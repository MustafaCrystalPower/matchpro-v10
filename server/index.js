/**
 * MatchPro Unified Intelligence Engine v11.0.0
 * Crystal Power Investments — Mo'men Hisham Maisara
 *
 * Entry point — app setup, middleware, route mounting
 * Port: 3070
 */
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const cron = require('node-cron');
const { execFile } = require('child_process');
const discoverHandler = require('./discover');
const crypto = require('crypto');

const PORT = process.env.PORT || 3070;
const ROOT = path.resolve(__dirname, '..');
const DB_PATH = path.join(ROOT, 'data', 'matchpro.db');
const REPORTS_DIR = path.join(ROOT, 'reports');
const LOGS_DIR = path.join(ROOT, 'logs');
const CLIENT_DIR = path.join(ROOT, 'client');
const ACCESS_LOG = path.join(LOGS_DIR, 'access.log');

[REPORTS_DIR, LOGS_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

const app = express();

// ─── SECURITY HEADERS ────────────────────────
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'SAMEORIGIN');
  res.set('X-XSS-Protection', '1; mode=block');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('X-Powered-By', 'MatchPro/11.0.0');
  next();
});

// ─── RATE LIMITING (simple in-memory: 100 req/min per IP) ────────────────────
const rateLimitStore = new Map();
const RATE_LIMIT = 100;
const RATE_WINDOW_MS = 60 * 1000;
app.use((req, res, next) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  let entry = rateLimitStore.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_WINDOW_MS };
    rateLimitStore.set(ip, entry);
  }
  entry.count++;
  res.set('X-RateLimit-Limit', String(RATE_LIMIT));
  res.set('X-RateLimit-Remaining', String(Math.max(0, RATE_LIMIT - entry.count)));
  if (entry.count > RATE_LIMIT) {
    return res.status(429).json({ error: 'Too Many Requests', retryAfter: Math.ceil((entry.resetAt - now) / 1000) });
  }
  next();
});
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) rateLimitStore.delete(ip);
  }
}, 5 * 60 * 1000);

// ─── ACCESS LOGGING ──────────────────────────
const accessLogStream = fs.createWriteStream(ACCESS_LOG, { flags: 'a' });
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || '-';
    const line = `${new Date().toISOString()} ${ip} ${req.method} ${req.path} ${res.statusCode} ${ms}ms\n`;
    accessLogStream.write(line);
    try {
      const d = db(true);
      d.prepare('INSERT INTO api_logs (method, path, status, duration_ms, ip) VALUES (?,?,?,?,?)').run(req.method, req.path, res.statusCode, ms, ip);
      d.close();
    } catch (_) {}
  });
  next();
});

app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));

// ─── JWT HELPERS ─────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'cpi-matchpro-secret-2026';
function hashPw(p) { return crypto.createHash('sha256').update(p).digest('hex'); }
const ADMIN_USERS = {
  mmaisara:  { password: hashPw('CPI-Admin-2026!'), name: "Mo'men Maisara", role: 'admin' },
  admin:     { password: hashPw('CPI-Admin-2026!'), name: "Admin", role: 'admin' },
};
function makeToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body   = Buffer.from(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 604800 })).toString('base64url');
  const sig    = crypto.createHmac('sha256', JWT_SECRET).update(header + '.' + body).digest('base64url');
  return header + '.' + body + '.' + sig;
}
function verifyToken(token) {
  try {
    const [h, b, s] = token.split('.');
    const expected = crypto.createHmac('sha256', JWT_SECRET).update(h + '.' + b).digest('base64url');
    if (s !== expected) return null;
    const payload = JSON.parse(Buffer.from(b, 'base64url').toString());
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}
function auth(req, res, next) {
  const t = (req.headers.authorization || '').replace('Bearer ', '') || req.query.token;
  if (!t) return res.status(401).json({ error: 'Unauthorized' });
  const u = verifyToken(t);
  if (!u) return res.status(401).json({ error: 'Invalid token' });
  req.user = u; next();
}

// ─── DB HELPER ───────────────────────────────
function db(rw = false) {
  const d = new Database(DB_PATH, rw ? {} : { readonly: true });
  d.pragma('journal_mode = WAL');
  return d;
}

// ─── DB SCHEMA HARDENING ─────────────────────
function ensureSchema() {
  const d = db(true);
  d.exec(`
    CREATE TABLE IF NOT EXISTS webhook_leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT,
      message TEXT,
      category TEXT,
      score INTEGER,
      matched_supply_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS api_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      method TEXT,
      path TEXT,
      status INTEGER,
      duration_ms INTEGER,
      ip TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  d.close();
  console.log('✅ DB schema hardened');
}
ensureSchema();

// ─── LOCATION COORDINATES ────────────────────
const LOCATION_COORDS = {
  'مدينتي': { lat: 30.1128, lng: 31.6411, label: 'Madinaty' },
  'Madinaty': { lat: 30.1128, lng: 31.6411, label: 'Madinaty' },
  'مدينتى': { lat: 30.1128, lng: 31.6411, label: 'Madinaty' },
  'القاهرة الجديدة': { lat: 30.0271, lng: 31.4961, label: 'New Cairo' },
  'New Cairo': { lat: 30.0271, lng: 31.4961, label: 'New Cairo' },
  'الرحاب': { lat: 30.0549, lng: 31.5422, label: 'Al Rehab' },
  'الشيخ زايد': { lat: 30.0626, lng: 30.9854, label: 'Sheikh Zayed' },
  'Sheikh Zayed': { lat: 30.0626, lng: 30.9854, label: 'Sheikh Zayed' },
  '6 أكتوبر': { lat: 29.9418, lng: 30.9458, label: '6 October' },
  '6 October': { lat: 29.9418, lng: 30.9458, label: '6 October' },
  'التجمع الخامس': { lat: 30.0131, lng: 31.4716, label: '5th Settlement' },
  'العاصمة الإدارية': { lat: 30.0131, lng: 31.7269, label: 'New Admin Capital' },
  'الساحل الشمالي': { lat: 30.9408, lng: 29.2467, label: 'North Coast' },
  'Noor City': { lat: 30.0900, lng: 31.6200, label: 'Noor City' },
  'Hyde Park': { lat: 30.0050, lng: 31.4700, label: 'Hyde Park' },
  'Mivida': { lat: 30.0400, lng: 31.5200, label: 'Mivida' },
  'mountain view': { lat: 30.0350, lng: 31.5000, label: 'Mountain View' },
  'مدينة بدر': { lat: 30.1120, lng: 31.7200, label: 'Badr City' },
  'الشروق': { lat: 30.1450, lng: 31.6100, label: 'Al Shorouk' },
  'العين السخنة': { lat: 29.5500, lng: 32.3500, label: 'Ain Sokhna' },
  'Cairo': { lat: 30.0444, lng: 31.2357, label: 'Cairo' },
  'القاهرة': { lat: 30.0444, lng: 31.2357, label: 'Cairo' },
  'B6': { lat: 30.1100, lng: 31.6350, label: 'Madinaty B6' },
  'B7': { lat: 30.1105, lng: 31.6355, label: 'Madinaty B7' },
  'B8': { lat: 30.1110, lng: 31.6360, label: 'Madinaty B8' },
  'B10': { lat: 30.1115, lng: 31.6365, label: 'Madinaty B10' },
  'B11': { lat: 30.1120, lng: 31.6370, label: 'Madinaty B11' },
  'B12': { lat: 30.1125, lng: 31.6375, label: 'Madinaty B12' },
  'B14': { lat: 30.1130, lng: 31.6380, label: 'Madinaty B14' },
  'B15': { lat: 30.1135, lng: 31.6385, label: 'Madinaty B15' },
  'Privado': { lat: 30.1090, lng: 31.6340, label: 'Privado Madinaty' },
  'دريملاند': { lat: 29.9850, lng: 30.9800, label: 'Dreamland' },
  'Dreamland': { lat: 29.9850, lng: 30.9800, label: 'Dreamland' },
  'الدقي': { lat: 30.0516, lng: 31.2101, label: 'Dokki' },
  'المهندسين': { lat: 30.0600, lng: 31.2050, label: 'Mohandessin' },
  'مصر الجديدة': { lat: 30.0900, lng: 31.3300, label: 'Heliopolis' },
  'الزمالك': { lat: 30.0650, lng: 31.2170, label: 'Zamalek' },
};
function getCoords(location) {
  if (!location) return null;
  if (LOCATION_COORDS[location]) return LOCATION_COORDS[location];
  const lc = location.toLowerCase().trim();
  for (const [key, val] of Object.entries(LOCATION_COORDS)) {
    if (key.toLowerCase() === lc) return val;
    if (lc.includes(key.toLowerCase()) || key.toLowerCase().includes(lc)) return val;
  }
  return null;
}

// ─── MATCH SCORING ───────────────────────────
function normalizeLocationKey(loc) {
  if (!loc) return null;
  const map = {
    'مدينتى': 'madinaty', 'مدينتي': 'madinaty', 'Madinaty': 'madinaty', 'madinaty': 'madinaty',
    'New Cairo': 'newcairo', 'القاهرة الجديدة': 'newcairo',
    'الرحاب': 'rehab', 'Al Rehab': 'rehab',
    'الشيخ زايد': 'sheikzayed', 'Sheikh Zayed': 'sheikzayed',
    '6 أكتوبر': '6october', '6 October': '6october',
    'التجمع الخامس': '5thsettlement',
    'Dreamland': 'dreamland', 'دريملاند': 'dreamland',
    'القاهرة': 'cairo', 'Cairo': 'cairo'
  };
  return map[loc] || loc.toLowerCase().replace(/\s+/g, '');
}
function scoreMatchPair(supply, demand) {
  let score = 0;
  const sLoc = normalizeLocationKey(supply.location);
  const dLoc = normalizeLocationKey(demand.location);
  if (sLoc && dLoc && sLoc === dLoc) score += 40;
  else if (sLoc && dLoc && (sLoc.includes(dLoc) || dLoc.includes(sLoc))) score += 25;
  if (supply.purpose && demand.purpose && supply.purpose === demand.purpose) score += 20;
  if (demand.price_max && supply.price) {
    if (supply.price <= demand.price_max) score += 25;
    else if (supply.price <= demand.price_max * 1.15) score += 12;
  } else if (!demand.price_max) score += 12;
  if (supply.bedrooms && demand.bedrooms && supply.bedrooms === demand.bedrooms) score += 15;
  else if (!demand.bedrooms) score += 7;
  return Math.min(score, 100);
}

// ─── STATIC FILES ────────────────────────────
app.use('/reports', express.static(REPORTS_DIR));
app.use('/', express.static(CLIENT_DIR));

// ─── PWA ROUTES ──────────────────────────────
app.get(['/dashboard', '/dashboard/'], (req, res) => res.sendFile(path.join(CLIENT_DIR, 'public', 'dashboard.html')));
app.get('/asset-intelligence', (req, res) => res.sendFile(path.join(CLIENT_DIR, 'public', 'asset-intelligence.html')));
app.get('/manifest.json', (req, res) => res.sendFile(path.join(CLIENT_DIR, 'public', 'manifest.json')));
app.get('/sw.js', (req, res) => { res.set('Service-Worker-Allowed', '/matchpro/'); res.sendFile(path.join(CLIENT_DIR, 'public', 'sw.js')); });
app.get('/icon-192.png', (req, res) => res.sendFile(path.join(CLIENT_DIR, 'public', 'icon-192.png')));
app.get('/icon-512.png', (req, res) => res.sendFile(path.join(CLIENT_DIR, 'public', 'icon-512.png')));
app.get(['/market-intelligence', '/market'], (req, res) => res.sendFile(path.join(CLIENT_DIR, 'public', 'market-intelligence.html')));

// ─── ROUTE MODULES ───────────────────────────
app.use('/', require('./routes/auth')(db, hashPw, makeToken, verifyToken, ADMIN_USERS));
app.use('/', require('./routes/stats')(db, DB_PATH, PORT));
app.use('/', require('./routes/dashboard')(db, auth));
app.use('/', require('./routes/demand')(db, scoreMatchPair));
app.use('/', require('./routes/supply')(db));
app.use('/', require('./routes/matches')(db, ROOT));
app.use('/', require('./routes/assets')(db, scoreMatchPair));
app.use('/', require('./routes/map')(db, getCoords));
app.use('/', require('./routes/market')(db));
app.use('/', require('./routes/public')(db, scoreMatchPair));
app.use('/', require('./routes/webhook')(db));
app.use('/', require('./routes/pipeline')(db, ROOT, REPORTS_DIR, discoverHandler));
app.use('/', require('./routes/properties')(db, auth));

// ─── EXTERNAL MODULE INTEGRATIONS ────────────
require('./market-v2')(app, db);
require('./avm')(app, db);
require('./subscriptions')(app, db, hashPw, makeToken, auth);
require('./broker-portal')(app, db, makeToken);
require('./leads')(app, db, auth);
require('./buyers')(app, db, auth);

// ─── ROOT FALLBACK ───────────────────────────
app.get('/', (req, res) => {
  if (fs.existsSync(path.join(CLIENT_DIR, 'index.html'))) {
    return res.sendFile(path.join(CLIENT_DIR, 'index.html'));
  }
  res.send(`<!doctype html><html><head><meta charset="utf-8"><title>MatchPro v11</title>
  <style>body{font-family:system-ui;background:#0a0e27;color:#fff;padding:40px;max-width:900px;margin:auto}
  h1{color:#FFD700}a{color:#4FC3F7;text-decoration:none}a:hover{text-decoration:underline}
  .card{background:#1a1f3a;padding:20px;border-radius:12px;margin:12px 0}
  .badge{background:#FFD700;color:#0a0e27;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:bold}</style></head><body>
  <h1>🚀 MatchPro Unified Intelligence <span class="badge">v11.0.0</span></h1>
  <div class="card"><h3>Quick Links</h3>
  <ul>
    <li><a href="/dashboard">📊 Dashboard</a></li>
    <li><a href="/asset-intelligence">🏠 Asset Intelligence</a></li>
    <li><a href="/health">/health</a> — JSON status</li>
    <li><a href="/api/stats">/api/stats</a> — full stats</li>
    <li><a href="/api/demand">/api/demand</a> — recent demand</li>
    <li><a href="/api/supply">/api/supply</a> — recent supply</li>
    <li><a href="/api/matches">/api/matches</a> — top matches</li>
  </ul></div>
  <p style="color:#999">Crystal Power Investments — Mo'men Hisham Maisara</p>
  </body></html>`);
});

// ─── SPA CATCH-ALL (must be LAST) ────────────
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/reports/') || req.path.includes('.')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(CLIENT_DIR, 'public', 'index.html'));
});

// ─── START SERVER ────────────────────────────
const http = require('http');
const WebSocket = require('ws');
const server = http.createServer(app);

let wss;
try {
  wss = new WebSocket.Server({ server, path: '/ws' });
  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'connected', message: 'MatchPro Live Feed', timestamp: new Date().toISOString() }));
    ws.on('error', () => {});
  });
  console.log('✅ WebSocket server active on /ws');
} catch (e) {
  console.log('⚠️  WebSocket not available (ws package missing), using HTTP polling');
}

function broadcast(data) {
  if (!wss) return;
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === 1) client.send(msg);
  });
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ MatchPro Unified v11.0.0 listening on :${PORT}`);
  console.log(`   DB: ${DB_PATH}`);
  console.log(`   Reports: ${REPORTS_DIR}`);
  console.log(`   Rate limit: ${RATE_LIMIT} req/min per IP`);
  console.log(`   Access log: ${ACCESS_LOG}`);
  console.log(`   Modules: AVM, Subscriptions, Broker Portal, Leads, Buyers, Properties`);
});
