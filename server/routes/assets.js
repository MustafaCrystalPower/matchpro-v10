/**
 * Assets Routes — /api/assets, /api/assets/:code/matches, /api/assets/:code/demand-matches, /api/assets/match-custom
 */
module.exports = (db, scoreMatchPair) => {
  const router = require('express').Router();

  router.get('/api/assets', (req, res) => {
    try {
      const d = db();
      const assets = d.prepare("SELECT * FROM assets WHERE status='available' ORDER BY created_at DESC").all();
      // For each asset, count matched demands
      const result = assets.map(a => {
        const lead_count = d.prepare('SELECT COUNT(*) c FROM asset_matches WHERE asset_id=?').get(a.id).c;
        return { ...a, lead_count };
      });
      d.close();
      res.json({ count: result.length, assets: result });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.get('/api/assets/:code/matches', (req, res) => {
    try {
      const code = req.params.code;
      const d = db();
      const asset = d.prepare('SELECT * FROM assets WHERE asset_code=?').get(code);
      if (!asset) { d.close(); return res.status(404).json({ error: 'Asset not found' }); }
      const matches = d.prepare('SELECT * FROM asset_matches WHERE asset_id=? ORDER BY match_score DESC LIMIT 50').all(asset.id);
      d.close();
      res.setHeader('Content-Disposition', `attachment; filename="matches_${code}.json"`);
      res.json({ asset_code: code, asset, matches, exported_at: new Date().toISOString() });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.get('/api/assets/:code/demand-matches', (req, res) => {
    try {
      const code = req.params.code;
      const min_score = parseInt(req.query.min_score) || 50;
      const limit = Math.min(parseInt(req.query.limit) || 50, 200);
      const d = db();
      const asset = d.prepare('SELECT * FROM assets WHERE asset_code = ?').get(code);
      if (!asset) { d.close(); return res.status(404).json({ error: 'Asset not found' }); }
      const demands = d.prepare('SELECT * FROM demand ORDER BY created_at DESC LIMIT 500').all();
      d.close();
      const supplyLike = { location: asset.location, purpose: asset.purpose, price: asset.price, bedrooms: asset.bedrooms };
      const scored = demands.map(dem => ({ ...dem, match_score: scoreMatchPair(supplyLike, dem) })).filter(d => d.match_score >= min_score).sort((a, b) => b.match_score - a.match_score).slice(0, limit);
      res.json({ asset_code: code, asset, count: scored.length, matches: scored });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.post('/api/assets/match-custom', (req, res) => {
    try {
      const { location, property_type, purpose, price, bedrooms, size } = req.body;
      const min_score = parseInt(req.query.min_score) || 30;
      const d = db();
      const demands = d.prepare('SELECT * FROM demand ORDER BY created_at DESC LIMIT 1000').all();
      d.close();
      const supplyLike = { location, property_type, purpose, price: parseFloat(price) || 0, bedrooms: parseInt(bedrooms) || null };
      const scored = demands.map(dem => ({ ...dem, match_score: scoreMatchPair(supplyLike, dem) })).filter(d => d.match_score >= min_score).sort((a, b) => b.match_score - a.match_score).slice(0, 50);
      res.json({ count: scored.length, matches: scored, query: supplyLike });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  return router;
};
