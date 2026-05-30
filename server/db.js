/**
 * MatchPro Intelligence — SQLite Persistence Layer v1.0
 * ======================================================
 * Powered by better-sqlite3 (synchronous, zero-dependency, battle-tested)
 *
 * Tables:
 *   wa_credentials   — idInstance / apiToken (persist across restarts)
 *   messages         — full classified WA message store
 *   pipeline         — CRM deal pipeline
 *   pipeline_history — stage transition log
 *   brokers          — broker analytics
 *   match_feedback   — user feedback on match scores
 *   location_stats   — aggregated supply/demand per Egyptian city (updated on classify)
 *   scraper_cache    — TTL-cached scraper results per query hash
 */

import Database from 'better-sqlite3'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { mkdirSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR   = join(__dirname, '..', 'data')
const DB_PATH    = join(DATA_DIR, 'matchpro.db')

mkdirSync(DATA_DIR, { recursive: true })

const db = new Database(DB_PATH)

// ── WAL mode for concurrent reads + durability ──────────────────────────────
db.pragma('journal_mode = WAL')
db.pragma('synchronous = NORMAL')
db.pragma('foreign_keys = ON')
db.pragma('cache_size = -32000')   // 32 MB cache

// ── Schema ───────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS wa_credentials (
    id          INTEGER PRIMARY KEY,
    instance_id TEXT    NOT NULL,
    api_token   TEXT    NOT NULL,
    gateway_url TEXT    NOT NULL DEFAULT 'https://7105.api.greenapi.com',
    updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );

  CREATE TABLE IF NOT EXISTS messages (
    id            TEXT PRIMARY KEY,
    sender        TEXT,
    sender_name   TEXT,
    body          TEXT,
    direction     TEXT,
    type_message  TEXT,
    timestamp     INTEGER,
    classification TEXT,   -- JSON blob: { label, confidence, reason, extracted }
    gpt_upgraded  INTEGER DEFAULT 0,
    is_group      INTEGER DEFAULT 0,
    created_at    TEXT    DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_messages_ts        ON messages(timestamp DESC);
  CREATE INDEX IF NOT EXISTS idx_messages_label     ON messages(json_extract(classification,'$.label'));
  CREATE INDEX IF NOT EXISTS idx_messages_location  ON messages(json_extract(classification,'$.extracted.location'));

  CREATE TABLE IF NOT EXISTS pipeline (
    id            TEXT PRIMARY KEY,
    match_id      TEXT,
    buyer_name    TEXT,
    seller_name   TEXT,
    property_desc TEXT,
    status        TEXT    DEFAULT 'new',
    notes         TEXT    DEFAULT '',
    created_at    TEXT    DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    updated_at    TEXT    DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );

  CREATE TABLE IF NOT EXISTS pipeline_history (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    deal_id    TEXT,
    status     TEXT,
    note       TEXT,
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    FOREIGN KEY(deal_id) REFERENCES pipeline(id)
  );

  CREATE TABLE IF NOT EXISTS brokers (
    phone      TEXT PRIMARY KEY,
    name       TEXT,
    supply     INTEGER DEFAULT 0,
    demand     INTEGER DEFAULT 0,
    match_cnt  INTEGER DEFAULT 0,
    inquiry    INTEGER DEFAULT 0,
    other      INTEGER DEFAULT 0,
    total      INTEGER DEFAULT 0,
    last_seen  TEXT
  );

  CREATE TABLE IF NOT EXISTS match_feedback (
    id         TEXT PRIMARY KEY,
    match_id   TEXT,
    rating     TEXT,
    comment    TEXT,
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );

  CREATE TABLE IF NOT EXISTS location_stats (
    location   TEXT PRIMARY KEY,
    supply     INTEGER DEFAULT 0,
    demand     INTEGER DEFAULT 0,
    avg_budget REAL    DEFAULT 0,
    updated_at TEXT    DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );

  CREATE TABLE IF NOT EXISTS scraper_cache (
    hash       TEXT PRIMARY KEY,
    query_json TEXT,
    result_json TEXT,
    hits       INTEGER DEFAULT 1,
    created_at TEXT    DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    expires_at TEXT
  );
`)

// Pre-seed location_stats so the map always has baseline data
const SEED_LOCATIONS = [
  { location: 'Madinaty',        supply: 0, demand: 0, avg_budget: 4200000 },
  { location: 'Rehab City',      supply: 0, demand: 0, avg_budget: 3800000 },
  { location: 'New Cairo',       supply: 0, demand: 0, avg_budget: 5100000 },
  { location: 'Sheikh Zayed',    supply: 0, demand: 0, avg_budget: 7500000 },
  { location: '6th October',     supply: 0, demand: 0, avg_budget: 3200000 },
  { location: 'Mostakbal City',  supply: 0, demand: 0, avg_budget: 3900000 },
  { location: 'Heliopolis',      supply: 0, demand: 0, avg_budget: 6200000 },
  { location: 'Nasr City',       supply: 0, demand: 0, avg_budget: 3600000 },
  { location: 'Obour City',      supply: 0, demand: 0, avg_budget: 2800000 },
  { location: '5th Settlement',  supply: 0, demand: 0, avg_budget: 4800000 },
  { location: 'Zamalek',         supply: 0, demand: 0, avg_budget: 8500000 },
  { location: 'El Tagamoa',      supply: 0, demand: 0, avg_budget: 5200000 },
]
const seedStmt = db.prepare(`
  INSERT OR IGNORE INTO location_stats(location, supply, demand, avg_budget)
  VALUES (@location, @supply, @demand, @avg_budget)
`)
const seedMany = db.transaction(() => SEED_LOCATIONS.forEach(l => seedStmt.run(l)))
seedMany()

console.log(`[DB] SQLite ready → ${DB_PATH}`)

// ════════════════════════════════════════════════════════════════════════════
// WA CREDENTIALS
// ════════════════════════════════════════════════════════════════════════════
const _getCreds = db.prepare('SELECT * FROM wa_credentials ORDER BY id DESC LIMIT 1')
const _upsertCreds = db.prepare(`
  INSERT INTO wa_credentials(id, instance_id, api_token, gateway_url, updated_at)
  VALUES(1, @instance_id, @api_token, @gateway_url, strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  ON CONFLICT(id) DO UPDATE SET
    instance_id = @instance_id,
    api_token   = @api_token,
    gateway_url = @gateway_url,
    updated_at  = strftime('%Y-%m-%dT%H:%M:%SZ','now')
`)

export function getWaCreds() {
  return _getCreds.get() || null
}

export function saveWaCreds(instanceId, apiToken, gatewayUrl = 'https://7105.api.greenapi.com') {
  _upsertCreds.run({ instance_id: instanceId, api_token: apiToken, gateway_url: gatewayUrl })
}

// ════════════════════════════════════════════════════════════════════════════
// MESSAGES
// ════════════════════════════════════════════════════════════════════════════
const _insertMsg = db.prepare(`
  INSERT OR REPLACE INTO messages(id, sender, sender_name, body, direction, type_message, timestamp, classification, gpt_upgraded, is_group)
  VALUES(@id, @sender, @sender_name, @body, @direction, @type_message, @timestamp, @classification, @gpt_upgraded, @is_group)
`)
const _updateMsgClassification = db.prepare(`
  UPDATE messages SET classification = @classification, gpt_upgraded = 1 WHERE id = @id
`)
const _getMessages = db.prepare(`
  SELECT * FROM messages ORDER BY timestamp DESC LIMIT @limit
`)
const _getMessagesByLabel = db.prepare(`
  SELECT * FROM messages
  WHERE json_extract(classification,'$.label') = @label
  ORDER BY timestamp DESC LIMIT @limit
`)
const _getMsgsSince = db.prepare(`
  SELECT * FROM messages WHERE timestamp > @since ORDER BY timestamp DESC LIMIT @limit
`)
const _countMessages = db.prepare(`SELECT COUNT(*) as cnt FROM messages`)
const _getMsgById = db.prepare(`SELECT id FROM messages WHERE id = @id`)
const _getStats = db.prepare(`
  SELECT
    json_extract(classification,'$.label') as label,
    COUNT(*) as cnt
  FROM messages
  GROUP BY label
`)

export function saveMessage(msg) {
  _insertMsg.run({
    id:            msg.id,
    sender:        msg.sender,
    sender_name:   msg.senderName,
    body:          msg.body,
    direction:     msg.direction,
    type_message:  msg.typeMessage,
    timestamp:     msg.timestamp,
    classification: JSON.stringify(msg.classification),
    gpt_upgraded:  msg.gptUpgraded ? 1 : 0,
    is_group:      msg.isGroup ? 1 : 0,
  })
}

export function saveMessages(msgs) {
  const tx = db.transaction(() => msgs.forEach(saveMessage))
  tx()
}

export function updateMessageClassification(id, classification) {
  _updateMsgClassification.run({ id, classification: JSON.stringify(classification) })
}

export function hasMessage(id) {
  return !!_getMsgById.get({ id })
}

export function getMessages({ limit = 500, label, since } = {}) {
  let rows
  if (since) {
    rows = _getMsgsSince.all({ since: parseInt(since), limit: parseInt(limit) })
  } else if (label && label !== 'all') {
    rows = _getMessagesByLabel.all({ label, limit: parseInt(limit) })
  } else {
    rows = _getMessages.all({ limit: parseInt(limit) })
  }
  return rows.map(deserializeMessage)
}

export function getMessageCount() {
  return _countMessages.get().cnt
}

export function getStatsFromDB() {
  const rows = _getStats.all()
  const stats = { supply: 0, demand: 0, match: 0, inquiry: 0, other: 0, total: 0 }
  for (const row of rows) {
    const label = (row.label || 'other').toLowerCase()
    stats[label] = (stats[label] || 0) + row.cnt
    stats.total += row.cnt
  }
  return stats
}

function deserializeMessage(row) {
  let classification = { label: 'other', confidence: 0, reason: '', extracted: {} }
  try { classification = JSON.parse(row.classification || '{}') } catch {}
  return {
    id:             row.id,
    sender:         row.sender,
    senderName:     row.sender_name,
    body:           row.body,
    direction:      row.direction,
    typeMessage:    row.type_message,
    timestamp:      row.timestamp,
    isGroup:        !!row.is_group,
    gptUpgraded:    !!row.gpt_upgraded,
    classification,
  }
}

// ════════════════════════════════════════════════════════════════════════════
// PIPELINE
// ════════════════════════════════════════════════════════════════════════════
const _insertDeal = db.prepare(`
  INSERT OR REPLACE INTO pipeline(id, match_id, buyer_name, seller_name, property_desc, status, notes, created_at, updated_at)
  VALUES(@id, @match_id, @buyer_name, @seller_name, @property_desc, @status, @notes, @created_at, strftime('%Y-%m-%dT%H:%M:%SZ','now'))
`)
const _insertHistory = db.prepare(`
  INSERT INTO pipeline_history(deal_id, status, note) VALUES(@deal_id, @status, @note)
`)
const _updateDeal = db.prepare(`
  UPDATE pipeline SET status = @status, notes = @notes, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
  WHERE id = @id
`)
const _getDeal = db.prepare(`SELECT * FROM pipeline WHERE id = @id`)
const _getAllPipeline = db.prepare(`SELECT * FROM pipeline ORDER BY updated_at DESC LIMIT 500`)
const _getDealHistory = db.prepare(`SELECT * FROM pipeline_history WHERE deal_id = @id ORDER BY created_at ASC`)

export function savePipelineDeal(deal) {
  _insertDeal.run({
    id:            deal.id,
    match_id:      deal.matchId,
    buyer_name:    deal.buyerName,
    seller_name:   deal.sellerName,
    property_desc: deal.propertyDesc,
    status:        deal.status,
    notes:         deal.notes,
    created_at:    deal.createdAt || new Date().toISOString(),
  })
  if (deal.history && deal.history.length > 0) {
    const tx = db.transaction(() => {
      deal.history.forEach(h => _insertHistory.run({ deal_id: deal.id, status: h.status, note: h.note || '' }))
    })
    tx()
  }
}

export function updatePipelineDeal(id, status, notes) {
  _updateDeal.run({ id, status, notes })
  _insertHistory.run({ deal_id: id, status, note: notes || '' })
}

export function getPipelineDeal(id) {
  const row = _getDeal.get({ id })
  if (!row) return null
  const history = _getDealHistory.all({ id })
  return { ...row, matchId: row.match_id, buyerName: row.buyer_name, sellerName: row.seller_name, propertyDesc: row.property_desc, history }
}

export function getAllPipeline() {
  return _getAllPipeline.all().map(row => {
    const history = _getDealHistory.all({ id: row.id })
    return { ...row, matchId: row.match_id, buyerName: row.buyer_name, sellerName: row.seller_name, propertyDesc: row.property_desc, history }
  })
}

// ════════════════════════════════════════════════════════════════════════════
// BROKERS
// ════════════════════════════════════════════════════════════════════════════
const _upsertBroker = db.prepare(`
  INSERT INTO brokers(phone, name, supply, demand, match_cnt, inquiry, other, total, last_seen)
  VALUES(@phone, @name, @supply, @demand, @match_cnt, @inquiry, @other, @total, @last_seen)
  ON CONFLICT(phone) DO UPDATE SET
    name      = @name,
    supply    = brokers.supply    + @supply,
    demand    = brokers.demand    + @demand,
    match_cnt = brokers.match_cnt + @match_cnt,
    inquiry   = brokers.inquiry   + @inquiry,
    other     = brokers.other     + @other,
    total     = brokers.total     + @total,
    last_seen = @last_seen
`)
const _getAllBrokers = db.prepare(`SELECT * FROM brokers ORDER BY total DESC LIMIT 100`)

export function upsertBroker(phone, name, labelCounts, lastSeen) {
  _upsertBroker.run({
    phone,
    name: name || phone,
    supply:    labelCounts.supply   || 0,
    demand:    labelCounts.demand   || 0,
    match_cnt: labelCounts.match    || 0,
    inquiry:   labelCounts.inquiry  || 0,
    other:     labelCounts.other    || 0,
    total:     labelCounts.total    || 1,
    last_seen: lastSeen || new Date().toISOString(),
  })
}

export function getAllBrokers() {
  return _getAllBrokers.all().map(row => ({
    phone:    row.phone,
    name:     row.name,
    supply:   row.supply,
    demand:   row.demand,
    match:    row.match_cnt,
    inquiry:  row.inquiry,
    other:    row.other,
    total:    row.total,
    lastSeen: row.last_seen,
  }))
}

// ════════════════════════════════════════════════════════════════════════════
// MATCH FEEDBACK
// ════════════════════════════════════════════════════════════════════════════
const _insertFeedback = db.prepare(`
  INSERT INTO match_feedback(id, match_id, rating, comment) VALUES(@id, @match_id, @rating, @comment)
`)
const _getAllFeedback = db.prepare(`SELECT * FROM match_feedback ORDER BY created_at DESC LIMIT 200`)

export function saveFeedback(fb) {
  _insertFeedback.run({ id: fb.id, match_id: fb.matchId, rating: fb.rating, comment: fb.comment || '' })
}

export function getAllFeedback() {
  return _getAllFeedback.all().map(row => ({
    id: row.id, matchId: row.match_id, rating: row.rating,
    comment: row.comment, createdAt: row.created_at,
  }))
}

// ════════════════════════════════════════════════════════════════════════════
// LOCATION STATS  (real supply/demand per city from actual WA messages)
// ════════════════════════════════════════════════════════════════════════════

// Location name normalization map — maps extracted location → canonical city
const LOCATION_CANONICAL = {
  'مدينتي':          'Madinaty',
  'madinaty':        'Madinaty',
  'b10':             'Madinaty',
  'b12':             'Madinaty',
  'b1':              'Madinaty',
  'b2':              'Madinaty',
  'الرحاب':          'Rehab City',
  'rehab':           'Rehab City',
  'القاهرة الجديدة': 'New Cairo',
  'new cairo':       'New Cairo',
  'التجمع الخامس':   '5th Settlement',
  'fifth settlement': '5th Settlement',
  '5th settlement':  '5th Settlement',
  'الشيخ زايد':      'Sheikh Zayed',
  'sheikh zayed':    'Sheikh Zayed',
  'السادس من أكتوبر': '6th October',
  '6th october':     '6th October',
  'october':         '6th October',
  'مدينة المستقبل':  'Mostakbal City',
  'mostakbal':       'Mostakbal City',
  'مصر الجديدة':     'Heliopolis',
  'heliopolis':      'Heliopolis',
  'مدينة نصر':       'Nasr City',
  'nasr city':       'Nasr City',
  'nasr':            'Nasr City',
  'مدينة العبور':    'Obour City',
  'obour':           'Obour City',
  'الزمالك':         'Zamalek',
  'zamalek':         'Zamalek',
  'التجمع':          'El Tagamoa',
  'tagamoa':         'El Tagamoa',
  'el tagamoa':      'El Tagamoa',
}

function canonicalizeLocation(raw) {
  if (!raw) return null
  const lower = raw.toLowerCase().trim()
  // direct match
  if (LOCATION_CANONICAL[lower]) return LOCATION_CANONICAL[lower]
  // partial match
  for (const [key, city] of Object.entries(LOCATION_CANONICAL)) {
    if (lower.includes(key) || key.includes(lower)) return city
  }
  return null
}

const _incrLocationSupply = db.prepare(`
  INSERT INTO location_stats(location, supply, demand, avg_budget, updated_at)
  VALUES(@location, 1, 0, @price, strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  ON CONFLICT(location) DO UPDATE SET
    supply     = location_stats.supply + 1,
    avg_budget = CASE WHEN @price > 0
                   THEN (location_stats.avg_budget * location_stats.supply + @price) / (location_stats.supply + 1)
                   ELSE location_stats.avg_budget END,
    updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
`)
const _incrLocationDemand = db.prepare(`
  INSERT INTO location_stats(location, supply, demand, avg_budget, updated_at)
  VALUES(@location, 0, 1, 0, strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  ON CONFLICT(location) DO UPDATE SET
    demand     = location_stats.demand + 1,
    updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
`)
const _getAllLocationStats = db.prepare(`SELECT * FROM location_stats ORDER BY (supply+demand) DESC`)
const _getLocationStat = db.prepare(`SELECT * FROM location_stats WHERE location = @location`)

export function updateLocationStats(classification) {
  const { label, extracted = {} } = classification
  const rawLoc = extracted.location
  const location = canonicalizeLocation(rawLoc)
  if (!location) return

  const price = typeof extracted.price === 'number'
    ? extracted.price
    : parseFloat(String(extracted.price || '0').replace(/[^0-9.]/g, '')) || 0

  if (label === 'supply') {
    _incrLocationSupply.run({ location, price })
  } else if (label === 'demand' || label === 'DEMAND' || label === 'BROKER_DEMAND') {
    _incrLocationDemand.run({ location })
  }
}

export function getAllLocationStats() {
  return _getAllLocationStats.all()
}

export function getLocationStat(location) {
  return _getLocationStat.get({ location })
}

// ════════════════════════════════════════════════════════════════════════════
// SCRAPER CACHE
// ════════════════════════════════════════════════════════════════════════════
const _getCache = db.prepare(`SELECT * FROM scraper_cache WHERE hash = @hash AND expires_at > strftime('%Y-%m-%dT%H:%M:%SZ','now')`)
const _setCache = db.prepare(`
  INSERT INTO scraper_cache(hash, query_json, result_json, hits, expires_at)
  VALUES(@hash, @query_json, @result_json, 1, @expires_at)
  ON CONFLICT(hash) DO UPDATE SET result_json = @result_json, hits = hits + 1, expires_at = @expires_at
`)
const _clearExpiredCache = db.prepare(`DELETE FROM scraper_cache WHERE expires_at < strftime('%Y-%m-%dT%H:%M:%SZ','now')`)

export function getScraperCache(hash) {
  const row = _getCache.get({ hash })
  if (!row) return null
  try { return JSON.parse(row.result_json) } catch { return null }
}

export function setScraperCache(hash, queryJson, result, ttlMinutes = 30) {
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000).toISOString()
  _setCache.run({ hash, query_json: JSON.stringify(queryJson), result_json: JSON.stringify(result), expires_at: expiresAt })
}

export function clearExpiredCache() {
  _clearExpiredCache.run()
}

// ════════════════════════════════════════════════════════════════════════════
// MAINTENANCE — clear expired cache on startup
// ════════════════════════════════════════════════════════════════════════════
clearExpiredCache()

export default db
