/**
 * MatchPro Secure Report Portal
 * OTP-gated demand viewer with contact masking, watermark, screenshot prevention
 * 
 * Flow:
 *   1. Cron generates report → stores in DB → sends WA message with link + PIN
 *   2. Broker opens link → enters PIN → sees masked demand table
 *   3. Phone numbers shown as ****XXXX, full number on WA-click only
 *   4. Watermark overlaid with group name + timestamp
 *   5. Links expire after 6 hours, PINs after 15 minutes
 * 
 * © Crystal Power Investments — Confidential
 */

const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');

// ── Constants ─────────────────────────────────────────────────────────────────
const REPORT_TTL_MS  = 6  * 60 * 60 * 1000; // 6 hours
const OTP_TTL_MS     = 15 * 60 * 1000;       // 15 minutes
const SECRET         = process.env.REPORT_ENCRYPT_KEY || 'cpi-matchpro-enc-2026-xk9z';

// ── DB schema ─────────────────────────────────────────────────────────────────
function ensureSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS report_sessions (
      id       TEXT PRIMARY KEY,          -- report token (URL param)
      group_id TEXT NOT NULL,             -- WA group chat ID
      group_loc TEXT NOT NULL,            -- location name (Arabic)
      otp_hash  TEXT NOT NULL,            -- bcrypt/sha256 of 6-digit PIN
      otp_plain TEXT,                     -- stored plain for WA delivery (cleared after send)
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      otp_expires_at DATETIME NOT NULL,
      accessed_at DATETIME,
      access_count INTEGER DEFAULT 0,
      row_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active'        -- active / expired / accessed
    );
    CREATE INDEX IF NOT EXISTS idx_report_token ON report_sessions(id);

    CREATE TABLE IF NOT EXISTS report_access_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id TEXT,
      ip TEXT,
      user_agent TEXT,
      accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      success INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_report_log ON report_access_log(report_id);
  `);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function genOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function hashOTP(otp) {
  return crypto.createHmac('sha256', SECRET).update(otp).digest('hex');
}

function maskPhone(phone) {
  if (!phone) return '—';
  const clean = String(phone).replace(/@c\.us$/, '').replace(/[^0-9+]/g, '');
  if (clean.length < 4) return '****';
  return '****' + clean.slice(-4);
}

function createReport(db, group) {
  const token = crypto.randomBytes(20).toString('hex');
  const otp   = genOTP();
  const now   = new Date();
  const exp   = new Date(now.getTime() + REPORT_TTL_MS);
  const otpExp = new Date(now.getTime() + OTP_TTL_MS);

  // Fetch demand rows for this location
  const locKeywords = group.keywords || [group.loc];
  const whereParts  = locKeywords.map(() => `(location LIKE ? OR location_cluster LIKE ?)`).join(' OR ');
  const params      = locKeywords.flatMap(k => [`%${k}%`, `%${k}%`]);

  const rows = db.prepare(`
    SELECT id, sender_name, sender_phone, location, property_type, purpose,
           price_min, price_max, bedrooms, size_min, size_max,
           raw_message, created_at
    FROM demand
    WHERE (digested_at IS NULL OR digested_at='')
      AND (${whereParts})
    ORDER BY created_at DESC
    LIMIT 500
  `).all(...params);

  // Serialize rows as JSON in the DB (avoid separate table for simplicity)
  const rowJson = JSON.stringify(rows);
  const rowHash = crypto.createHmac('sha256', SECRET).update(rowJson).digest('hex').slice(0,8);

  db.prepare(`
    INSERT INTO report_sessions (id, group_id, group_loc, otp_hash, otp_plain, expires_at, otp_expires_at, row_count)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(token, group.id, group.loc, hashOTP(otp), otp, exp.toISOString(), otpExp.toISOString(), rows.length);

  // Store rows in a temp file (cleaner than DB JSON)
  const dataDir = path.join(__dirname, '../data/reports');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, `${token}.json`), rowJson, 'utf8');

  return { token, otp, rowCount: rows.length, group };
}

function getReportData(db, token) {
  const session = db.prepare('SELECT * FROM report_sessions WHERE id=?').get(token);
  if (!session) return null;
  if (new Date(session.expires_at) < new Date()) return { expired: true };

  const dataPath = path.join(__dirname, '../data/reports', `${token}.json`);
  if (!fs.existsSync(dataPath)) return { expired: true };

  let rows = [];
  try { rows = JSON.parse(fs.readFileSync(dataPath, 'utf8')); } catch {}
  return { session, rows };
}

// ── Secure report viewer HTML ─────────────────────────────────────────────────
function renderReportPage(session, rows, locName) {
  const now      = new Date().toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' });
  const totalSale = rows.filter(r => r.purpose === 'sale').length;
  const totalRent = rows.filter(r => r.purpose === 'rent').length;
  const totalApts  = rows.filter(r => (r.property_type||'').includes('apartment')).length;
  const totalVillas= rows.filter(r => (r.property_type||'').includes('villa')).length;

  // Build masked table rows
  const tableRows = rows.map((r, i) => {
    const masked  = maskPhone(r.sender_phone);
    const clean   = (r.sender_phone || '').replace(/@c\.us$/,'').replace(/[^0-9]/g,'');
    const wa      = clean ? `https://wa.me/${clean}` : '#';
    const budget  = r.price_max ? (r.price_max/1e6).toFixed(1)+'M' : r.price_min ? (r.price_min/1e6).toFixed(1)+'M+' : '—';
    const purpose = r.purpose==='sale'?'🏷️ بيع':r.purpose==='rent'?'🔑 إيجار':'—';
    const type    = r.property_type||'—';
    const date    = r.created_at ? new Date(r.created_at).toLocaleDateString('ar-EG',{timeZone:'Africa/Cairo'}) : '—';
    const msg     = (r.raw_message||'').substring(0,80).replace(/</g,'&lt;').replace(/>/g,'&gt;');

    return `<tr>
      <td style="text-align:center;color:#8899bb;font-size:10px">${i+1}</td>
      <td><b>${(r.sender_name||'—').replace(/</g,'&lt;')}</b></td>
      <td style="direction:ltr;text-align:center">
        <span class="masked-phone">${masked}</span>
        ${clean ? `<a href="${wa}" target="_blank" class="wa-btn" data-phone="${clean}">📱 WA</a>` : ''}
      </td>
      <td>${(r.location||'—').replace(/</g,'&lt;')}</td>
      <td>${type}</td>
      <td style="text-align:center">${purpose}</td>
      <td style="text-align:center;color:#22c55e;font-weight:700">${budget}</td>
      <td style="text-align:center">${r.bedrooms||'—'}</td>
      <td style="direction:rtl;font-size:11px;color:#8899bb;max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${msg}</td>
      <td style="font-size:10px;color:#8899bb">${date}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>MatchPro™ — ${locName}</title>
<meta name="robots" content="noindex,nofollow">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--gold:#c9a227;--dark:#07111f;--card:#0c1a2e;--gray:#8899bb;--green:#22c55e;--blue:#3b82f6;--border:rgba(201,162,39,.18)}
body{background:var(--dark);color:#eef2ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:13px;min-height:100vh;direction:rtl}

/* ─── Screenshot prevention ─── */
body{-webkit-user-select:none;-moz-user-select:none;user-select:none}
@media print{body{display:none!important}}
.no-print{display:block}

/* ─── Watermark ─── */
#watermark{position:fixed;inset:0;pointer-events:none;z-index:9999;opacity:.06;display:flex;align-items:center;justify-content:center;transform:rotate(-30deg);font-size:clamp(16px,4vw,28px);font-weight:900;color:#c9a227;text-align:center;white-space:pre-line;letter-spacing:2px}

/* ─── Header ─── */
.hdr{background:linear-gradient(135deg,var(--card),var(--dark));padding:16px 20px;border-bottom:2px solid var(--gold);display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:100}
.hdr-title{font-size:18px;font-weight:800;color:var(--gold)}
.hdr-sub{font-size:11px;color:var(--gray);margin-top:3px}
.badge{background:rgba(201,162,39,.15);border:1px solid var(--border);border-radius:20px;padding:4px 12px;font-size:11px;color:var(--gold);font-weight:700}

/* ─── Stats row ─── */
.stats{display:flex;gap:10px;padding:14px 16px;flex-wrap:wrap}
.stat{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:10px 16px;text-align:center;flex:1;min-width:90px}
.stat-num{font-size:22px;font-weight:800}
.stat-lbl{font-size:10px;color:var(--gray);margin-top:2px;letter-spacing:.5px;text-transform:uppercase}

/* ─── Table ─── */
.tbl-wrap{overflow-x:auto;padding:0 12px 16px}
table{width:100%;border-collapse:collapse;font-size:12px}
thead th{background:var(--gold);color:#07111f;padding:8px 10px;font-weight:700;white-space:nowrap;text-align:center;position:sticky;top:56px}
tbody tr{border-bottom:1px solid rgba(255,255,255,.05)}
tbody tr:hover{background:rgba(201,162,39,.05)}
tbody td{padding:8px 10px;vertical-align:middle}
tbody tr:nth-child(even){background:rgba(12,26,46,.6)}

/* ─── WA button ─── */
.wa-btn{display:inline-block;background:rgba(34,197,94,.15);color:#22c55e;border:1px solid rgba(34,197,94,.3);padding:2px 8px;border-radius:5px;font-size:10px;text-decoration:none;font-weight:700;margin-right:4px;cursor:pointer}
.wa-btn:hover{background:rgba(34,197,94,.25)}

/* ─── Footer ─── */
.ftr{background:var(--card);border-top:1px solid rgba(255,255,255,.07);padding:12px 20px;font-size:10px;color:var(--gray);text-align:center;margin-top:20px}

/* ─── Context menu block ─── */
</style>
</head>
<body>

<div id="watermark">MatchPro™\nCrystal Power\n${locName}\n${now}</div>

<div class="hdr">
  <div>
    <div class="hdr-title">📊 MatchPro™ — ${locName}</div>
    <div class="hdr-sub">🕐 ${now} (القاهرة) · ${rows.length} طلب نشط</div>
  </div>
  <div class="badge">🔐 محمي</div>
</div>

<div class="stats">
  <div class="stat"><div class="stat-num" style="color:var(--gold)">${rows.length}</div><div class="stat-lbl">إجمالي الطلبات</div></div>
  <div class="stat"><div class="stat-num" style="color:var(--green)">${totalSale}</div><div class="stat-lbl">للبيع</div></div>
  <div class="stat"><div class="stat-num" style="color:var(--blue)">${totalRent}</div><div class="stat-lbl">للإيجار</div></div>
  <div class="stat"><div class="stat-num" style="color:#a78bfa">${totalApts}</div><div class="stat-lbl">شقق</div></div>
  <div class="stat"><div class="stat-num" style="color:#fb923c">${totalVillas}</div><div class="stat-lbl">فيلل</div></div>
</div>

<div class="tbl-wrap">
  <table>
    <thead>
      <tr>
        <th>#</th><th>الاسم</th><th>التواصل</th><th>المنطقة</th><th>النوع</th><th>الغرض</th><th>الميزانية</th><th>غرف</th><th>الرسالة</th><th>التاريخ</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
</div>

<div class="ftr">
  MatchPro™ Intelligence Engine · Crystal Power Investments © ${new Date().getFullYear()}<br>
  هذا التقرير سري ومخصص للمجموعة المحددة فقط · ⛔ لا تشارك هذا الرابط
</div>

<script>
// Block right-click
document.addEventListener('contextmenu', e => e.preventDefault());
// Block F12, Ctrl+Shift+I, Ctrl+U, etc.
document.addEventListener('keydown', e => {
  if (e.key==='F12' || (e.ctrlKey&&e.shiftKey&&['I','J','C'].includes(e.key)) || (e.ctrlKey&&e.key==='U') || (e.ctrlKey&&e.key==='S')) {
    e.preventDefault(); e.stopPropagation();
  }
});
// Blur on visibility change (tab switch = potential screenshot)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) document.body.style.filter='blur(12px)';
  else document.body.style.filter='';
});
// DevTools detection (basic)
(function devToolsCheck(){
  const t = new Image();
  Object.defineProperty(t,'id',{get(){document.body.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#07111f;color:#ef4444;font-size:18px;font-weight:700">⛔ Developer tools detected</div>';}});
  setInterval(()=>{console.log(t);console.clear();},2000);
})();
</script>
</body>
</html>`;
}

// ── OTP entry page ────────────────────────────────────────────────────────────
function renderOTPPage(token, locName, error) {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>MatchPro™ — الدخول</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#07111f;color:#eef2ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}
.card{background:#0c1a2e;border:1px solid rgba(201,162,39,.25);border-radius:16px;padding:36px 32px;width:100%;max-width:380px;text-align:center}
.logo{font-size:36px;margin-bottom:12px}
.title{font-size:20px;font-weight:800;color:#c9a227;margin-bottom:4px}
.sub{font-size:12px;color:#8899bb;margin-bottom:28px}
.loc{background:rgba(201,162,39,.1);border:1px solid rgba(201,162,39,.2);border-radius:8px;padding:8px 16px;margin-bottom:24px;font-size:14px;font-weight:700;color:#c9a227}
label{display:block;font-size:11px;color:#8899bb;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;text-align:right}
input{width:100%;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:14px;color:#eef2ff;font-size:20px;letter-spacing:8px;text-align:center;font-weight:700;transition:.2s;direction:ltr}
input:focus{outline:none;border-color:#c9a227;background:rgba(201,162,39,.05)}
.btn{width:100%;background:linear-gradient(135deg,#c9a227,#e8c547);color:#07111f;border:none;border-radius:9px;padding:14px;font-size:15px;font-weight:800;cursor:pointer;margin-top:16px;letter-spacing:.3px}
.btn:hover{opacity:.9}
.btn:disabled{opacity:.5}
.err{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:8px;padding:10px;margin-top:12px;font-size:12px;color:#f87171;display:${error?'block':'none'}}
.hint{font-size:11px;color:#8899bb;margin-top:16px}
.exp{font-size:10px;color:#3a5070;margin-top:8px}
</style>
</head>
<body>
<div class="card">
  <div class="logo">🏙️</div>
  <div class="title">MatchPro™</div>
  <div class="sub">Crystal Power Investments</div>
  <div class="loc">📍 ${locName}</div>
  <label>الرقم السري (PIN)</label>
  <input type="tel" id="otp" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="• • • • • •" autocomplete="off" autofocus>
  <button class="btn" onclick="verify()">🔐 دخول</button>
  <div class="err" id="err">${error||'كود غير صحيح أو منتهي الصلاحية'}</div>
  <div class="hint">أدخل الرقم السري المرسل إليك عبر واتساب</div>
  <div class="exp">⏰ الكود صالح لمدة 15 دقيقة</div>
</div>
<script>
function verify(){
  const otp=document.getElementById('otp').value.trim();
  if(otp.length!==6){document.getElementById('err').style.display='block';document.getElementById('err').textContent='أدخل 6 أرقام';return;}
  const btn=document.querySelector('.btn');btn.disabled=true;btn.textContent='جاري التحقق...';
  fetch('/report/${token}/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({otp})})
    .then(r=>r.json())
    .then(d=>{
      if(d.ok){window.location.href='/report/${token}/view?s='+d.session;}
      else{document.getElementById('err').textContent=d.error||'كود غير صحيح';document.getElementById('err').style.display='block';btn.disabled=false;btn.textContent='🔐 دخول';}
    }).catch(()=>{btn.disabled=false;btn.textContent='🔐 دخول';});
}
document.getElementById('otp').addEventListener('keydown',e=>{if(e.key==='Enter')verify();});
</script>
</body>
</html>`;
}

// ── Init (register routes) ────────────────────────────────────────────────────
function init(app, db) {
  ensureSchema(db);

  // GET /report/:token — OTP entry page
  app.get('/report/:token', (req, res) => {
    const session = db.prepare('SELECT * FROM report_sessions WHERE id=?').get(req.params.token);
    if (!session) return res.status(404).send('<h2 style="font-family:sans-serif;color:#ef4444;text-align:center;margin-top:40vh">⛔ رابط غير صالح</h2>');
    if (new Date(session.expires_at) < new Date()) {
      return res.status(410).send('<h2 style="font-family:sans-serif;color:#f59e0b;text-align:center;margin-top:40vh">⏰ انتهت صلاحية هذا التقرير</h2>');
    }
    res.send(renderOTPPage(req.params.token, session.group_loc, ''));
  });

  // POST /report/:token/verify — check OTP, issue view session
  app.post('/report/:token/verify', express.json(), (req, res) => {
    const { otp } = req.body || {};
    const session = db.prepare('SELECT * FROM report_sessions WHERE id=?').get(req.params.token);
    if (!session || new Date(session.expires_at) < new Date()) {
      return res.json({ ok: false, error: 'انتهت صلاحية التقرير' });
    }
    if (new Date(session.otp_expires_at) < new Date()) {
      return res.json({ ok: false, error: '⏰ انتهت صلاحية الكود (15 دقيقة) — انتظر الإرسال التالي' });
    }
    if (!otp || hashOTP(otp.trim()) !== session.otp_hash) {
      // Log failed attempt
      db.prepare('INSERT INTO report_access_log (report_id, ip, success) VALUES (?,?,0)')
        .run(req.params.token, req.ip || '');
      return res.json({ ok: false, error: 'كود غير صحيح' });
    }
    // Issue a short-lived view session (1 hour)
    const viewSession = crypto.randomBytes(16).toString('hex');
    db.prepare('UPDATE report_sessions SET accessed_at=CURRENT_TIMESTAMP, access_count=access_count+1 WHERE id=?')
      .run(req.params.token);
    db.prepare('INSERT INTO report_access_log (report_id, ip, success) VALUES (?,?,1)')
      .run(req.params.token, req.ip || '');
    // Store view session in memory (simple Map, not persisted — restart = re-auth)
    viewSessions.set(viewSession, { token: req.params.token, exp: Date.now() + 3600000 });
    res.json({ ok: true, session: viewSession });
  });

  // GET /report/:token/view — actual report page (requires view session)
  app.get('/report/:token/view', (req, res) => {
    const vs = viewSessions.get(req.query.s);
    if (!vs || vs.token !== req.params.token || Date.now() > vs.exp) {
      return res.redirect(`/report/${req.params.token}?err=1`);
    }
    const data = getReportData(db, req.params.token);
    if (!data || data.expired) {
      return res.status(410).send('<h2 style="font-family:sans-serif;color:#f59e0b;text-align:center;margin-top:40vh">⏰ انتهت صلاحية هذا التقرير</h2>');
    }
    res.send(renderReportPage(data.session, data.rows, data.session.group_loc));
  });

  // API: create reports for all groups (called by auto_deliver)
  app.post('/api/reports/generate', (req, res) => {
    const secret = req.headers['x-ingest-secret'];
    if (secret !== 'cpi-matchpro-ingest-2026') return res.status(401).json({ error: 'Unauthorized' });
    const { groups } = req.body || {};
    if (!groups || !Array.isArray(groups)) return res.status(400).json({ error: 'groups array required' });
    const results = groups.map(g => {
      try {
        const r = createReport(db, g);
        return { ...r, ok: true };
      } catch(e) {
        return { group: g, ok: false, error: e.message };
      }
    });
    res.json({ ok: true, results });
  });

  // Admin: view report stats
  app.get('/api/reports/stats', (req, res) => {
    // Light auth: just check header
    const token = (req.headers['authorization'] || '').replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const sessions = db.prepare('SELECT id, group_loc, row_count, status, created_at, expires_at, access_count FROM report_sessions ORDER BY created_at DESC LIMIT 50').all();
    res.json({ sessions });
  });

  // Cleanup old report files (run daily)
  setInterval(() => {
    try {
      const expired = db.prepare("SELECT id FROM report_sessions WHERE expires_at < datetime('now','-1 hour')").all();
      const dataDir = path.join(__dirname, '../data/reports');
      expired.forEach(s => {
        const f = path.join(dataDir, `${s.id}.json`);
        if (fs.existsSync(f)) fs.unlinkSync(f);
      });
      if (expired.length > 0) console.log(`[reports] Cleaned ${expired.length} expired report files`);
    } catch(e) { console.error('[reports] cleanup error:', e.message); }
  }, 60 * 60 * 1000);

  console.log('🔐 Secure Report Portal loaded (OTP-gated, contact-masked)');
}

// In-memory view sessions (simple, no persistence needed)
const viewSessions = new Map();

// Express reference (set by init)
let express;

module.exports = {
  init: function(app, db, _express) {
    express = _express;
    init(app, db);
  },
  createReport,
  getReportData,
  maskPhone,
};
