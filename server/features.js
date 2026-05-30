/**
 * MatchPro Features Module
 * Feature 1: My Assets — Excel upload, email notifications on new matches, export leads
 * Feature 2: Broker Management — email/areas config, 6-hour scheduled sheets, on-demand export
 *
 * © Crystal Power Investments — Confidential
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const ExcelJS = require('exceljs');
const multer = require('multer');
const cron = require('node-cron');

// ── Constants ─────────────────────────────────────────────────────────────────
const LOGO_PATH = path.join(__dirname, '../client/public/icons/icon-192x192.png');
const SHEETS_DIR = '/home/work/.openclaw/workspace/demand_sheets';
const UPLOAD_DIR = path.join(__dirname, '../data/uploads');
const CPI_GOLD = 'C9A227';
const CPI_DARK = '07111F';
const ADMIN_EMAIL = process.env.DIGEST_EMAIL_TO || 'mmaisara@crystalpowerinvestment.com';
const ASSET_MATCH_EMAIL = 'maisaramoamen@outlook.com'; // as per spec

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(SHEETS_DIR)) fs.mkdirSync(SHEETS_DIR, { recursive: true });

// ── Email transport (SMTP with gsk fallback) ────────────────────────────────
const { execSync } = require('child_process');

function makeTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function sendEmailWithAttachment(to, subject, htmlBody, attachmentPath, attachmentFilename) {
  // Try SMTP first
  try {
    const transport = makeTransport();
    await transport.sendMail({
      from: `"MatchPro\u2122 CPI" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html: htmlBody,
      attachments: [{ filename: attachmentFilename, path: attachmentPath }],
    });
    console.log(`[email] SMTP sent to ${to}`);
    return;
  } catch (smtpErr) {
    console.log(`[email] SMTP failed (${smtpErr.message.slice(0,60)}), trying gsk fallback...`);
  }

  // gsk fallback: upload Excel → send clean markdown email
  try {
    let downloadUrl = null;
    try {
      const uploadOut = execSync(`gsk upload "${attachmentPath}"`, { encoding: 'utf8', timeout: 60000, env: process.env });
      try { downloadUrl = JSON.parse(uploadOut)?.data?.file_wrapper_url || null; } catch {}
    } catch(uploadErr) {
      console.log('[email] gsk upload failed:', uploadErr.message.slice(0,80));
    }

    // Extract key data from HTML for clean markdown body
    const leadsMatch = htmlBody.match(/<div style="font-size:28px[^>]+>(\d+)<\/div>[\s\S]*?New Leads/);
    const newCount = leadsMatch ? leadsMatch[1] : '?';
    const totalMatch = htmlBody.match(/<div style="font-size:28px[^>]+>(\d+)<\/div>[\s\S]*?Total Leads/);
    const totalCount = totalMatch ? totalMatch[1] : '?';
    
    // Extract top leads table rows
    const rows = [];
    const rowRegex = /Match %[^%]*?(\d+)%[\s\S]*?Name[^\n]*([A-Za-z\u0600-\u06FF ]+)[\s\S]*?Phone[^2]*(20[0-9]{10})/g;
    let m;
    const tdRegex = /<td[^>]*>([^<]*)<\/td>/g;
    const tbodyMatch = htmlBody.match(/<tbody>([\s\S]*?)<\/tbody>/);
    if (tbodyMatch) {
      const trs = tbodyMatch[1].match(/<tr[^>]*>([\s\S]*?)<\/tr>/g) || [];
      trs.forEach(tr => {
        const cells = [];
        let cm; const cre = /<td[^>]*>([^<]*(?:<a[^>]*>([^<]*)<\/a>[^<]*)?)<\/td>/g;
        while ((cm = cre.exec(tr)) !== null) cells.push(cm[2]||cm[1]);
        if (cells.length >= 4) rows.push(`| ${cells[0].trim()} | ${cells[1].trim()||'—'} | ${cells[2].trim()} | ${cells[3].trim()||'—'} |`);
      });
    }

    const assetMatch = htmlBody.match(/Property: <b[^>]*>([^<]+)<\/b> · ([^<]+) · ([^<]+)</);
    const assetInfo = assetMatch ? `${assetMatch[1]} · ${assetMatch[2].trim()} · ${assetMatch[3].trim()}` : subject;

    const mdBody = [
      `## 🏠 MatchPro™ — ${newCount} New Leads`,
      `**Property:** ${assetInfo}`,
      `**New Leads:** ${newCount} | **Total:** ${totalCount}`,
      ``,
      `| Match% | Name | Phone | Budget |`,
      `|--------|------|-------|--------|`,
      ...rows,
      ``,
      downloadUrl ? `📥 **Excel:** [Download Full List](${downloadUrl})` : `📥 Excel attached`,
      ``,
      `*MatchPro™ — Crystal Power Investments*`,
    ].join('\n');

    const fs2 = require('fs');
    const tmpMd = `/tmp/email_body_${Date.now()}.txt`;
    fs2.writeFileSync(tmpMd, mdBody);
    execSync(`gsk vm_email send ${to} -s "${subject.replace(/"/g, "'")}" -b "$(cat ${tmpMd})"`, { encoding: 'utf8', timeout: 60000, env: process.env });
    fs2.unlink(tmpMd, ()=>{});
    console.log(`[email] gsk vm_email sent to ${to}`);
  } catch(gskErr) {
    console.error('[email] gsk fallback also failed:', gskErr.message.slice(0,120));
    throw gskErr;
  }
}

// ── Arabic area normalization ─────────────────────────────────────────────────
const AREA_ALIASES = {
  'التجمع': 'التجمع الخامس',
  'new cairo': 'التجمع الخامس',
  'القاهرة الجديدة': 'التجمع الخامس',
  'مدينتى': 'مدينتي',
  '6 اكتوبر': '6 أكتوبر',
  'سكتوبر': '6 أكتوبر',
  'الشيخ زايد': 'الشيخ زايد',
  'شيخ زايد': 'الشيخ زايد',
  '10th of ramadan': 'العاشر من رمضان',
  'العاصمه': 'العاصمة الإدارية',
  'العاصمة': 'العاصمة الإدارية',
  'new capital': 'العاصمة الإدارية',
  'ماضي': 'المعادي',
  'مصر الجديدة': 'هليوبوليس',
};

function normalizeArea(str) {
  if (!str) return '';
  const s = str.trim().toLowerCase();
  for (const [alias, canonical] of Object.entries(AREA_ALIASES)) {
    if (s.includes(alias.toLowerCase())) return canonical;
  }
  return str.trim();
}

// ── Excel workbook helpers ────────────────────────────────────────────────────
function applyHeaderStyle(cell, opts = {}) {
  cell.font = { bold: true, color: { argb: 'FF' + (opts.textColor || 'FFFFFF') }, size: opts.size || 10 };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + (opts.bg || CPI_GOLD) } };
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  cell.border = { bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } } };
}

function applyDataRow(row, index) {
  const bg = index % 2 === 0 ? 'FF0C1A2E' : 'FF07111F';
  row.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    cell.font = { color: { argb: 'FFEEF2FF' }, size: 9 };
    cell.alignment = { vertical: 'middle', wrapText: true };
  });
}

async function addLogoAndTitle(sheet, title, subtitle) {
  // Title row
  sheet.mergeCells('A1:J1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = title;
  titleCell.font = { bold: true, size: 14, color: { argb: 'FF' + CPI_GOLD } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + CPI_DARK } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 28;

  sheet.mergeCells('A2:J2');
  const subCell = sheet.getCell('A2');
  subCell.value = subtitle;
  subCell.font = { size: 9, color: { argb: 'FF8899BB' } };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + CPI_DARK } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(2).height = 16;
}

// ── FEATURE 1: Asset Excel Export (leads for an asset) ───────────────────────
async function exportAssetLeads(db, assetId, outputPath) {
  const asset = db.prepare('SELECT * FROM assets WHERE id=?').get(assetId);
  if (!asset) throw new Error('Asset not found');

  const matches = db.prepare(`
    SELECT am.*, am.demand_message as raw_message
    FROM asset_matches am
    WHERE am.asset_id=? ORDER BY am.match_score DESC
  `).all(assetId);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'MatchPro™ by Crystal Power Investments';
  wb.created = new Date();

  const sheet = wb.addWorksheet('Matched Leads', {
    views: [{ state: 'frozen', ySplit: 3 }],
    pageSetup: { orientation: 'landscape', fitToPage: true },
  });

  await addLogoAndTitle(
    sheet,
    `MatchPro™ — Matched Leads: ${asset.asset_code} · ${asset.property_type} · ${asset.location}`,
    `Crystal Power Investments © ${new Date().getFullYear()} · Generated ${new Date().toLocaleString('en-GB')} · ${matches.length} leads`
  );

  // Header row
  const COLS = [
    { header: '#', key: 'idx', width: 4 },
    { header: 'Match %', key: 'score', width: 9 },
    { header: 'Buyer/Renter Name', key: 'name', width: 22 },
    { header: 'Phone', key: 'phone', width: 16 },
    { header: 'WhatsApp', key: 'wa', width: 18 },
    { header: 'Budget (EGP)', key: 'budget', width: 14 },
    { header: 'Asset Matched', key: 'asset', width: 20 },
    { header: 'Original Message (Arabic)', key: 'msg', width: 45 },
    { header: 'Match Date', key: 'date', width: 14 },
    { header: 'Loc Score', key: 'loc', width: 10 },
  ];

  sheet.columns = COLS.map(c => ({ key: c.key, width: c.width }));
  const hdrRow = sheet.getRow(3);
  COLS.forEach((c, i) => {
    const cell = hdrRow.getCell(i + 1);
    cell.value = c.header;
    applyHeaderStyle(cell);
  });
  hdrRow.height = 20;

  matches.forEach((m, i) => {
    const row = sheet.addRow({
      idx: i + 1,
      score: (m.match_score || 0).toFixed(0) + '%',
      name: m.demand_name || '—',
      phone: (m.demand_phone || '').replace(/@c\.us$/, ''),
      wa: m.wa_link || '—',
      budget: m.demand_budget ? Number(m.demand_budget).toLocaleString() : '—',
      asset: `${asset.property_type} · ${asset.location} · ${asset.price ? (asset.price / 1e6).toFixed(1) + 'M' : '?'}`,
      msg: m.raw_message || '—',
      date: m.created_at ? new Date(m.created_at).toLocaleDateString('en-GB') : '—',
      loc: (m.location_score || 0).toFixed(0) + '%',
    });
    applyDataRow(row, i);
    row.height = 18;
  });

  await wb.xlsx.writeFile(outputPath);
  return matches.length;
}

// ── FEATURE 1: Email notification for new asset matches ───────────────────────
async function sendAssetMatchEmail(db, asset, newMatches) {
  if (!newMatches.length) return;

  const tmpPath = `/tmp/asset_leads_${asset.id}_${Date.now()}.xlsx`;
  const count = await exportAssetLeads(db, asset.id, tmpPath);

  const transport = makeTransport();
  const subject = `🏠 MatchPro: ${newMatches.length} New Lead${newMatches.length > 1 ? 's' : ''} — ${asset.asset_code} · ${asset.location}`;

  const topLeads = newMatches.slice(0, 5).map((m, i) => {
    const phone = (m.demand_phone || '').replace(/@c\.us$/, '');
    const wa = phone ? `https://wa.me/${phone.replace(/[^0-9]/g, '')}` : null;
    return `
      <tr style="background:${i % 2 === 0 ? '#0c1a2e' : '#07111f'}">
        <td style="padding:8px;color:#c9a227;font-weight:bold">${(m.match_score || 0).toFixed(0)}%</td>
        <td style="padding:8px;color:#eef2ff">${m.demand_name || '—'}</td>
        <td style="padding:8px;color:#3b82f6">${phone || '—'}</td>
        <td style="padding:8px;color:#22c55e">${m.demand_budget ? (m.demand_budget / 1e6).toFixed(1) + 'M EGP' : '—'}</td>
        <td style="padding:8px">${wa ? `<a href="${wa}" style="color:#22c55e">📱 WhatsApp</a>` : '—'}</td>
      </tr>`;
  }).join('');

  const html = `
  <div style="background:#07111f;color:#eef2ff;font-family:Arial,sans-serif;max-width:680px;margin:0 auto;border-radius:12px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#0c1a2e,#07111f);padding:28px 32px;border-bottom:2px solid #c9a227">
      <div style="font-size:11px;color:#c9a227;letter-spacing:2px;font-weight:700;margin-bottom:8px">MATCHPRO™ · CRYSTAL POWER INVESTMENTS</div>
      <h1 style="margin:0;font-size:22px;color:#eef2ff">🎯 New Buyer Leads Found</h1>
      <p style="color:#8899bb;margin:8px 0 0;font-size:14px">Property: <b style="color:#c9a227">${asset.asset_code}</b> · ${asset.property_type} · ${asset.location}</p>
    </div>
    <div style="padding:24px 32px">
      <div style="display:flex;gap:16px;margin-bottom:20px">
        <div style="background:#0c1a2e;border:1px solid rgba(201,162,39,.2);border-radius:8px;padding:14px 20px;text-align:center;flex:1">
          <div style="font-size:28px;font-weight:800;color:#22c55e">${newMatches.length}</div>
          <div style="font-size:11px;color:#8899bb">New Leads</div>
        </div>
        <div style="background:#0c1a2e;border:1px solid rgba(201,162,39,.2);border-radius:8px;padding:14px 20px;text-align:center;flex:1">
          <div style="font-size:28px;font-weight:800;color:#c9a227">${count}</div>
          <div style="font-size:11px;color:#8899bb">Total Leads</div>
        </div>
        <div style="background:#0c1a2e;border:1px solid rgba(201,162,39,.2);border-radius:8px;padding:14px 20px;text-align:center;flex:1">
          <div style="font-size:28px;font-weight:800;color:#3b82f6">${asset.price ? (asset.price / 1e6).toFixed(1) + 'M' : '—'}</div>
          <div style="font-size:11px;color:#8899bb">Asset Price</div>
        </div>
      </div>
      <h3 style="color:#c9a227;font-size:13px;letter-spacing:1px;text-transform:uppercase;margin:0 0 12px">Top New Leads</h3>
      <table style="width:100%;border-collapse:collapse;font-size:12px;border-radius:8px;overflow:hidden">
        <thead>
          <tr style="background:#c9a227">
            <th style="padding:8px;text-align:left;color:#07111f;font-weight:700">Match %</th>
            <th style="padding:8px;text-align:left;color:#07111f;font-weight:700">Name</th>
            <th style="padding:8px;text-align:left;color:#07111f;font-weight:700">Phone</th>
            <th style="padding:8px;text-align:left;color:#07111f;font-weight:700">Budget</th>
            <th style="padding:8px;text-align:left;color:#07111f;font-weight:700">Contact</th>
          </tr>
        </thead>
        <tbody>${topLeads}</tbody>
      </table>
      <p style="color:#8899bb;font-size:12px;margin-top:16px">Full leads list attached as Excel file.</p>
    </div>
    <div style="padding:16px 32px;background:#0c1a2e;border-top:1px solid rgba(255,255,255,.07);font-size:11px;color:#8899bb;text-align:center">
      MatchPro™ Intelligence Engine · Crystal Power Investments © ${new Date().getFullYear()}
    </div>
  </div>`;

  try {
    await sendEmailWithAttachment(ASSET_MATCH_EMAIL, subject, html, tmpPath, `MatchPro_Leads_${asset.asset_code}_${Date.now()}.xlsx`);
    console.log(`[assets] Email sent: ${newMatches.length} new leads for ${asset.asset_code}`);
  } catch (e) {
    console.error('[assets] email error:', e.message.slice(0, 100));
  } finally {
    fs.unlink(tmpPath, () => {});
  }
}

// ── FEATURE 1: Asset matching with email trigger ──────────────────────────────
function runAssetMatchingWithNotify(db, singleAsset) {
  try {
    const assets = singleAsset
      ? [singleAsset]
      : db.prepare("SELECT * FROM assets WHERE status='available'").all();

    const demands = db.prepare(`
      SELECT * FROM demand
      WHERE digested_at IS NULL AND sender_phone IS NOT NULL
      ORDER BY created_at DESC LIMIT 1000
    `).all();

    const insertMatch = db.prepare(`
      INSERT OR IGNORE INTO asset_matches
      (asset_id, demand_id, match_score, location_score, price_score, specs_score,
       demand_phone, demand_name, demand_message, demand_budget, wa_link)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `);

    let totalNew = 0;
    for (const asset of assets) {
      const newForAsset = [];
      for (const demand of demands) {
        // Location score (40%)
        let locScore = 0;
        const aLoc = normalizeArea(asset.location || '').toLowerCase();
        const dLoc = normalizeArea(demand.location || '').toLowerCase();
        if (aLoc && dLoc) {
          if (aLoc === dLoc) locScore = 100;
          else if (aLoc.includes(dLoc) || dLoc.includes(aLoc)) locScore = 80;
          else locScore = 5;
        } else locScore = 35;

        // Purpose hard gate
        if (asset.transaction_type && demand.purpose) {
          const aT = asset.transaction_type.toLowerCase();
          const dP = demand.purpose.toLowerCase();
          if ((aT === 'sale' && dP === 'rent') || (aT === 'rent' && dP === 'sale')) continue;
        }

        // Price score (35%)
        let priceScore = 50;
        if (asset.price && demand.price_max) {
          const assetP = Number(asset.price);
          const demMax = Number(demand.price_max);
          if (assetP <= demMax * 1.2) { // ±20% tolerance
            priceScore = assetP <= demMax ? Math.min(100, 80 + (1 - assetP / demMax) * 20) : 65;
          } else {
            const over = (assetP - demMax) / demMax;
            priceScore = over <= 0.3 ? 40 : 10;
          }
        }

        // Specs score (25%)
        let specsScore = 50;
        if (asset.bedrooms && demand.bedrooms) {
          const diff = Math.abs(Number(asset.bedrooms) - Number(demand.bedrooms));
          specsScore = diff === 0 ? 100 : diff === 1 ? 70 : 30;
        }
        if (asset.property_type && demand.property_type && asset.property_type !== demand.property_type) {
          specsScore = Math.max(0, specsScore - 25);
        }

        const matchScore = Math.round(locScore * 0.40 + priceScore * 0.35 + specsScore * 0.25);
        if (matchScore < 55) continue;

        const phone = (demand.sender_phone || '').replace(/[^0-9]/g, '');
        const info = db.prepare(`
          INSERT OR IGNORE INTO asset_matches
          (asset_id, demand_id, match_score, location_score, price_score, specs_score,
           demand_phone, demand_name, demand_message, demand_budget, wa_link)
          VALUES (?,?,?,?,?,?,?,?,?,?,?)
        `).run(
          asset.id, demand.id,
          matchScore, locScore, priceScore, specsScore,
          demand.sender_phone, demand.sender_name,
          (demand.raw_message || '').substring(0, 500),
          demand.price_max,
          phone ? `https://wa.me/${phone}` : null
        );

        if (info.changes > 0) {
          newForAsset.push({
            match_score: matchScore,
            demand_name: demand.sender_name,
            demand_phone: demand.sender_phone,
            demand_budget: demand.price_max,
            wa_link: phone ? `https://wa.me/${phone}` : null,
          });
          totalNew++;
        }
      }

      // Email notify — DISABLED per Mo'men request (2026-04-19)
      if (newForAsset.length > 0) {
        console.log(`[assets] ${newForAsset.length} new matches for ${asset.asset_code} — email DISABLED`);
        // setImmediate(() => sendAssetMatchEmail(db, asset, newForAsset).catch(e =>
        //   console.error('[assets] email error:', e.message)
        // ));
      }
    }

    return totalNew;
  } catch (e) {
    console.error('[assets] matching error:', e.message);
    return 0;
  }
}

// ── FEATURE 1: Asset Excel Upload Parser ─────────────────────────────────────
const upload = multer({ dest: UPLOAD_DIR, limits: { fileSize: 10 * 1024 * 1024 } });

async function parseAssetExcel(filePath) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const sheet = wb.worksheets[0];
  if (!sheet) throw new Error('No worksheet found');

  // Auto-detect column mapping from header row
  const headerRow = sheet.getRow(1);
  const colMap = {};
  headerRow.eachCell((cell, colNumber) => {
    const v = String(cell.value || '').toLowerCase().trim();
    if (v.includes('type') || v.includes('نوع')) colMap.property_type = colNumber;
    else if (v.includes('location') || v.includes('area') || v.includes('منطقة') || v.includes('موقع')) colMap.location = colNumber;
    else if (v.includes('price') || v.includes('سعر')) colMap.price = colNumber;
    else if (v.includes('size') || v.includes('area') || v.includes('مساحة')) colMap.size_sqm = colNumber;
    else if (v.includes('bed') || v.includes('غرف')) colMap.bedrooms = colNumber;
    else if (v.includes('bath') || v.includes('حمام')) colMap.bathrooms = colNumber;
    else if (v.includes('sale') || v.includes('rent') || v.includes('نوع_العملية') || v.includes('بيع') || v.includes('إيجار')) colMap.transaction_type = colNumber;
    else if (v.includes('note') || v.includes('ملاحظ')) colMap.owner_notes = colNumber;
    else if (v.includes('finish') || v.includes('تشطيب')) colMap.finishing = colNumber;
  });

  const assets = [];
  sheet.eachRow((row, rowIndex) => {
    if (rowIndex === 1) return; // skip header
    const get = (key) => {
      if (!colMap[key]) return null;
      const v = row.getCell(colMap[key]).value;
      return v != null ? String(v).trim() : null;
    };
    const loc = get('location');
    const type = get('property_type');
    if (!loc || !type) return; // skip empty rows

    const txnRaw = (get('transaction_type') || '').toLowerCase();
    const txn = txnRaw.includes('rent') || txnRaw.includes('إيجار') ? 'rent' : 'sale';
    const priceRaw = get('price');
    const price = priceRaw ? parseFloat(String(priceRaw).replace(/[^\d.]/g, '')) || null : null;

    assets.push({
      property_type: type.toLowerCase().includes('villa') || type.includes('فيلا') ? 'villa'
        : type.toLowerCase().includes('studio') ? 'studio'
        : type.toLowerCase().includes('duplex') || type.includes('دوبلكس') ? 'duplex'
        : type.toLowerCase().includes('shop') || type.includes('محل') ? 'shop'
        : type.toLowerCase().includes('office') || type.includes('مكتب') ? 'office'
        : 'apartment',
      location: normalizeArea(loc),
      transaction_type: txn,
      price: price,
      size_sqm: get('size_sqm') ? parseFloat(get('size_sqm')) || null : null,
      bedrooms: get('bedrooms') ? parseInt(get('bedrooms')) || null : null,
      bathrooms: get('bathrooms') ? parseInt(get('bathrooms')) || null : null,
      finishing: get('finishing') || null,
      owner_notes: get('owner_notes') || null,
    });
  });

  return assets;
}

// ── FEATURE 2: Broker Management DB Schema ───────────────────────────────────
function ensureBrokerSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS brokers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      areas TEXT DEFAULT '[]',
      active INTEGER DEFAULT 1,
      last_sheet_sent DATETIME,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_brokers_active ON brokers(active);

    CREATE TABLE IF NOT EXISTS broker_sheet_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      broker_id INTEGER,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      rows_sale INTEGER DEFAULT 0,
      rows_rent INTEGER DEFAULT 0,
      filename TEXT,
      status TEXT DEFAULT 'sent',
      error TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_broker_sheet_log_broker ON broker_sheet_log(broker_id);
  `);
  // Add columns if missing (migration safety)
  try { db.exec('ALTER TABLE brokers ADD COLUMN notes TEXT'); } catch {}
  try { db.exec('ALTER TABLE brokers ADD COLUMN last_sheet_sent DATETIME'); } catch {}
}

// ── Supply/Demand Classification Engine (FIXED) ─────────────────────────────
// Prevents supply listings (sellers offering properties) from appearing in
// buyer demand sheets. Previously ~89% of HOT leads were sellers, not buyers.
const DEMAND_SIGNALS_JS = [
  'مطلوب ضروري', 'مطلوب ضرورى', 'urgent request', 'very urgent request',
  'محتاج', 'محتاجة', 'محتاجين', 'بدور', 'بدورة', 'عايز', 'عايزة', 'عايزين',
  'ابحث عن', 'أبحث عن', 'نبحث عن', 'بنبحث',
  'want to buy', 'want to rent', 'wants to buy', 'wants to rent',
  'عميل عنده', 'عندي عميل', 'عندى عميل', 'معايا عميل',
  'لديه عميل', 'لدي عميل', 'في إيده', 'في ايده',
  'عميل جاهز', 'مشتري جاهز', 'client ready', 'client needs',
  'client looking', 'client has', 'my client', 'our client',
  'looking for apartment', 'looking for villa', 'looking for flat',
  'needed', 'in need of', 'searching for',
  'i need', 'we need', 'طالب', 'طالبة', 'هيشتري',
  'buyer ready', 'ready buyer', 'buyer looking',
];

const SUPPLY_SIGNALS_JS = [
  'للبيع', 'للإيجار', 'للايجار', 'للتمليك', 'للتأجير',
  'متاح', 'متاحة', 'يوجد', 'يتوفر', 'بيوفر', 'موجود',
  'استلام فوري', 'استلام فورى', 'استلام حالي',
  'تشطيب سوبر لوكس', 'تشطيب خاص', 'تشطيب كامل', 'مشطب',
  'مقدم', 'أقساط', 'قسط شهري', 'داتا', 'down payment', 'downpayment',
  'total price', 'asking price', 'bua:', 'land area', 'built up',
  'resale', 'for sale', 'for rent', 'for lease',
  'fully finished', 'semi finished', 'fully furnished',
  'immediate delivery', 'ready to move',
  'dubizzle', '[dubizzle]', 'من المالك',
  'ground floor with garden', 'duplex ground',
];

function classifyDemandRecord(rawMessage, senderName) {
  if (!rawMessage) return 'unclear';
  const m = rawMessage.toLowerCase();
  
  // Broker data dump = definitely supply
  if (m.includes('داتا') || m.includes('بيانات وسيط')) return 'supply';
  
  let dScore = DEMAND_SIGNALS_JS.filter(s => m.includes(s.toLowerCase())).length;
  let sScore = SUPPLY_SIGNALS_JS.filter(s => m.includes(s.toLowerCase())).length;
  
  // "مطلوب X مليون" = asking price = supply
  if (/مطلوب\s+[\d,\.]+\s*(مليون|الف|ألف)/.test(m)) { sScore += 2; dScore = Math.max(0, dScore - 2); }
  
  // Price at line start = supply listing price
  if (/^[\d,\.]+\s*(مليون|million|m egp)/m.test(m)) { sScore += 2; }
  
  // "مطلوب" at start of message (not followed by price) = demand request
  if (/^مطلوب\s+(?![\d,\.]+\s*(مليون|الف))/.test(m.trim())) { dScore += 2; }
  
  if (dScore > sScore && dScore >= 1) return 'demand';
  if (sScore > dScore && sScore >= 1) return 'supply';
  return 'unclear';
}

// ── FEATURE 2: Generate broker demand sheet ───────────────────────────────────
async function generateBrokerSheet(db, broker, outputPath) {
  const areas = JSON.parse(broker.areas || '[]');
  const sinceHours = parseInt(process.env.DIGEST_INTERVAL_HOURS || '6');
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString();

  // Build area filter
  let areaWhere = '';
  let areaParams = [];
  if (areas.length > 0) {
    const normalized = areas.map(a => normalizeArea(a));
    areaWhere = 'AND (' + normalized.map(() => `(location LIKE ? OR location_cluster LIKE ?)`).join(' OR ') + ')';
    normalized.forEach(a => { areaParams.push(`%${a}%`, `%${a}%`); });
  }

  const allSaleRows = db.prepare(`
    SELECT * FROM demand
    WHERE (digested_at IS NULL OR digested_at='')
      AND (purpose='sale' OR purpose IS NULL OR purpose='')
      AND created_at >= ?
      ${areaWhere}
    ORDER BY location, property_type, created_at DESC
  `).all(since, ...areaParams);

  const allRentRows = db.prepare(`
    SELECT * FROM demand
    WHERE (digested_at IS NULL OR digested_at='')
      AND purpose='rent'
      AND created_at >= ?
      ${areaWhere}
    ORDER BY location, property_type, created_at DESC
  `).all(since, ...areaParams);

  // FIXED: Filter out supply records misclassified as demand
  const saleRows = allSaleRows.filter(r => {
    const c = classifyDemandRecord(r.raw_message || r.original_message || '', r.sender_name || '');
    return c === 'demand' || c === 'unclear'; // keep unclear, remove supply
  });
  const rentRows = allRentRows.filter(r => {
    const c = classifyDemandRecord(r.raw_message || r.original_message || '', r.sender_name || '');
    return c === 'demand' || c === 'unclear';
  });

  const filteredSaleCount = allSaleRows.length - saleRows.length;
  const filteredRentCount = allRentRows.length - rentRows.length;
  if (filteredSaleCount + filteredRentCount > 0) {
    console.log(`[generateBrokerSheet] Filtered out ${filteredSaleCount} sale + ${filteredRentCount} rent supply records from demand sheet`);
  }

  if (saleRows.length === 0 && rentRows.length === 0) return { skipped: true };

  const wb = new ExcelJS.Workbook();
  wb.creator = 'MatchPro™ by Crystal Power Investments';
  wb.created = new Date();

  const COLS = [
    { header: '#', key: 'idx', width: 4 },
    { header: 'Name', key: 'name', width: 22 },
    { header: 'Phone', key: 'phone', width: 16 },
    { header: 'WhatsApp Link', key: 'wa', width: 26 },
    { header: 'Area / Location', key: 'area', width: 18 },
    { header: 'Property Type', key: 'type', width: 14 },
    { header: 'Size (m²)', key: 'size', width: 10 },
    { header: 'Bedrooms', key: 'beds', width: 10 },
    { header: 'Budget (EGP)', key: 'budget', width: 15 },
    { header: 'Original Message', key: 'msg', width: 50 },
    { header: 'Date', key: 'date', width: 12 },
  ];

  for (const [sheetName, rows, color] of [
    ['📈 For Sale Requests', saleRows, CPI_GOLD],
    ['🏘️ For Rent Requests', rentRows, '3B82F6'],
  ]) {
    const sheet = wb.addWorksheet(sheetName, {
      views: [{ state: 'frozen', ySplit: 3 }],
    });
    sheet.columns = COLS.map(c => ({ key: c.key, width: c.width }));

    await addLogoAndTitle(
      sheet,
      `MatchPro™ — ${sheetName} · ${broker.name}`,
      `${areas.length ? areas.join(', ') : 'All Areas'} · Generated ${new Date().toLocaleString('en-GB')} · Crystal Power Investments`
    );

    const hdrRow = sheet.getRow(3);
    COLS.forEach((c, i) => {
      const cell = hdrRow.getCell(i + 1);
      cell.value = c.header;
      applyHeaderStyle(cell, { bg: color });
    });
    hdrRow.height = 20;

    rows.forEach((r, i) => {
      const phone = (r.sender_phone || '').replace(/@c\.us$/, '').replace(/[^0-9]/g, '');
      const wa = phone ? `https://wa.me/${phone}` : '';
      const row = sheet.addRow({
        idx: i + 1,
        name: r.sender_name || '—',
        phone: (r.sender_phone || '').replace(/@c\.us$/, ''),
        wa,
        area: r.location || r.area || '—',
        type: r.property_type || '—',
        size: r.size_min || r.size_max || '—',
        beds: r.bedrooms || '—',
        budget: r.price_max ? Number(r.price_max).toLocaleString() : '—',
        msg: (r.raw_message || r.original_message || '').substring(0, 300),
        date: r.created_at ? new Date(r.created_at).toLocaleDateString('en-GB') : '—',
      });
      applyDataRow(row, i);
      row.height = 20;

      // Make WA link clickable
      if (wa) {
        const waCell = row.getCell('wa');
        waCell.value = { text: `📱 ${phone}`, hyperlink: wa };
        waCell.font = { color: { argb: 'FF22C55E' }, size: 9, underline: true };
      }
    });
  }

  await wb.xlsx.writeFile(outputPath);
  return { skipped: false, saleRows: saleRows.length, rentRows: rentRows.length };
}

// ── WA group map (loaded from disk) ─────────────────────────────────────────
function loadGroupMap() {
  try {
    const p = path.join('/home/work/.openclaw/workspace', 'matchpro_groups.json');
    const groups = JSON.parse(fs.readFileSync(p, 'utf8'));
    const map = {};
    groups.forEach(g => { if (g.id && !g.id.startsWith('PENDING')) map[g.loc] = g.id; });
    return map;
  } catch(e) { return {}; }
}

// ── Send WA message via Green API ────────────────────────────────────────────
async function sendWAMessage(chatId, text) {
  const instance = process.env.GREEN_API_INSTANCE || '7105409203';
  const token    = process.env.GREEN_API_TOKEN || '';
  if (!token) return null;
  const url = `https://7105.api.greenapi.com/waInstance${instance}/sendMessage/${token}`;
  const http = require('http'), https = require('https');
  return new Promise((resolve) => {
    const body = JSON.stringify({ chatId, message: text });
    const u = new URL(url);
    const opts = { hostname: u.hostname, path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } };
    const req = (u.protocol === 'https:' ? https : http).request(opts, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch(e) { resolve({ error: d }); }
      });
    });
    req.on('error', e => resolve({ error: e.message }));
    req.setTimeout(15000, () => { req.destroy(); resolve({ error: 'timeout' }); });
    req.write(body); req.end();
  });
}

// ── FEATURE 2: Send sheet to one broker ──────────────────────────────────────
async function sendBrokerSheet(db, broker) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
  const filename = `MatchPro_Leads_${broker.name.replace(/\s+/g, '_')}_${timestamp}.xlsx`;
  const tmpPath = path.join('/tmp', filename);

  let result;
  try {
    result = await generateBrokerSheet(db, broker, tmpPath);
  } catch (e) {
    db.prepare(`INSERT INTO broker_sheet_log (broker_id, status, error) VALUES (?,?,?)`)
      .run(broker.id, 'error', e.message.substring(0, 300));
    console.error(`[brokers] Sheet generation failed for ${broker.name}:`, e.message);
    return;
  }

  if (result.skipped) {
    console.log(`[brokers] Skipped ${broker.name} — no demands in last 6h for areas: ${broker.areas}`);
    return;
  }

  const areas = JSON.parse(broker.areas || '[]');
  const areaStr = areas.length ? areas.join(' & ') : 'All Areas';

  const transport = makeTransport();
  const subject = `📊 MatchPro Leads — ${areaStr} · ${new Date().toLocaleDateString('en-GB')}`;

  const html = `
  <div style="background:#07111f;color:#eef2ff;font-family:Arial,sans-serif;max-width:620px;margin:0 auto;border-radius:12px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#0c1a2e,#07111f);padding:24px 28px;border-bottom:2px solid #c9a227">
      <div style="font-size:10px;color:#c9a227;letter-spacing:2px;font-weight:700">MATCHPRO™ · CRYSTAL POWER INVESTMENTS</div>
      <h2 style="margin:8px 0 4px;color:#eef2ff;font-size:18px">📊 Your Latest Demand Leads</h2>
      <p style="color:#8899bb;margin:0;font-size:13px">${areaStr}</p>
    </div>
    <div style="padding:20px 28px">
      <p style="color:#eef2ff;margin:0 0 16px">Hello <b style="color:#c9a227">${broker.name}</b>,</p>
      <p style="color:#8899bb;font-size:13px;margin:0 0 16px">Here is your personalized demand sheet for <b style="color:#eef2ff">${areaStr}</b> covering the last 6 hours.</p>
      <div style="display:flex;gap:12px;margin-bottom:16px">
        <div style="background:#0c1a2e;border:1px solid rgba(201,162,39,.2);border-radius:8px;padding:14px;text-align:center;flex:1">
          <div style="font-size:26px;font-weight:800;color:#c9a227">${result.saleRows}</div>
          <div style="font-size:11px;color:#8899bb">For Sale</div>
        </div>
        <div style="background:#0c1a2e;border:1px solid rgba(59,130,246,.2);border-radius:8px;padding:14px;text-align:center;flex:1">
          <div style="font-size:26px;font-weight:800;color:#3b82f6">${result.rentRows}</div>
          <div style="font-size:11px;color:#8899bb">For Rent</div>
        </div>
      </div>
      <p style="color:#8899bb;font-size:12px">Your leads spreadsheet is attached. Open it to see full contact details, budgets, and original Arabic messages.</p>
    </div>
    <div style="padding:14px 28px;background:#0c1a2e;border-top:1px solid rgba(255,255,255,.07);font-size:10px;color:#8899bb;text-align:center">
      MatchPro™ Intelligence Engine · Crystal Power Investments © ${new Date().getFullYear()}<br>
      This report is confidential and intended only for ${broker.name}.
    </div>
  </div>`;

  try {
    await sendEmailWithAttachment(broker.email, subject, html, tmpPath, filename);
    // Also send WA notification to broker directly if they have a WA ID
    if (broker.whatsapp_chat_id) {
      const areas = JSON.parse(broker.areas || '[]');
      const waMsg = [
        `📊 *MatchPro™ Leads — ${areas.join(' · ')}*`,
        `━━━━━━━━━━━━━━━━━━`,
        `📅 ${new Date().toLocaleDateString('en-GB')}  ⏰ ${new Date().toLocaleTimeString('en-GB', {hour:'2-digit',minute:'2-digit'})}`,
        `🏷️ للبيع: ${result.saleRows}  |  🔑 للإيجار: ${result.rentRows}`,
        `━━━━━━━━━━━━━━━━━━`,
        `📧 الشيت وصلك على الإيميل بتاعك`,
        `_Crystal Power Investments_`,
      ].join('\n');
      await sendWAMessage(broker.whatsapp_chat_id, waMsg).catch(() => {});
    }
    const areas = JSON.parse(broker.areas || '[]');
    db.prepare(`
      INSERT INTO broker_sheet_log (broker_id, rows_sale, rows_rent, filename, status, area)
      VALUES (?,?,?,?,?,?)
    `).run(broker.id, result.saleRows, result.rentRows, filename, 'ok', areas[0] || null);
    db.prepare(`UPDATE brokers SET last_sheet_sent=CURRENT_TIMESTAMP WHERE id=?`).run(broker.id);
    console.log(`[brokers] Sent to ${broker.name} <${broker.email}>: ${result.saleRows} sale + ${result.rentRows} rent`);
  } catch (e) {
    db.prepare(`INSERT INTO broker_sheet_log (broker_id, status, error) VALUES (?,?,?)`)
      .run(broker.id, 'error', e.message.substring(0, 300));
    console.error(`[brokers] Email failed for ${broker.name}:`, e.message);
  } finally {
    fs.unlink(tmpPath, () => {});
  }
}

// ── FEATURE 2: Run all active brokers ────────────────────────────────────────
async function runAllBrokerSheets(db) {
  const brokers = db.prepare("SELECT * FROM brokers WHERE active=1 AND email IS NOT NULL AND email != ''").all();
  console.log(`[brokers] Running scheduled sheets for ${brokers.length} active brokers`);
  for (const broker of brokers) {
    await sendBrokerSheet(db, broker).catch(e => console.error('[brokers] error:', e.message));
  }
  // Also send OTP reports to all WA groups
  await sendAreaGroupReports(db).catch(e => console.error('[groups] error:', e.message));
}

// ── Send OTP report to each area's WA group ───────────────────────────────────
const LOC_EMOJI = {
  'مدينتي':'🏘️','الرحاب':'🏢','التجمع الخامس':'🏙️','الشيخ زايد':'🌳',
  '6 أكتوبر':'🏡','العاصمة الإدارية':'🏛️','الساحل الشمالي':'🏖️',
  'نصر سيتي':'🏬','مدينة نور':'✨','أخرى':'📍',
};

const LOC_KW = [
  { key:'مدينتي',   kw:['مدينتي','مدينتى','madinaty','b1','b2','b3','b4','b5','b6','b7','b8','b9','b10','b11','b12','b13','b14','b15','بريفادو','privado'] },
  { key:'الرحاب',   kw:['الرحاب','rehab','ريحاب'] },
  { key:'التجمع الخامس', kw:['التجمع الخامس','التجمع','القاهرة الجديدة','fifth settlement','new cairo','هايد بارك','hyde park','ميفيدا','mivida','ايستاون','eastown','تاج سيتي','taj city','palm hills','lake view','villette','galleria'] },
  { key:'الشيخ زايد', kw:['الشيخ زايد','sheikh zayed','زايد','زايد ديونز','sodic','beverly hills'] },
  { key:'6 أكتوبر', kw:['6 اكتوبر','6 أكتوبر','october','اكتوبر'] },
  { key:'العاصمة الإدارية', kw:['العاصمة','العاصمة الادارية','العاصمة الإدارية','new capital','administrative capital'] },
  { key:'الساحل الشمالي', kw:['الساحل','north coast','مارينا','marina','هاسيندا','hacienda','مراسي','marassi','العلمين'] },
  { key:'نصر سيتي', kw:['مدينة نصر','نصر سيتي','nasr city'] },
  { key:'مدينة نور', kw:['مدينة نور','madinet nour'] },
];

function countAreaDemands(db, areaKey) {
  const areaInfo = LOC_KW.find(a => a.key === areaKey);
  if (!areaInfo) {
    const allKw = LOC_KW.flatMap(a => a.kw);
    const cond = allKw.map(() => '(location NOT LIKE ? AND (location_cluster IS NULL OR location_cluster NOT LIKE ?))').join(' AND ');
    const params = allKw.flatMap(k => [`%${k}%`, `%${k}%`]);
    return db.prepare(`SELECT COUNT(*) as c FROM demand WHERE (digested_at IS NULL OR digested_at='') AND (${cond})`).get(...params).c;
  }
  const cond = areaInfo.kw.map(() => '(location LIKE ? OR location_cluster LIKE ?)').join(' OR ');
  const params = areaInfo.kw.flatMap(k => [`%${k}%`, `%${k}%`]);
  return db.prepare(`SELECT COUNT(*) as c FROM demand WHERE (digested_at IS NULL OR digested_at='') AND (${cond})`).get(...params).c;
}

async function sendAreaGroupReports(db) {
  const groupMap = loadGroupMap();
  const http = require('http');
  for (const [loc, groupId] of Object.entries(groupMap)) {
    try {
      const count = countAreaDemands(db, loc);
      if (count === 0) { console.log(`[groups] ${loc}: 0 demands, skipping`); continue; }
      const areaKw = LOC_KW.find(a => a.key === loc)?.kw || [];
      const body = JSON.stringify({ groups: [{ loc, id: groupId, keywords: areaKw }] });
      const result = await new Promise((resolve) => {
        const opts = { hostname:'localhost', port:3001, path:'/api/reports/generate', method:'POST',
          headers:{'Content-Type':'application/json','x-ingest-secret':'cpi-matchpro-ingest-2026','Content-Length':Buffer.byteLength(body)} };
        const req = http.request(opts, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>{ try{resolve(JSON.parse(d))}catch(e){resolve({error:d})} }); });
        req.on('error', e => resolve({error:e.message}));
        req.write(body); req.end();
      });
      const r = result.results?.[0];
      if (!r?.ok) { console.log(`[groups] ${loc}: report gen failed`, r?.error); continue; }
      const base = process.env.PORTAL_BASE || 'https://lkdsbjzk.gensparkclaw.com';
      const emoji = LOC_EMOJI[loc] || '📍';
      const now = new Date();
      const msg = [
        `${emoji} *MatchPro™ ${loc}*`,
        `━━━━━━━━━━━━━━━━━━`,
        `📅 ${now.toLocaleDateString('ar-EG')}  ⏰ ${now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})} (Cairo)`,
        `📊 الطلبات النشطة: *${r.rowCount}*`,
        `━━━━━━━━━━━━━━━━━━`,
        `🔐 الرابط الآمن:`,
        `${base}/report/${r.token}`,
        ``,
        `🔑 الرقم السري: *${r.otp}*`,
        `⚠️ (صالح 15 دقيقة)`,
        `━━━━━━━━━━━━━━━━━━`,
        `⛔ لا تشارك | 📵 سكرين شوت محظور`,
        `_Crystal Power Investments_`,
      ].join('\n');
      const waResult = await sendWAMessage(groupId, msg);
      const ok = waResult?.idMessage ? 'ok' : 'error';
      console.log(`[groups] ${loc}: ${ok} — ${waResult?.idMessage || waResult?.error || '?'}`);
      db.prepare(`INSERT INTO broker_sheet_log (broker_id, rows_sale, rows_rent, filename, status, area, wa_group_id, wa_message_id) VALUES (?,?,?,?,?,?,?,?)`)
        .run(0, r.rowCount, 0, `report:${r.token}`, ok, loc, groupId, waResult?.idMessage || null);
    } catch(e) {
      console.error(`[groups] ${loc} error:`, e.message);
    }
    await new Promise(r => setTimeout(r, 3000));
  }
}

// ── WA group map (loaded from disk) ──────────────────────────────────────────
function loadGroupMap() {
  try {
    const p = path.join('/home/work/.openclaw/workspace', 'matchpro_groups.json');
    const groups = JSON.parse(fs.readFileSync(p, 'utf8'));
    const map = {};
    groups.forEach(g => { if (g.id && !g.id.startsWith('PENDING')) map[g.loc] = g.id; });
    return map;
  } catch(e) { return {}; }
}

// ── Send WA message via Green API ────────────────────────────────────────────
async function sendWAMessage(chatId, text) {
  const instance = process.env.GREEN_API_INSTANCE || '7105409203';
  const token    = process.env.GREEN_API_TOKEN || '';
  if (!token) return null;
  const url = `https://7105.api.greenapi.com/waInstance${instance}/sendMessage/${token}`;
  const https = require('https');
  return new Promise((resolve) => {
    const body = JSON.stringify({ chatId, message: text });
    const u = new URL(url);
    const opts = { hostname:u.hostname, path:u.pathname+u.search, method:'POST',
      headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)} };
    const req = https.request(opts, res => {
      let d = ''; res.on('data',c=>d+=c); res.on('end',()=>{ try{resolve(JSON.parse(d))}catch(e){resolve({error:d})}; });
    });
    req.on('error', e => resolve({error:e.message}));
    req.setTimeout(15000, () => { req.destroy(); resolve({error:'timeout'}); });
    req.write(body); req.end();
  });
}

// ── FEATURE 2: On-demand export with filters ─────────────────────────────────
async function exportDemandSheet(db, filters, outputPath) {
  const {
    areas = [],
    purpose = null,
    dateFrom = null,
    dateTo = null,
    minConfidence = null,
    propertyType = null,
  } = filters;

  let where = ["(digested_at IS NULL OR digested_at='')"];
  const params = [];

  if (areas.length > 0) {
    const normalized = areas.map(normalizeArea);
    where.push('(' + normalized.map(() => '(location LIKE ? OR location_cluster LIKE ?)').join(' OR ') + ')');
    normalized.forEach(a => params.push(`%${a}%`, `%${a}%`));
  }
  if (purpose) { where.push('purpose=?'); params.push(purpose); }
  if (dateFrom) { where.push('created_at>=?'); params.push(dateFrom); }
  if (dateTo) { where.push('created_at<=?'); params.push(dateTo); }
  if (minConfidence) { where.push('confidence>=?'); params.push(minConfidence); }
  if (propertyType) { where.push('property_type=?'); params.push(propertyType); }

  const sql = `SELECT * FROM demand WHERE ${where.join(' AND ')} ORDER BY location, property_type, created_at DESC LIMIT 5000`;
  const allRows = db.prepare(sql).all(...params);
  
  // FIXED: Filter out supply listings misclassified as demand
  const rows = allRows.filter(r => {
    const c = classifyDemandRecord(r.raw_message || r.original_message || '', r.sender_name || '');
    return c !== 'supply'; // include demand + unclear, exclude supply
  });
  const filteredOut = allRows.length - rows.length;
  if (filteredOut > 0) {
    console.log(`[exportDemandSheet] Filtered ${filteredOut} supply records from demand export (total: ${allRows.length} → ${rows.length} real buyers)`);
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'MatchPro™ by Crystal Power Investments';
  wb.created = new Date();
  const sheet = wb.addWorksheet('Demand Export', { views: [{ state: 'frozen', ySplit: 3 }] });

  const COLS = [
    { header: '#', key: 'idx', width: 4 },
    { header: 'Name', key: 'name', width: 22 },
    { header: 'Phone', key: 'phone', width: 16 },
    { header: 'WA Link', key: 'wa', width: 26 },
    { header: 'Location', key: 'loc', width: 18 },
    { header: 'Type', key: 'type', width: 14 },
    { header: 'Purpose', key: 'purpose', width: 8 },
    { header: 'Size', key: 'size', width: 10 },
    { header: 'Beds', key: 'beds', width: 6 },
    { header: 'Budget Min', key: 'bmin', width: 13 },
    { header: 'Budget Max', key: 'bmax', width: 13 },
    { header: 'Confidence', key: 'conf', width: 10 },
    { header: 'Group', key: 'group', width: 22 },
    { header: 'Message', key: 'msg', width: 50 },
    { header: 'Date', key: 'date', width: 12 },
  ];

  sheet.columns = COLS.map(c => ({ key: c.key, width: c.width }));

  await addLogoAndTitle(
    sheet,
    `MatchPro™ — Demand Export · ${new Date().toLocaleDateString('en-GB')}`,
    `Filters: ${areas.length ? areas.join(', ') : 'All Areas'} · ${purpose || 'All'} · ${rows.length} records · Crystal Power Investments`
  );

  const hdrRow = sheet.getRow(3);
  COLS.forEach((c, i) => {
    applyHeaderStyle(hdrRow.getCell(i + 1));
    hdrRow.getCell(i + 1).value = c.header;
  });
  hdrRow.height = 20;

  rows.forEach((r, i) => {
    const phone = (r.sender_phone || '').replace(/@c\.us$/, '').replace(/[^0-9]/g, '');
    const wa = phone ? `https://wa.me/${phone}` : '';
    const row = sheet.addRow({
      idx: i + 1,
      name: r.sender_name || '—',
      phone: (r.sender_phone || '').replace(/@c\.us$/, ''),
      wa,
      loc: r.location || '—',
      type: r.property_type || '—',
      purpose: r.purpose || '—',
      size: r.size_min || r.size_max || '—',
      beds: r.bedrooms || '—',
      bmin: r.price_min ? Number(r.price_min).toLocaleString() : '—',
      bmax: r.price_max ? Number(r.price_max).toLocaleString() : '—',
      conf: r.confidence ? (r.confidence * 100).toFixed(0) + '%' : '—',
      group: r.group_name || '—',
      msg: (r.raw_message || r.original_message || '').substring(0, 400),
      date: r.created_at ? new Date(r.created_at).toLocaleDateString('en-GB') : '—',
    });
    applyDataRow(row, i);
    row.height = 20;

    if (wa) {
      const waCell = row.getCell('wa');
      waCell.value = { text: `📱 ${phone}`, hyperlink: wa };
      waCell.font = { color: { argb: 'FF22C55E' }, size: 9, underline: true };
    }
  });

  await wb.xlsx.writeFile(outputPath);
  return rows.length;
}

// ── FEATURE 2: Scheduler ─────────────────────────────────────────────────────
function startBrokerScheduler(db) {
  // DISABLED 2026-04-23 — was sending links with personal data to WA groups
  // Re-enable only after proper review. See: auto_deliver security issue
  // cron.schedule('0 0,6,12,18 * * *', async () => {
  //   console.log('[brokers] Cron trigger: running 6-hour sheets');
  //   await runAllBrokerSheets(db);
  // }, { timezone: 'UTC' });
  console.log('[brokers] 6-hour WA auto-delivery DISABLED for security review');
}

// ── Main init ─────────────────────────────────────────────────────────────────
function init(app, db, auth) {
  ensureBrokerSchema(db);

  // ── FEATURE 1 ROUTES ─────────────────────────────────────────────────────

  // Excel upload → parse → return preview (no DB insert yet)
  app.post('/api/assets/upload-preview', auth, upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    try {
      const assets = await parseAssetExcel(req.file.path);
      fs.unlink(req.file.path, () => {});
      res.json({ ok: true, count: assets.length, preview: assets.slice(0, 5), assets });
    } catch (e) {
      fs.unlink(req.file.path, () => {});
      res.status(400).json({ error: e.message });
    }
  });

  // Excel upload → bulk insert assets
  app.post('/api/assets/upload-import', auth, upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    try {
      const assets = await parseAssetExcel(req.file.path);
      fs.unlink(req.file.path, () => {});
      if (!assets.length) return res.status(400).json({ error: 'No valid rows found in Excel' });

      const insert = db.prepare(`
        INSERT INTO assets (asset_code, property_type, location, district, transaction_type,
          price, size_sqm, bedrooms, bathrooms, finishing, status, owner_notes)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
      `);

      const insertMany = db.transaction((rows) => {
        let n = 0;
        for (const a of rows) {
          const code = 'A-' + String(Date.now() + n).slice(-6);
          insert.run(code, a.property_type, a.location, a.district || null, a.transaction_type,
            a.price || null, a.size_sqm || null, a.bedrooms || null, a.bathrooms || null,
            a.finishing || null, 'available', a.owner_notes || null);
          n++;
        }
        return n;
      });

      const count = insertMany(assets);
      // Trigger matching after bulk import
      setTimeout(() => runAssetMatchingWithNotify(db, null), 2000);
      res.json({ ok: true, imported: count });
    } catch (e) {
      if (req.file) fs.unlink(req.file.path, () => {});
      res.status(500).json({ error: e.message });
    }
  });

  // Export leads for a specific asset as Excel download
  app.get('/api/assets/:id/export', auth, async (req, res) => {
    try {
      const asset = db.prepare('SELECT * FROM assets WHERE id=?').get(req.params.id);
      if (!asset) return res.status(404).json({ error: 'Asset not found' });
      const tmpPath = `/tmp/leads_${asset.id}_${Date.now()}.xlsx`;
      const count = await exportAssetLeads(db, asset.id, tmpPath);
      const filename = `MatchPro_Leads_${asset.asset_code}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      const stream = fs.createReadStream(tmpPath);
      stream.pipe(res);
      stream.on('close', () => fs.unlink(tmpPath, () => {}));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Re-run matching for all assets (manual trigger)
  app.post('/api/assets/rematch', auth, (req, res) => {
    setTimeout(() => runAssetMatchingWithNotify(db, null), 100);
    res.json({ ok: true, message: 'Matching started in background' });
  });

  // ── FEATURE 2 ROUTES ─────────────────────────────────────────────────────

  // List brokers
  app.get('/api/brokers', auth, (req, res) => {
    const brokers = db.prepare('SELECT * FROM brokers ORDER BY name').all();
    const logs = db.prepare('SELECT broker_id, COUNT(*) as sends FROM broker_sheet_log WHERE status=\'sent\' GROUP BY broker_id').all();
    const logMap = {};
    logs.forEach(l => logMap[l.broker_id] = l.sends);
    res.json(brokers.map(b => ({ ...b, areas: JSON.parse(b.areas || '[]'), totalSends: logMap[b.id] || 0 })));
  });

  // Create broker
  app.post('/api/brokers', auth, (req, res) => {
    const { name, email, phone, areas, notes } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'name and email required' });
    const result = db.prepare(`
      INSERT INTO brokers (name, email, phone, areas, notes)
      VALUES (?,?,?,?,?)
    `).run(name, email, phone || null, JSON.stringify(areas || []), notes || null);
    res.json({ ok: true, id: result.lastInsertRowid });
  });

  // Update broker
  app.put('/api/brokers/:id', auth, (req, res) => {
    const { name, email, phone, areas, active, notes } = req.body;
    db.prepare(`
      UPDATE brokers SET name=?, email=?, phone=?, areas=?, active=?, notes=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(name, email, phone || null, JSON.stringify(areas || []), active ? 1 : 0, notes || null, req.params.id);
    res.json({ ok: true });
  });

  // Delete broker
  app.delete('/api/brokers/:id', auth, (req, res) => {
    db.prepare('UPDATE brokers SET active=0 WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  });

  // Broker send history
  app.get('/api/brokers/:id/log', auth, (req, res) => {
    const logs = db.prepare('SELECT * FROM broker_sheet_log WHERE broker_id=? ORDER BY sent_at DESC LIMIT 20').all(req.params.id);
    res.json(logs);
  });

  // Global delivery log for Command Centre (all brokers)
  app.get('/api/brokers/delivery-log', auth, (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const rows = db.prepare(`
      SELECT l.*, 
        COALESCE(b.name, CASE WHEN l.broker_id=0 THEN '📡 Group' ELSE NULL END) as broker_name,
        b.areas as broker_areas
      FROM broker_sheet_log l
      LEFT JOIN brokers b ON b.id = l.broker_id AND l.broker_id != 0
      ORDER BY l.sent_at DESC
      LIMIT ?
    `).all(limit);
    const enriched = rows.map(r => ({
      ...r,
      loc: r.area || (() => {
        try { const a = JSON.parse(r.broker_areas||'[]'); return a[0]||null; } catch(e){return null;}
      })()
    }));
    res.json(enriched);
  });

  // Demand counts per area for Command Centre
  app.get('/api/demand/counts-by-area', auth, (req, res) => {
    const AREAS = [
      { key: 'مدينتي', kw: ['مدينتي','مدينتى','madinaty','b1','b2','b3','b4','b5','b6','b7','b8','b9','b10','b11','b12','b13','b14','b15','بريفادو','privado'] },
      { key: 'الرحاب', kw: ['الرحاب','rehab','ريحاب'] },
      { key: 'التجمع الخامس', kw: ['التجمع الخامس','التجمع','القاهرة الجديدة','fifth settlement','new cairo','هايد بارك','hyde park','ميفيدا','mivida','ايستاون','eastown','تاج سيتي','taj city','palm hills','lake view','villette','galleria'] },
      { key: 'الشيخ زايد', kw: ['الشيخ زايد','sheikh zayed','زايد','زايد ديونز','sodic','beverly hills'] },
      { key: '6 أكتوبر', kw: ['6 اكتوبر','6 أكتوبر','october','اكتوبر'] },
      { key: 'العاصمة الإدارية', kw: ['العاصمة الادارية','العاصمة الإدارية','العاصمة','new capital','administrative capital'] },
      { key: 'الساحل الشمالي', kw: ['الساحل','north coast','مارينا','marina','هاسيندا','hacienda','مراسي','marassi','العلمين'] },
      { key: 'نصر سيتي', kw: ['مدينة نصر','نصر سيتي','nasr city'] },
      { key: 'مدينة نور', kw: ['مدينة نور','madinet nour'] },
    ];
    const counts = {};
    const usedIds = new Set();
    for (const area of AREAS) {
      const cond = area.kw.map(() => '(location LIKE ? OR location_cluster LIKE ?)').join(' OR ');
      const params = area.kw.flatMap(k => [`%${k}%`, `%${k}%`]);
      const rows = db.prepare(`SELECT id FROM demand WHERE (digested_at IS NULL OR digested_at='') AND (${cond})`).all(...params);
      const unique = rows.filter(r => !usedIds.has(r.id));
      unique.forEach(r => usedIds.add(r.id));
      counts[area.key] = unique.length;
    }
    // Other = remaining
    const total = db.prepare(`SELECT COUNT(*) as c FROM demand WHERE (digested_at IS NULL OR digested_at='')`).get().c;
    counts['أخرى'] = Math.max(0, total - Object.values(counts).reduce((a,b)=>a+b,0));
    res.json({ counts, total });
  });

  // Send sheet to specific broker NOW
  app.post('/api/brokers/:id/send-now', auth, async (req, res) => {
    const broker = db.prepare('SELECT * FROM brokers WHERE id=?').get(req.params.id);
    if (!broker) return res.status(404).json({ error: 'Broker not found' });
    try {
      await sendBrokerSheet(db, broker);
      res.json({ ok: true, message: `Sheet sent to ${broker.email}` });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Send to ALL active brokers now
  app.post('/api/brokers/send-all', auth, async (req, res) => {
    res.json({ ok: true, message: 'Sending sheets in background...' });
    setImmediate(() => runAllBrokerSheets(db));
  });

  // Send OTP report to one specific area's WA group (Command Centre ⊢ Send button)
  app.post('/api/areas/:loc/send', auth, async (req, res) => {
    const loc = decodeURIComponent(req.params.loc);
    const groupMap = loadGroupMap();
    const groupId = groupMap[loc];
    if (!groupId) return res.status(400).json({ error: `No WA group configured for «${loc}»` });
    res.json({ ok: true, message: `Sending ${loc} in background...` });
    setImmediate(async () => {
      try {
        const count = countAreaDemands(db, loc);
        if (count === 0) { console.log(`[areas] ${loc}: 0 demands`); return; }
        const areaKw = LOC_KW.find(a => a.key === loc)?.kw || [];
        const http = require('http');
        const body = JSON.stringify({ groups: [{ loc, id: groupId, keywords: areaKw }] });
        const result = await new Promise((resolve) => {
          const opts = { hostname:'localhost', port:3001, path:'/api/reports/generate', method:'POST',
            headers:{'Content-Type':'application/json','x-ingest-secret':'cpi-matchpro-ingest-2026','Content-Length':Buffer.byteLength(body)} };
          const req = http.request(opts, res2 => { let d=''; res2.on('data',c=>d+=c); res2.on('end',()=>{ try{resolve(JSON.parse(d))}catch(e){resolve({error:d})} }); });
          req.on('error', e => resolve({error:e.message}));
          req.write(body); req.end();
        });
        const r = result.results?.[0];
        if (!r?.ok) { console.log(`[areas] ${loc}: report gen failed`, r?.error); return; }
        const base = process.env.PORTAL_BASE || 'https://lkdsbjzk.gensparkclaw.com';
        const emoji = LOC_EMOJI[loc] || '📍';
        const now = new Date();
        const msg = [
          `${emoji} *MatchPro™ ${loc}*`,
          `━━━━━━━━━━━━━━━━━━`,
          `📅 ${now.toLocaleDateString('ar-EG')}  ⏰ ${now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})} (Cairo)`,
          `📊 الطلبات النشطة: *${r.rowCount}*`,
          `━━━━━━━━━━━━━━━━━━`,
          `🔐 الرابط الآمن:`,
          `${base}/report/${r.token}`,
          ``,
          `🔑 الرقم السري: *${r.otp}*`,
          `⚠️ (صالح 15 دقيقة)`,
          `━━━━━━━━━━━━━━━━━━`,
          `⛔ لا تشارك | 📵 سكرين شوت محظور`,
          `_Crystal Power Investments_`,
        ].join('\n');
        const waResult = await sendWAMessage(groupId, msg);
        const ok = waResult?.idMessage ? 'ok' : 'error';
        console.log(`[areas/send] ${loc}: ${ok}`);
        db.prepare(`INSERT INTO broker_sheet_log (broker_id, rows_sale, rows_rent, filename, status, area, wa_group_id, wa_message_id) VALUES (?,?,?,?,?,?,?,?)`)
          .run(0, r.rowCount, 0, `report:${r.token}`, ok, loc, groupId, waResult?.idMessage || null);
      } catch(e) { console.error(`[areas/send] ${loc} error:`, e.message); }
    });
  });

  // On-demand export with filters (returns file download)
  app.post('/api/export/demand', auth, async (req, res) => {
    try {
      const filters = req.body || {};
      const tmpPath = `/tmp/demand_export_${Date.now()}.xlsx`;
      const count = await exportDemandSheet(db, filters, tmpPath);
      const filename = `MatchPro_DemandExport_${new Date().toISOString().slice(0, 10)}.xlsx`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      const stream = fs.createReadStream(tmpPath);
      stream.pipe(res);
      stream.on('close', () => fs.unlink(tmpPath, () => {}));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Export preview (row count only, no file)
  app.post('/api/export/demand/preview', auth, (req, res) => {
    const { areas = [], purpose, dateFrom, dateTo, minConfidence, propertyType } = req.body || {};
    let where = ["(digested_at IS NULL OR digested_at='')"];
    const params = [];
    if (areas.length > 0) {
      const normalized = areas.map(normalizeArea);
      where.push('(' + normalized.map(() => '(location LIKE ? OR location_cluster LIKE ?)').join(' OR ') + ')');
      normalized.forEach(a => params.push(`%${a}%`, `%${a}%`));
    }
    if (purpose) { where.push('purpose=?'); params.push(purpose); }
    if (dateFrom) { where.push('created_at>=?'); params.push(dateFrom); }
    if (dateTo) { where.push('created_at<=?'); params.push(dateTo); }
    if (minConfidence) { where.push('confidence>=?'); params.push(minConfidence); }
    if (propertyType) { where.push('property_type=?'); params.push(propertyType); }
    const count = db.prepare(`SELECT COUNT(*) as c FROM demand WHERE ${where.join(' AND ')}`).get(...params).c;
    res.json({ count });
  });

  // Start the broker scheduler
  startBrokerScheduler(db);

  // Run initial asset matching (with notify)
  setTimeout(() => {
    const n = runAssetMatchingWithNotify(db, null);
    console.log(`[features] Initial asset matching: ${n} new matches`);
  }, 6000);

  console.log('✅ Features module loaded: My Assets + Broker Management');
}

module.exports = { init, runAssetMatchingWithNotify, exportAssetLeads, sendBrokerSheet, exportDemandSheet };
