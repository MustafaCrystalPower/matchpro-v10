/**
 * Properties Routes — /api/properties CRUD
 */
module.exports = (db, auth) => {
  const router = require('express').Router();

  // Ensure schema
  (function initProperties() {
    const d = db(true);
    d.exec(`
      CREATE TABLE IF NOT EXISTS properties (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE,
        title TEXT,
        location TEXT,
        district TEXT,
        property_type TEXT,
        bedrooms INTEGER,
        bathrooms INTEGER,
        area_m2 REAL,
        price REAL,
        currency TEXT DEFAULT 'EGP',
        purpose TEXT DEFAULT 'sale',
        status TEXT DEFAULT 'available',
        owner_name TEXT,
        owner_phone TEXT,
        owner_email TEXT,
        images_json TEXT DEFAULT '[]',
        features_json TEXT DEFAULT '[]',
        notes TEXT,
        floor INTEGER,
        furnished INTEGER DEFAULT 0,
        year_built INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    d.close();
  })();

  // Generate unique code
  function genPropertyCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'MP-';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  router.get('/api/properties', auth, (req, res) => {
    try {
      const { status, search, location, limit } = req.query;
      const lim = parseInt(limit) || 100;
      let where = "1=1";
      const params = [];
      if (status) { where += " AND status=?"; params.push(status); }
      if (location) { where += " AND (location LIKE ? OR district LIKE ?)"; params.push(`%${location}%`, `%${location}%`); }
      if (search) { where += " AND (title LIKE ? OR code LIKE ? OR location LIKE ? OR owner_name LIKE ?)"; params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`); }
      const d2 = db(false);
      const rows = d2.prepare(`SELECT * FROM properties WHERE ${where} ORDER BY created_at DESC LIMIT ?`).all(...params, lim);
      const total = d2.prepare(`SELECT COUNT(*) c FROM properties WHERE ${where}`).get(...params);
      d2.close();
      res.json({ count: rows.length, total: total.c, properties: rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.post('/api/properties', auth, (req, res) => {
    try {
      const p = req.body;
      const code = p.code || genPropertyCode();
      const d2 = db(true);
      const result = d2.prepare(`
        INSERT INTO properties (code, title, location, district, property_type, bedrooms, bathrooms, area_m2, price, currency, purpose, status, owner_name, owner_phone, owner_email, images_json, features_json, notes, floor, furnished, year_built)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        code, p.title || null, p.location || null, p.district || null, p.property_type || null,
        p.bedrooms || null, p.bathrooms || null, p.area_m2 || null, p.price || null, p.currency || 'EGP',
        p.purpose || 'sale', p.status || 'available', p.owner_name || null, p.owner_phone || null, p.owner_email || null,
        JSON.stringify(p.images || []), JSON.stringify(p.features || []), p.notes || null,
        p.floor || null, p.furnished ? 1 : 0, p.year_built || null
      );
      d2.close();
      res.json({ ok: true, id: result.lastInsertRowid, code });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.put('/api/properties/:id', auth, (req, res) => {
    try {
      const p = req.body;
      const d2 = db(true);
      d2.prepare(`
        UPDATE properties SET title=?, location=?, district=?, property_type=?, bedrooms=?, bathrooms=?, area_m2=?, price=?, currency=?, purpose=?, status=?, owner_name=?, owner_phone=?, owner_email=?, images_json=?, features_json=?, notes=?, floor=?, furnished=?, year_built=?, updated_at=datetime('now')
        WHERE id=?
      `).run(
        p.title || null, p.location || null, p.district || null, p.property_type || null,
        p.bedrooms || null, p.bathrooms || null, p.area_m2 || null, p.price || null, p.currency || 'EGP',
        p.purpose || 'sale', p.status || 'available', p.owner_name || null, p.owner_phone || null, p.owner_email || null,
        JSON.stringify(p.images || []), JSON.stringify(p.features || []), p.notes || null,
        p.floor || null, p.furnished ? 1 : 0, p.year_built || null, req.params.id
      );
      d2.close();
      res.json({ ok: true, id: parseInt(req.params.id) });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.delete('/api/properties/:id', auth, (req, res) => {
    try {
      const d2 = db(true);
      d2.prepare("UPDATE properties SET status='deleted', updated_at=datetime('now') WHERE id=?").run(req.params.id);
      d2.close();
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  return router;
};
