"""
MatchPro™ — WhatsApp Group Message Reader
Reads messages from cpi-webhook-gateway DB within a time window.
Extracts real estate leads from group messages.
"""
import sqlite3, os
from datetime import datetime
from audit import log_audit

GATEWAY_DB = "/home/work/.openclaw/workspace/matchpro-v2/data/matchpro.db"

# WhatsApp groups to monitor for leads
MONITORED_GROUPS = [
    "120363409205401520@g.us",   # MatchPro group
    "120363380080596361@g.us",   # Best brokers in Egypt
    "120363403042751205@g.us",   # Crystal Brokers
    "120363378704512094@g.us",   # Gama real estate
    "120363159243314702@g.us",   # Tycoon Estate Madinaty
    "120363404540214715@g.us",   # Crystal Homes تمليك
    "120363384097444115@g.us",   # عقارات مدينتي ونور
    "120363317084441105@g.us",   # Privado deals
]

def read_group_messages_in_window(window_from: datetime, window_to: datetime,
                                   cycle_id: str) -> list:
    """
    Read WhatsApp group messages within the time window.
    Returns list of message dicts ready for NLP extraction.
    """
    if not os.path.exists(GATEWAY_DB):
        log_audit(cycle_id, "WA_DB_NOT_FOUND", GATEWAY_DB)
        return []

    msgs = []
    try:
        conn = sqlite3.connect(GATEWAY_DB)
        conn.row_factory = sqlite3.Row

        wf_str = window_from.strftime("%Y-%m-%d %H:%M:%S")
        wt_str = window_to.strftime("%Y-%m-%d %H:%M:%S")

        query = """
            SELECT id, group_id as chat_id, group_name as chat_name,
                   sender_name, sender_phone as phone, body as message,
                   'inbound' as direction, created_at
            FROM messages
            WHERE group_id IS NOT NULL AND group_id != ''
              AND created_at >= ? AND created_at <= ?
              AND body != '' AND length(body) > 10
            ORDER BY created_at ASC
        """

        rows = conn.execute(query, [wf_str, wt_str]).fetchall()
        conn.close()

        for row in rows:
            msgs.append({
                "id":          f"wa-{row['id']}",
                "from_email":  None,
                "from_name":   row["sender_name"] or "",
                "from_phone":  row["phone"] or "",
                "subject":     f"WhatsApp | {row['chat_name']}",
                "body":        row["message"],
                "received_at": row["created_at"],
                "source":      "whatsapp",
                "group_name":  row["chat_name"],
                "chat_id":     row["chat_id"],
            })

        log_audit(cycle_id, "WA_MSGS_READ",
                  f"count={len(msgs)} window={wf_str}→{wt_str}")

    except Exception as e:
        log_audit(cycle_id, "WA_READ_ERROR", str(e))

    return msgs


def get_all_group_stats() -> list:
    """Return stats for all monitored groups."""
    if not os.path.exists(GATEWAY_DB):
        return []
    try:
        conn = sqlite3.connect(GATEWAY_DB)
        conn.row_factory = sqlite3.Row
        rows = conn.execute("""
            SELECT group_id as chat_id, group_name as chat_name, COUNT(*) as total,
                   COUNT(*) as inbound,
                   MAX(created_at) as last_msg
            FROM messages
            WHERE group_id IS NOT NULL AND group_id != ''
            GROUP BY group_id
            ORDER BY total DESC
        """).fetchall()
        conn.close()
        return [dict(r) for r in rows]
    except Exception as e:
        return []
