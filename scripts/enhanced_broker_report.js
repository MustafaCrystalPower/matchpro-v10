#!/usr/bin/env node
// Enhanced Broker Report Generator for MatchPro
// Groups matches by supply broker, shows listings + matched buyers, hot leads section
// Output: /tmp/enhanced_broker_report_[DATE].xlsx

const Database = require('better-sqlite3');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../data/matchpro.db');
const DATE_STR = new Date().toISOString().split('T')[0].replace(/-/g, '');
const OUTPUT_PATH = `/tmp/enhanced_broker_report_${DATE_STR}.xlsx`;

// ==================
// Utility functions
// ==================

function formatPrice(price) {
  if (!price && price !== 0) return 'N/A';
  const num = Math.round(price);
  return num.toLocaleString('en-US') + ' EGP';
}

function cleanPhone(phone) {
  if (!phone) return '';
  return phone.replace('@c.us', '').replace('@g.us', '').replace('@s.whatsapp.net', '').trim();
}

function cleanText(text) {
  if (!text) return '';
  return text.trim().replace(/\s+/g, ' ');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toISOString().split('T')[0];
  } catch (e) { return dateStr; }
}

function translatePropertyType(type) {
  const t = {
    'apartment': 'Apartment', 'villa': 'Villa', 'house': 'House',
    'office': 'Office', 'shop': 'Shop', 'land': 'Land',
    'duplex': 'Duplex', 'townhouse': 'Townhouse', 'chalet': 'Chalet',
    'studio': 'Studio', 'penthouse': 'Penthouse', 'warehouse': 'Warehouse',
    'building': 'Building', 'farm': 'Farm',
  };
  if (!type) return 'Unknown';
  return t[type.toLowerCase().trim()] || type;
}

// ==================
// Style helpers
// ==================

const COLORS = {
  headerBg: 'FF1A3A5C',       // Dark navy
  headerFont: 'FFFFFFFF',      // White
  sectionBg: 'FF2E75B6',       // Blue
  sectionFont: 'FFFFFFFF',     // White
  brokerBg: 'FF4472C4',        // Medium blue
  brokerFont: 'FFFFFFFF',
  colHeaderBg: 'FFD9E1F2',     // Light blue
  colHeaderFont: 'FF1A3A5C',   // Dark navy
  rowEven: 'FFF2F7FF',         // Very light blue
  rowOdd: 'FFFFFFFF',          // White
  hotLeadBg: 'FFFFF2CC',       // Light yellow
  hotLeadFont: 'FF7F6000',     // Dark gold
  greenBg: 'FFE2EFDA',
  redBg: 'FFFFC7CE',
  scoreHigh: 'FF548235',       // Green
  scoreMedium: 'FFFFC000',     // Orange
};

function applyBorder(cell) {
  cell.border = {
    top: { style: 'thin', color: { argb: 'FFB8CCE4' } },
    bottom: { style: 'thin', color: { argb: 'FFB8CCE4' } },
    left: { style: 'thin', color: { argb: 'FFB8CCE4' } },
    right: { style: 'thin', color: { argb: 'FFB8CCE4' } },
  };
}

function styleHeaderRow(row, bgColor, fontColor, fontSize = 11) {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    cell.font = { color: { argb: fontColor }, bold: true, size: fontSize };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    applyBorder(cell);
  });
  row.height = 22;
}

function styleDataRow(row, isEven, isHotLead = false) {
  const bgColor = isHotLead ? COLORS.hotLeadBg : (isEven ? COLORS.rowEven : COLORS.rowOdd);
  const fontColor = isHotLead ? COLORS.hotLeadFont : 'FF000000';
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    cell.font = { color: { argb: fontColor }, size: 10 };
    cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    applyBorder(cell);
  });
  row.height = 18;
}

// ==================
// Main
// ==================

async function main() {
  console.log('=== Enhanced Broker Report Generator ===\n');
  
  const db = new Database(DB_PATH);
  
  // Get all matches with supply broker info
  const allMatches = db.prepare(`
    SELECT 
      m.id, m.match_score,
      m.supply_name, m.supply_phone, m.supply_location, m.supply_property_type,
      m.supply_bedrooms, m.supply_price, m.supply_size, m.supply_purpose,
      m.demand_name, m.demand_phone, m.demand_location, m.demand_price_max,
      m.demand_bedrooms, m.demand_purpose,
      m.created_at, m.match_summary, m.status
    FROM matches m
    WHERE m.supply_name IS NOT NULL AND m.supply_name != ''
      AND m.match_score >= 60
    ORDER BY m.supply_name, m.match_score DESC, m.created_at DESC
  `).all();

  // Get hot leads (buyers with budget > 5M EGP)
  const hotLeads = db.prepare(`
    SELECT DISTINCT
      demand_name, demand_phone, demand_location, demand_price_max,
      demand_property_type, demand_bedrooms, demand_purpose,
      COUNT(*) as match_count,
      MAX(match_score) as best_score,
      MAX(created_at) as last_seen
    FROM matches
    WHERE demand_price_max > 5000000
      AND (demand_name IS NOT NULL AND demand_name != '')
      AND match_score >= 60
    GROUP BY demand_phone
    ORDER BY demand_price_max DESC, match_count DESC
    LIMIT 100
  `).all();

  // Get summary stats
  const stats = db.prepare(`
    SELECT 
      COUNT(DISTINCT supply_name) as broker_count,
      COUNT(*) as total_matches,
      COUNT(CASE WHEN match_score = 100 THEN 1 END) as perfect_matches,
      COUNT(CASE WHEN demand_price_max > 5000000 THEN 1 END) as hot_lead_matches
    FROM matches
    WHERE match_score >= 60
  `).get();

  db.close();

  // Group by broker
  const brokerMap = {};
  for (const m of allMatches) {
    const brokerKey = cleanText(m.supply_name) || 'Unknown Broker';
    if (!brokerMap[brokerKey]) {
      brokerMap[brokerKey] = {
        name: brokerKey,
        phone: cleanPhone(m.supply_phone),
        matches: []
      };
    }
    brokerMap[brokerKey].matches.push(m);
  }

  // Sort brokers by match count descending
  const brokers = Object.values(brokerMap).sort((a, b) => b.matches.length - a.matches.length);
  
  console.log(`Total brokers: ${brokers.length}`);
  console.log(`Total matches: ${allMatches.length}`);
  console.log(`Hot leads: ${hotLeads.length}`);

  // Create workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MatchPro v8';
  workbook.created = new Date();
  workbook.title = 'CPI Enhanced Broker Report';

  // ==============================
  // Sheet 1: Summary Dashboard
  // ==============================
  const summarySheet = workbook.addWorksheet('📊 Summary', {
    views: [{ state: 'frozen', ySplit: 5 }]
  });

  summarySheet.columns = [
    { width: 35 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 20 }
  ];

  // Title
  summarySheet.mergeCells('A1:E1');
  const titleCell = summarySheet.getCell('A1');
  titleCell.value = '🏠 CRYSTAL POWER INVESTMENTS — BROKER MATCH REPORT';
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } };
  titleCell.font = { color: { argb: COLORS.headerFont }, bold: true, size: 16 };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  summarySheet.getRow(1).height = 35;

  summarySheet.mergeCells('A2:E2');
  const subtitleCell = summarySheet.getCell('A2');
  subtitleCell.value = `Generated: ${new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })} | Score Threshold: ≥ 60`;
  subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.sectionBg } };
  subtitleCell.font = { color: { argb: COLORS.sectionFont }, size: 11 };
  subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  summarySheet.getRow(2).height = 22;

  // Stats row headers
  summarySheet.getRow(4).values = ['', 'Total Brokers', 'Total Matches', 'Perfect Matches (100)', 'Hot Lead Matches (>5M)'];
  styleHeaderRow(summarySheet.getRow(4), COLORS.colHeaderBg, COLORS.colHeaderFont);

  summarySheet.getRow(5).values = ['📈 Stats', stats.broker_count, stats.total_matches, stats.perfect_matches, stats.hot_lead_matches];
  styleDataRow(summarySheet.getRow(5), true);

  summarySheet.addRow([]);

  // Broker performance table header
  summarySheet.getRow(7).values = ['Broker Name', 'Phone', 'Total Matches', 'Perfect Matches', 'Hot Lead Buyers'];
  styleHeaderRow(summarySheet.getRow(7), COLORS.brokerBg, COLORS.brokerFont);

  let rowIdx = 0;
  for (const broker of brokers) {
    const perfectCount = broker.matches.filter(m => m.match_score === 100).length;
    const hotBuyers = broker.matches.filter(m => m.demand_price_max > 5000000).length;
    const row = summarySheet.addRow([
      broker.name, broker.phone, broker.matches.length, perfectCount, hotBuyers
    ]);
    styleDataRow(row, rowIdx % 2 === 0);
    rowIdx++;
  }

  // ==============================
  // Sheet 2: Broker Details
  // ==============================
  const detailSheet = workbook.addWorksheet('📋 Broker Details', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  detailSheet.columns = [
    { key: 'broker', header: 'Broker', width: 25 },
    { key: 'score', header: 'Score', width: 8 },
    { key: 'supply_location', header: 'Property Location', width: 20 },
    { key: 'property_type', header: 'Type', width: 12 },
    { key: 'bedrooms', header: 'BR', width: 5 },
    { key: 'supply_price', header: 'Asking Price', width: 16 },
    { key: 'buyer_name', header: 'Matched Buyer', width: 25 },
    { key: 'buyer_phone', header: 'Buyer Phone', width: 18 },
    { key: 'buyer_location', header: 'Buyer Area', width: 20 },
    { key: 'budget', header: 'Budget', width: 16 },
    { key: 'match_date', header: 'Match Date', width: 12 },
    { key: 'summary', header: 'Summary', width: 45 },
  ];

  styleHeaderRow(detailSheet.getRow(1), COLORS.headerBg, COLORS.headerFont, 11);

  rowIdx = 0;
  for (const broker of brokers) {
    for (const m of broker.matches) {
      const isHotLead = m.demand_price_max > 5000000;
      const row = detailSheet.addRow({
        broker: broker.name,
        score: m.match_score,
        supply_location: cleanText(m.supply_location),
        property_type: translatePropertyType(m.supply_property_type),
        bedrooms: m.supply_bedrooms || '',
        supply_price: formatPrice(m.supply_price),
        buyer_name: cleanText(m.demand_name) || 'Unknown',
        buyer_phone: cleanPhone(m.demand_phone),
        buyer_location: cleanText(m.demand_location),
        budget: formatPrice(m.demand_price_max),
        match_date: formatDate(m.created_at),
        summary: cleanText(m.match_summary),
      });
      styleDataRow(row, rowIdx % 2 === 0, isHotLead);
      rowIdx++;
    }
  }

  detailSheet.autoFilter = { from: 'A1', to: 'L1' };

  // ==============================
  // Sheet 3: Hot Leads
  // ==============================
  const hotSheet = workbook.addWorksheet('🔥 Hot Leads (>5M EGP)', {
    views: [{ state: 'frozen', ySplit: 4 }]
  });

  hotSheet.columns = [
    { width: 30 }, { width: 20 }, { width: 20 }, { width: 18 },
    { width: 12 }, { width: 8 }, { width: 15 }, { width: 12 }, { width: 15 },
  ];

  // Title
  hotSheet.mergeCells('A1:I1');
  const hotTitle = hotSheet.getCell('A1');
  hotTitle.value = '🔥 HOT LEADS — Buyers with Budget > 5,000,000 EGP';
  hotTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF6600' } };
  hotTitle.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 14 };
  hotTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  hotSheet.getRow(1).height = 30;

  hotSheet.mergeCells('A2:I2');
  const hotSubtitle = hotSheet.getCell('A2');
  hotSubtitle.value = `${hotLeads.length} qualified hot leads | Prioritize these contacts for high-value deals`;
  hotSubtitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC000' } };
  hotSubtitle.font = { color: { argb: 'FF7F6000' }, bold: true, size: 11 };
  hotSubtitle.alignment = { horizontal: 'center', vertical: 'middle' };
  hotSheet.getRow(2).height = 22;

  hotSheet.addRow([]);

  // Headers
  hotSheet.getRow(4).values = [
    'Buyer Name', 'Phone', 'Preferred Area', 'Max Budget (EGP)',
    'Property Type', 'Bedrooms', 'Purpose', 'Matches', 'Best Score'
  ];
  styleHeaderRow(hotSheet.getRow(4), 'FFFF6600', 'FFFFFFFF');

  rowIdx = 0;
  for (const lead of hotLeads) {
    const row = hotSheet.addRow([
      cleanText(lead.demand_name),
      cleanPhone(lead.demand_phone),
      cleanText(lead.demand_location),
      formatPrice(lead.demand_price_max),
      translatePropertyType(lead.demand_property_type),
      lead.demand_bedrooms || '',
      lead.demand_purpose || '',
      lead.match_count,
      lead.best_score,
    ]);
    
    // All hot lead rows get yellow background
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowIdx % 2 === 0 ? 'FFFFF2CC' : 'FFFFECB3' } };
      cell.font = { color: { argb: 'FF7F6000' }, size: 10 };
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
      applyBorder(cell);
    });
    row.height = 18;
    rowIdx++;
  }

  hotSheet.autoFilter = { from: 'A4', to: 'I4' };

  // ==============================
  // Save workbook
  // ==============================
  await workbook.xlsx.writeFile(OUTPUT_PATH);
  
  const fileSize = fs.statSync(OUTPUT_PATH).size;
  console.log(`\n✅ Enhanced broker report saved to: ${OUTPUT_PATH}`);
  console.log(`   File size: ${(fileSize / 1024).toFixed(1)} KB`);
  console.log(`   Sheets: Summary, Broker Details (${allMatches.length} rows), Hot Leads (${hotLeads.length} entries)`);
  
  return {
    outputPath: OUTPUT_PATH,
    brokerCount: brokers.length,
    matchRows: allMatches.length,
    hotLeadCount: hotLeads.length,
    fileSize
  };
}

main().then(result => {
  const stats = JSON.parse(fs.readFileSync('/tmp/fix_stats.json', 'utf8'));
  const statsAll = { ...stats, brokerReport: result };
  fs.writeFileSync('/tmp/report_stats.json', JSON.stringify(statsAll, null, 2));
  console.log('All stats saved to /tmp/report_stats.json');
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
