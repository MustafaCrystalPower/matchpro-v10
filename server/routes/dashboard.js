/**
 * Dashboard Routes — /api/dashboard, /api/currencies
 */
module.exports = (db, auth) => {
  const router = require('express').Router();

  const EXCHANGE_RATES = {
    EGP: 1, USD: 0.0204, EUR: 0.0188, SAR: 0.0765, AED: 0.0749, GBP: 0.0162, JPY: 3.15
  };

  router.get('/api/dashboard', auth, (req, res) => {
    try {
      const d2 = db();
      const totalMessages = d2.prepare('SELECT COUNT(*) c FROM messages').get().c;
      const totalSupply = d2.prepare('SELECT COUNT(*) c FROM supply').get().c;
      const totalDemand = d2.prepare('SELECT COUNT(*) c FROM demand').get().c;
      const totalMatches = d2.prepare('SELECT COUNT(*) c FROM matches').get().c;
      const totalBrokers = d2.prepare('SELECT COUNT(*) c FROM brokers').get().c;
      const totalAssets = d2.prepare("SELECT COUNT(*) c FROM assets").get().c;
      const avgScore = d2.prepare("SELECT AVG(CAST(match_score AS REAL)) a FROM matches WHERE match_score IS NOT NULL").get().a || 0;
      const highMatches = d2.prepare("SELECT COUNT(*) c FROM matches WHERE CAST(match_score AS REAL) >= 85").get().c;

      // Quality metrics
      const demandTotal = totalDemand;
      const demandWithLocation = d2.prepare("SELECT COUNT(*) c FROM demand WHERE location IS NOT NULL AND location != ''").get().c;
      const demandWithType = d2.prepare("SELECT COUNT(*) c FROM demand WHERE property_type IS NOT NULL AND property_type != ''").get().c;
      const demandWithPurpose = d2.prepare("SELECT COUNT(*) c FROM demand WHERE purpose IS NOT NULL AND purpose != ''").get().c;
      const supplyTotal = totalSupply;
      const supplyWithLocation = d2.prepare("SELECT COUNT(*) c FROM supply WHERE location IS NOT NULL AND location != ''").get().c;

      // Message volume (14 days)
      const msgVolume = d2.prepare("SELECT date(created_at) day, COUNT(*) count FROM messages WHERE created_at >= date('now','-14 days') GROUP BY date(created_at) ORDER BY day").all();

      // Demand by location (top 10)
      const demandByLocation = d2.prepare("SELECT location, COUNT(*) count FROM demand WHERE location IS NOT NULL AND location != '' GROUP BY location ORDER BY count DESC LIMIT 10").all();

      // Demand by type
      const demandByType = d2.prepare("SELECT property_type as type, COUNT(*) count FROM demand WHERE property_type IS NOT NULL GROUP BY property_type ORDER BY count DESC LIMIT 8").all();

      // Demand by purpose
      const demandByPurpose = d2.prepare("SELECT purpose, COUNT(*) count FROM demand WHERE purpose IS NOT NULL AND purpose != '' GROUP BY purpose ORDER BY count DESC").all();

      d2.close();
      res.json({
        stats: { totalMessages, totalSupply, totalDemand, totalMatches, totalBrokers, totalAssets, avgScore, highMatches },
        qualityMetrics: { demandTotal, demandWithLocation, demandWithType, demandWithPurpose, supplyTotal, supplyWithLocation },
        msgVolume,
        demandByLocation,
        demandByType,
        demandByPurpose
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.get('/api/currencies', (req, res) => {
    res.json({ base: 'EGP', rates: EXCHANGE_RATES, updated: '2026-05-11' });
  });

  return router;
};
