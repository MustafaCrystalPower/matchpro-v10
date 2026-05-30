"""
MatchPro™ — Email Reader
Reads emails from genspark.email inbox within a time window.
Uses gsk email CLI.
"""
import subprocess, json, re
from datetime import datetime
from audit import log_audit

def read_emails_in_window(window_from: datetime, window_to: datetime,
                           cycle_id: str) -> list:
    """
    Fetch emails received between window_from and window_to.
    Returns list of email dicts: {id, from_email, from_name, subject, body, received_at}
    """
    emails = []
    try:
        # Get recent emails via gsk
        result = subprocess.run(
            ["gsk", "email", "list", "--limit", "50", "--format", "json"],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode != 0:
            log_audit(cycle_id, "EMAIL_READ_ERROR", result.stderr[:200])
            return []

        raw = result.stdout.strip()
        if not raw:
            return []

        data = json.loads(raw)
        items = data if isinstance(data, list) else data.get("emails", [])

        for item in items:
            received_str = item.get("date") or item.get("received_at") or ""
            try:
                received = _parse_email_date(received_str)
            except:
                continue

            if window_from <= received <= window_to:
                emails.append({
                    "id":         item.get("id") or item.get("message_id", ""),
                    "from_email": item.get("from") or item.get("from_email", ""),
                    "from_name":  item.get("from_name", ""),
                    "subject":    item.get("subject", ""),
                    "body":       item.get("body") or item.get("snippet", ""),
                    "received_at": received_str,
                })

        log_audit(cycle_id, "EMAILS_READ", f"count={len(emails)} window={window_from}→{window_to}")

    except json.JSONDecodeError:
        # Try to parse non-JSON output
        log_audit(cycle_id, "EMAIL_PARSE_ERROR", "Non-JSON response from gsk")
    except Exception as e:
        log_audit(cycle_id, "EMAIL_READ_EXCEPTION", str(e))

    return emails

def read_email_by_id(email_id: str) -> dict:
    """Fetch a single email by ID for full body."""
    try:
        result = subprocess.run(
            ["gsk", "email", "read", email_id, "--format", "json"],
            capture_output=True, text=True, timeout=20
        )
        if result.returncode == 0:
            return json.loads(result.stdout)
    except Exception:
        pass
    return {}

def _parse_email_date(date_str: str) -> datetime:
    """Parse various date formats from email headers."""
    formats = [
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S.%f",
        "%a, %d %b %Y %H:%M:%S %z",
        "%d %b %Y %H:%M:%S %z",
    ]
    date_str = date_str.strip()
    for fmt in formats:
        try:
            dt = datetime.strptime(date_str[:25], fmt[:len(date_str)])
            return dt.replace(tzinfo=None)
        except:
            continue
    # Try generic parse
    from email.utils import parsedate_to_datetime
    try:
        return parsedate_to_datetime(date_str).replace(tzinfo=None)
    except:
        raise ValueError(f"Cannot parse date: {date_str}")
