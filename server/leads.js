/**
 * MatchPro Lead Delivery System
 * 12-24h SLA guarantee tracking
 */

module.exports = function(app, db, auth) {
  // Ensure table
  const d = db(true);
  d.exec(`
    CREATE TABLE IF NOT EXISTS lead_deliveries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id TEXT,
      broker_id TEXT,
      broker_phone TEXT,
      buyer_phone TEXT,
      seller_phone TEXT,
      property_ref TEXT,
      location TEXT,
      property_type TEXT,
      price REAL,
      delivered_at DATETIME,
      sla_hours REAL,
      status TEXT DEFAULT 'pending',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  d.close();

  // GET /api/leads/pending — leads awaiting delivery
  app.get('/api/leads/pending', auth, (req, res) => {
    try {
      const d2 = db(false);
      const rows = d2.prepare(`
        SELECT ld.*, 
          ROUND((julianday('now') - julianday(ld.created_at)) * 24, 1) AS hours_waiting
        FROM lead_deliveries ld
        WHERE ld.status = 'pending'
        ORDER BY ld.created_at ASC LIMIT 100
      `).all();
      d2.close();
      const overdue = rows.filter(r => r.hours_waiting > 24);
      res.json({ count: rows.length, overdue_count: overdue.length, leads: rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  // POST /api/leads/deliver — mark as delivered
  app.post('/api/leads/deliver', auth, (req, res) => {
    try {
      const { id, notes } = req.body;
      if (!id) return res.status(400).json({ error: 'id required' });
      const d2 = db(true);
      const lead = d2.prepare("SELECT * FROM lead_deliveries WHERE id=?").get(id);
      if (!lead) { d2.close(); return res.status(404).json({ error: 'Lead not found' }); }
      
      const sla_hours = (Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60);
      d2.prepare(`UPDATE lead_deliveries SET status='delivered', delivered_at=datetime('now'), sla_hours=?, notes=? WHERE id=?`)
        .run(Math.round(sla_hours * 10) / 10, notes || null, id);
      d2.close();
      res.json({ ok: true, sla_hours: Math.round(sla_hours * 10) / 10, within_sla: sla_hours <= 24 });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  // POST /api/leads/create — create a new lead from a match
  app.post('/api/leads/create', auth, (req, res) => {
    try {
      const { match_id, broker_id, broker_phone, buyer_phone, seller_phone, property_ref, location, property_type, price } = req.body;
      const d2 = db(true);
      const result = d2.prepare(`
        INSERT INTO lead_deliveries (match_id, broker_id, broker_phone, buyer_phone, seller_phone, property_ref, location, property_type, price)
        VALUES (?,?,?,?,?,?,?,?,?)
      `).run(match_id||null, broker_id||null, broker_phone||null, buyer_phone||null, seller_phone||null, property_ref||null, location||null, property_type||null, price||null);
      d2.close();
      res.json({ ok: true, id: result.lastInsertRowid });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  // GET /api/leads/history — delivered leads history
  app.get('/api/leads/history', auth, (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const d2 = db(false);
      const rows = d2.prepare(`
        SELECT * FROM lead_deliveries WHERE status='delivered' ORDER BY delivered_at DESC LIMIT ?
      `).all(limit);
      const stats = d2.prepare(`
        SELECT 
          COUNT(*) total,
          SUM(CASE WHEN sla_hours <= 12 THEN 1 ELSE 0 END) within_12h,
          SUM(CASE WHEN sla_hours <= 24 THEN 1 ELSE 0 END) within_24h,
          AVG(sla_hours) avg_sla_hours
        FROM lead_deliveries WHERE status='delivered'
      `).get();
      d2.close();
      res.json({ count: rows.length, sla_stats: stats, leads: rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  // GET /api/leads/stats — SLA performance metrics
  app.get('/api/leads/stats', auth, (req, res) => {
    try {
      const d2 = db(false);
      const stats = d2.prepare(`
        SELECT 
          COUNT(*) total_leads,
          SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END) delivered,
          SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) pending,
          SUM(CASE WHEN status='delivered' AND sla_hours <= 12 THEN 1 ELSE 0 END) within_12h,
          SUM(CASE WHEN status='delivered' AND sla_hours <= 24 THEN 1 ELSE 0 END) within_24h,
          ROUND(AVG(CASE WHEN status='delivered' THEN sla_hours END), 1) avg_delivery_hours
        FROM lead_deliveries
      `).get();
      d2.close();
      res.json(stats);
    } catch(e) { res.status(500).json({ error: e.message }); }
  });
};
