/**
 * MatchPro AVM — Automated Valuation Model
 * Estimates property value from existing supply data
 */

function calculateAVM(db, { location, property_type, area_m2, bedrooms, purpose }) {
  const d = db(false);
  try {
    const params = [];
    let where = "price IS NOT NULL AND price > 0";

    if (location) {
      where += " AND (location LIKE ? OR area LIKE ? OR city LIKE ?)";
      const lp = `%${location}%`;
      params.push(lp, lp, lp);
    }
    if (property_type) { where += " AND property_type = ?"; params.push(property_type); }
    if (purpose) { where += " AND purpose = ?"; params.push(purpose); }
    if (bedrooms) { where += " AND (bedrooms = ? OR bedrooms IS NULL)"; params.push(bedrooms); }

    const rows = d.prepare(`SELECT price, size as size_sqm, bedrooms, location FROM supply WHERE ${where} ORDER BY created_at DESC LIMIT 500`).all(...params);

    if (rows.length === 0) {
      // Fallback: broader search just by location
      const fallback = location
        ? d.prepare("SELECT price, size as size_sqm FROM supply WHERE location LIKE ? AND price > 0 ORDER BY created_at DESC LIMIT 200").all(`%${location}%`)
        : d.prepare("SELECT price, size as size_sqm FROM supply WHERE price > 0 ORDER BY created_at DESC LIMIT 200").all();
      if (fallback.length === 0) return null;
      return computeStats(fallback, area_m2, 'low');
    }

    const confidence = rows.length >= 30 ? 'high' : rows.length >= 10 ? 'medium' : 'low';
    return computeStats(rows, area_m2, confidence, location);
  } finally {
    d.close();
  }
}

function computeStats(rows, area_m2, confidence, location) {
  const prices = rows.map(r => r.price).filter(p => p > 0).sort((a, b) => a - b);
  if (!prices.length) return null;

  const median = prices[Math.floor(prices.length / 2)];
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  const p25 = prices[Math.floor(prices.length * 0.25)];
  const p75 = prices[Math.floor(prices.length * 0.75)];
  const min = prices[0];
  const max = prices[prices.length - 1];

  // Price per m² (only from rows that have both price and size)
  const pricePerSqm = rows
    .filter(r => r.price > 0 && (r.size_sqm > 0 || r.size > 0))
    .map(r => r.price / (r.size_sqm || r.size));
  const avgPricePerSqm = pricePerSqm.length
    ? Math.round(pricePerSqm.reduce((a, b) => a + b, 0) / pricePerSqm.length)
    : 0;

  const estimatedValue = area_m2 && avgPricePerSqm
    ? Math.round(area_m2 * avgPricePerSqm)
    : Math.round(median);

  // Market heat: ratio of data points → demand density
  const heatScore = Math.min(100, Math.round((rows.length / 5)));

  return {
    estimated_value: estimatedValue,
    median,
    average: Math.round(avg),
    p25: Math.round(p25),
    p75: Math.round(p75),
    min: Math.round(min),
    max: Math.round(max),
    price_per_sqm: avgPricePerSqm,
    confidence,
    data_points: rows.length,
    market_heat: heatScore,
    location,
    currency: 'EGP',
    computed_at: new Date().toISOString()
  };
}

module.exports = function(app, db) {
  // POST /api/avm/estimate
  app.post('/api/avm/estimate', (req, res) => {
    try {
      const { location, property_type, area_m2, bedrooms, purpose } = req.body;
      const result = calculateAVM(db, { location, property_type, area_m2: parseFloat(area_m2) || 0, bedrooms: parseInt(bedrooms) || null, purpose });
      if (!result) return res.status(404).json({ error: 'Insufficient data for estimate', suggestion: 'Try a broader location or property type' });
      res.json({ ok: true, ...result });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  // GET /api/avm/estimate (query string version)
  app.get('/api/avm/estimate', (req, res) => {
    try {
      const { location, property_type, area_m2, bedrooms, purpose } = req.query;
      const result = calculateAVM(db, { location, property_type, area_m2: parseFloat(area_m2) || 0, bedrooms: parseInt(bedrooms) || null, purpose });
      if (!result) return res.status(404).json({ error: 'Insufficient data for estimate' });
      res.json({ ok: true, ...result });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  // GET /api/avm/market-heat — heat per location
  app.get('/api/avm/market-heat', (req, res) => {
    try {
      const d = db(false);
      const locs = d.prepare(`
        SELECT location, COUNT(*) supply_cnt, AVG(price) avg_price,
               AVG(size) avg_size
        FROM supply WHERE location IS NOT NULL AND location != '' AND price > 0
        GROUP BY location ORDER BY supply_cnt DESC LIMIT 20
      `).all();
      const demandCounts = d.prepare(`
        SELECT location, COUNT(*) cnt FROM demand
        WHERE location IS NOT NULL AND location != ''
        GROUP BY location
      `).all();
      d.close();
      const demMap = {};
      demandCounts.forEach(r => { demMap[r.location] = r.cnt; });
      const result = locs.map(r => ({
        location: r.location,
        supply_count: r.supply_cnt,
        demand_count: demMap[r.location] || 0,
        avg_price: Math.round(r.avg_price || 0),
        avg_size_sqm: Math.round(r.avg_size || 0),
        pressure_index: r.supply_cnt > 0 ? parseFloat(((demMap[r.location] || 0) / r.supply_cnt).toFixed(2)) : 0,
        heat_score: Math.min(100, Math.round(((demMap[r.location] || 0) + r.supply_cnt) / 5))
      }));
      res.json({ count: result.length, locations: result });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });
};
