/**
 * MatchPro Subscriptions Module
 * Plans: Solo, Agency, Enterprise
 */

const PLANS = {
  solo:       { name: 'Solo',       price_egp: 1500,  max_properties: 5,   max_users: 1 },
  agency:     { name: 'Agency',     price_egp: 8000,  max_properties: 50,  max_users: 10 },
  enterprise: { name: 'Enterprise', price_egp: 25000, max_properties: -1,  max_users: -1 },
};

function ensureSubscriptionsTable(db) {
  const d = db(true);
  d.exec(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      plan TEXT NOT NULL DEFAULT 'solo',
      status TEXT NOT NULL DEFAULT 'active',
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      properties_used INTEGER DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS app_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT,
      role TEXT DEFAULT 'viewer',
      plan TEXT DEFAULT 'solo',
      phone TEXT,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    );
  `);
  d.close();
}

module.exports = function(app, db, hashPw, makeToken, auth) {
  ensureSubscriptionsTable(db);

  // GET /api/subscriptions/plans — list available plans
  app.get('/api/subscriptions/plans', (req, res) => {
    res.json({ plans: PLANS });
  });

  // GET /api/subscriptions/my — current user subscription
  app.get('/api/subscriptions/my', auth, (req, res) => {
    try {
      const d = db(false);
      const sub = d.prepare("SELECT * FROM subscriptions WHERE user_id=? AND status='active' ORDER BY created_at DESC LIMIT 1").get(req.user.username);
      d.close();
      const plan = sub ? PLANS[sub.plan] : PLANS['solo'];
      res.json({ subscription: sub || { user_id: req.user.username, plan: 'solo', status: 'active' }, plan_details: plan });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  // POST /api/subscriptions — create/upgrade subscription (admin only)
  app.post('/api/subscriptions', auth, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    try {
      const { user_id, plan, expires_at, notes } = req.body;
      if (!user_id || !plan || !PLANS[plan]) return res.status(400).json({ error: 'user_id and valid plan required' });
      const d = db(true);
      // Deactivate existing
      d.prepare("UPDATE subscriptions SET status='cancelled' WHERE user_id=? AND status='active'").run(user_id);
      const result = d.prepare(`INSERT INTO subscriptions (user_id, plan, status, expires_at, notes)
                                VALUES (?, ?, 'active', ?, ?)`).run(user_id, plan, expires_at || null, notes || null);
      d.close();
      res.json({ ok: true, id: result.lastInsertRowid, plan: PLANS[plan] });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  // GET /api/subscriptions — list all (admin)
  app.get('/api/subscriptions', auth, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    try {
      const d = db(false);
      const rows = d.prepare("SELECT * FROM subscriptions ORDER BY created_at DESC LIMIT 100").all();
      d.close();
      res.json({ count: rows.length, subscriptions: rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  // ─── User Management ───────────────────────────────

  // POST /api/users/register
  app.post('/api/users/register', (req, res) => {
    try {
      const { username, email, password, name, phone } = req.body;
      if (!username || !password) return res.status(400).json({ error: 'username and password required' });
      // Auto-detect enterprise for @crystalpowerinvestment.com
      let role = 'viewer';
      let plan = 'solo';
      if (email && email.endsWith('@crystalpowerinvestment.com')) { role = 'admin'; plan = 'enterprise'; }

      const d = db(true);
      try {
        const result = d.prepare(`INSERT INTO app_users (username, email, password_hash, name, role, plan, phone) VALUES (?,?,?,?,?,?,?)`)
          .run(username.toLowerCase(), email || null, hashPw(password), name || username, role, plan, phone || null);
        d.close();
        const token = makeToken({ username: username.toLowerCase(), role, name: name || username, plan });
        res.json({ ok: true, token, user: { username: username.toLowerCase(), role, name: name || username, plan } });
      } catch(e2) {
        d.close();
        if (e2.message.includes('UNIQUE')) return res.status(409).json({ error: 'Username or email already exists' });
        throw e2;
      }
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  // GET /api/users — list users (admin)
  app.get('/api/users', auth, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    try {
      const d = db(false);
      const users = d.prepare("SELECT id, username, email, name, role, plan, phone, active, created_at, last_login FROM app_users ORDER BY created_at DESC").all();
      d.close();
      res.json({ count: users.length, users });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  return { PLANS };
};
