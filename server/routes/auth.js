/**
 * Auth Routes — JWT login, /api/me
 */
module.exports = (db, hashPw, makeToken, verifyToken, ADMIN_USERS) => {
  const router = require('express').Router();

  router.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    // Support email login: extract part before @
    const key = (username || '').toLowerCase().split('@')[0];
    const u = ADMIN_USERS[key] || ADMIN_USERS[(username || '').toLowerCase()];
    if (u && u.password === hashPw(password || '')) {
      const token = makeToken({ username: key, role: u.role, name: u.name });
      return res.json({ token, user: { name: u.name, role: u.role, username: key } });
    }
    // Check app_users table
    try {
      const d2 = db(false);
      const dbUser = d2.prepare("SELECT * FROM app_users WHERE (username=? OR email=?) AND active=1").get(key, (username || '').toLowerCase());
      d2.close();
      if (dbUser && dbUser.password_hash === hashPw(password || '')) {
        const token = makeToken({ username: dbUser.username, role: dbUser.role, name: dbUser.name, plan: dbUser.plan });
        return res.json({ token, user: { name: dbUser.name, role: dbUser.role, username: dbUser.username, plan: dbUser.plan } });
      }
    } catch (_) {}
    res.status(401).json({ error: 'Invalid credentials' });
  });

  router.get('/api/me', (req, res) => {
    const t = (req.headers.authorization || '').replace('Bearer ', '') || req.query.token;
    if (!t) return res.status(401).json({ error: 'Unauthorized' });
    const u = verifyToken(t);
    if (!u) return res.status(401).json({ error: 'Invalid token' });
    res.json({ ok: true, user: u });
  });

  return router;
};
