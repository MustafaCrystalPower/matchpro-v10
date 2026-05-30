/**
 * Webhook Routes — /webhook/whatsapp, webhook processing logic
 */
const https = require('https');

/**
 * Auto-categorize a message text by Arabic+English keywords.
 * Returns: 'buy' | 'sell' | 'rent' | 'invest' | 'other'
 */
function categorizeMessage(text) {
  if (!text) return 'other';
  const t = text.toLowerCase();
  const KEYWORDS = {
    buy:    ['buy','purchase','شراء','عايز','أبحث','ابحث','محتاج','أريد','اريد','looking for','want to buy','need','للشراء'],
    sell:   ['sell','for sale','للبيع','بيع','عنده','عندي','متاح','available','listing','معروض'],
    rent:   ['rent','إيجار','ايجار','for rent','للإيجار','للايجار','lease','تأجير','تاجير'],
    invest: ['invest','استثمار','عائد','roi','return','investment','portfolio','فرصة','opportunity'],
  };
  for (const [cat, words] of Object.entries(KEYWORDS)) {
    if (words.some(w => t.includes(w))) return cat;
  }
  return 'other';
}

/**
 * Find best matching supply for an incoming demand signal.
 * Returns { score, supply } or null.
 */
function findBestMatch(db, category, messageText) {
  if (category === 'sell') return null; // seller → no demand match needed
  try {
    const d = db();
    const supplies = d.prepare('SELECT * FROM supply ORDER BY created_at DESC LIMIT 200').all();
    d.close();
    if (!supplies.length) return null;
    let best = null, bestScore = 0;
    for (const s of supplies) {
      let score = 0;
      // Simple heuristic scoring
      if (category === 'buy' && s.purpose && s.purpose.toLowerCase().includes('sale')) score += 40;
      if (category === 'rent' && s.purpose && s.purpose.toLowerCase().includes('rent')) score += 40;
      if (category === 'invest') score += 30;
      // Text overlap
      const msgWords = (messageText || '').toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const supplyText = ((s.raw_message || '') + ' ' + (s.location || '')).toLowerCase();
      const overlap = msgWords.filter(w => supplyText.includes(w)).length;
      score += Math.min(overlap * 5, 30);
      if (score > bestScore) { bestScore = score; best = s; }
    }
    return bestScore >= 70 ? { score: bestScore, supply: best } : null;
  } catch (e) {
    console.error('matchFinder error:', e.message);
    return null;
  }
}

/**
 * Send WhatsApp notification via Green API
 */
function sendWhatsApp(chatId, message) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ chatId, message });
    const url = 'https://7105.api.greenapi.com/waInstance7105409203/sendMessage/c678c910865246ca90eeb3d16867b5fa12a52bb37b4944db92';
    const req = https.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = (db) => {
  const router = require('express').Router();

  router.post('/webhook/whatsapp', (req, res) => {
    // Always respond 200 immediately
    res.status(200).json({ ok: true });

    // Process asynchronously
    setImmediate(async () => {
      try {
        const payload = req.body;
        // Green API webhook format
        const typeWebhook = payload.typeWebhook || '';
        // Support incomingMessageReceived or incomingMessage
        if (!['incomingMessageReceived', 'incomingMessage', 'outgoingMessageStatus'].includes(typeWebhook)) {
          if (typeWebhook) return; // Not a message event
        }

        const msgData = payload.messageData || payload.body || {};
        const senderData = payload.senderData || {};

        // Extract fields
        const senderPhone = (senderData.sender || senderData.chatId || payload.from || '').replace('@c.us', '').replace('@g.us', '');
        const senderName  = senderData.senderName || senderData.pushname || '';
        const textMsg     = msgData.textMessageData?.textMessage
                         || msgData.extendedTextMessageData?.text
                         || msgData.text
                         || (typeof payload.body === 'string' ? payload.body : '')
                         || '';
        const timestamp   = payload.timestamp ? new Date(payload.timestamp * 1000).toISOString() : new Date().toISOString();

        if (!textMsg) return; // No text to process

        const category = categorizeMessage(textMsg);
        const matchResult = findBestMatch(db, category, textMsg);
        const score = matchResult ? matchResult.score : 0;
        const matchedSupplyId = matchResult ? String(matchResult.supply.id) : null;

        // Store in webhook_leads
        const d = db(true);
        d.prepare(`INSERT INTO webhook_leads (phone, message, category, score, matched_supply_id, created_at)
                   VALUES (?, ?, ?, ?, ?, datetime('now'))`).run(senderPhone, textMsg.slice(0, 1000), category, score, matchedSupplyId);

        // Also store in messages table if not duplicate
        try {
          const extId = `webhook_${senderPhone}_${Date.now()}`;
          d.prepare(`INSERT OR IGNORE INTO messages (external_id, sender_phone, sender_name, body, timestamp, type, source)
                     VALUES (?, ?, ?, ?, ?, 'whatsapp_webhook', 'webhook')`).run(extId, senderPhone, senderName, textMsg.slice(0, 2000), timestamp);
        } catch (_) {}
        d.close();

        // Send notification if high-confidence match
        if (score >= 70 && matchResult) {
          const supply = matchResult.supply;
          const notifMsg = `🔔 *MatchPro v10 — Hot Lead Alert*\n\n` +
            `📱 From: ${senderName || senderPhone}\n` +
            `📝 Message: ${textMsg.slice(0, 200)}\n` +
            `🏷️ Category: ${category.toUpperCase()}\n` +
            `🎯 Match Score: ${score}/100\n\n` +
            `🏠 *Best Supply Match:*\n` +
            `• Location: ${supply.location || 'N/A'}\n` +
            `• Price: ${supply.price || 'N/A'} ${supply.price_unit || 'EGP'}\n` +
            `• Type: ${supply.property_type || 'N/A'}\n` +
            `• Contact: ${supply.sender_phone || 'N/A'}\n\n` +
            `⏰ ${new Date().toISOString()}`;
          try {
            await sendWhatsApp('201066505665@c.us', notifMsg);
            console.log(`✅ Hot lead notification sent for ${senderPhone} (score: ${score})`);
          } catch (e) {
            console.error('WhatsApp notify error:', e.message);
          }
        }

        console.log(`📱 Webhook: ${senderPhone} | cat:${category} | score:${score} | match:${matchedSupplyId || 'none'}`);
      } catch (e) {
        console.error('Webhook processing error:', e.message);
      }
    });
  });

  return router;
};
