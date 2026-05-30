"""
MatchPro™ — SQLite Database Layer
Handles: leads, matches, messages, responses, audit log
"""
import sqlite3, os
from config import DB_PATH

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_conn()
    c = conn.cursor()

    # ── Leads (buyers & sellers extracted from emails) ────────────
    c.execute("""
    CREATE TABLE IF NOT EXISTS leads (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        cycle_id    TEXT NOT NULL,
        role        TEXT NOT NULL CHECK(role IN ('buyer','seller')),
        name        TEXT,
        phone       TEXT,
        email       TEXT,
        prop_type   TEXT,
        location_ar TEXT,
        location_en TEXT,
        area_sqm    REAL,
        price       REAL,
        budget_min  REAL,
        budget_max  REAL,
        details     TEXT,
        source_email TEXT,
        created_at  TEXT DEFAULT (datetime('now'))
    )""")

    # ── Matches ───────────────────────────────────────────────────
    c.execute("""
    CREATE TABLE IF NOT EXISTS matches (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        match_id        TEXT UNIQUE NOT NULL,
        cycle_id        TEXT NOT NULL,
        seller_id       INTEGER REFERENCES leads(id),
        buyer_id        INTEGER REFERENCES leads(id),
        score           REAL,
        score_location  REAL,
        score_type      REAL,
        score_price     REAL,
        score_specs     REAL,
        seller_status   TEXT DEFAULT 'Pending',
        buyer_status    TEXT DEFAULT 'Pending',
        overall_status  TEXT DEFAULT 'Pending',
        seller_msg_sent TEXT,
        buyer_msg_sent  TEXT,
        seller_replied_at TEXT,
        buyer_replied_at  TEXT,
        created_at      TEXT DEFAULT (datetime('now')),
        updated_at      TEXT DEFAULT (datetime('now'))
    )""")

    # ── Messages log ──────────────────────────────────────────────
    c.execute("""
    CREATE TABLE IF NOT EXISTS messages (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        match_id    TEXT,
        recipient   TEXT,
        channel     TEXT CHECK(channel IN ('whatsapp','email')),
        direction   TEXT CHECK(direction IN ('out','in')),
        content     TEXT,
        status      TEXT,
        sent_at     TEXT DEFAULT (datetime('now'))
    )""")

    # ── Cycles ────────────────────────────────────────────────────
    c.execute("""
    CREATE TABLE IF NOT EXISTS cycles (
        id          TEXT PRIMARY KEY,
        label       TEXT,
        window_from TEXT,
        window_to   TEXT,
        emails_read INTEGER DEFAULT 0,
        matches_made INTEGER DEFAULT 0,
        status      TEXT DEFAULT 'running',
        started_at  TEXT DEFAULT (datetime('now')),
        finished_at TEXT
    )""")

    # ── Audit log ─────────────────────────────────────────────────
    c.execute("""
    CREATE TABLE IF NOT EXISTS audit (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        cycle_id  TEXT,
        event     TEXT,
        detail    TEXT,
        ts        TEXT DEFAULT (datetime('now'))
    )""")

    conn.commit()
    conn.close()
    print("✅ DB initialised at", DB_PATH)

if __name__ == "__main__":
    init_db()
