/**
 * Demand Routes — /api/demand, /api/demand/match-custom, /api/demand/:id/supply-matches
 */
module.exports = (db, scoreMatchPair) => {
  const router = require('express').Router();

  router.get('/api/demand', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const days = parseInt(req.query.days) || 7;
    const d = db();
    const rows = d.prepare(`SELECT * FROM demand WHERE created_at > datetime('now','-${days} days') ORDER BY created_at DESC LIMIT ?`).all(limit);
    d.close();
    res.json({ count: rows.length, rows });
  });

  router.post('/api/demand/match-custom', (req, res) => {
    try {
      const { location, property_type, purpose, price_max, bedrooms } = req.body;
      const min_score = parseInt(req.query.min_score) || 30;
      const d = db();
      const supplies = d.prepare('SELECT * FROM supply ORDER BY created_at DESC LIMIT 1000').all();
      d.close();
      const demandLike = { location, property_type, purpose, price_max: parseFloat(price_max) || null, bedrooms: parseInt(bedrooms) || null };
      const scored = supplies.map(s => ({ ...s, match_score: scoreMatchPair(s, demandLike) })).filter(s => s.match_score >= min_score).sort((a, b) => b.match_score - a.match_score).slice(0, 50);
      res.json({ count: scored.length, matches: scored, query: demandLike });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.get('/api/demand/:id/supply-matches', (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const min_score = parseInt(req.query.min_score) || 50;
      const limit = Math.min(parseInt(req.query.limit) || 50, 200);
      const d = db();
      const demand = d.prepare('SELECT * FROM demand WHERE id = ?').get(id);
      if (!demand) { d.close(); return res.status(404).json({ error: 'Demand not found' }); }
      const supplies = d.prepare('SELECT * FROM supply ORDER BY created_at DESC LIMIT 500').all();
      d.close();
      const scored = supplies.map(s => ({ ...s, match_score: scoreMatchPair(s, demand) })).filter(s => s.match_score >= min_score).sort((a, b) => b.match_score - a.match_score).slice(0, limit);
      res.json({ demand_id: id, demand, count: scored.length, matches: scored });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  return router;
};
