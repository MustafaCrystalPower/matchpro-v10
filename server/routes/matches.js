/**
 * Matches Routes — /api/matches, /api/match/run
 */
const path = require('path');
const { execFile } = require('child_process');

module.exports = (db, ROOT) => {
  const router = require('express').Router();

  router.get('/api/matches', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const d = db();
    const rows = d.prepare(`SELECT * FROM matches ORDER BY match_score DESC, created_at DESC LIMIT ?`).all(limit);
    d.close();
    res.json({ count: rows.length, rows });
  });

  router.post('/api/match/run', (req, res) => {
    // Fire-and-forget match cycle
    execFile('node', [path.join(ROOT, 'automations', 'auto_report_4h.js')], (err, stdout, stderr) => {
      if (err) console.error('match/run error:', err.message);
      else console.log('match/run done:', stdout.slice(0, 200));
    });
    res.json({ ok: true, message: 'Match cycle triggered', timestamp: new Date().toISOString() });
  });

  return router;
};
