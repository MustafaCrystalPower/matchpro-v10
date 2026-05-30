/**
 * Stats Routes — /api/stats, /api/verified-stats, /api/health, /health
 */
const fs = require('fs');
const path = require('path');

module.exports = (db, DB_PATH, PORT) => {
  const router = require('express').Router();

  function formatUptime(s) {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
    return `${h}h ${m}m ${sec}s`;
  }

  router.get('/health', (req, res) => {
    try {
      const d = db();
      const stats = {
        messages: d.prepare('SELECT COUNT(*) c FROM messages').get().c,
        demand: d.prepare('SELECT COUNT(*) c FROM demand').get().c,
        supply: d.prepare('SELECT COUNT(*) c FROM supply').get().c,
        matches: d.prepare('SELECT COUNT(*) c FROM matches').get().c,
        hot_leads: d.prepare("SELECT COUNT(*) c FROM v7_lead_quality WHERE is_hot_lead=1").get().c,
        last_demand: d.prepare('SELECT MAX(created_at) m FROM demand').get().m,
        last_match: d.prepare('SELECT MAX(created_at) m FROM matches').get().m
      };
      d.close();
      res.json({
        status: 'ok',
        version: '11.0.0',
        port: PORT,
        uptime: process.uptime(),
        uptime_human: formatUptime(process.uptime()),
        timestamp: new Date().toISOString(),
        dbSize: (fs.statSync(DB_PATH).size / 1048576).toFixed(1) + "MB",
        stats
      });
    } catch (e) { res.status(500).json({ status: 'error', version: '11.0.0', error: e.message }); }
  });

  router.get('/api/stats', (req, res) => {
    try {
      const d = db();
      const messages = d.prepare('SELECT COUNT(*) c FROM messages').get().c;
      const supply = d.prepare('SELECT COUNT(*) c FROM supply').get().c;
      const demand = d.prepare('SELECT COUNT(*) c FROM demand').get().c;
      const matches = d.prepare('SELECT COUNT(*) c FROM matches').get().c;
      const hot_leads = d.prepare("SELECT COUNT(*) c FROM v7_lead_quality WHERE is_hot_lead=1").get().c;
      const webhook_leads = d.prepare("SELECT COUNT(*) c FROM webhook_leads").get().c;
      const assets = d.prepare("SELECT COUNT(*) c FROM assets WHERE status='available'").get().c;
      const today_demand = d.prepare("SELECT COUNT(*) c FROM demand WHERE created_at >= date('now')").get().c;
      const today_matches = d.prepare("SELECT COUNT(*) c FROM matches WHERE created_at >= date('now')").get().c;
      d.close();
      res.json({
        status: 'ok',
        version: '11.0.0',
        timestamp: new Date().toISOString(),
        dbSize: (fs.statSync(DB_PATH).size / 1048576).toFixed(1) + "MB",
        totals: { messages, supply, demand, matches, hot_leads, webhook_leads, assets },
        today: { demand: today_demand, matches: today_matches }
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.get('/api/verified-stats', (req, res) => {
    try {
      const d = db();
      const v = d.prepare("SELECT COUNT(*) c FROM demand WHERE verified=1").get().c;
      const total = d.prepare("SELECT COUNT(*) c FROM demand").get().c;
      const byCluster = d.prepare("SELECT location_cluster cluster, COUNT(*) cnt FROM demand WHERE verified=1 GROUP BY location_cluster ORDER BY cnt DESC").all();
      d.close();
      res.json({ verified: v, total, pct: total ? ((v / total * 100).toFixed(1)) : 0, byCluster });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  return router;
};
