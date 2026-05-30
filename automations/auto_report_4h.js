#!/usr/bin/env node
/**
 * MatchPro Auto-Report — runs every 4 hours via cron
 * Generates fresh Excel intelligence sheets
 */
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const ExcelJS = require('exceljs');

const DB_PATH = path.join(__dirname, '..', 'data', 'matchpro.db');
const REPORTS_DIR = path.join(__dirname, '..', 'reports');
const STAMP = new Date().toISOString().replace(/[:T]/g,'-').slice(0,16);

if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

async function run() {
  const db = new Database(DB_PATH, { readonly: true });
  const wb = new ExcelJS.Workbook();
  wb.creator = "MatchPro Unified v8";
  wb.created = new Date();

  const fillHeader = (sheet, color) => {
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
  };

  // SHEET 1: Hot Demand 7d
  const s1 = wb.addWorksheet('🔥 Hot Demand 7d');
  s1.columns = [
    { header: 'ID', key: 'id', width: 8 },
    { header: 'Type', key: 'property_type', width: 16 },
    { header: 'Area', key: 'area', width: 22 },
    { header: 'City', key: 'city', width: 14 },
    { header: 'Purpose', key: 'purpose', width: 12 },
    { header: 'Price Min', key: 'price_min', width: 14 },
    { header: 'Price Max', key: 'price_max', width: 14 },
    { header: 'Bedrooms', key: 'bedrooms', width: 10 },
    { header: 'Buyer', key: 'sender_name', width: 18 },
    { header: 'Phone', key: 'sender_phone', width: 16 },
    { header: 'Source', key: 'group_name', width: 22 },
    { header: 'Created', key: 'created_at', width: 18 }
  ];
  const hot = db.prepare(`SELECT id, property_type, area, city, purpose, price_min, price_max, bedrooms, sender_name, sender_phone, group_name, created_at
                          FROM demand WHERE created_at > datetime('now','-7 days') ORDER BY created_at DESC LIMIT 300`).all();
  hot.forEach(r => s1.addRow(r));
  fillHeader(s1, 'FFD32F2F');

  // SHEET 2: Live Matches
  const s2 = wb.addWorksheet('🎯 Live Matches');
  s2.columns = [
    { header: 'ID', key: 'id', width: 8 },
    { header: 'Demand', key: 'demand_id', width: 10 },
    { header: 'Supply', key: 'supply_id', width: 10 },
    { header: 'Score', key: 'match_score', width: 10 },
    { header: 'Location', key: 'supply_location', width: 22 },
    { header: 'Type', key: 'supply_property_type', width: 16 },
    { header: 'Price', key: 'supply_price', width: 14 },
    { header: 'Beds', key: 'supply_bedrooms', width: 8 },
    { header: 'Seller', key: 'supply_name', width: 18 },
    { header: 'Phone', key: 'supply_phone', width: 16 },
    { header: 'Created', key: 'created_at', width: 18 }
  ];
  const matches = db.prepare(`SELECT id, demand_id, supply_id, match_score, supply_location, supply_property_type, supply_price, supply_bedrooms, supply_name, supply_phone, created_at
                              FROM matches ORDER BY match_score DESC, created_at DESC LIMIT 150`).all();
  matches.forEach(r => s2.addRow(r));
  fillHeader(s2, 'FF1976D2');

  // SHEET 3: Area Heat Map
  const s3 = wb.addWorksheet('📍 Area Heat Map');
  s3.columns = [
    { header: 'Area', key: 'area', width: 28 },
    { header: 'Demand Count', key: 'demand_count', width: 14 },
    { header: 'Supply Count', key: 'supply_count', width: 14 },
    { header: 'D/S Ratio', key: 'ratio', width: 12 },
    { header: 'Avg Demand Budget', key: 'avg_budget', width: 18 }
  ];
  const heat = db.prepare(`SELECT COALESCE(area, location) as area,
                                  COUNT(*) as demand_count,
                                  AVG((COALESCE(price_min,0)+COALESCE(price_max,0))/2) as avg_budget
                           FROM demand WHERE COALESCE(area,location) IS NOT NULL AND COALESCE(area,location) != ''
                           GROUP BY COALESCE(area,location) ORDER BY demand_count DESC LIMIT 40`).all();
  heat.forEach(r => {
    const sup = db.prepare(`SELECT COUNT(*) c FROM supply WHERE COALESCE(area,location)=?`).get(r.area);
    r.supply_count = sup?.c || 0;
    r.ratio = r.supply_count > 0 ? (r.demand_count / r.supply_count).toFixed(2) : '∞';
    s3.addRow(r);
  });
  fillHeader(s3, 'FF388E3C');

  // SHEET 4: Top Buyers
  const s4 = wb.addWorksheet('💰 Top Buyers');
  s4.columns = [
    { header: 'Buyer', key: 'sender_name', width: 22 },
    { header: 'Phone', key: 'sender_phone', width: 16 },
    { header: 'Demand Count', key: 'cnt', width: 14 },
    { header: 'Last Active', key: 'last_at', width: 20 },
    { header: 'Avg Budget', key: 'avg_budget', width: 16 }
  ];
  const buyers = db.prepare(`SELECT sender_name, sender_phone, COUNT(*) cnt,
                                    MAX(created_at) last_at,
                                    AVG((COALESCE(price_min,0)+COALESCE(price_max,0))/2) avg_budget
                             FROM demand WHERE sender_phone IS NOT NULL
                             GROUP BY sender_phone ORDER BY cnt DESC, last_at DESC LIMIT 50`).all();
  buyers.forEach(r => s4.addRow(r));
  fillHeader(s4, 'FFF57C00');

  // SHEET 5: KPIs Snapshot
  const s5 = wb.addWorksheet('📊 KPIs');
  const total_demand = db.prepare(`SELECT COUNT(*) c FROM demand`).get().c;
  const total_supply = db.prepare(`SELECT COUNT(*) c FROM supply`).get().c;
  const total_matches = db.prepare(`SELECT COUNT(*) c FROM matches`).get().c;
  const recent_demand = db.prepare(`SELECT COUNT(*) c FROM demand WHERE created_at > datetime('now','-7 days')`).get().c;
  const recent_matches = db.prepare(`SELECT COUNT(*) c FROM matches WHERE created_at > datetime('now','-7 days')`).get().c;
  const last_demand = db.prepare(`SELECT MAX(created_at) m FROM demand`).get().m;
  const last_match = db.prepare(`SELECT MAX(created_at) m FROM matches`).get().m;
  s5.addRows([
    ['Metric','Value'],
    ['Total Demand', total_demand],
    ['Total Supply', total_supply],
    ['Total Matches', total_matches],
    ['Demand last 7d', recent_demand],
    ['Matches last 7d', recent_matches],
    ['Last Demand At', last_demand],
    ['Last Match At', last_match],
    ['Report Generated', new Date().toISOString()]
  ]);
  s5.getRow(1).font = { bold: true };
  s5.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF424242' } };
  s5.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  db.close();
  const outPath = path.join(REPORTS_DIR, `MatchPro_Intelligence_${STAMP}.xlsx`);
  await wb.xlsx.writeFile(outPath);
  console.log(`✅ Report: ${outPath}`);
  console.log(`   demand=${total_demand} (${recent_demand} new 7d) supply=${total_supply} matches=${total_matches} (${recent_matches} new 7d)`);
  return outPath;
}

run().catch(e => { console.error('❌ Report failed:', e.message); process.exit(1); });
