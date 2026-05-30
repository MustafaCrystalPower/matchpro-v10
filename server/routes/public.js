/**
 * Public Routes — /api/public/* (open CORS, no auth required)
 * /api/public/supply, /api/public/demand, /api/public/match, /api/public/embed/:location
 */
module.exports = (db, scoreMatchPair) => {
  const router = require('express').Router();

  // Open CORS for all public routes
  router.use('/api/public', (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });

  router.get('/api/public/supply', (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(parseInt(req.query.limit) || 20, 100);
      const offset = (page - 1) * limit;
      const { location, property_type, purpose, min_price, max_price, bedrooms } = req.query;
      let where = '1=1';
      const params = [];
      if (location) { where += ' AND location LIKE ?'; params.push(`%${location}%`); }
      if (property_type) { where += ' AND property_type = ?'; params.push(property_type); }
      if (purpose) { where += ' AND purpose = ?'; params.push(purpose); }
      if (min_price) { where += ' AND price >= ?'; params.push(parseFloat(min_price)); }
      if (max_price) { where += ' AND price <= ?'; params.push(parseFloat(max_price)); }
      if (bedrooms) { where += ' AND bedrooms = ?'; params.push(parseInt(bedrooms)); }
      const d = db();
      const total = d.prepare(`SELECT COUNT(*) c FROM supply WHERE ${where}`).get(...params).c;
      const rows = d.prepare(`SELECT id, location, city, area, property_type, purpose, price, bedrooms, size, group_name FROM supply WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
      d.close();
      res.json({ total, page, limit, pages: Math.ceil(total / limit), count: rows.length, data: rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.get('/api/public/demand', (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(parseInt(req.query.limit) || 20, 100);
      const offset = (page - 1) * limit;
      const { location, property_type, purpose, min_price, max_price, bedrooms } = req.query;
      let where = '1=1';
      const params = [];
      if (location) { where += ' AND location LIKE ?'; params.push(`%${location}%`); }
      if (property_type) { where += ' AND property_type = ?'; params.push(property_type); }
      if (purpose) { where += ' AND purpose = ?'; params.push(purpose); }
      if (min_price) { where += ' AND price_max >= ?'; params.push(parseFloat(min_price)); }
      if (max_price) { where += ' AND price_max <= ?'; params.push(parseFloat(max_price)); }
      if (bedrooms) { where += ' AND bedrooms = ?'; params.push(parseInt(bedrooms)); }
      const d = db();
      const total = d.prepare(`SELECT COUNT(*) c FROM demand WHERE ${where}`).get(...params).c;
      const rows = d.prepare(`SELECT id, location, city, area, property_type, purpose, price_min, price_max, bedrooms FROM demand WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
      d.close();
      res.json({ total, page, limit, pages: Math.ceil(total / limit), count: rows.length, data: rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.get('/api/public/match', (req, res) => {
    try {
      const { asset_location, asset_type, asset_purpose, asset_price, asset_bedrooms } = req.query;
      const d = db();
      const demands = d.prepare('SELECT * FROM demand ORDER BY created_at DESC LIMIT 500').all();
      d.close();
      const supplyLike = { location: asset_location, property_type: asset_type, purpose: asset_purpose, price: parseFloat(asset_price) || 0, bedrooms: parseInt(asset_bedrooms) || null };
      const scored = demands.map(dem => ({ ...dem, match_score: scoreMatchPair(supplyLike, dem) })).filter(d => d.match_score >= 30).sort((a, b) => b.match_score - a.match_score).slice(0, 20);
      res.json({ count: scored.length, matches: scored });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.post('/api/public/match', (req, res) => {
    try {
      const { asset_location, asset_type, asset_purpose, asset_price, asset_bedrooms } = req.body;
      const d = db();
      const demands = d.prepare('SELECT * FROM demand ORDER BY created_at DESC LIMIT 500').all();
      d.close();
      const supplyLike = { location: asset_location, property_type: asset_type, purpose: asset_purpose, price: parseFloat(asset_price) || 0, bedrooms: parseInt(asset_bedrooms) || null };
      const scored = demands.map(dem => ({ ...dem, match_score: scoreMatchPair(supplyLike, dem) })).filter(d => d.match_score >= 30).sort((a, b) => b.match_score - a.match_score).slice(0, 20);
      res.json({ count: scored.length, matches: scored });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.get('/api/public/embed/:location', (req, res) => {
    try {
      const loc = req.params.location;
      const d = db();
      const demand_count = d.prepare('SELECT COUNT(*) c FROM demand WHERE location LIKE ?').get(`%${loc}%`).c;
      const supply_count = d.prepare('SELECT COUNT(*) c FROM supply WHERE location LIKE ?').get(`%${loc}%`).c;
      const avg_price = d.prepare('SELECT AVG(price) v FROM supply WHERE location LIKE ?').get(`%${loc}%`).v || 0;
      d.close();
      res.json({ location: loc, demand_count, supply_count, avg_price: Math.round(avg_price), pressure: supply_count > 0 ? (demand_count / supply_count).toFixed(2) : demand_count, last_updated: new Date().toISOString() });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  return router;
};
