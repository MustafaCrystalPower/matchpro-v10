/**
 * Market Routes — /api/market/analysis/v2, /api/market/heatmap/v2, /api/market/location/:location,
 *                 /api/public/market-summary, /api/public/market-intelligence
 * Note: market-v2.js registers /api/market/analysis/v2 and /api/market/heatmap/v2 directly on app.
 * This module handles public market-summary and delegates to market-v2 module.
 */
module.exports = (db) => {
  const router = require('express').Router();

  // Public market-summary
  router.get('/api/public/market-summary', (req, res) => {
    try {
      const d = db();
      const total_supply = d.prepare('SELECT COUNT(*) c FROM supply').get().c;
      const total_demand = d.prepare('SELECT COUNT(*) c FROM demand').get().c;
      const total_matches = d.prepare('SELECT COUNT(*) c FROM matches').get().c;
      const topLocs = d.prepare("SELECT location, COUNT(*) cnt FROM demand WHERE location IS NOT NULL AND location != '' GROUP BY location ORDER BY cnt DESC LIMIT 10").all();
      const supplyByLoc = d.prepare("SELECT location, COUNT(*) cnt FROM supply WHERE location IS NOT NULL AND location != '' GROUP BY location").all();
      d.close();
      const supplyMap = {}; supplyByLoc.forEach(r => { supplyMap[r.location] = r.cnt; });
      const top_locations = topLocs.map(r => ({ name: r.location, demand: r.cnt, supply: supplyMap[r.location] || 0, pressure: supplyMap[r.location] > 0 ? (r.cnt / supplyMap[r.location]).toFixed(2) : r.cnt }));
      res.json({ total_supply, total_demand, total_matches, top_locations, last_updated: new Date().toISOString() });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  return router;
};
