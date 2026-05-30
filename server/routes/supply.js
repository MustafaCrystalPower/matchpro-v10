/**
 * Supply Routes — /api/supply
 */
module.exports = (db) => {
  const router = require('express').Router();

  router.get('/api/supply', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const d = db();
    const rows = d.prepare(`SELECT * FROM supply ORDER BY created_at DESC LIMIT ?`).all(limit);
    d.close();
    res.json({ count: rows.length, rows });
  });

  return router;
};
