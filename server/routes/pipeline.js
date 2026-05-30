/**
 * Pipeline Routes — /api/pipeline/daily, /api/reports, /api/reports/generate, /api/webhook-leads, /api/discover
 */
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

module.exports = (db, ROOT, REPORTS_DIR, discoverHandler) => {
  const router = require('express').Router();

  router.get('/api/pipeline/daily', (req, res) => {
    try {
      const d = db();
      const rows = d.prepare(`
        SELECT date(created_at) day, COUNT(*) cnt
        FROM demand
        WHERE created_at >= datetime('now', '-7 days')
        GROUP BY date(created_at)
        ORDER BY day ASC
      `).all();
      d.close();
      res.json({ rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.get('/api/webhook-leads', (req, res) => {
    try {
      const d = db();
      const rows = d.prepare('SELECT * FROM webhook_leads ORDER BY created_at DESC LIMIT 20').all();
      d.close();
      res.json({ count: rows.length, rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.get('/api/reports', (req, res) => {
    const files = fs.readdirSync(REPORTS_DIR).filter(f => f.endsWith('.xlsx'))
                    .sort((a, b) => fs.statSync(path.join(REPORTS_DIR, b)).mtimeMs - fs.statSync(path.join(REPORTS_DIR, a)).mtimeMs)
                    .slice(0, 30)
                    .map(f => ({ name: f, url: `/reports/${f}`, size: fs.statSync(path.join(REPORTS_DIR, f)).size, mtime: fs.statSync(path.join(REPORTS_DIR, f)).mtime }));
    res.json({ count: files.length, reports: files });
  });

  router.post('/api/reports/generate', (req, res) => {
    execFile('node', [path.join(ROOT, 'automations', 'auto_report_4h.js')], (err, stdout, stderr) => {
      if (err) return res.status(500).json({ error: err.message, stderr });
      res.json({ ok: true, output: stdout });
    });
  });

  router.post('/api/discover', (req, res) => {
    const d = db(false);
    discoverHandler(d)(req, res).finally(() => { try { d.close(); } catch (_) {} });
  });

  return router;
};
