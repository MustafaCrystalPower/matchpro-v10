#!/usr/bin/env node
/**
 * MatchPro Auto-Matching Cycle — lightweight version
 * Runs every 30 min via crontab
 */
'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const { calculateMatchScore } = require('../server/matching_enhanced');

const DB_PATH = path.join(__dirname, '../data/matchpro.db');
const MIN_SCORE = 65;
const DEMAND_WINDOW_HOURS = 3;
const SUPPLY_WINDOW_DAYS = 7;
const MAX_SUPPLY = 300;
const MAX_DEMAND = 100;
const BATCH_SIZE = 10; // Process demand 10 at a time

const db = new Database(DB_PATH);

const checkExists = db.prepare('SELECT 1 FROM matches WHERE supply_id=? AND demand_id=?');

const insertMatch = db.prepare(`
  INSERT OR IGNORE INTO matches
  (external_id, supply_id, demand_id, match_score, location_score, price_score, specs_score,
   match_summary,
   supply_phone, supply_name, supply_location, supply_price, supply_property_type,
   supply_purpose, supply_group, supply_message,
   demand_phone, demand_name, demand_location, demand_price_max, demand_property_type,
   demand_purpose, demand_group, demand_message,
   status, notified, created_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
`);

function run() {
  const start = Date.now();

  const demands = db.prepare(`
    SELECT * FROM demand
    WHERE created_at >= datetime('now', '-${DEMAND_WINDOW_HOURS} hours')
    AND sender_phone NOT LIKE '%201066505665%'
    ORDER BY created_at DESC LIMIT ${MAX_DEMAND}
  `).all();

  const supplies = db.prepare(`
    SELECT * FROM supply
    WHERE created_at >= datetime('now', '-${SUPPLY_WINDOW_DAYS} days')
    ORDER BY created_at DESC LIMIT ${MAX_SUPPLY}
  `).all();

  console.log(`[match-cycle] ${new Date().toISOString()} | ${demands.length} demands x ${supplies.length} supplies`);

  let newMatches = 0;

  for (const dem of demands) {
    for (const sup of supplies) {
      if (dem.sender_phone === sup.sender_phone) continue;
      if (checkExists.get(sup.id, dem.id)) continue;

      const scores = calculateMatchScore(sup, dem);
      if (!scores || scores.matchScore < MIN_SCORE) continue;

      const extId = `ac_${sup.id}_${dem.id}`;
      const summary = `${dem.sender_name || dem.sender_phone} → ${scores.matchScore.toFixed(0)}% match with ${sup.sender_name || sup.sender_phone}`;

      try {
        insertMatch.run(
          extId, sup.id, dem.id,
          scores.matchScore, scores.locationScore || 0, scores.priceScore || 0, scores.specsScore || 0,
          summary,
          sup.sender_phone, sup.sender_name, sup.location_cluster || sup.location || '',
          sup.price, sup.property_type, sup.purpose, sup.group_name, sup.raw_message,
          dem.sender_phone, dem.sender_name, dem.location_cluster || dem.location || '',
          dem.price_max, dem.property_type, dem.purpose, dem.group_name, dem.raw_message,
          'new', 0
        );
        newMatches++;
      } catch(e) { /* duplicate — skip */ }
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[match-cycle] +${newMatches} new matches | ${elapsed}s`);
  db.close();
}

run();
