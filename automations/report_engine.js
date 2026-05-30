/**
 * MatchPro™ Report Engine
 * Builds 4-sheet Excel with demand, supply, matches, and insights
 * No external dependencies — pure self-hosted
 */
const ExcelJS = require('exceljs');
const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const cfg = require('./config');

// ─── Color Palette ────────────────────────────────────────
const C = {
  deepBlue:   '1B2A4A',
  gold:       'C9A84C',
  accent:     '2E5DA6',
  teal:       '1ABC9C',
  orange:     'E67E22',
  red:        'E74C3C',
  green:      '27AE60',
  lightGray:  'F5F7FA',
  midGray:    'DEE2E6',
  white:      'FFFFFF',
  darkText:   '2C3E50',
};

function styleHeader(row, bgColor, fgColor = 'FFFFFF') {
  row.eachCell(cell => {
    cell.font = { bold: true, color: { argb: fgColor }, size: 11, name: 'Calibri' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: C.midGray } },
      bottom: { style: 'thin', color: { argb: C.midGray } },
      left: { style: 'thin', color: { argb: C.midGray } },
      right: { style: 'thin', color: { argb: C.midGray } }
    };
  });
  row.height = 36;
}

function styleDataRow(row, isEven) {
  row.eachCell({ includeEmpty: true }, cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? C.lightGray : C.white } };
    cell.alignment = { vertical: 'middle', horizontal: 'right', wrapText: false };
    cell.font = { size: 10, name: 'Calibri', color: { argb: C.darkText } };
    cell.border = {
      top: { style: 'hair', color: { argb: C.midGray } },
      bottom: { style: 'hair', color: { argb: C.midGray } }
    };
  });
  row.height = 22;
}

function getDb() {
  return new Database(cfg.DB_PATH, { readonly: true });
}

function formatEGP(n) {
  if (!n || n <= 0) return '—';
  if (n >= 1000000) return `${(n/1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n/1000).toFixed(0)}K`;
  return n.toString();
}

function purposeLabel(p) {
  if (!p) return '—';
  p = p.toLowerCase();
  if (p.includes('rent') || p.includes('إيجار') || p.includes('ايجار')) return '🔵 إيجار';
  if (p.includes('sale') || p.includes('بيع') || p.includes('تمليك')) return '🔴 بيع';
  return p;
}

// ─── Sheet 1: DEMAND ────────────────────────────────────────
async function buildDemandSheet(ws, db) {
  ws.properties.defaultRowHeight = 22;

  // Title row
  ws.mergeCells('A1:H1');
  const title = ws.getCell('A1');
  title.value = '📋 الطلبات — Demand  |  MatchPro™ Intelligence Report';
  title.font = { bold: true, size: 14, color: { argb: C.white }, name: 'Calibri' };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.deepBlue } };
  title.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 44;

  // Subtitle
  ws.mergeCells('A2:H2');
  const sub = ws.getCell('A2');
  sub.value = `آخر 24 ساعة — تحديث: ${new Date().toLocaleString('ar-EG', {timeZone:'Africa/Cairo'})}`;
  sub.font = { size: 10, italic: true, color: { argb: C.accent } };
  sub.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 22;

  ws.addRow([]);

  // Headers
  const hRow = ws.addRow(['#', 'المنطقة', 'النوع', 'الغرض', 'الميزانية', 'المساحة', 'الجهة', 'تاريخ الطلب']);
  styleHeader(hRow, C.accent);
  ws.columns = [
    { key: 'num', width: 5 },
    { key: 'loc', width: 20 },
    { key: 'type', width: 16 },
    { key: 'purpose', width: 12 },
    { key: 'price', width: 14 },
    { key: 'size', width: 10 },
    { key: 'source', width: 18 },
    { key: 'date', width: 18 },
  ];

  const rows = db.prepare(`
    SELECT location, property_type, purpose, price_max, size_max, group_name, created_at
    FROM demand
    WHERE created_at > datetime('now', '-24 hours')
    ORDER BY created_at DESC
    LIMIT ?
  `).all(cfg.MAX_ROWS_PER_SHEET);

  rows.forEach((r, i) => {
    const dr = ws.addRow([
      i + 1,
      r.location || '—',
      r.property_type || '—',
      purposeLabel(r.purpose),
      formatEGP(r.price_max),
      r.size_max ? `${r.size_max}م²` : '—',
      (r.group_name || '—').replace('جروب ', '').slice(0, 22),
      r.created_at ? r.created_at.slice(0, 16).replace('T', ' ') : '—'
    ]);
    styleDataRow(dr, i % 2 === 0);

    // Color code by purpose
    const purp = (r.purpose || '').toLowerCase();
    if (purp.includes('rent') || purp.includes('إيجار')) {
      dr.getCell(4).font = { color: { argb: C.accent }, bold: true, size: 10 };
    } else if (purp.includes('sale') || purp.includes('بيع')) {
      dr.getCell(4).font = { color: { argb: C.red }, bold: true, size: 10 };
    }
  });

  // Freeze top rows
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 4 }];

  return rows.length;
}

// ─── Sheet 2: SUPPLY ─────────────────────────────────────────
async function buildSupplySheet(ws, db) {
  ws.properties.defaultRowHeight = 22;

  ws.mergeCells('A1:H1');
  const title = ws.getCell('A1');
  title.value = '🏠 العروض — Supply  |  MatchPro™ Intelligence Report';
  title.font = { bold: true, size: 14, color: { argb: C.white }, name: 'Calibri' };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.deepBlue } };
  title.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 44;

  ws.mergeCells('A2:H2');
  const sub = ws.getCell('A2');
  sub.value = `آخر 24 ساعة — تحديث: ${new Date().toLocaleString('ar-EG', {timeZone:'Africa/Cairo'})}`;
  sub.font = { size: 10, italic: true, color: { argb: C.teal } };
  sub.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 22;
  ws.addRow([]);

  const hRow = ws.addRow(['#', 'المنطقة', 'النوع', 'الغرض', 'السعر المطلوب', 'المساحة', 'الجهة', 'تاريخ العرض']);
  styleHeader(hRow, C.teal, 'FFFFFF');
  ws.columns = [
    { key: 'num', width: 5 },
    { key: 'loc', width: 20 },
    { key: 'type', width: 16 },
    { key: 'purpose', width: 12 },
    { key: 'price', width: 14 },
    { key: 'size', width: 10 },
    { key: 'source', width: 18 },
    { key: 'date', width: 18 },
  ];

  const rows = db.prepare(`
    SELECT location, property_type, purpose, price, size, group_name, created_at
    FROM supply
    WHERE created_at > datetime('now', '-24 hours')
    ORDER BY created_at DESC
    LIMIT ?
  `).all(cfg.MAX_ROWS_PER_SHEET);

  rows.forEach((r, i) => {
    const dr = ws.addRow([
      i + 1,
      r.location || '—',
      r.property_type || '—',
      purposeLabel(r.purpose),
      formatEGP(r.price),
      r.size ? `${r.size}م²` : '—',
      (r.group_name || '—').replace('جروب ', '').slice(0, 22),
      r.created_at ? r.created_at.slice(0, 16).replace('T', ' ') : '—'
    ]);
    styleDataRow(dr, i % 2 === 0);
  });

  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 4 }];
  return rows.length;
}

// ─── Sheet 3: TOP MATCHES ────────────────────────────────────
async function buildMatchesSheet(ws, db) {
  ws.properties.defaultRowHeight = 22;

  ws.mergeCells('A1:I1');
  const title = ws.getCell('A1');
  title.value = '🔗 أفضل الماتشات — Top Matches  |  MatchPro™ Intelligence Report';
  title.font = { bold: true, size: 14, color: { argb: C.white }, name: 'Calibri' };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.deepBlue } };
  title.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 44;

  ws.mergeCells('A2:I2');
  const sub = ws.getCell('A2');
  sub.value = 'ماتشات بدرجة ≥80% — مرتبة من الأعلى درجة';
  sub.font = { size: 10, italic: true, color: { argb: C.gold } };
  sub.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 22;
  ws.addRow([]);

  const hRow = ws.addRow(['#', 'درجة التطابق', 'المنطقة — طلب', 'النوع', 'الميزانية', 'المنطقة — عرض', 'السعر المطلوب', 'تاريخ', 'حالة']);
  styleHeader(hRow, C.gold, C.deepBlue);
  ws.columns = [
    { key: 'num', width: 5 },
    { key: 'score', width: 14 },
    { key: 'dloc', width: 20 },
    { key: 'type', width: 16 },
    { key: 'budget', width: 14 },
    { key: 'sloc', width: 20 },
    { key: 'sprice', width: 14 },
    { key: 'date', width: 16 },
    { key: 'status', width: 12 },
  ];

  const rows = db.prepare(`
    SELECT match_score, demand_location, demand_property_type, demand_price_max,
           supply_location, supply_price, created_at, status
    FROM matches
    WHERE match_score >= 80
      AND created_at > datetime('now', '-24 hours')
    ORDER BY match_score DESC
    LIMIT 300
  `).all();

  rows.forEach((r, i) => {
    const score = Math.round(r.match_score || 0);
    const scoreLabel = score >= 90 ? `🟢 ${score}%` : score >= 80 ? `🟡 ${score}%` : `⚪ ${score}%`;
    const dr = ws.addRow([
      i + 1,
      scoreLabel,
      r.demand_location || '—',
      r.demand_property_type || '—',
      formatEGP(r.demand_price_max),
      r.supply_location || '—',
      formatEGP(r.supply_price),
      r.created_at ? r.created_at.slice(0, 10) : '—',
      r.status === 'new' ? '🆕 جديد' : r.status || '—'
    ]);
    styleDataRow(dr, i % 2 === 0);

    // Highlight high score rows
    if (score >= 90) {
      dr.getCell(2).font = { bold: true, color: { argb: C.green }, size: 11 };
    } else if (score >= 85) {
      dr.getCell(2).font = { bold: true, color: { argb: C.orange }, size: 10 };
    }
  });

  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 4 }];
  return rows.length;
}

// ─── Sheet 4: INSIGHTS ────────────────────────────────────────
async function buildInsightsSheet(ws, db) {
  ws.properties.defaultRowHeight = 22;

  ws.mergeCells('A1:F1');
  const title = ws.getCell('A1');
  title.value = '📊 Market Intelligence  |  MatchPro™ Insights';
  title.font = { bold: true, size: 14, color: { argb: C.white }, name: 'Calibri' };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.deepBlue } };
  title.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 44;

  ws.mergeCells('A2:F2');
  ws.getCell('A2').value = '─── تحليل السوق لكل منطقة — 24 ساعة ───';
  ws.getCell('A2').font = { italic: true, color: { argb: C.midGray }, size: 10 };
  ws.getCell('A2').alignment = { horizontal: 'center' };
  ws.getRow(2).height = 18;
  ws.addRow([]);

  // ── Section 1: Area Intelligence ──
  ws.mergeCells('A4:F4');
  const s1h = ws.getCell('A4');
  s1h.value = '🏙️  تحليل المناطق — Demand vs Supply';
  s1h.font = { bold: true, size: 12, color: { argb: C.white } };
  s1h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.accent } };
  s1h.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(4).height = 30;

  const aHdr = ws.addRow(['المنطقة', 'الطلب (24h)', 'العرض (24h)', 'نسبة الطلب/عرض', 'أعلى ميزانية', 'تقييم السوق']);
  styleHeader(aHdr, C.midGray, C.deepBlue);
  ws.columns = [
    { key: 'area', width: 22 },
    { key: 'demand', width: 14 },
    { key: 'supply', width: 14 },
    { key: 'gap', width: 18 },
    { key: 'topBudget', width: 16 },
    { key: 'assessment', width: 28 },
  ];

  const areas = db.prepare(`
    SELECT location,
      COUNT(*) as cnt,
      MAX(price_max) as top_price
    FROM demand
    WHERE created_at > datetime('now', '-24 hours')
      AND location != ''
    GROUP BY location
    ORDER BY cnt DESC
    LIMIT 20
  `).all();

  areas.forEach((a, i) => {
    const supRow = db.prepare(`SELECT COUNT(*) as cnt FROM supply WHERE location LIKE ? AND created_at > datetime('now','-24 hours')`).get(`%${a.location}%`);
    const sCnt = supRow ? supRow.cnt : 0;
    const gap = sCnt > 0 ? (a.cnt / sCnt).toFixed(1) : a.cnt > 0 ? '∞' : '—';
    const gapNum = parseFloat(gap) || 0;

    let assessment = '—';
    if (gapNum >= 10) assessment = '🔥 فرصة ذهبية — supply نادر جداً';
    else if (gapNum >= 5) assessment = '📈 سوق ساخن — demand عالي';
    else if (gapNum >= 2) assessment = '⚖️ سوق نشط — طبيعي';
    else if (gapNum < 1 && gapNum > 0) assessment = '🔵 supply زيادة — تنافسية عالية';
    else if (a.cnt >= 10) assessment = '📊 طلب مرتفع';

    const dr = ws.addRow([
      a.location,
      a.cnt,
      sCnt,
      gap === '∞' ? '∞ — لا يوجد عرض' : `${gap}:1`,
      formatEGP(a.top_price),
      assessment
    ]);
    styleDataRow(dr, i % 2 === 0);

    // Highlight hot areas
    if (gapNum >= 5 || gap === '∞') {
      dr.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3CD' } };
      dr.getCell(4).font = { bold: true, color: { argb: C.orange }, size: 10 };
    }
  });

  ws.addRow([]);

  // ── Section 2: Property Type Breakdown ──
  const currentRow = ws.lastRow.number + 1;
  ws.mergeCells(`A${currentRow}:F${currentRow}`);
  const s2h = ws.getCell(`A${currentRow}`);
  s2h.value = '🏠  توزيع النوع العقاري — Property Type Breakdown';
  s2h.font = { bold: true, size: 12, color: { argb: C.white } };
  s2h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.teal } };
  s2h.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(currentRow).height = 30;

  const tHdr = ws.addRow(['نوع العقار', 'طلب (24h)', 'عرض (24h)', 'نسبة', 'متوسط الميزانية', 'التوصية']);
  styleHeader(tHdr, C.midGray, C.deepBlue);

  const types = db.prepare(`
    SELECT property_type, COUNT(*) as cnt, AVG(CASE WHEN price_max > 0 THEN price_max END) as avg_price
    FROM demand
    WHERE created_at > datetime('now', '-24 hours') AND property_type != ''
    GROUP BY property_type ORDER BY cnt DESC LIMIT 10
  `).all();

  types.forEach((t, i) => {
    const sRow = db.prepare(`SELECT COUNT(*) as cnt FROM supply WHERE property_type LIKE ? AND created_at > datetime('now','-24 hours')`).get(`%${t.property_type}%`);
    const ratio = sRow && sRow.cnt > 0 ? (t.cnt / sRow.cnt).toFixed(1) : '—';
    const avgP = t.avg_price ? formatEGP(Math.round(t.avg_price)) : '—';
    let rec = '—';
    if (t.property_type === 'apartment') rec = 'الأكثر طلباً — safe investment';
    else if (t.property_type === 'villa') rec = 'High value — premium market';
    else if (t.property_type === 'studio') rec = 'Rental yield عالي — شباب ومغتربين';
    else if (t.property_type === 'land') rec = 'Long-term — مطورون';
    else if (t.property_type === 'commercial') rec = 'عائد تجاري مرتفع';

    const dr = ws.addRow([t.property_type || '—', t.cnt, sRow?.cnt || 0, ratio === '—' ? '—' : `${ratio}:1`, avgP, rec]);
    styleDataRow(dr, i % 2 === 0);
  });

  ws.addRow([]);

  // ── Section 3: Who Benefits + Valuation ──
  const curRow2 = ws.lastRow.number + 1;
  ws.mergeCells(`A${curRow2}:F${curRow2}`);
  const s3h = ws.getCell(`A${curRow2}`);
  s3h.value = '💡  لمن هذه البيانات وما قيمتها الحقيقية؟';
  s3h.font = { bold: true, size: 12, color: { argb: C.white } };
  s3h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.gold } };
  s3h.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(curRow2).height = 30;

  const valRows = [
    ['🏗️ المطور العقاري', 'يعرف أي منطقة تحتاج supply جديد وأي نوع وبكم', '3,000–10,000 USD/شهر', 'يخطط مشاريعه بدقة ويحدد الأسعار المثلى'],
    ['🔬 باحث السوق', 'بيانات طلب وعرض حقيقية يومية — مش تقديرية', '1,000–5,000 USD/شهر', 'يصدر تقارير احترافية بمصداقية عالية'],
    ['💰 المستثمر', 'يكتشف المناطق ذات الفجوة قبل الجميع', '2,000–7,000 USD/شهر', 'يدخل السوق في الوقت الصح بأفضل سعر'],
    ['🤝 شركة الوساطة', 'طلبات حقيقية اليوم من عملاء جاهزين', '500–2,000 USD/شهر', 'يوفر وقت الحملات ويزيد نسبة الإغلاق'],
    ['🏦 البنوك والمحللون', 'مؤشرات السوق لصياغة القروض والتقييمات', '5,000–15,000 USD/شهر', 'أداة تقييم مخاطر في محفظة التمويل العقاري'],
  ];

  const vHdr = ws.addRow(['الفئة المستفيدة', 'ما الذي يحصل عليه؟', 'القيمة المقترحة', 'الفائدة المباشرة']);
  styleHeader(vHdr, C.midGray, C.deepBlue);

  valRows.forEach((r, i) => {
    const dr = ws.addRow(r);
    styleDataRow(dr, i % 2 === 0);
    dr.getCell(1).font = { bold: true, size: 11, color: { argb: C.deepBlue } };
    dr.getCell(3).font = { bold: true, size: 10, color: { argb: C.green } };
    dr.height = 28;
  });

  ws.addRow([]);

  // ── Section 4: Best Opportunity Guidance ──
  const curRow3 = ws.lastRow.number + 1;
  ws.mergeCells(`A${curRow3}:F${curRow3}`);
  const s4h = ws.getCell(`A${curRow3}`);
  s4h.value = '🎯  أعلى فرصة الآن — Highest Potential Action';
  s4h.font = { bold: true, size: 12, color: { argb: C.white } };
  s4h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.red } };
  s4h.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(curRow3).height = 30;

  // Find the hottest area (highest demand/supply gap)
  const hotAreas = db.prepare(`
    SELECT d.location, COUNT(d.id) as demand_cnt
    FROM demand d
    WHERE d.created_at > datetime('now', '-24 hours') AND d.location != ''
    GROUP BY d.location ORDER BY demand_cnt DESC LIMIT 5
  `).all();

  const aHdr2 = ws.addRow(['المنطقة الساخنة', 'الطلب', 'الفرصة', 'الإجراء المقترح', 'العائد المتوقع', 'مستوى الأولوية']);
  styleHeader(aHdr2, C.midGray, C.deepBlue);

  hotAreas.forEach((a, i) => {
    const sRow = db.prepare(`SELECT COUNT(*) as cnt FROM supply WHERE location LIKE ? AND created_at > datetime('now','-24 hours')`).get(`%${a.location}%`);
    const sCnt = sRow?.cnt || 0;
    const gap = sCnt > 0 ? (a.demand_cnt / sCnt).toFixed(1) : '∞';
    const action = sCnt === 0
      ? 'اعرض وحدة هنا فوراً — لا منافسة'
      : gap > 5 ? 'أعرض بسعر premium — الطلب يتحمل'
      : gap > 2 ? 'سعر سوق — حركة عالية'
      : 'سعر تنافسي — supply وافر';
    const roi = gap === '∞' || parseFloat(gap) > 5 ? '🔥 ممتاز' : parseFloat(gap) > 2 ? '✅ جيد' : '⚪ متوسط';
    const priority = i === 0 ? '🥇 أولوية قصوى' : i === 1 ? '🥈 عالي' : '🥉 متوسط';

    const dr = ws.addRow([a.location, a.demand_cnt, `Gap: ${gap}:1`, action, roi, priority]);
    styleDataRow(dr, i % 2 === 0);
    if (i === 0) dr.eachCell(c => { c.font = { bold: true, size: 10, color: { argb: C.red } }; });
  });

  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 4 }];
}

// ─── Sheet 5: BY AREA (Demand + Supply per area) ──────────────
async function buildAreaSheet(ws, db) {
  ws.properties.defaultRowHeight = 22;
  ws.mergeCells('A1:G1');
  const title = ws.getCell('A1');
  title.value = '🗺️ تفصيل المناطق — By Area Detail  |  MatchPro™';
  title.font = { bold: true, size: 14, color: { argb: C.white }, name: 'Calibri' };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.deepBlue } };
  title.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 44;
  ws.addRow([]);

  const areas = db.prepare(`
    SELECT DISTINCT location FROM demand
    WHERE created_at > datetime('now', '-24 hours') AND location != ''
    ORDER BY location LIMIT 20
  `).all();

  ws.columns = [
    { key: 'area', width: 20 }, { key: 'dCnt', width: 12 },
    { key: 'sCnt', width: 12 }, { key: 'gap', width: 12 },
    { key: 'topType', width: 16 }, { key: 'avgBudget', width: 16 }, { key: 'note', width: 30 }
  ];

  const hRow = ws.addRow(['المنطقة', 'الطلبات', 'العروض', 'الفجوة', 'أكثر نوع مطلوب', 'متوسط الميزانية', 'ملاحظة']);
  styleHeader(hRow, C.deepBlue);

  areas.forEach((a, i) => {
    const d = db.prepare(`SELECT COUNT(*) as cnt, AVG(CASE WHEN price_max > 0 AND price_max < 100000000 THEN price_max END) as avg FROM demand WHERE location=? AND created_at>datetime('now','-24 hours')`).get(a.location);
    const s = db.prepare(`SELECT COUNT(*) as cnt FROM supply WHERE location LIKE ? AND created_at>datetime('now','-24 hours')`).get(`%${a.location}%`);
    const topType = db.prepare(`SELECT property_type, COUNT(*) as c FROM demand WHERE location=? AND property_type!='' AND created_at>datetime('now','-24 hours') GROUP BY property_type ORDER BY c DESC LIMIT 1`).get(a.location);
    const gap = s?.cnt > 0 ? (d.cnt / s.cnt).toFixed(1) + ':1' : d.cnt > 0 ? '∞' : '—';
    const avgB = d.avg ? formatEGP(Math.round(d.avg)) : '—';
    const note = d.cnt >= 20 ? '🔥 حركة مكثفة' : d.cnt >= 10 ? '📈 نشط' : '⚪ محدود';

    const dr = ws.addRow([a.location, d.cnt, s?.cnt || 0, gap, topType?.property_type || '—', avgB, note]);
    styleDataRow(dr, i % 2 === 0);
  });

  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 3 }];
}

// ─── MAIN BUILD FUNCTION ──────────────────────────────────────
async function buildReport() {
  const db = getDb();
  const wb = new ExcelJS.Workbook();

  wb.creator = 'MatchPro™ Intelligence Engine';
  wb.created = new Date();
  wb.modified = new Date();
  wb.lastModifiedBy = 'MatchPro Auto-Report';

  // Add sheets
  const wsD = wb.addWorksheet('📋 Demand', { tabColor: { argb: C.accent } });
  const wsS = wb.addWorksheet('🏠 Supply', { tabColor: { argb: C.teal } });
  const wsM = wb.addWorksheet('🔗 Matches', { tabColor: { argb: C.gold } });
  const wsI = wb.addWorksheet('📊 Insights', { tabColor: { argb: C.orange } });
  const wsA = wb.addWorksheet('🗺️ By Area', { tabColor: { argb: C.deepBlue } });

  const [dCount, sCount, mCount] = await Promise.all([
    buildDemandSheet(wsD, db),
    buildSupplySheet(wsS, db),
    buildMatchesSheet(wsM, db)
  ]);
  await buildInsightsSheet(wsI, db);
  await buildAreaSheet(wsA, db);

  db.close();

  // Save to temp
  const fname = `MatchPro_Intel_${new Date().toISOString().slice(0,10)}_${Date.now()}.xlsx`;
  const fpath = path.join(os.tmpdir(), fname);
  await wb.xlsx.writeFile(fpath);

  return { path: fpath, name: fname, dCount, sCount, mCount };
}

module.exports = { buildReport };
