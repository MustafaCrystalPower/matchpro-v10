/**
 * MatchPro™ Standalone Sender
 * Sends Excel report via Green API — no external subscriptions
 * Uses multipart upload + sendFileByUpload
 */
const fs = require('fs');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
const FormData = require('form-data');
const cfg = require('./config');

async function sendFileToChat(chatId, filePath, caption) {
  try {
    const form = new FormData();
    form.append('chatId', chatId);
    form.append('caption', caption || '');
    form.append('fileName', path.basename(filePath));
    form.append('file', fs.createReadStream(filePath), {
      filename: path.basename(filePath),
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const res = await fetch(
      `${cfg.WA_API}/sendFileByUpload/${cfg.WA_TOKEN}`,
      { method: 'POST', body: form, headers: form.getHeaders() }
    );
    const data = await res.json();
    return data.idMessage || null;
  } catch (e) {
    console.error('[SENDER] Upload failed:', e.message);
    return null;
  }
}

async function sendTextToChat(chatId, message) {
  try {
    const res = await fetch(`${cfg.WA_API}/sendMessage/${cfg.WA_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, message })
    });
    const data = await res.json();
    return data.idMessage || null;
  } catch (e) {
    console.error('[SENDER] Text failed:', e.message);
    return null;
  }
}

async function deliverReport(reportInfo) {
  const { path: fpath, name, dCount, sCount, mCount } = reportInfo;
  const now = new Date().toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' });

  const caption =
`📊 *MatchPro™ Intelligence Report*
🕐 ${now}

📋 Demand: ${dCount} طلب
🏠 Supply: ${sCount} عرض
🔗 Matches (≥80%): ${mCount}

5 شيتات: Demand | Supply | Matches | Insights | By Area

─────────────────────
💡 *لمن هذه البيانات؟*
• المطور العقاري → يعرف أين يبني وبكم
• المستثمر → يدخل قبل الجميع
• شركة الوساطة → طلبات جاهزة اليوم
• الباحث → مؤشرات حقيقية مش تقديرية

💰 *قيمة البيانات: 1,000–10,000 USD/شهر*
─────────────────────
🔒 تقرير حصري — MatchPro™`;

  console.log(`[SENDER] Sending to Mo'men...`);
  const id1 = await sendFileToChat(cfg.MOMEN_CHAT, fpath, caption);
  console.log(`[SENDER] Mo'men: ${id1 || 'FAILED'}`);

  await new Promise(r => setTimeout(r, 3000));

  console.log(`[SENDER] Sending to Intel Group...`);
  const id2 = await sendFileToChat(cfg.INTEL_GROUP, fpath, caption);
  console.log(`[SENDER] Intel Group: ${id2 || 'FAILED'}`);

  // Clean up temp file
  try { fs.unlinkSync(fpath); } catch(e) {}

  return { momen: id1, group: id2 };
}

module.exports = { sendFileToChat, sendTextToChat, deliverReport };
