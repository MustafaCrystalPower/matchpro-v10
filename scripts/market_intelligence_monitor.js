#!/usr/bin/env node
/**
 * MatchPro Market Intelligence Monitor
 * Crystal Power Investments — CPI
 * Runs every 12 hours (6AM + 6PM Cairo)
 *
 * Generates structured Excel with 5 sheets:
 *   1. Supply       — all active listings
 *   2. Demand       — all buyer/renter requests
 *   3. Matches      — high-confidence supply↔demand pairs
 *   4. Market Heat  — segment-level scoring (area × type × purpose)
 *   5. Gaps         — demand with no matching supply (opportunity zones)
 *
 * Reverse mode (on-demand via CLI args):
 *   node market_intelligence_monitor.js --mode=supply --query="فيلا مدينتي 40M"
 *   node market_intelligence_monitor.js --mode=demand --asset="CPI-PRIVADO"
 */

'use strict';

const Database = require('better-sqlite3');
const ExcelJS  = require('exceljs');
const path     = require('path');
const fs       = require('fs');
const { execSync } = require('child_process');

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const DB_PATH     = '/home/work/.openclaw/workspace/matchpro-v2/data/matchpro.db';
const OUT_DIR     = '/home/work/.openclaw/workspace/reports/market-intelligence';
const GREEN_API   = 'https://7105.api.greenapi.com/waInstance7105409203';
const GREEN_TOKEN = '0e7ca429980f4331ae5fee4360c955a9db2d6fe3ca6545a4b3';
const WA_TARGET   = '201066505665@c.us';

// Lookback window for "recent" data (last 12h in scheduled mode, last 7d for full snapshot)
const HOURS_BACK  = parseInt(process.env.HOURS_BACK || '12');
const FULL_MODE   = process.env.FULL_MODE === '1';   // export ALL data regardless of window

// ─── KEYWORDS ────────────────────────────────────────────────────────────────
// Auto-fetched dynamically from DB + hardcoded Egyptian real estate terms
const RE_KEYWORDS = {
  property_types: [
    'شقة','apartment','فيلا','villa','دوبلكس','duplex','تاون هاوس','townhouse',
    'بنتهاوس','penthouse','ستوديو','studio','روف','roof','محل','shop','مكتب','office',
    'أرض','land','مخزن','warehouse','عيادة','clinic','وحدة','unit'
  ],
  purposes: ['بيع','sale','للبيع','إيجار','rent','للإيجار','تمليك','إيجار قانون'],
  locations: [
    'مدينتي','Madinaty','القاهرة الجديدة','New Cairo','التجمع','Fifth Settlement',
    'الشيخ زايد','Sheikh Zayed','أكتوبر','6th October','الرحاب','Rehab',
    'المعادي','Maadi','الزمالك','Zamalek','مصر الجديدة','Heliopolis',
    'العاصمة الإدارية','New Capital','الساحل الشمالي','North Coast',
    'الغردقة','Hurghada','شرم الشيخ','Sharm El Sheikh','سوهو','Soho',
    'بريفادو','Privado','ميفيدا','Mivida','بلوم فيلدز','Bloomfields',
    'ماونتن فيو','Mountain View','دريم لاند','Dreamland','بالم هيلز','Palm Hills'
  ],
  price_indicators: ['مليون','M','EGP','جنيه','ألف','K','USD','SAR'],
  quality_signals:  ['فاخر','luxury','سوبر لوكس','super lux','لوكس','lux','نظيف','متشطب']
};

// ─── ARGS ─────────────────────────────────────────────────────────────────────
const args      = process.argv.slice(2);
const modeArg   = (args.find(a => a.startsWith('--mode=')) || '').replace('--mode=','');
const queryArg  = (args.find(a => a.startsWith('--query=')) || '').replace('--query=','');
const assetArg  = (args.find(a => a.startsWith('--asset=')) || '').replace('--asset=','');
const REVERSE   = modeArg === 'supply' || modeArg === 'demand';

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function ts() { return new Date().toISOString().replace('T',' ').slice(0,19); }

function sendWhatsApp(msg) {
  try {
    const payload = JSON.stringify({ chatId: WA_TARGET, message: msg });
    execSync(`curl -s -X POST '${GREEN_API}/sendMessage/${GREEN_TOKEN}' \
      -H 'Content-Type: application/json' -d '${payload.replace(/'/g,"'\\''")}'`);
  } catch(e) { console.error('WA send failed:', e.message); }
}

const PUBLIC_BASE = 'http://20.69.29.54:8000/reports/market-intelligence';
const PUBLIC_DIR  = '/home/work/.openclaw/workspace/cpi-platform/public/reports/market-intelligence';

function sendFileWhatsApp(filePath, caption) {
  try {
    const filename = path.basename(filePath);
    // Ensure file is in public dir (symlinked dir should already cover it)
    const pubPath = path.join(PUBLIC_DIR, filename);
    if (!fs.existsSync(pubPath)) {
      try { fs.copyFileSync(filePath, pubPath); } catch(_) {}
    }
    const url = `${PUBLIC_BASE}/${encodeURIComponent(filename)}`;
    const payload = JSON.stringify({ chatId: WA_TARGET, urlFile: url, fileName: filename, caption });
    const safePayload = payload.replace(/'/g, "'\''");
    execSync(`curl -s -X POST '${GREEN_API}/sendFileByUrl/${GREEN_TOKEN}' -H 'Content-Type: application/json' -d '${safePayload}'`);
    console.log(`📎 File sent via URL: ${url}`);
  } catch(e) { console.error('WA file send failed:', e.message); }
}

function styleHeader(row, color = 'FF1F3A6E') {
  row.eachCell(cell => {
    cell.fill   = { type:'pattern', pattern:'solid', fgColor:{ argb: color } };
    cell.font   = { bold:true, color:{ argb:'FFFFFFFF' }, size:10 };
    cell.border = {
      top:    { style:'thin' }, bottom: { style:'thin' },
      left:   { style:'thin' }, right:  { style:'thin' }
    };
    cell.alignment = { vertical:'middle', wrapText:true };
  });
}

function autoWidth(sheet, min=8, max=40) {
  sheet.columns.forEach(col => {
    let maxLen = min;
    col.eachCell({ includeEmpty:false }, cell => {
      const v = cell.value ? String(cell.value) : '';
      maxLen = Math.max(maxLen, v.length);
    });
    col.width = Math.min(maxLen + 2, max);
  });
}

function flagIncomplete(row, requiredFields) {
  const missing = requiredFields.filter(f => !row[f] || row[f] === '' || row[f] === null);
  return missing.length > 0 ? `⚠️ Missing: ${missing.join(', ')}` : '✅';
}

function dedup(rows, keyFn) {
  const seen = new Set();
  return rows.filter(r => {
    const k = keyFn(r);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function heatScore(supplyCount, demandCount) {
  if (demandCount === 0) return { score: 0, label: '⚪ Dead' };
  const ratio = demandCount / Math.max(supplyCount, 1);
  if (ratio >= 5)  return { score: 5, label: '🔴 Ultra Hot' };
  if (ratio >= 3)  return { score: 4, label: '🟠 Very Hot' };
  if (ratio >= 2)  return { score: 3, label: '🟡 Hot' };
  if (ratio >= 1)  return { score: 2, label: '🟢 Balanced' };
  return             { score: 1, label: '🔵 Supply Heavy' };
}

// ─── DB QUERIES ──────────────────────────────────────────────────────────────
function openDB() {
  return new Database(DB_PATH, { readonly: true });
}

function getSupply(db, hoursBack, full) {
  const cutoff = full ? '2000-01-01' :
    new Date(Date.now() - hoursBack * 3600000).toISOString();
  return db.prepare(`
    SELECT s.*,
           COALESCE(bs.broker_score, 0)  AS broker_score,
           COALESCE(bs.listing_count, 0) AS broker_listing_count
    FROM   supply s
    LEFT JOIN broker_scores bs ON bs.phone = s.sender_phone
    WHERE  s.created_at >= ?
    ORDER  BY s.created_at DESC
  `).all(cutoff);
}

function getDemand(db, hoursBack, full) {
  const cutoff = full ? '2000-01-01' :
    new Date(Date.now() - hoursBack * 3600000).toISOString();
  return db.prepare(`
    SELECT * FROM demand
    WHERE  created_at >= ?
    ORDER  BY created_at DESC
  `).all(cutoff);
}

function getMatches(db, hoursBack, full) {
  const cutoff = full ? '2000-01-01' :
    new Date(Date.now() - hoursBack * 3600000).toISOString();
  return db.prepare(`
    SELECT * FROM matches
    WHERE  created_at >= ?
      AND  match_score >= 60
    ORDER  BY match_score DESC
    LIMIT  2000
  `).all(cutoff);
}

function getAssetMatches(db, assetCode) {
  return db.prepare(`
    SELECT am.*, a.asset_code, a.property_type AS asset_type,
           a.location AS asset_location, a.price AS asset_price
    FROM   asset_matches am
    JOIN   assets a ON a.id = am.asset_id
    WHERE  a.asset_code = ?
    ORDER  BY am.match_score DESC
  `).all(assetCode);
}

function getAssets(db) {
  return db.prepare('SELECT * FROM assets ORDER BY created_at DESC').all();
}

// ─── SHEET BUILDERS ──────────────────────────────────────────────────────────
function buildSupplySheet(wb, supply) {
  const ws = wb.addWorksheet('📦 Supply', { properties:{ tabColor:{ argb:'FF1565C0' }}});
  ws.addRow([
    '#','Source','Date','Group','Sender','Phone','Location','Area','City',
    'Type','Purpose','Price','Unit','Beds','Size (m²)','Floor',
    'Confidence','Features','Broker Score','Raw Message','Quality Flag'
  ]);
  styleHeader(ws.getRow(1), 'FF1565C0');
  ws.getRow(1).height = 22;

  let i = 1;
  for (const r of supply) {
    const flag = flagIncomplete(r, ['location','property_type','price']);
    const row = ws.addRow([
      i++, r.source || 'WhatsApp',
      r.created_at ? r.created_at.slice(0,16) : '',
      r.group_name || '',
      r.sender_name || '',
      r.sender_phone || '',
      r.location || '',
      r.area || '',
      r.city || '',
      r.property_type || '',
      r.purpose || '',
      r.price || '',
      r.price_unit || 'EGP',
      r.bedrooms || '',
      r.size || '',
      r.floor || '',
      r.confidence ? `${r.confidence}%` : '',
      (r.features || '').slice(0,80),
      r.broker_score || 0,
      (r.raw_message || '').slice(0,120),
      flag
    ]);
    if (flag !== '✅') {
      row.getCell(21).fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFFFF9C4' }};
    }
    if (r.broker_score >= 70) {
      row.getCell(19).font = { bold:true, color:{ argb:'FF1B5E20' }};
    }
  }
  autoWidth(ws);
  ws.getRow(1).freeze = true;
  ws.views = [{ state:'frozen', ySplit:1 }];
  return supply.length;
}

function buildDemandSheet(wb, demand) {
  const ws = wb.addWorksheet('🔍 Demand', { properties:{ tabColor:{ argb:'FF6A1B9A' }}});
  ws.addRow([
    '#','Date','Group','Sender','Phone','Location','Area','City',
    'Type','Purpose','Budget Min','Budget Max','Unit','Beds',
    'Size Min (m²)','Size Max (m²)','Confidence','Original Message','Quality Flag'
  ]);
  styleHeader(ws.getRow(1), 'FF6A1B9A');
  ws.getRow(1).height = 22;

  let i = 1;
  for (const r of demand) {
    const flag = flagIncomplete(r, ['location','property_type','price_max']);
    const row = ws.addRow([
      i++,
      r.created_at ? r.created_at.slice(0,16) : '',
      r.group_name || '',
      r.sender_name || '',
      r.sender_phone || '',
      r.location || '',
      r.area || '',
      r.city || '',
      r.property_type || '',
      r.purpose || '',
      r.price_min || '',
      r.price_max || '',
      'EGP',
      r.bedrooms || '',
      r.size_min || '',
      r.size_max || '',
      r.confidence ? `${r.confidence}%` : '',
      (r.original_message || r.raw_message || '').slice(0,120),
      flag
    ]);
    if (flag !== '✅') {
      row.getCell(19).fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFFFF9C4' }};
    }
  }
  autoWidth(ws);
  ws.views = [{ state:'frozen', ySplit:1 }];
  return demand.length;
}

function buildMatchesSheet(wb, matches) {
  const ws = wb.addWorksheet('🎯 Matches', { properties:{ tabColor:{ argb:'FF2E7D32' }}});
  ws.addRow([
    '#','Score','Date','Supply Location','Supply Type','Supply Price',
    'Supply Beds','Supply Size','Supply Phone','Supply Group',
    'Demand Location','Demand Budget Max','Demand Type','Demand Beds',
    'Demand Phone','Demand Group','Match Summary'
  ]);
  styleHeader(ws.getRow(1), 'FF2E7D32');
  ws.getRow(1).height = 22;

  let i = 1;
  for (const r of matches) {
    const score = r.match_score || 0;
    const row = ws.addRow([
      i++, `${score}%`,
      r.created_at ? r.created_at.slice(0,16) : '',
      r.supply_location || '',
      r.supply_property_type || '',
      r.supply_price || '',
      r.supply_bedrooms || '',
      r.supply_size || '',
      r.supply_phone || '',
      r.supply_group || '',
      r.demand_location || '',
      r.demand_price_max || '',
      r.demand_property_type || '',
      r.demand_bedrooms || '',
      r.demand_phone || '',
      r.demand_group || '',
      (r.match_summary || '').slice(0,100)
    ]);
    // Color by score
    const scoreCell = row.getCell(2);
    if (score >= 90)      scoreCell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF43A047' }};
    else if (score >= 75) scoreCell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFFDD835' }};
    else if (score >= 60) scoreCell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFFFA726' }};
    scoreCell.font = { bold:true };
  }
  autoWidth(ws);
  ws.views = [{ state:'frozen', ySplit:1 }];
  return matches.length;
}

function buildHeatSheet(wb, supply, demand) {
  const ws = wb.addWorksheet('🌡️ Market Heat', { properties:{ tabColor:{ argb:'FFC62828' }}});
  ws.addRow([
    'Location','Property Type','Purpose',
    'Supply Count','Demand Count','D/S Ratio','Heat Score','Heat Label',
    'Avg Supply Price (EGP)','Avg Demand Budget (EGP)','Price Gap'
  ]);
  styleHeader(ws.getRow(1), 'FFC62828');
  ws.getRow(1).height = 22;

  // Build segment map
  const segments = {};
  const key = (loc, type, purpose) => `${(loc||'Unknown').slice(0,20)}|${(type||'Unknown').slice(0,20)}|${(purpose||'Unknown').slice(0,15)}`;

  for (const r of supply) {
    const k = key(r.location_cluster || r.location, r.property_type, r.purpose);
    if (!segments[k]) segments[k] = { loc: r.location_cluster||r.location, type: r.property_type, purpose: r.purpose, supply:[], demand:[] };
    segments[k].supply.push(r.price || 0);
  }
  for (const r of demand) {
    const k = key(r.location_cluster || r.location, r.property_type, r.purpose);
    if (!segments[k]) segments[k] = { loc: r.location_cluster||r.location, type: r.property_type, purpose: r.purpose, supply:[], demand:[] };
    segments[k].demand.push(r.price_max || 0);
  }

  // Sort by heat (demand/supply ratio desc)
  const rows = Object.values(segments)
    .sort((a,b) => (b.demand.length / Math.max(b.supply.length,1)) - (a.demand.length / Math.max(a.supply.length,1)));

  for (const seg of rows) {
    const sc   = seg.supply.length;
    const dc   = seg.demand.length;
    const heat = heatScore(sc, dc);
    const avgS = sc ? Math.round(seg.supply.filter(p=>p>0).reduce((a,b)=>a+b,0) / Math.max(seg.supply.filter(p=>p>0).length,1)) : 0;
    const avgD = dc ? Math.round(seg.demand.filter(p=>p>0).reduce((a,b)=>a+b,0) / Math.max(seg.demand.filter(p=>p>0).length,1)) : 0;
    const gap  = avgD && avgS ? (avgD > avgS ? `+${(avgD-avgS).toLocaleString()} (demand > supply)` : `-${(avgS-avgD).toLocaleString()} (supply > demand)`) : '';

    const row = ws.addRow([
      seg.loc || '', seg.type || '', seg.purpose || '',
      sc, dc,
      sc > 0 ? (dc/sc).toFixed(2) : 'N/A',
      heat.score, heat.label,
      avgS ? avgS.toLocaleString() : '',
      avgD ? avgD.toLocaleString() : '',
      gap
    ]);

    const heatColors = {
      5: 'FFEF5350', 4: 'FFFF7043', 3: 'FFFFC107',
      2: 'FF66BB6A', 1: 'FF42A5F5', 0: 'FFB0BEC5'
    };
    row.getCell(8).fill = { type:'pattern', pattern:'solid', fgColor:{ argb: heatColors[heat.score] || 'FFB0BEC5' }};
    row.getCell(8).font = { bold:true };
  }

  autoWidth(ws);
  ws.views = [{ state:'frozen', ySplit:1 }];
  return rows.length;
}

function buildGapsSheet(wb, supply, demand, matches) {
  const ws = wb.addWorksheet('🕳️ Gaps', { properties:{ tabColor:{ argb:'FFE65100' }}});
  ws.addRow([
    '#','Demand Location','Type','Purpose','Budget Max (EGP)',
    'Beds','Sender','Phone','Group','Message Preview',
    'Supply Count in Area','Gap Severity','Opportunity Note'
  ]);
  styleHeader(ws.getRow(1), 'FFE65100');
  ws.getRow(1).height = 22;

  // Find demand with 0 or low matches
  const matchedDemandIds = new Set(matches.map(m => m.demand_id));
  const supplyByLocation = {};
  for (const s of supply) {
    const loc = (s.location_cluster || s.location || '').toLowerCase();
    supplyByLocation[loc] = (supplyByLocation[loc] || 0) + 1;
  }

  const gaps = demand
    .filter(d => !matchedDemandIds.has(d.id))
    .filter(d => d.price_max && d.price_max > 0); // only qualified demand

  let i = 1;
  for (const r of gaps.slice(0, 500)) {
    const loc = (r.location_cluster || r.location || '').toLowerCase();
    const supCount = supplyByLocation[loc] || 0;
    const severity = supCount === 0 ? '🔴 No Supply' : supCount < 3 ? '🟠 Low Supply' : '🟡 Weak Match';
    const opp = supCount === 0
      ? `Zero listings in ${r.location || 'this area'} — high acquisition opportunity`
      : `${supCount} listings but no match — consider acquiring matching ${r.property_type || 'unit'}`;

    const row = ws.addRow([
      i++,
      r.location || '',
      r.property_type || '',
      r.purpose || '',
      r.price_max ? r.price_max.toLocaleString() : '',
      r.bedrooms || '',
      r.sender_name || '',
      r.sender_phone || '',
      r.group_name || '',
      (r.original_message || r.raw_message || '').slice(0, 100),
      supCount,
      severity,
      opp
    ]);

    if (supCount === 0) {
      row.getCell(12).fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFEF9A9A' }};
    }
  }

  autoWidth(ws);
  ws.views = [{ state:'frozen', ySplit:1 }];
  return gaps.length;
}

function buildSummarySheet(wb, stats, runMode, windowLabel) {
  const ws = wb.addWorksheet('📊 Summary', { properties:{ tabColor:{ argb:'FF37474F' }}});
  ws.mergeCells('A1:D1');
  ws.getCell('A1').value = '🏢 Crystal Power Investments — MatchPro Market Intelligence Report';
  ws.getCell('A1').font  = { bold:true, size:14, color:{ argb:'FF1F3A6E' }};
  ws.getCell('A1').alignment = { horizontal:'center' };

  ws.addRow([]);
  ws.addRow(['Generated At',    ts()]);
  ws.addRow(['Mode',            runMode === 'scheduled' ? '🕐 Scheduled (12h)' : `🔍 Reverse — ${runMode}`]);
  ws.addRow(['Data Window',     windowLabel]);
  ws.addRow(['Database',        DB_PATH]);
  ws.addRow([]);
  ws.addRow(['Sheet',           'Record Count', 'Notes', '']);
  styleHeader(ws.getRow(7), 'FF37474F');

  ws.addRow(['📦 Supply',       stats.supply,   'Active listings from all sources']);
  ws.addRow(['🔍 Demand',       stats.demand,   'Buyer/renter requests']);
  ws.addRow(['🎯 Matches',      stats.matches,  'High-confidence pairs (≥60% score)']);
  ws.addRow(['🌡️ Market Heat',  stats.heat,     'Segments ranked by demand pressure']);
  ws.addRow(['🕳️ Gaps',         stats.gaps,     'Demand with no matching supply = opportunity']);

  ws.addRow([]);
  ws.addRow(['⚡ Key Insights', '', '', '']);
  ws.getRow(ws.lastRow.number).getCell(1).font = { bold:true, size:11 };

  const topGapNote = stats.gaps > 50
    ? `🔴 ${stats.gaps} unmatched demand records — major inventory opportunity`
    : stats.gaps > 10
    ? `🟡 ${stats.gaps} unmatched demand — moderate gap`
    : `🟢 ${stats.gaps} gaps — supply is broadly meeting demand`;

  const matchRate = stats.demand > 0 ? ((stats.matches / stats.demand) * 100).toFixed(1) : 0;

  ws.addRow(['Match Rate', `${matchRate}%`, matchRate >= 50 ? '✅ Healthy' : matchRate >= 25 ? '⚠️ Moderate' : '🔴 Low — grow supply']);
  ws.addRow(['Gap Summary', topGapNote]);
  ws.addRow([]);
  ws.addRow(['Reverse Mode Instructions', '', '', '']);
  ws.getRow(ws.lastRow.number).getCell(1).font = { bold:true };
  ws.addRow(['Supply search', 'node market_intelligence_monitor.js --mode=supply --query="فيلا مدينتي 40M"']);
  ws.addRow(['Demand search', 'node market_intelligence_monitor.js --mode=demand --asset="CPI-PRIVADO"']);

  ws.columns[0].width = 26;
  ws.columns[1].width = 35;
  ws.columns[2].width = 50;
}

// ─── REVERSE MODE ─────────────────────────────────────────────────────────────
function runReverseMode(db, mode, query, assetCode) {
  console.log(`\n🔍 Reverse Mode: ${mode}`);

  if (mode === 'supply') {
    // User has a demand query → find all matching supply
    const terms = query.toLowerCase().split(/\s+/);
    const allSupply = db.prepare('SELECT * FROM supply ORDER BY created_at DESC').all();
    const results = allSupply.filter(s => {
      const text = [s.location, s.property_type, s.purpose, s.raw_message].join(' ').toLowerCase();
      return terms.some(t => text.includes(t));
    });
    console.log(`Found ${results.length} matching supply listings for: "${query}"`);
    return results;
  }

  if (mode === 'demand') {
    // User has an asset → find all matching demand
    if (assetCode) {
      return getAssetMatches(db, assetCode);
    }
    // Generic demand search by query
    const terms = query.toLowerCase().split(/\s+/);
    const allDemand = db.prepare('SELECT * FROM demand ORDER BY created_at DESC').all();
    const results = allDemand.filter(d => {
      const text = [d.location, d.property_type, d.purpose, d.raw_message, d.original_message].join(' ').toLowerCase();
      return terms.some(t => text.includes(t));
    });
    console.log(`Found ${results.length} demand records matching: "${query || assetCode}"`);
    return results;
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🚀 MatchPro Market Intelligence Monitor — ${ts()}`);
  console.log(`   Mode: ${REVERSE ? `Reverse (${modeArg})` : 'Scheduled'} | Window: ${FULL_MODE ? 'ALL data' : `Last ${HOURS_BACK}h`}`);

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive:true });

  const db = openDB();

  // ── Handle reverse mode ───────────────────────────────────────────────────
  if (REVERSE) {
    const results = runReverseMode(db, modeArg, queryArg, assetArg);
    db.close();

    const wb   = new ExcelJS.Workbook();
    const ws   = wb.addWorksheet(`🔍 ${modeArg === 'supply' ? 'Supply Results' : 'Demand Results'}`);
    const cols  = modeArg === 'supply'
      ? ['#','Location','Type','Purpose','Price','Beds','Size','Sender','Phone','Group','Date','Message']
      : ['#','Sender','Phone','Location','Type','Purpose','Budget Max','Beds','Date','Message'];

    ws.addRow(cols);
    styleHeader(ws.getRow(1), 'FF1565C0');

    let i = 1;
    for (const r of results) {
      if (modeArg === 'supply') {
        ws.addRow([i++, r.location, r.property_type, r.purpose, r.price,
          r.bedrooms, r.size, r.sender_name, r.sender_phone, r.group_name,
          (r.created_at||'').slice(0,16), (r.raw_message||'').slice(0,100)]);
      } else {
        ws.addRow([i++, r.sender_name||r.demand_name, r.sender_phone||r.demand_phone,
          r.location||r.demand_location, r.property_type||r.demand_property_type,
          r.purpose||r.demand_purpose, r.price_max||r.demand_price_max||r.demand_budget,
          r.bedrooms||r.demand_bedrooms, (r.created_at||'').slice(0,16),
          (r.raw_message||r.demand_message||r.original_message||'').slice(0,100)]);
      }
    }
    autoWidth(ws);

    const fname = `reverse_${modeArg}_${Date.now()}.xlsx`;
    const fpath = path.join(OUT_DIR, fname);
    await wb.xlsx.writeFile(fpath);
    console.log(`✅ Saved: ${fpath} (${results.length} rows)`);

    const summary = `🔍 *MatchPro Reverse Search*\nMode: ${modeArg === 'supply' ? 'Supply for demand query' : 'Demand for asset'}\nQuery: "${queryArg || assetArg}"\nResults: ${results.length} records\nFile: ${fname}`;
    sendWhatsApp(summary);
    if (fs.existsSync(fpath)) sendFileWhatsApp(fpath, summary);
    return;
  }

  // ── Scheduled mode ────────────────────────────────────────────────────────
  const windowLabel = FULL_MODE ? 'All historical data' : `Last ${HOURS_BACK} hours`;
  console.log(`\n📥 Fetching data (${windowLabel})...`);

  let supply  = getSupply(db, HOURS_BACK, FULL_MODE);
  let demand  = getDemand(db, HOURS_BACK, FULL_MODE);
  let matches = getMatches(db, HOURS_BACK, FULL_MODE);

  // Dedup
  supply  = dedup(supply,  r => r.external_id || `${r.sender_phone}_${r.raw_message?.slice(0,30)}`);
  demand  = dedup(demand,  r => r.external_id || `${r.sender_phone}_${(r.raw_message||r.original_message)?.slice(0,30)}`);
  matches = dedup(matches, r => r.external_id || `${r.supply_id}_${r.demand_id}`);

  console.log(`   Supply:  ${supply.length} listings`);
  console.log(`   Demand:  ${demand.length} requests`);
  console.log(`   Matches: ${matches.length} pairs`);
  db.close();

  if (supply.length === 0 && demand.length === 0) {
    console.log('⚠️  No new data in window. Sending brief update.');
    sendWhatsApp(`📊 *MatchPro Intelligence Monitor*\n🕐 ${ts()}\n\nNo new supply or demand in the last ${HOURS_BACK} hours. Market quiet — no report generated.`);
    return;
  }

  // ── Build Excel ───────────────────────────────────────────────────────────
  console.log('\n📊 Building Excel report...');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Crystal Power Investments';
  wb.created  = new Date();

  const stats = {
    supply:  buildSupplySheet(wb, supply),
    demand:  buildDemandSheet(wb, demand),
    matches: buildMatchesSheet(wb, matches),
    heat:    buildHeatSheet(wb, supply, demand),
    gaps:    0
  };
  stats.gaps = (() => {
    const matchedIds = new Set(matches.map(m => m.demand_id));
    const gaps = demand.filter(d => !matchedIds.has(d.id) && d.price_max > 0);
    buildGapsSheet(wb, supply, demand, matches);
    return gaps.length;
  })();

  buildSummarySheet(wb, stats, 'scheduled', windowLabel);

  // Summary sheet already added last; reorder not needed

  // ── Save & send ───────────────────────────────────────────────────────────
  const dateStr = new Date().toISOString().slice(0,10);
  const timeStr = new Date().toTimeString().slice(0,5).replace(':','h');
  const fname   = `CPI_Market_Intelligence_${dateStr}_${timeStr}.xlsx`;
  const fpath   = path.join(OUT_DIR, fname);

  await wb.xlsx.writeFile(fpath);
  const size = (fs.statSync(fpath).size / 1024).toFixed(1);
  console.log(`\n✅ Saved: ${fpath} (${size} KB)`);

  const matchRate = demand.length > 0 ? ((matches.length / demand.length) * 100).toFixed(1) : 0;
  const topHeat = supply.length > 0 || demand.length > 0 ? '🔴 مدينتي' : '—'; // TODO: derive dynamically

  const waMsg = [
    `📊 *CPI Market Intelligence Report*`,
    `🕐 ${ts()} Cairo`,
    ``,
    `📦 Supply:      ${stats.supply} listings`,
    `🔍 Demand:      ${stats.demand} requests`,
    `🎯 Matches:     ${stats.matches} pairs (${matchRate}% match rate)`,
    `🕳️ Gaps:         ${stats.gaps} unmatched demand`,
    `🌡️ Segments:    ${stats.heat} analyzed`,
    ``,
    `📁 File: ${fname}`,
    `📏 Size: ${size} KB`,
    ``,
    `✅ 5 sheets: Supply | Demand | Matches | Market Heat | Gaps`
  ].join('\n');

  sendWhatsApp(waMsg);
  if (fs.existsSync(fpath)) {
    sendFileWhatsApp(fpath, `📊 CPI Market Intelligence — ${dateStr} ${timeStr}`);
  }

  console.log('\n📱 WhatsApp delivery done.');
  console.log('\n📈 Summary:');
  console.log(`   Supply:  ${stats.supply} | Demand: ${stats.demand} | Matches: ${stats.matches} | Gaps: ${stats.gaps}`);
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  try {
    execSync(`curl -s -X POST '${GREEN_API}/sendMessage/${GREEN_TOKEN}' \
      -H 'Content-Type: application/json' \
      -d '{"chatId":"${WA_TARGET}","message":"❌ Market Intelligence Monitor failed: ${err.message.slice(0,200)}"}'`);
  } catch(_) {}
  process.exit(1);
});
