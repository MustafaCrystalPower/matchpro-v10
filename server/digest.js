/**
 * MatchPro Email Digest Service v2
 * Sends 3-sheet Excel report every 6 hours to mmaisara@crystalpowerinvestment.com
 *
 * Sheet A — VIP High Matches (مدينتي + الرحاب, Villa demands → top supply)
 * Sheet B — MatchPro Full Analysis (all locations, supply + demand)
 * Sheet C — Brokers Demand List (demand only, supply match encrypted)
 *
 * After successful send: demand entries are moved to demand_archive table.
 * Supply entries are NEVER touched (permanent inventory).
 *
 * Owner: Mo'men Hisham Maisara / Crystal Power Investments
 */

const path    = require('path');
const fs      = require('fs');
const { execSync } = require('child_process');
const { v4: uuidv4 } = require('uuid');

let _db = null;

const SCRIPT_PATH = path.join(__dirname, '../scripts/export_digest_sheets.py');
const TMP_DIR     = '/tmp';

// ── Init ─────────────────────────────────────────────────────────────────────
function init(db) {
  _db = db;

  // Ensure digested_at column exists on demand (legacy compat)
  try { _db.exec('ALTER TABLE demand ADD COLUMN digested_at DATETIME'); } catch {}

  // Ensure demand_archive table exists
  _db.exec(`
    CREATE TABLE IF NOT EXISTS demand_archive (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      original_id INTEGER,
      external_id TEXT,
      message_id INTEGER,
      sender_phone TEXT,
      sender_name TEXT,
      group_name TEXT,
      location TEXT,
      area TEXT,
      city TEXT,
      property_type TEXT,
      purpose TEXT,
      price_min REAL,
      price_max REAL,
      bedrooms INTEGER,
      size_min REAL,
      size_max REAL,
      confidence REAL,
      raw_message TEXT,
      original_message TEXT,
      digested_at DATETIME,
      location_cluster TEXT,
      created_at DATETIME,
      archived_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      digest_id TEXT
    )
  `);
  try { _db.exec('CREATE INDEX IF NOT EXISTS idx_demand_archive_digest ON demand_archive(digest_id)'); } catch {}
  try { _db.exec('CREATE INDEX IF NOT EXISTS idx_demand_archive_archived ON demand_archive(archived_at DESC)'); } catch {}

  scheduleDigest();
  console.log('📧 Digest service v2 started — runs every 6 hours (3-sheet Excel)');
}

// ── Stats helpers ─────────────────────────────────────────────────────────────
function getStats(sinceHours = 6) {
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString();
  const activeDemand = _db.prepare(`
    SELECT COUNT(*) as c FROM demand
    WHERE (digested_at IS NULL OR digested_at = '')
  `).get().c;
  const newSupply = _db.prepare(`SELECT COUNT(*) as c FROM supply WHERE created_at >= ?`).get(since).c;
  const newDemand = _db.prepare(`
    SELECT COUNT(*) as c FROM demand
    WHERE created_at >= ?
      AND (digested_at IS NULL OR digested_at = '')
  `).get(since).c;
  const matches = _db.prepare(`
    SELECT COUNT(*) as c FROM matches WHERE created_at >= ? AND match_score >= 60
  `).get(since).c || 0;
  return { activeDemand, newSupply, newDemand, matches, since };
}

// ── Generate Excel workbook via Python script ─────────────────────────────────
function generateExcel(digestId) {
  const outPath = path.join(TMP_DIR, `matchpro_digest_${digestId}.xlsx`);
  const env = Object.assign({}, process.env); // pass REPORT_ENCRYPT_KEY through

  const output = execSync(
    `python3 "${SCRIPT_PATH}" "${outPath}"`,
    { encoding: 'utf8', timeout: 120000, env }
  );
  console.log('[digest] Excel output:', output.trim().split('\n').slice(0, -1).join('\n'));

  if (!fs.existsSync(outPath)) {
    throw new Error(`Excel file not created at ${outPath}`);
  }
  return outPath;
}

// ── Archive demand entries that were in this digest ───────────────────────────
function archiveDemands(digestId) {
  // Fetch all active (un-digested) demand entries
  const demands = _db.prepare(`
    SELECT * FROM demand
    WHERE digested_at IS NULL OR digested_at = ''
  `).all();

  if (!demands.length) return 0;

  const insertArch = _db.prepare(`
    INSERT INTO demand_archive
      (original_id, external_id, message_id, sender_phone, sender_name, group_name,
       location, area, city, property_type, purpose, price_min, price_max, bedrooms,
       size_min, size_max, confidence, raw_message, original_message, digested_at,
       location_cluster, created_at, archived_at, digest_id)
    VALUES
      (@original_id, @external_id, @message_id, @sender_phone, @sender_name, @group_name,
       @location, @area, @city, @property_type, @purpose, @price_min, @price_max, @bedrooms,
       @size_min, @size_max, @confidence, @raw_message, @original_message, @digested_at,
       @location_cluster, @created_at, CURRENT_TIMESTAMP, @digest_id)
  `);

  const archiveMany = _db.transaction((rows) => {
    for (const d of rows) {
      insertArch.run({
        original_id:      d.id,
        external_id:      d.external_id || null,
        message_id:       d.message_id || null,
        sender_phone:     d.sender_phone || null,
        sender_name:      d.sender_name || null,
        group_name:       d.group_name || null,
        location:         d.location || null,
        area:             d.area || null,
        city:             d.city || null,
        property_type:    d.property_type || null,
        purpose:          d.purpose || null,
        price_min:        d.price_min || null,
        price_max:        d.price_max || null,
        bedrooms:         d.bedrooms || null,
        size_min:         d.size_min || null,
        size_max:         d.size_max || null,
        confidence:       d.confidence || null,
        raw_message:      d.raw_message || null,
        original_message: d.original_message || null,
        digested_at:      new Date().toISOString(),
        location_cluster: d.location_cluster || null,
        created_at:       d.created_at || null,
        digest_id:        digestId,
      });
    }
  });

  archiveMany(demands);

  // Mark originals as digested (keep rows so legacy queries don't break, but they're now
  // excluded from active /api/demand because of the digested_at filter)
  const ids = demands.map(d => d.id).join(',');
  _db.exec(`UPDATE demand SET digested_at = CURRENT_TIMESTAMP WHERE id IN (${ids})`);

  console.log(`[digest] 🗄  Archived ${demands.length} demand entries → digest_id=${digestId}`);
  return demands.length;
}

// ── Send the 3-sheet Excel via gsk vm_email ───────────────────────────────────
async function sendDigest(sinceHours = 6) {
  if (!_db) return { ok: false, error: 'DB not initialized' };

  const digestId = uuidv4().split('-')[0].toUpperCase(); // short 8-char ID
  const to       = process.env.DIGEST_EMAIL_TO || 'mmaisara@crystalpowerinvestment.com';
  const now      = new Date().toLocaleDateString('en-GB');
  const stats    = getStats(sinceHours);

  console.log(`[digest] Starting digest run — id=${digestId}`);
  console.log(`[digest] Stats: ${stats.newDemand} new demand / ${stats.newSupply} new supply / ${stats.matches} matches`);

  // ── 1. Generate Excel ──────────────────────────────────────────────────────
  let xlsxPath;
  try {
    xlsxPath = generateExcel(digestId);
    console.log(`[digest] Excel generated: ${xlsxPath}`);
  } catch (err) {
    console.error('[digest] ❌ Excel generation failed:', err.message);
    return { ok: false, error: `Excel generation failed: ${err.message}` };
  }

  // ── 2. Build email body with real lead data (FIXED) ───────────────────────────
  // Classification signals to identify real buyers vs supply listings
  const DSIGS = ['مطلوب ضروري','مطلوب ضرورى','urgent request','very urgent request','محتاج','محتاجة','بدور','بدورة','عايز','عايزة','want to buy','want to rent','عميل عنده','عندي عميل','لديه عميل','لدي عميل','في إيده','في ايده','عميل جاهز','مشتري جاهز','client ready','client needs','client looking','client has','my client','looking for','needed','i need','we need','طالب','طالبة'];
  const SSIGS = ['للبيع','للإيجار','للايجار','للتمليك','متاح','داتا','down payment','downpayment','total price','bua:','land area','resale','for sale','for rent','fully finished','fully furnished','immediate delivery','dubizzle','مقدم','استلام فوري','تشطيب','يوجد','يتوفر','من المالك'];
  function digestIsRealBuyer(row) {
    const m = (row.raw_message || row.original_message || '').toLowerCase();
    if (m.includes('داتا')) return false;
    let d = DSIGS.filter(s => m.includes(s.toLowerCase())).length;
    let s = SSIGS.filter(s => m.includes(s.toLowerCase())).length;
    if (/مطلوب\s+[\d,\.]+\s*(مليون|الف|ألف)/.test(m)) { s += 2; d = Math.max(0, d-2); }
    if (/^مطلوب\s+(?![\d,\.]+\s*(مليون|الف))/.test(m.trim())) { d += 2; }
    if (s > d && s >= 1) return false;
    return true;
  }
  // Get top HOT leads for email body
  let hotLeadsSection = '';
  let realBuyerCount = 0;
  try {
    const recent = _db.prepare(`SELECT id, sender_name, sender_phone, location, location_cluster, price_max, price_min, bedrooms, raw_message, created_at FROM demand WHERE (digested_at IS NULL OR digested_at='') AND created_at >= datetime('now', '-6 hours') ORDER BY created_at DESC LIMIT 300`).all();
    const realBuyers = recent.filter(digestIsRealBuyer);
    realBuyerCount = realBuyers.length;
    const hot = realBuyers.filter(r => {
      let sc = 0;
      if (r.price_max > 0) sc += 3; else if (r.price_min > 0) sc += 1;
      if (r.bedrooms > 0) sc += 1;
      if (r.sender_phone) sc += 2;
      if ((r.raw_message||'').length > 50) sc += 1;
      return sc >= 5;
    }).slice(0, 5);
    if (hot.length > 0) {
      const lines = hot.map((r,i) => {
        const phone = (r.sender_phone||'').replace(/@c\.us$/,'');
        const loc = r.location || r.location_cluster || '?';
        const budget = r.price_max ? `${(r.price_max/1e6).toFixed(1)}M EGP` : '—';
        const msg = (r.raw_message||'').substring(0,100).replace(/[\n\r]+/g,' ');
        return `  ${i+1}. ${r.sender_name||'?'} | ${phone} | ${loc} | ${budget}\n     ${msg}`;
      });
      hotLeadsSection = `\n\n\ud83d\udd25 TOP ${hot.length} HOT LEADS (real buyers):\n` + lines.join('\n');
    } else {
      hotLeadsSection = `\n\n\u2705 ${realBuyers.length} real buyers in last 6h (${recent.length - realBuyers.length} supply records filtered out)`;
    }
  } catch(e) {
    hotLeadsSection = '';
  }
  const subject = `\ud83d\udcca MatchPro Digest [${digestId}] \u2014 ${stats.newDemand} total, ${realBuyerCount || '?'} real buyers \u00b7 ${stats.newSupply} supply (${now})`;
  const body = [
    `# MatchPro Digest Report \u2014 ${now}  [ID: ${digestId}]`,
    '',
    `\u26a0\ufe0f CLASSIFICATION FIX ACTIVE: supply listings removed from buyer reports`,
    '',
    `- \ud83d\udccb ${stats.newDemand} raw demand records (incl. misclassified supply)`,
    `- \ud83d\udce6 ${stats.newSupply} new supply listings`,
    `- \ud83c\udfaf ${stats.matches} AI matches (score \u2265 60%)`,
    '',
    'Attached: 3-sheet Excel report',
    '  \u2022 Sheet A \u2014 VIP High Matches (\u0645\u062f\u064a\u0646\u062a\u064a / \u0627\u0644\u0631\u062d\u0627\u0628 villas)',
    '  \u2022 Sheet B \u2014 MatchPro Full Analysis (all locations)',
    '  \u2022 Sheet C \u2014 Brokers Demand List (encrypted supply refs)',
    `Dashboard: ${process.env.WEBHOOK_PUBLIC_URL || 'https://maisaramoamen-9d4a3b2f-4305-vm.westcentralus.cloudapp.azure.com:8999'}`,
  ].join('\\n') + hotLeadsSection.replace(/\n/g, '\\n');

  // ── 3. Upload Excel → get link → send via gsk vm_email ─────────────────────
  try {
    // Upload Excel to get a download link
    let downloadUrl = null;
    try {
      const uploadOut = execSync(`gsk upload "${xlsxPath}"`, { encoding: 'utf8', timeout: 60000, env: process.env });
      try { downloadUrl = JSON.parse(uploadOut)?.data?.file_wrapper_url || null; } catch {}
    } catch(uploadErr) {
      console.warn('[digest] Upload failed, sending without link');
    }

    const downloadLine = downloadUrl
      ? `\n\n📥 Download Excel Report:\n${downloadUrl}\n\n(contains VIP Matches + Full Analysis + Brokers List)`
      : '\n\n[Excel generated — check /api/digest/preview for data]';

    const subjectSafe = subject.replace(/"/g, "'");
    const bodySafe    = (body + downloadLine).replace(/"/g, "'").replace(/\n/g, '\\n');
    const cmd = `gsk vm_email send ${to} -s "${subjectSafe}" -b "${bodySafe}" -f "$OPENCLAW_VM_NAME"`;
    const result = execSync(cmd, { encoding: 'utf8', timeout: 60000, env: process.env });

    let messageId = 'sent';
    try { messageId = JSON.parse(result)?.data?.message_id || 'sent'; } catch {}

    // ── 4. Archive demand entries ──────────────────────────────────────────
    const archivedCount = archiveDemands(digestId);

    // ── 5. Cleanup temp file ───────────────────────────────────────────────
    try { fs.unlinkSync(xlsxPath); } catch {}

    console.log(`[digest] ✅ Sent via gsk to ${to} — ${stats.newDemand} demands archived=${archivedCount} id=${digestId}`);
    return { ok: true, digestId, total: stats.newDemand, archivedCount, messageId };

  } catch (err) {
    console.error('[digest] ❌ gsk send failed:', err.message?.substring(0, 300));

    // ── Fallback: SMTP with attachment ────────────────────────────────────
    if (process.env.SMTP_USER && process.env.SMTP_PASS &&
        process.env.SMTP_PASS !== 'REPLACE_WITH_APP_PASSWORD') {
      try {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
          host:   process.env.SMTP_HOST || 'smtp.gmail.com',
          port:   parseInt(process.env.SMTP_PORT || '587'),
          secure: parseInt(process.env.SMTP_PORT || '587') === 465,
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
          tls:  { rejectUnauthorized: false },
        });

        const mailRes = await transporter.sendMail({
          from:        `"MatchPro Platform" <${process.env.SMTP_USER}>`,
          to,
          subject,
          text:        body.replace(/\\n/g, '\n'),
          attachments: [{ filename: path.basename(xlsxPath), path: xlsxPath }],
        });

        const archivedCount = archiveDemands(digestId);
        try { fs.unlinkSync(xlsxPath); } catch {}
        console.log(`[digest] ✅ Sent via SMTP fallback to ${to} — archived=${archivedCount}`);
        return { ok: true, digestId, total: stats.newDemand, archivedCount, messageId: mailRes.messageId };
      } catch (smtpErr) {
        try { fs.unlinkSync(xlsxPath); } catch {}
        return { ok: false, error: smtpErr.message, digestId };
      }
    }

    // ── Fallback 2: WhatsApp via Green API ─────────────────────────────────
    try {
      const https = require('https');
      const FormData = require('form-data') || null;
      const waBase = 'https://7105.api.greenapi.com/waInstance7105409203';
      const waToken = '0e7ca429980f4331ae5fee4360c955a9db2d6fe3ca6545a4b3';
      const waChatId = '201066505665@c.us';

      // Upload file via Green API
      const fileStream = fs.createReadStream(xlsxPath);
      const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
      const fileContent = fs.readFileSync(xlsxPath);
      const fileName = path.basename(xlsxPath);

      const postData = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="chatId"\r\n\r\n${waChatId}\r\n`),
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\n${subject}\r\n`),
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`),
        fileContent,
        Buffer.from(`\r\n--${boundary}--\r\n`)
      ]);

      const waResult = execSync(`curl -s -X POST '${waBase}/sendFileByUpload/${waToken}' -F 'chatId=${waChatId}' -F 'caption=${subject.replace(/'/g, "'\\''")}' -F 'file=@${xlsxPath};type=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'`, {
        encoding: 'utf8', timeout: 60000
      });

      const archivedCount = archiveDemands(digestId);
      try { fs.unlinkSync(xlsxPath); } catch {}
      console.log(`[digest] ✅ Sent via WhatsApp to Mo'men — id=${digestId}`);
      return { ok: true, digestId, total: stats.newDemand, archivedCount, messageId: 'whatsapp' };
    } catch (waErr) {
      console.error('[digest] ❌ WhatsApp send also failed:', waErr.message?.substring(0, 200));
    }

    try { fs.unlinkSync(xlsxPath); } catch {}
    return { ok: false, error: err.message, digestId };
  }
}

// ── Schedule ──────────────────────────────────────────────────────────────────
function scheduleDigest() {
  const intervalMs = (parseFloat(process.env.DIGEST_INTERVAL_HOURS) || 6) * 60 * 60 * 1000;
  setInterval(async () => {
    console.log('[digest] Running scheduled digest...');
    const result = await sendDigest();
    console.log('[digest] Result:', JSON.stringify(result));
  }, intervalMs);
  console.log(`[digest] Scheduled every ${intervalMs / 3600000}h`);
}

// ── Dashboard preview (no file write) ────────────────────────────────────────
function getDigestPreview(sinceHours = 6) {
  if (!_db) return null;
  const stats = getStats(sinceHours);

  // Build grouped summary for preview (HTML table)
  const demands = _db.prepare(`
    SELECT location, purpose, property_type, sender_name, sender_phone,
           price_max, bedrooms, created_at
    FROM demand
    WHERE (digested_at IS NULL OR digested_at = '')
    ORDER BY location, purpose, created_at DESC
    LIMIT 200
  `).all();

  const grouped = {};
  for (const d of demands) {
    const loc     = d.location || 'غير محدد';
    const purpose = d.purpose === 'rent' ? 'For Rent' : d.purpose === 'sale' ? 'For Sale' : 'General';
    const type    = d.property_type || 'Any';
    if (!grouped[loc]) grouped[loc] = {};
    if (!grouped[loc][purpose]) grouped[loc][purpose] = {};
    if (!grouped[loc][purpose][type]) grouped[loc][purpose][type] = [];
    grouped[loc][purpose][type].push({
      name:     d.sender_name || 'Unknown',
      phone:    d.sender_phone || '—',
      budget:   d.price_max ? `${(d.price_max/1e6).toFixed(1)}M EGP` : '—',
      bedrooms: d.bedrooms || '—',
      time:     d.created_at,
    });
  }

  return {
    stats,
    grouped,
    locations: Object.keys(grouped),
    html: `<pre>Preview: ${stats.newDemand} active demands · ${stats.newSupply} new supply</pre>`,
  };
}

module.exports = { init, sendDigest, getDigestPreview, scheduleDigest };
