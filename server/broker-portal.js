/**
 * MatchPro Broker Portal
 * OTP verification, broker-specific dashboard
 */

const crypto = require('crypto');

// In-memory OTP store: phone → { otp, expires, attempts }
const otpStore = new Map();
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OTP_MAX_ATTEMPTS = 3;

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function ensureBrokerTables(db) {
  const d = db(true);
  d.exec(`
    CREATE TABLE IF NOT EXISTS broker_otp_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL,
      otp_hash TEXT NOT NULL,
      verified INTEGER DEFAULT 0,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS broker_portal_logins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL,
      broker_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  d.close();
}

module.exports = function(app, db, makeToken) {
  ensureBrokerTables(db);

  // POST /api/broker/request-otp
  app.post('/api/broker/request-otp', (req, res) => {
    try {
      const { phone } = req.body;
      if (!phone) return res.status(400).json({ error: 'phone required' });

      const otp = generateOTP();
      const hash = crypto.createHash('sha256').update(otp).digest('hex');
      const expires = Date.now() + OTP_TTL_MS;

      otpStore.set(phone, { hash, expires, attempts: 0 });

      // Log OTP to console (mock send — in production integrate SMS/WhatsApp)
      console.log(`📱 [OTP] Phone: ${phone} → OTP: ${otp} (expires in 10min)`);

      // Store in DB for audit
      const d = db(true);
      d.prepare(`INSERT INTO broker_otp_sessions (phone, otp_hash, expires_at) VALUES (?,?, datetime('now','+10 minutes'))`).run(phone, hash);
      d.close();

      res.json({
        ok: true,
        message: 'OTP sent via WhatsApp/SMS',
        phone,
        expires_in: 600,
        // In dev/test mode, return OTP directly — REMOVE IN PRODUCTION
        debug_otp: process.env.NODE_ENV !== 'production' ? otp : undefined
      });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  // POST /api/broker/verify-otp
  app.post('/api/broker/verify-otp', (req, res) => {
    try {
      const { phone, otp } = req.body;
      if (!phone || !otp) return res.status(400).json({ error: 'phone and otp required' });

      const entry = otpStore.get(phone);
      if (!entry) return res.status(400).json({ error: 'No OTP requested for this phone. Request a new one.' });
      if (Date.now() > entry.expires) {
        otpStore.delete(phone);
        return res.status(400).json({ error: 'OTP expired. Request a new one.' });
      }
      if (entry.attempts >= OTP_MAX_ATTEMPTS) {
        otpStore.delete(phone);
        return res.status(429).json({ error: 'Too many failed attempts. Request a new OTP.' });
      }

      const inputHash = crypto.createHash('sha256').update(otp).digest('hex');
      if (inputHash !== entry.hash) {
        entry.attempts++;
        return res.status(401).json({ error: 'Invalid OTP', attempts_remaining: OTP_MAX_ATTEMPTS - entry.attempts });
      }

      // Valid OTP
      otpStore.delete(phone);

      // Look up broker in DB
      const d = db(false);
      const broker = d.prepare("SELECT * FROM brokers WHERE phone = ? OR whatsapp_chat_id LIKE ? LIMIT 1").get(phone, `%${phone}%`);
      d.close();

      const token = makeToken({
        role: 'broker',
        phone,
        broker_id: broker?.id || null,
        broker_name: broker?.name || null,
        username: `broker_${phone}`
      });

      // Log login
      const dw = db(true);
      dw.prepare("INSERT INTO broker_portal_logins (phone, broker_id) VALUES (?,?)").run(phone, broker?.id || null);
      dw.close();

      res.json({
        ok: true,
        token,
        broker: broker || { phone, name: 'Broker', id: null }
      });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  // GET /api/broker/me — broker's own profile + stats
  app.get('/api/broker/me', (req, res) => {
    const t = (req.headers.authorization || '').replace('Bearer ', '') || req.query.token;
    if (!t) return res.status(401).json({ error: 'Unauthorized' });
    // Token verification handled by main auth, but broker role specific
    res.json({ message: 'Use /api/broker/dashboard' });
  });

  // GET /api/broker/dashboard — broker's listings and matches
  app.get('/api/broker/dashboard', (req, res) => {
    try {
      const phone = req.query.phone || (req.headers['x-broker-phone'] || '');
      if (!phone) return res.status(400).json({ error: 'phone required' });

      const d = db(false);
      // Broker's supply listings
      const listings = d.prepare("SELECT * FROM supply WHERE sender_phone LIKE ? OR sender_phone = ? ORDER BY created_at DESC LIMIT 50")
        .all(`%${phone}%`, phone);
      // Broker scores
      const score = d.prepare("SELECT * FROM broker_scores WHERE broker_id IN (SELECT id FROM brokers WHERE phone LIKE ?) LIMIT 1")
        .get(`%${phone}%`);
      // Top matches for their listings
      const matches = d.prepare(`SELECT m.* FROM matches m
        JOIN supply s ON s.id = m.supply_id
        WHERE s.sender_phone LIKE ?
        ORDER BY m.match_score DESC LIMIT 20`).all(`%${phone}%`);
      d.close();

      res.json({
        phone,
        listings_count: listings.length,
        listings,
        broker_score: score || null,
        top_matches: matches,
        dashboard_at: new Date().toISOString()
      });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  // GET /api/broker/list — all brokers (admin)
  app.get('/api/broker/list', (req, res) => {
    try {
      const d = db(false);
      const brokers = d.prepare("SELECT b.*, bs.total_score, bs.listings_count FROM brokers b LEFT JOIN broker_scores bs ON bs.broker_id = b.id ORDER BY b.created_at DESC LIMIT 100").all();
      d.close();
      res.json({ count: brokers.length, brokers });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  // GET /api/broker/scores — broker scoring table
  app.get('/api/broker/scores', (req, res) => {
    try {
      const d = db(false);
      const scores = d.prepare(`
        SELECT bs.*, b.name, b.phone, b.email
        FROM broker_scores bs
        LEFT JOIN brokers b ON b.id = bs.broker_id
        ORDER BY bs.total_score DESC LIMIT 50
      `).all();
      d.close();
      res.json({ count: scores.length, scores });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });
};
