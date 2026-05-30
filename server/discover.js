/**
 * MatchPro Reverse Discovery Engine — POST /api/discover
 * Crystal Power Investments — v1.0
 *
 * Given ANY signal (free Arabic/English text, or structured params),
 * returns ALL matching signals from the opposite side, ranked by score + close probability.
 *
 * Modes:
 *   auto   — detect type from text, return opposite
 *   supply — caller has supply → return matching demand
 *   demand — caller has demand → return matching supply
 *   asset  — caller provides asset_code → return matched demand from asset_matches table
 *
 * Request:
 *   POST /api/discover
 *   {
 *     "signal":    "شقة 3 غرف مدينتي بادجت 4M تمليك",   // free text OR
 *     "asset":     "CPI-PRIVADO",                          // asset code OR
 *     "market":    "real_estate",                          // optional filter
 *     "mode":      "auto|supply|demand|asset",             // default: auto
 *     "min_score": 0.70,                                   // default: 0.55
 *     "limit":     20,                                     // default: 20, max: 100
 *     "area":      "مدينتي",                               // optional pre-filter
 *     "purpose":   "sale|rent",                            // optional pre-filter
 *     "hours_back": 168                                    // default: all time
 *   }
 *
 * Response:
 *   {
 *     "parsed": { type, location_area, location_cluster, bedrooms, budget_max/price, purpose, property_type },
 *     "mode":   "demand_to_supply" | "supply_to_demand" | "asset_to_demand",
 *     "matches": [ { signal_id, score, close_prob_24h, type, name, phone, area, price/budget, message, days_ago, source, group } ],
 *     "total":   N,
 *     "query_ms": N,
 *     "stats":  { searched, matched, filtered_by_score, avg_score }
 *   }
 */

'use strict';

const { parseRealEstateMessage } = require('./nlp_v2');
const { calculateMatch }         = require('./matching_v2');

// ── Close Probability Heuristic ───────────────────────────────────────────────
// Based on: match score + recency + confidence of original signal
function closeProbability(matchScore, daysAgo, confidence) {
  let base = matchScore / 100;

  // Recency boost: fresher = higher close prob
  if (daysAgo <= 1)       base *= 1.20;
  else if (daysAgo <= 3)  base *= 1.10;
  else if (daysAgo <= 7)  base *= 1.00;
  else if (daysAgo <= 14) base *= 0.85;
  else if (daysAgo <= 30) base *= 0.65;
  else                    base *= 0.40;

  // Confidence boost
  if (confidence >= 0.8) base *= 1.10;
  else if (confidence >= 0.6) base *= 1.00;
  else base *= 0.85;

  return Math.min(parseFloat(base.toFixed(3)), 0.99);
}

// ── Days ago helper ───────────────────────────────────────────────────────────
function daysAgo(dateStr) {
  if (!dateStr) return 999;
  const d = new Date(dateStr);
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

// ── Parse price from free text ────────────────────────────────────────────────
function extractPriceFromText(text) {
  if (!text) return null;
  const m = text.match(/(\d+(?:\.\d+)?)\s*(?:M|مليون|million)/i);
  if (m) return parseFloat(m[1]) * 1_000_000;
  const m2 = text.match(/(\d+(?:,\d{3})+)/);
  if (m2) return parseInt(m2[1].replace(/,/g, ''));
  const m3 = text.match(/(\d{6,})/);
  if (m3) return parseInt(m3[1]);
  return null;
}

// ── Main discover handler factory ─────────────────────────────────────────────
module.exports = function discoverRouter(db) {

  return async function handleDiscover(req, res) {
    const t0 = Date.now();

    try {
      const {
        signal     = '',
        asset      = '',
        market     = 'real_estate',
        mode       = 'auto',
        min_score  = 0.55,
        limit      = 20,
        area       = '',
        purpose    = '',
        hours_back = null
      } = req.body || {};

      const minScore  = parseFloat(min_score) || 0.55;
      const maxLimit  = Math.min(parseInt(limit) || 20, 100);
      const cutoff    = hours_back
        ? new Date(Date.now() - parseInt(hours_back) * 3600000).toISOString()
        : '2000-01-01';

      // ── ASSET MODE ──────────────────────────────────────────────────────────
      if (mode === 'asset' || asset) {
        const assetCode = (asset || signal).trim().toUpperCase();
        const assetRow  = db.prepare('SELECT * FROM assets WHERE asset_code = ? OR asset_code = ?')
                            .get(assetCode, assetCode.replace(/^CPI-/, ''));
        if (!assetRow) {
          return res.status(404).json({ error: `Asset not found: ${assetCode}`, available_assets: db.prepare('SELECT asset_code, property_type, location FROM assets').all() });
        }

        const matches = db.prepare(`
          SELECT am.*, d.sender_name, d.sender_phone, d.group_name, d.original_message,
                 d.created_at, d.confidence, d.location AS demand_location,
                 d.property_type AS demand_type, d.purpose AS demand_purpose,
                 d.price_min, d.price_max, d.bedrooms
          FROM   asset_matches am
          JOIN   demand d ON d.id = am.demand_id
          WHERE  am.asset_id = ? AND am.match_score >= ?
          ORDER  BY am.match_score DESC
          LIMIT  ?
        `).all(assetRow.id, minScore * 100, maxLimit);

        const results = matches.map(m => ({
          signal_id:      m.demand_id,
          score:          parseFloat((m.match_score / 100).toFixed(3)),
          close_prob_24h: closeProbability(m.match_score, daysAgo(m.created_at), m.confidence || 0.7),
          type:           'demand',
          name:           m.sender_name || m.demand_name || 'Unknown',
          phone:          m.sender_phone || m.demand_phone || '',
          area:           m.demand_location || '',
          budget_min:     m.price_min || 0,
          budget_max:     m.price_max || m.demand_budget || 0,
          bedrooms:       m.bedrooms || null,
          purpose:        m.demand_purpose || '',
          property_type:  m.demand_type || '',
          message:        (m.original_message || m.demand_message || '').slice(0, 200),
          days_ago:       daysAgo(m.created_at),
          source:         'whatsapp',
          group:          m.group_name || '',
          wa_link:        m.wa_link || null,
          is_broker:      m.is_broker || false,
          broker_score:   m.broker_score || 0
        }));

        return res.json({
          parsed:   { type: 'asset', asset_code: assetCode, asset: { type: assetRow.property_type, location: assetRow.location, price: assetRow.price } },
          mode:     'asset_to_demand',
          matches:  results,
          total:    results.length,
          query_ms: Date.now() - t0,
          stats:    { searched: matches.length, matched: results.length, avg_score: results.length ? parseFloat((results.reduce((a,b) => a+b.score, 0) / results.length).toFixed(3)) : 0 }
        });
      }

      // ── PARSE SIGNAL TEXT ────────────────────────────────────────────────────
      if (!signal || signal.trim().length < 3) {
        return res.status(400).json({ error: 'Provide either "signal" (text) or "asset" (asset code)' });
      }

      const parsed   = parseRealEstateMessage(signal);
      const sigType  = parsed.classification || 'unknown';

      // Price fallback — try raw text extraction
      if (!parsed.price && !parsed.priceMax) {
        const p = extractPriceFromText(signal);
        if (p) {
          if (sigType === 'supply') parsed.price = p;
          else parsed.priceMax = p;
        }
      }

      // Determine direction
      let resolvedMode = mode;
      if (resolvedMode === 'auto') {
        resolvedMode = (sigType === 'supply') ? 'supply' : 'demand';
      }

      const responseMode = resolvedMode === 'supply' ? 'supply_to_demand' : 'demand_to_supply';

      // Area override
      const filterArea    = area || parsed.locationCluster || parsed.location || null;
      const filterPurpose = purpose || parsed.purpose || null;

      // ── SUPPLY → find matching DEMAND ───────────────────────────────────────
      if (resolvedMode === 'supply') {
        let query = `SELECT * FROM demand WHERE created_at >= ? AND confidence >= 0.3`;
        const params = [cutoff];
        if (filterArea) { query += ` AND (LOWER(location_cluster) = LOWER(?) OR location LIKE ? OR location_cluster LIKE ? OR location_cluster IS NULL)`; params.push(filterArea, `%${filterArea}%`, `%${filterArea}%`); }
        // Purpose is used in scoring, not pre-filtering (too many rows have empty purpose)
        query += ` ORDER BY created_at DESC LIMIT 3000`;

        const candidates = db.prepare(query).all(...params);
        const scored = [];

        for (const d of candidates) {
          const supplyObj = {
            location:         parsed.location || filterArea || '',
            location_cluster: parsed.locationCluster || '',
            price:            parsed.price || 0,
            purpose:          parsed.purpose || '',
            property_type:    parsed.propertyType || '',
            bedrooms:         parsed.bedrooms || null
          };
          const demandObj = {
            location:         d.location || '',
            location_cluster: d.location_cluster || '',
            price_max:        d.price_max || 0,
            purpose:          d.purpose || '',
            property_type:    d.property_type || '',
            bedrooms:         d.bedrooms || null
          };
          const s = calculateMatch(supplyObj, demandObj);
          if (!s.skip && s.matchScore >= minScore * 100) {
            scored.push({ row: d, score: s.matchScore, breakdown: s });
          }
        }

        scored.sort((a, b) => b.score - a.score);
        const top = scored.slice(0, maxLimit);

        const results = top.map(({ row: d, score, breakdown }) => ({
          signal_id:      d.id,
          score:          parseFloat((score / 100).toFixed(3)),
          close_prob_24h: closeProbability(score, daysAgo(d.created_at), d.confidence || 0.6),
          type:           'demand',
          name:           d.sender_name || 'Unknown',
          phone:          d.sender_phone || '',
          area:           d.location || d.location_cluster || '',
          area_cluster:   d.location_cluster || '',
          budget_min:     d.price_min || 0,
          budget_max:     d.price_max || 0,
          bedrooms:       d.bedrooms || null,
          purpose:        d.purpose || '',
          property_type:  d.property_type || '',
          message:        (d.original_message || d.raw_message || '').slice(0, 200),
          days_ago:       daysAgo(d.created_at),
          source:         'whatsapp',
          group:          d.group_name || '',
          score_breakdown: breakdown
        }));

        const searched = candidates.length;
        return res.json({
          parsed:   { type: 'supply', location_area: parsed.location, location_cluster: parsed.locationCluster, price: parsed.price, purpose: parsed.purpose, property_type: parsed.propertyType, bedrooms: parsed.bedrooms },
          mode:     responseMode,
          matches:  results,
          total:    results.length,
          query_ms: Date.now() - t0,
          stats:    { searched, matched: results.length, filtered_by_score: scored.length - results.length, avg_score: results.length ? parseFloat((results.reduce((a,b) => a+b.score, 0) / results.length).toFixed(3)) : 0 }
        });
      }

      // ── DEMAND → find matching SUPPLY ───────────────────────────────────────
      let query = `SELECT s.*, COALESCE(bs.broker_score, 0) AS broker_score FROM supply s LEFT JOIN broker_scores bs ON bs.phone = s.sender_phone WHERE s.created_at >= ? AND s.confidence >= 0.3`;
      const params = [cutoff];
      if (filterArea) { query += ` AND (LOWER(s.location_cluster) = LOWER(?) OR s.location LIKE ? OR s.location_cluster LIKE ? OR s.location_cluster IS NULL)`; params.push(filterArea, `%${filterArea}%`, `%${filterArea}%`); }
      // Purpose is used in scoring, not pre-filtering (too many rows have empty purpose)
      query += ` ORDER BY s.created_at DESC LIMIT 3000`;

      const candidates = db.prepare(query).all(...params);
      const scored = [];

      for (const s of candidates) {
        const supplyObj = {
          location:         s.location || '',
          location_cluster: s.location_cluster || '',
          price:            s.price || 0,
          purpose:          s.purpose || '',
          property_type:    s.property_type || '',
          bedrooms:         s.bedrooms || null
        };
        const demandObj = {
          location:         parsed.location || filterArea || '',
          location_cluster: parsed.locationCluster || '',
          price_max:        parsed.priceMax || 0,
          purpose:          parsed.purpose || filterPurpose || '',
          property_type:    parsed.propertyType || '',
          bedrooms:         parsed.bedrooms || null
        };
        const sc = calculateMatch(supplyObj, demandObj);
        if (!sc.skip && sc.matchScore >= minScore * 100) {
          scored.push({ row: s, score: sc.matchScore, breakdown: sc });
        }
      }

      scored.sort((a, b) => b.score - a.score);
      const top = scored.slice(0, maxLimit);

      const results = top.map(({ row: s, score, breakdown }) => ({
        signal_id:      s.id,
        score:          parseFloat((score / 100).toFixed(3)),
        close_prob_24h: closeProbability(score, daysAgo(s.created_at), (s.confidence || 60) / 100),
        type:           'supply',
        name:           s.sender_name || 'Unknown',
        phone:          s.sender_phone || '',
        area:           s.location || s.location_cluster || '',
        area_cluster:   s.location_cluster || '',
        price:          s.price || 0,
        price_unit:     s.price_unit || 'EGP',
        bedrooms:       s.bedrooms || null,
        size:           s.size || null,
        floor:          s.floor || null,
        purpose:        s.purpose || '',
        property_type:  s.property_type || '',
        features:       s.features || '',
        message:        (s.raw_message || '').slice(0, 200),
        days_ago:       daysAgo(s.created_at),
        source:         s.source || 'whatsapp',
        group:          s.group_name || '',
        broker_score:   s.broker_score || 0,
        score_breakdown: breakdown
      }));

      const searched = candidates.length;
      return res.json({
        parsed:   { type: parsed.classification || sigType, location_area: parsed.location, location_cluster: parsed.locationCluster, budget_max: parsed.priceMax, purpose: parsed.purpose, property_type: parsed.propertyType, bedrooms: parsed.bedrooms },
        mode:     responseMode,
        matches:  results,
        total:    results.length,
        query_ms: Date.now() - t0,
        stats:    { searched, matched: results.length, filtered_by_score: scored.length - results.length, avg_score: results.length ? parseFloat((results.reduce((a,b) => a+b.score, 0) / results.length).toFixed(3)) : 0 }
      });

    } catch (err) {
      console.error('[/api/discover] Error:', err);
      return res.status(500).json({ error: err.message, stack: process.env.NODE_ENV === 'development' ? err.stack : undefined });
    }
  };
};
