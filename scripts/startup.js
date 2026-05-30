/**
 * MatchPro v11 Startup Script
 * Creates database + sample data if missing, then starts the server
 * Crystal Power Investments | Mo'men Maisara
 */

const { spawn } = require('child_process');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const DB_PATH = path.join(ROOT, 'data', 'matchpro.db');

// Ensure directories exist
[path.join(ROOT, 'data'), path.join(ROOT, 'logs'), path.join(ROOT, 'reports')].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

function log(msg) {
  console.log(`[MatchPro Startup] ${msg}`);
}

function initDB() {
  const dbExists = fs.existsSync(DB_PATH);
  
  if (dbExists) {
    log(`Database found at ${DB_PATH}`);
    try {
      const testDb = new Database(DB_PATH, { readonly: true });
      testDb.prepare('SELECT COUNT(*) FROM demand').get();
      testDb.close();
      log('Database is valid, starting server...');
      return false; // don't recreate
    } catch (e) {
      log(`Database corrupted or incomplete: ${e.message}`);
      log('Recreating database with fresh seed data...');
      fs.unlinkSync(DB_PATH);
    }
  } else {
    log('Database not found, creating fresh database with seed data...');
  }

  const db = new Database(DB_PATH);

  // ─── Schema Creation ─────────────────────────────────────────────
  log('Creating database schema...');

  // Core tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT, sender TEXT, sender_name TEXT,
      text TEXT, type TEXT, timestamp INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id TEXT UNIQUE, name TEXT, member_count INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS demand (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender TEXT, sender_name TEXT, sender_phone TEXT,
      location TEXT, location_cluster TEXT, city TEXT,
      property_type TEXT, purpose TEXT,
      budget_min REAL, budget_max REAL, budget_currency TEXT DEFAULT 'EGP',
      bedrooms INTEGER, bathrooms INTEGER, area_sqm INTEGER,
      finishing TEXT, floor INTEGER, amenities TEXT,
      intent TEXT DEFAULT 'buy', urgency TEXT DEFAULT 'normal',
      raw_message TEXT, classification TEXT,
      verified INTEGER DEFAULT 0, source TEXT DEFAULT 'whatsapp',
      score REAL DEFAULT 50, hot_lead INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS supply (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender TEXT, sender_name TEXT, sender_phone TEXT,
      location TEXT, location_cluster TEXT, city TEXT,
      property_type TEXT, purpose TEXT,
      price REAL, price_currency TEXT DEFAULT 'EGP', price_per_meter REAL,
      bedrooms INTEGER, bathrooms INTEGER, area_sqm INTEGER,
      finishing TEXT, floor INTEGER, amenities TEXT,
      description TEXT, images TEXT,
      verified INTEGER DEFAULT 0, source TEXT DEFAULT 'whatsapp',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      demand_id INTEGER, supply_id INTEGER,
      score REAL, match_type TEXT,
      buyer_name TEXT, buyer_contact TEXT,
      seller_name TEXT, seller_contact TEXT,
      location TEXT, property_type TEXT, purpose TEXT,
      bedrooms INTEGER, area_sqm INTEGER,
      buyer_budget REAL, seller_price REAL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (demand_id) REFERENCES demand(id),
      FOREIGN KEY (supply_id) REFERENCES supply(id)
    );
    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_code TEXT UNIQUE, name TEXT, type TEXT,
      location TEXT, city TEXT, area_sqm INTEGER,
      bedrooms INTEGER, bathrooms INTEGER, finishing TEXT,
      price REAL, price_currency TEXT DEFAULT 'EGP',
      status TEXT DEFAULT 'available', source TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS asset_matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id INTEGER, demand_id INTEGER,
      score REAL, status TEXT DEFAULT 'pending',
      notified INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (asset_id) REFERENCES assets(id),
      FOREIGN KEY (demand_id) REFERENCES demand(id)
    );
    CREATE TABLE IF NOT EXISTS webhook_leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT, name TEXT, message TEXT, intent TEXT,
      location TEXT, budget_max REAL, property_type TEXT,
      confidence INTEGER, classification TEXT,
      status TEXT DEFAULT 'new',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS api_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      method TEXT, path TEXT, status INTEGER,
      duration_ms INTEGER, ip TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS brokers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE, name TEXT, group_name TEXT,
      total_leads INTEGER DEFAULT 0, total_matches INTEGER DEFAULT 0,
      commission_rate REAL DEFAULT 2.5,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS broker_otp_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT, code TEXT, expires_at DATETIME,
      verified INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS broker_portal_logins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      broker_id INTEGER, ip TEXT, user_agent TEXT,
      success INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (broker_id) REFERENCES brokers(id)
    );
    CREATE TABLE IF NOT EXISTS properties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT, type TEXT, location TEXT,
      area_sqm INTEGER, bedrooms INTEGER, bathrooms INTEGER,
      finishing TEXT, price REAL, status TEXT DEFAULT 'available',
      description TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS lead_deliveries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id TEXT, broker_id INTEGER, match_id INTEGER,
      channel TEXT, delivered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'delivered',
      FOREIGN KEY (broker_id) REFERENCES brokers(id)
    );
    CREATE TABLE IF NOT EXISTS buyers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE, name TEXT, location TEXT,
      property_type TEXT, purpose TEXT, budget_max REAL,
      bedrooms INTEGER, score REAL DEFAULT 50,
      last_contact DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS demand_archive (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      original_id INTEGER, archive_data TEXT,
      archived_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE, name TEXT, plan TEXT,
      location_prefs TEXT, property_types TEXT,
      budget_min REAL, budget_max REAL,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS app_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE, password_hash TEXT,
      role TEXT DEFAULT 'user', name TEXT,
      email TEXT, phone TEXT,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS report_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT UNIQUE, report_type TEXT,
      filters TEXT, generated_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS report_access_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT, user_phone TEXT, accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS broker_sheet_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      broker_id INTEGER, sheet_url TEXT,
      status TEXT, error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    -- View for hot leads
    CREATE VIEW IF NOT EXISTS v7_lead_quality AS
    SELECT d.*,
      CASE
        WHEN d.hot_lead = 1 THEN 1
        WHEN d.score >= 85 AND d.verified = 1 THEN 1
        WHEN d.budget_max >= 5000000 AND d.score >= 75 THEN 1
        ELSE 0
      END as is_hot_lead
    FROM demand d;
  `);

  // ─── Seed Data ────────────────────────────────────────────────────
  log('Seeding demand data (7,626 buyers)...');
  const demandLocations = [
    'Madinaty', 'Rehab City', 'New Cairo', 'Fifth Settlement',
    'Sheikh Zayed', '6th of October', 'Mostakbal City', 'Nasr City',
    'Heliopolis', 'Maadi', 'Zamalek', 'North Coast', 'New Capital',
    'Beverly Hills', 'Shorouk City', 'Obour City', 'Madinaty B6',
    'Madinaty B1', 'Madinaty B11', 'Madinaty B12'
  ];
  const propertyTypes = ['apartment', 'villa', 'duplex', 'penthouse', 'townhouse'];
  const purposes = ['buy', 'rent'];
  const finishings = ['fully_finished', 'semi_finished', 'core_shell', null];
  const names = ['Ahmed Hassan', 'Mohamed Ibrahim', 'Omar Mahmoud', 'Ali Ahmed', 'Youssef Galal', 
                 'Sara Mahmoud', 'Fatima Ibrahim', 'Nadia Ahmed', 'Mariam Hassan', 'Dina Ali',
                 'Khaled Said', 'Amr Nabil', 'Tarek Hossam', 'Samy Kamal', 'Wael Adel'];
  const groups = ['365 Group', 'Aman Real Estate', 'ReMax CP', 'WeComm', 'El Mostaqbal', 
                  'CityScape', 'Prime Properties', 'Dream Home', 'El Shams', 'Tarek Group',
                  'Kamel Group', 'Al-Mashra3ya'];
  const intents = ['buy', 'rent'];

  const insertDemand = db.prepare(`
    INSERT INTO demand (sender_name, sender_phone, location, location_cluster, city,
      property_type, purpose, budget_min, budget_max, bedrooms, finishing, intent,
      raw_message, classification, verified, source, score, hot_lead, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((records) => {
    for (const r of records) insertDemand.run(...r);
  });

  const demandRecords = [];
  for (let i = 1; i <= 7626; i++) {
    const loc = demandLocations[Math.floor(Math.random() * demandLocations.length)];
    const locs = loc.split(' ');
    const cluster = locs[locs.length - 1];
    const purpose = intents[Math.floor(Math.random() * intents.length)];
    const propType = propertyTypes[Math.floor(Math.random() * propertyTypes.length)];
    const beds = [1, 2, 3, 4, 5][Math.floor(Math.random() * 5)];
    const finishing = finishings[Math.floor(Math.random() * finishings.length)];
    const intent = intents[Math.floor(Math.random() * intents.length)];
    const name = names[Math.floor(Math.random() * names.length)];
    const group = groups[Math.floor(Math.random() * groups.length)];
    const budget = purpose === 'buy'
      ? [1200000, 1800000, 2500000, 3500000, 5000000, 7000000, 10000000][Math.floor(Math.random() * 7)]
      : [8000, 12000, 18000, 25000, 35000, 50000, 75000][Math.floor(Math.random() * 7)];
    const score = Math.floor(45 + Math.random() * 55);
    const hot = score >= 85 ? 1 : 0;
    const daysAgo = Math.floor(Math.random() * 60);
    const createdAt = new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 19).replace('T', ' ');
    const msg = intent === 'buy'
      ? `Looking for ${propType} in ${loc}, ${beds} bedrooms, budget ${(budget/1000000).toFixed(1)}M`
      : `Need ${propType} for rent in ${loc}, ${beds} rooms, max ${budget.toLocaleString()} EGP`;
    const classifications = ['DEMAND', 'DEMAND', 'DEMAND', 'BROKER_DEMAND'];

    demandRecords.push([
      name, `010${Math.floor(10000000 + Math.random() * 89999999)}`,
      loc, cluster, 'Cairo', propType, purpose,
      budget * 0.8, budget, beds, finishing, intent,
      msg, classifications[Math.floor(Math.random() * classifications.length)],
      Math.random() > 0.3 ? 1 : 0, 'whatsapp', score, hot, createdAt
    ]);
  }
  insertMany(demandRecords);
  log(`  → Inserted ${demandRecords.length} demand records`);

  log('Seeding supply data (3,741 listings)...');
  const insertSupply = db.prepare(`
    INSERT INTO supply (sender_name, sender_phone, location, location_cluster, city,
      property_type, purpose, price, bedrooms, area_sqm, finishing, verified, source, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const supplyRecords = [];
  for (let i = 1; i <= 3741; i++) {
    const loc = demandLocations[Math.floor(Math.random() * demandLocations.length)];
    const locs = loc.split(' ');
    const cluster = locs[locs.length - 1];
    const purpose = purposes[Math.floor(Math.random() * purposes.length)];
    const propType = propertyTypes[Math.floor(Math.random() * propertyTypes.length)];
    const beds = [1, 2, 3, 4, 5][Math.floor(Math.random() * 5)];
    const area = beds * 40 + Math.floor(Math.random() * 80);
    const finishing = finishings[Math.floor(Math.random() * finishings.length)];
    const price = purpose === 'buy'
      ? [1500000, 2200000, 3000000, 4200000, 6000000, 8500000, 12000000][Math.floor(Math.random() * 7)]
      : [10000, 15000, 22000, 32000, 45000, 65000, 90000][Math.floor(Math.random() * 7)];
    const name = names[Math.floor(Math.random() * names.length)];
    const daysAgo = Math.floor(Math.random() * 45);
    const createdAt = new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 19).replace('T', ' ');
    supplyRecords.push([
      name, `010${Math.floor(10000000 + Math.random() * 89999999)}`,
      loc, cluster, 'Cairo', propType, purpose, price, beds, area, finishing,
      Math.random() > 0.25 ? 1 : 0, 'whatsapp', createdAt
    ]);
  }
  const insertSupplyMany = db.transaction((records) => {
    for (const r of records) insertSupply.run(...r);
  });
  insertSupplyMany(supplyRecords);
  log(`  → Inserted ${supplyRecords.length} supply records`);

  log('Generating matches (56,566 match pairs)...');
  const insertMatch = db.prepare(`
    INSERT INTO matches (demand_id, supply_id, score, buyer_name, buyer_contact,
      seller_name, seller_contact, location, property_type, purpose,
      bedrooms, area_sqm, buyer_budget, seller_price, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const demandRows = db.prepare('SELECT id, sender_name, sender_phone, location, property_type, purpose, budget_max, bedrooms FROM demand').all();
  const supplyRows = db.prepare('SELECT id, sender_name, sender_phone, location, property_type, purpose, price, bedrooms, area_sqm FROM supply').all();
  const supplyMap = {};
  supplyRows.forEach(s => {
    const key = `${s.location}|${s.property_type}|${s.purpose}`;
    if (!supplyMap[key]) supplyMap[key] = [];
    supplyMap[key].push(s);
  });

  const matchBatch = [];
  for (const d of demandRows) {
    const key = `${d.location}|${d.property_type}|${d.purpose}`;
    const matches = supplyMap[key] || [];
    if (matches.length === 0) continue;
    const numMatches = Math.min(matches.length, Math.floor(3 + Math.random() * 8));
    const selected = matches.slice(0, numMatches);
    for (const s of selected) {
      const score = Math.floor(60 + Math.random() * 40);
      const daysAgo = Math.floor(Math.random() * 30);
      const createdAt = new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 19).replace('T', ' ');
      const statuses = ['pending', 'pending', 'pending', 'contacted', 'qualified'];
      matchBatch.push([
        d.id, s.id, score, d.sender_name, d.sender_phone,
        s.sender_name, s.sender_phone, s.location, s.property_type, s.purpose,
        s.bedrooms, s.area_sqm, d.budget_max, s.price,
        statuses[Math.floor(Math.random() * statuses.length)], createdAt
      ]);
      if (matchBatch.length >= 2000) {
        const batchInsert = db.transaction((batch) => {
          for (const r of batch) insertMatch.run(...r);
        });
        batchInsert(matchBatch.splice(0));
      }
    }
  }
  if (matchBatch.length > 0) {
    const finalBatch = db.transaction((batch) => {
      for (const r of batch) insertMatch.run(...r);
    });
    finalBatch(matchBatch);
  }
  const totalMatches = db.prepare('SELECT COUNT(*) c FROM matches').get().c;
  log(`  → Created ${totalMatches} match records`);

  // Seed a default app user
  const jwtSecret = process.env.JWT_SECRET || 'd3454f78d857f7b49c213cb0da1eb04749c715ab77b58c9f8f5f09e431157f12';
  const pwHash = crypto.createHash('sha256').update('CPI-Admin-2026!').digest('hex');
  try {
    db.prepare(`INSERT INTO app_users (username, password_hash, role, name, email) VALUES (?,?,?,?,?)`)
      .run('mmaisara', pwHash, 'admin', 'Mo''men Hisham Maisara', 'mmaisara@crystalpowerinvestment.com');
    log('Default admin user created: mmaisara / CPI-Admin-2026!');
  } catch (e) { /* already exists */ }

  const dbSize = (db.prepare('SELECT COUNT(*) FROM demand').get()['COUNT(*)']);
  db.close();
  log(`Database initialization complete. ${dbSize} demand records ready.`);
  return true; // DB was created
}

function startServer() {
  const env = { ...process.env, PORT: process.env.PORT || '3070' };
  const server = spawn('node', ['server/index.js'], {
    cwd: ROOT,
    env,
    stdio: 'inherit'
  });
  server.on('error', (err) => {
    console.error('[MatchPro Startup] Failed to start server:', err.message);
    process.exit(1);
  });
}

console.log('╔══════════════════════════════════════════════╗');
console.log('║   MatchPro v11.0.0 — Intelligence Engine     ║');
console.log('║   Crystal Power Investments                  ║');
console.log('╚══════════════════════════════════════════════╝');

const dbCreated = initDB();
startServer();