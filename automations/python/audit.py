"""
MatchPro™ — PDPL Compliant Audit Logger
"""
import sqlite3, os
from datetime import datetime
from config import DB_PATH, LOG_PATH

def log_audit(cycle_id: str, event: str, detail: str = ""):
    """Write to both SQLite audit table and flat log file."""
    ts = datetime.utcnow().isoformat()
    # Flat log
    with open(LOG_PATH, "a") as f:
        f.write(f"{ts} | {cycle_id or '—'} | {event} | {detail}\n")
    # DB
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.execute(
            "INSERT INTO audit (cycle_id, event, detail, ts) VALUES (?,?,?,?)",
            (cycle_id, event, detail, ts)
        )
        conn.commit()
        conn.close()
    except Exception:
        pass  # DB might not be init'd yet
