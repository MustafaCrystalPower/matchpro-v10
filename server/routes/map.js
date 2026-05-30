/**
 * Map Routes — /api/map/supply, /api/map/demand, /api/map/heatmap, /api/market/analysis, /api/market/location/:location, /api/heat-map
 */
module.exports = (db, getCoords) => {
  const router = require('express').Router();

  router.get('/api/heat-map', (req, res) => {
    const d = db();
    const heat = d.prepare(`SELECT COALESCE(area,location) area, COUNT(*) cnt,
                                   AVG((COALESCE(price_min,0)+COALESCE(price_max,0))/2) avg_budget
                            FROM demand WHERE COALESCE(area,location) != ''
                            GROUP BY COALESCE(area,location) ORDER BY cnt DESC LIMIT 30`).all();
    d.close();
    res.json({ count: heat.length, rows: heat });
  });

  router.get('/api/map/supply', (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 500, 1000);
      const d = db();
      const rows = d.prepare('SELECT id, location, city, area, property_type, purpose, price, bedrooms, size, sender_phone FROM supply ORDER BY created_at DESC LIMIT ?').all(limit);
      d.close();
      const enriched = rows.map(r => {
        const coords = getCoords(r.location) || getCoords(r.city) || getCoords(r.area);
        return { ...r, lat: coords?.lat || null, lng: coords?.lng || null, location_label: coords?.label || r.location };
      }).filter(r => r.lat);
      res.json({ count: enriched.length, rows: enriched });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.get('/api/map/demand', (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 500, 1000);
      const d = db();
      const rows = d.prepare('SELECT id, location, city, area, property_type, purpose, price_min, price_max, bedrooms FROM demand ORDER BY created_at DESC LIMIT ?').all(limit);
      d.close();
      const enriched = rows.map(r => {
        const coords = getCoords(r.location) || getCoords(r.city) || getCoords(r.area);
        return { ...r, lat: coords?.lat || null, lng: coords?.lng || null, location_label: coords?.label || r.location };
      }).filter(r => r.lat);
      res.json({ count: enriched.length, rows: enriched });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.get('/api/map/heatmap', (req, res) => {
    try {
      const d = db();
      const supplyByLoc = d.prepare("SELECT location, COUNT(*) cnt, AVG(price) avg_price FROM supply WHERE location IS NOT NULL AND location != '' GROUP BY location").all();
      const demandByLoc = d.prepare("SELECT location, COUNT(*) cnt FROM demand WHERE location IS NOT NULL AND location != '' GROUP BY location").all();
      d.close();
      const supplyMap = {};
      supplyByLoc.forEach(r => { supplyMap[r.location] = { count: r.cnt, avg_price: r.avg_price }; });
      const demandMap = {};
      demandByLoc.forEach(r => { demandMap[r.location] = r.cnt; });
      const allLocs = new Set([...Object.keys(supplyMap), ...Object.keys(demandMap)]);
      const rows = [];
      for (const loc of allLocs) {
        const coords = getCoords(loc);
        if (!coords) continue;
        const supply_count = supplyMap[loc]?.count || 0;
        const demand_count = demandMap[loc] || 0;
        const avg_price = supplyMap[loc]?.avg_price || 0;
        const pressure_index = supply_count > 0 ? (demand_count / supply_count) : demand_count;
        rows.push({ location: loc, location_label: coords.label, lat: coords.lat, lng: coords.lng, supply_count, demand_count, avg_price, pressure_index });
      }
      rows.sort((a, b) => b.demand_count - a.demand_count);
      res.json({ count: rows.length, rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.get('/api/market/analysis', (req, res) => {
    try {
      const d = db();
      const supplyByLoc = d.prepare("SELECT location, COUNT(*) supply_count, AVG(price) avg_price FROM supply WHERE location IS NOT NULL AND location != '' GROUP BY location ORDER BY supply_count DESC LIMIT 20").all();
      const demandByLoc = d.prepare("SELECT location, COUNT(*) demand_count, AVG(price_max) avg_budget FROM demand WHERE location IS NOT NULL AND location != '' GROUP BY location ORDER BY demand_count DESC LIMIT 20").all();
      const propTypeSupply = d.prepare('SELECT property_type, COUNT(*) cnt FROM supply WHERE property_type IS NOT NULL GROUP BY property_type ORDER BY cnt DESC').all();
      const propTypeDemand = d.prepare('SELECT property_type, COUNT(*) cnt FROM demand WHERE property_type IS NOT NULL GROUP BY property_type ORDER BY cnt DESC').all();
      const purposeSupply = d.prepare('SELECT purpose, COUNT(*) cnt FROM supply WHERE purpose IS NOT NULL GROUP BY purpose ORDER BY cnt DESC').all();
      const purposeDemand = d.prepare('SELECT purpose, COUNT(*) cnt FROM demand WHERE purpose IS NOT NULL GROUP BY purpose ORDER BY cnt DESC').all();
      d.close();
      const demandMap = {};
      demandByLoc.forEach(r => { demandMap[r.location] = r; });
      const locations = supplyByLoc.map(s => {
        const dem = demandMap[s.location] || { demand_count: 0, avg_budget: 0 };
        return {
          location: s.location,
          supply_count: s.supply_count,
          demand_count: dem.demand_count,
          avg_supply_price: s.avg_price,
          avg_demand_budget: dem.avg_budget,
          pressure_index: s.supply_count > 0 ? (dem.demand_count / s.supply_count) : 0
        };
      });
      // Add demand-only locations
      demandByLoc.forEach(d => {
        if (!locations.find(l => l.location === d.location)) {
          locations.push({ location: d.location, supply_count: 0, demand_count: d.demand_count, avg_supply_price: 0, avg_demand_budget: d.avg_budget, pressure_index: d.demand_count });
        }
      });
      locations.sort((a, b) => b.demand_count - a.demand_count);
      res.json({ locations: locations.slice(0, 20), property_type_supply: propTypeSupply, property_type_demand: propTypeDemand, purpose_supply: purposeSupply, purpose_demand: purposeDemand, generated_at: new Date().toISOString() });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.get('/api/market/location/:location', (req, res) => {
    try {
      const loc = req.params.location;
      const d = db();
      const supply_count = d.prepare('SELECT COUNT(*) c FROM supply WHERE location = ?').get(loc).c;
      const demand_count = d.prepare('SELECT COUNT(*) c FROM demand WHERE location = ?').get(loc).c;
      const match_count = d.prepare('SELECT COUNT(*) c FROM matches WHERE supply_location = ?').get(loc).c;
      const avg_supply_price = d.prepare('SELECT AVG(price) v FROM supply WHERE location = ?').get(loc).v || 0;
      const avg_demand_budget = d.prepare('SELECT AVG(price_max) v FROM demand WHERE location = ?').get(loc).v || 0;
      const prop_types = d.prepare('SELECT property_type, COUNT(*) cnt FROM supply WHERE location = ? AND property_type IS NOT NULL GROUP BY property_type ORDER BY cnt DESC').all(loc);
      const bedrooms_dist = d.prepare('SELECT bedrooms, COUNT(*) cnt FROM demand WHERE location = ? AND bedrooms IS NOT NULL GROUP BY bedrooms ORDER BY cnt DESC').all(loc);
      const recent_supply = d.prepare('SELECT id, location, property_type, purpose, price, bedrooms, size, sender_phone FROM supply WHERE location = ? ORDER BY created_at DESC LIMIT 20').all(loc);
      const active_demand = d.prepare('SELECT id, location, property_type, purpose, price_min, price_max, bedrooms FROM demand WHERE location = ? ORDER BY created_at DESC LIMIT 20').all(loc);
      const top_matches = d.prepare('SELECT * FROM matches WHERE supply_location = ? AND match_score >= 70 ORDER BY match_score DESC LIMIT 10').all(loc);
      d.close();
      res.json({ location: loc, supply_count, demand_count, match_count, avg_supply_price, avg_demand_budget, property_types: prop_types, bedrooms_distribution: bedrooms_dist, recent_supply, active_demand, top_matches });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  return router;
};
