/**
 * MatchPro Buyers Management
 * CRUD + NLP scoring + auto-match
 */

module.exports = function(app, db, auth) {
  // Ensure table
  const d = db(true);
  d.exec(`
    CREATE TABLE IF NOT EXISTS buyers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      phone TEXT,
      email TEXT,
      budget_min REAL,
      budget_max REAL,
      locations TEXT,
      property_types TEXT,
      bedrooms INTEGER,
      bathrooms INTEGER,
      area_min REAL,
      area_max REAL,
      timeline TEXT,
      purpose TEXT DEFAULT 'buy',
      nlp_score REAL DEFAULT 0,
      source TEXT,
      notes TEXT,
      status TEXT DEFAULT 'active',
      currency TEXT DEFAULT 'EGP',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  d.close();

  // NLP Score calculation: how specific/serious is this buyer?
  function calcNlpScore(buyer) {
    let score = 0;
    if (buyer.name) score += 5;
    if (buyer.phone) score += 10;
    if (buyer.email) score += 5;
    if (buyer.budget_min && buyer.budget_max) score += 20;
    else if (buyer.budget_min || buyer.budget_max) score += 10;
    if (buyer.locations) score += 15;
    if (buyer.property_types) score += 10;
    if (buyer.bedrooms) score += 10;
    if (buyer.area_min || buyer.area_max) score += 10;
    if (buyer.timeline) score += 10;
    if (buyer.purpose) score += 5;
    return Math.min(100, score);
  }

  // GET /api/buyers — list all buyers
  app.get('/api/buyers', auth, (req, res) => {
    try {
      const { status, search, limit } = req.query;
      const lim = parseInt(limit) || 100;
      let where = "1=1";
      const params = [];

      if (status) { where += " AND status=?"; params.push(status); }
      if (search) { where += " AND (name LIKE ? OR phone LIKE ? OR locations LIKE ?)"; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }

      const d2 = db(false);
      const rows = d2.prepare(`SELECT * FROM buyers WHERE ${where} ORDER BY nlp_score DESC, created_at DESC LIMIT ?`).all(...params, lim);
      const total = d2.prepare(`SELECT COUNT(*) c FROM buyers WHERE ${where}`).get(...params);
      d2.close();
      res.json({ count: rows.length, total: total.c, buyers: rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  // POST /api/buyers — create buyer
  app.post('/api/buyers', auth, (req, res) => {
    try {
      const b = req.body;
      const nlp_score = calcNlpScore(b);
      const d2 = db(true);
      const result = d2.prepare(`
        INSERT INTO buyers (name, phone, email, budget_min, budget_max, locations, property_types, bedrooms, bathrooms, area_min, area_max, timeline, purpose, nlp_score, source, notes, currency)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        b.name||null, b.phone||null, b.email||null,
        b.budget_min||null, b.budget_max||null,
        b.locations||null, b.property_types||null,
        b.bedrooms||null, b.bathrooms||null,
        b.area_min||null, b.area_max||null,
        b.timeline||null, b.purpose||'buy',
        nlp_score, b.source||'manual', b.notes||null, b.currency||'EGP'
      );
      d2.close();
      res.json({ ok: true, id: result.lastInsertRowid, nlp_score });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  // PUT /api/buyers/:id — update buyer
  app.put('/api/buyers/:id', auth, (req, res) => {
    try {
      const b = req.body;
      const nlp_score = calcNlpScore(b);
      const d2 = db(true);
      d2.prepare(`
        UPDATE buyers SET name=?, phone=?, email=?, budget_min=?, budget_max=?, locations=?, property_types=?,
          bedrooms=?, bathrooms=?, area_min=?, area_max=?, timeline=?, purpose=?, nlp_score=?, source=?, notes=?, currency=?, status=?, updated_at=datetime('now')
        WHERE id=?
      `).run(
        b.name||null, b.phone||null, b.email||null,
        b.budget_min||null, b.budget_max||null,
        b.locations||null, b.property_types||null,
        b.bedrooms||null, b.bathrooms||null,
        b.area_min||null, b.area_max||null,
        b.timeline||null, b.purpose||'buy',
        nlp_score, b.source||null, b.notes||null, b.currency||'EGP', b.status||'active',
        req.params.id
      );
      d2.close();
      res.json({ ok: true, id: parseInt(req.params.id), nlp_score });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  // DELETE /api/buyers/:id
  app.delete('/api/buyers/:id', auth, (req, res) => {
    try {
      const d2 = db(true);
      d2.prepare("UPDATE buyers SET status='deleted', updated_at=datetime('now') WHERE id=?").run(req.params.id);
      d2.close();
      res.json({ ok: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  // POST /api/buyers/:id/match — find matching supply for a buyer
  app.post('/api/buyers/:id/match', auth, (req, res) => {
    try {
      const d2 = db(false);
      const buyer = d2.prepare("SELECT * FROM buyers WHERE id=?").get(req.params.id);
      if (!buyer) { d2.close(); return res.status(404).json({ error: 'Buyer not found' }); }

      // Build matching query from buyer criteria
      let where = "price IS NOT NULL AND price > 0";
      const params = [];

      if (buyer.locations) {
        const locs = buyer.locations.split(',').map(l => l.trim()).filter(Boolean);
        if (locs.length) {
          where += ` AND (${locs.map(() => 'location LIKE ?').join(' OR ')})`;
          locs.forEach(l => params.push(`%${l}%`));
        }
      }
      if (buyer.budget_min) { where += " AND price >= ?"; params.push(buyer.budget_min); }
      if (buyer.budget_max) { where += " AND price <= ?"; params.push(buyer.budget_max); }
      if (buyer.bedrooms) { where += " AND (bedrooms = ? OR bedrooms IS NULL)"; params.push(buyer.bedrooms); }
      if (buyer.property_types) {
        const types = buyer.property_types.split(',').map(t => t.trim()).filter(Boolean);
        if (types.length) {
          where += ` AND (${types.map(() => 'property_type LIKE ?').join(' OR ')})`;
          types.forEach(t => params.push(`%${t}%`));
        }
      }

      const matches = d2.prepare(`
        SELECT *, 
          CASE WHEN price > 0 AND ${buyer.budget_max ? buyer.budget_max : 999999999} > 0 
            THEN ROUND(100 - ABS(price - ${buyer.budget_max || buyer.budget_min || 0}) * 100.0 / NULLIF(${buyer.budget_max || buyer.budget_min || 1}, 0), 1)
            ELSE 50 END as match_score
        FROM supply WHERE ${where}
        ORDER BY created_at DESC LIMIT 20
      `).all(...params);
      d2.close();

      res.json({ buyer_id: buyer.id, buyer_name: buyer.name, matches_found: matches.length, matches });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });
};
