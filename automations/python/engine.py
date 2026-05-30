"""
MatchPro™ — Main Engine
Orchestrates the full cycle: read → extract → match → message → report
"""
import os, sqlite3, uuid, json
from datetime import datetime, timedelta
import pytz

from config import (TIMEZONE, MORNING_CYCLE, EVENING_CYCLE, DB_PATH,
                    MIN_MATCH_SCORE, MATCHPRO_GROUP_ID)
from db import get_conn, init_db
from outlook_reader import read_emails_in_window
from whatsapp_reader import read_group_messages_in_window, get_all_group_stats
from nlp_extractor import extract_leads_from_emails
from matcher import run_matching, classify_match
from messenger import (send_seller_confirmation_request, send_buyer_interest_message,
                        send_buyer_property_details, send_group_summary,
                        send_report_email, send_error_alert)
from reporter import generate_report
from audit import log_audit


def get_cycle_window(cycle_type: str) -> tuple:
    """
    Returns (window_from, window_to, cycle_label) in UTC.
    cycle_type: 'morning' | 'evening'
    """
    cairo_tz = pytz.timezone(TIMEZONE)
    now_cairo = datetime.now(cairo_tz)
    today = now_cairo.date()

    if cycle_type == "morning":
        # 9PM yesterday → 9AM today
        window_to   = cairo_tz.localize(datetime.combine(today, datetime.strptime("09:00", "%H:%M").time()))
        window_from = window_to - timedelta(hours=12)
        label = "9AM"
    else:
        # 9AM today → 9PM today
        window_from = cairo_tz.localize(datetime.combine(today, datetime.strptime("09:00", "%H:%M").time()))
        window_to   = cairo_tz.localize(datetime.combine(today, datetime.strptime("21:00", "%H:%M").time()))
        label = "9PM"

    # Convert to UTC for DB/email comparison
    return (
        window_from.astimezone(pytz.utc).replace(tzinfo=None),
        window_to.astimezone(pytz.utc).replace(tzinfo=None),
        label
    )


def run_cycle(cycle_type: str = "morning"):
    """
    Full MatchPro cycle.
    cycle_type: 'morning' | 'evening'
    """
    # ── Init ──────────────────────────────────────────────────────
    init_db()
    cycle_id  = f"CYCLE-{datetime.utcnow().strftime('%Y%m%d-%H%M')}-{cycle_type.upper()}"
    wf, wt, label = get_cycle_window(cycle_type)
    date_str  = datetime.utcnow().strftime("%Y-%m-%d")

    print(f"\n{'='*60}")
    print(f"🚀 MatchPro™ Cycle: {cycle_id}")
    print(f"📅 Window: {wf} → {wt} (UTC)")
    print(f"{'='*60}\n")

    log_audit(cycle_id, "CYCLE_START", f"type={cycle_type} window={wf}→{wt}")

    conn = get_conn()
    try:
        # Register cycle
        conn.execute("""
            INSERT INTO cycles (id, label, window_from, window_to)
            VALUES (?,?,?,?)
        """, (cycle_id, label, wf.isoformat(), wt.isoformat()))
        conn.commit()

        # ── Step 1: Read & Extract (Email + WhatsApp) ─────────────
        print("📨 Step 1: Reading emails + WhatsApp messages...")
        emails = read_emails_in_window(wf, wt, cycle_id)
        print(f"   Found {len(emails)} emails in window")

        # Read WhatsApp group messages
        wa_msgs = read_group_messages_in_window(wf, wt, cycle_id)
        print(f"   Found {len(wa_msgs)} WhatsApp group messages in window")

        # Combine both sources
        all_messages = emails + wa_msgs
        print(f"   Total messages to process: {len(all_messages)}")

        leads = extract_leads_from_emails(all_messages)
        print(f"   Extracted {len(leads)} valid leads")

        if not leads:
            print("   No leads found — cycle complete (no matches to make)")
            _finalize_cycle(conn, cycle_id, 0, 0, [])
            return

        # Save leads to DB
        sellers, buyers = [], []
        for lead in leads:
            c = conn.execute("""
                INSERT INTO leads
                (cycle_id, role, name, phone, email, prop_type,
                 location_ar, location_en, area_sqm, price,
                 budget_min, budget_max, details, source_email)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """, (
                cycle_id, lead["role"], lead["name"], lead["phone"],
                lead["email"], lead["prop_type"], lead["location_ar"],
                lead["location_en"], lead["area_sqm"], lead["price"],
                lead["budget_min"], lead["budget_max"],
                lead["details"], lead["source_email"]
            ))
            lead["id"] = c.lastrowid
            if lead["role"] == "seller":
                sellers.append(lead)
            else:
                buyers.append(lead)
        conn.commit()

        print(f"   Sellers: {len(sellers)} | Buyers: {len(buyers)}")

        if not sellers or not buyers:
            print("   Need both sellers and buyers to match — cycle complete")
            _finalize_cycle(conn, cycle_id, len(emails), 0, [])
            return

        # ── Step 2: Match ─────────────────────────────────────────
        print("\n🔗 Step 2: Running matching algorithm...")
        raw_matches = run_matching(sellers, buyers)
        print(f"   Found {len(raw_matches)} matches with score ≥ {MIN_MATCH_SCORE}%")

        # Save matches & send Step 2/3 messages
        match_records = []
        for i, m in enumerate(raw_matches):
            match_id = f"MP-{date_str.replace('-','')}-{i+1:03d}"

            conn.execute("""
                INSERT OR IGNORE INTO matches
                (match_id, cycle_id, seller_id, buyer_id, score,
                 score_location, score_type, score_price, score_specs)
                VALUES (?,?,?,?,?,?,?,?,?)
            """, (
                match_id, cycle_id,
                m["seller"]["id"], m["buyer"]["id"],
                m["score"], m["score_location"],
                m["score_type"], m["score_price"], m["score_specs"]
            ))
            conn.commit()

            print(f"   Match {match_id}: Score={m['score']}% | "
                  f"{m['seller'].get('location_ar','?')} | {m['seller'].get('prop_type','?')}")

            # Step 2: Message seller
            seller_ok = send_seller_confirmation_request(
                match_id, m["seller"], m["seller"], cycle_id
            )
            conn.execute(
                "UPDATE matches SET seller_msg_sent=? WHERE match_id=?",
                (datetime.utcnow().isoformat(), match_id)
            )

            # Step 3: Message buyer
            buyer_ok = send_buyer_interest_message(
                match_id, m["buyer"], m["seller"], cycle_id
            )
            conn.execute(
                "UPDATE matches SET buyer_msg_sent=? WHERE match_id=?",
                (datetime.utcnow().isoformat(), match_id)
            )
            conn.commit()

            match_records.append({
                "match_id":      match_id,
                "score":         m["score"],
                "location_ar":   m["seller"].get("location_ar", ""),
                "prop_type":     m["seller"].get("prop_type", ""),
                "price":         m["seller"].get("price"),
                "seller_name":   m["seller"].get("name", ""),
                "buyer_name":    m["buyer"].get("name", ""),
                "seller_status": "Pending",
                "buyer_status":  "Pending",
                "overall_status": "⚠️ Needs Follow-up",
            })

        # ── Step 7: Build summary ─────────────────────────────────
        print("\n📊 Step 7: Generating report...")
        summary = _build_summary(len(emails), match_records)

        # Generate Excel
        report_path = generate_report(cycle_id, match_records, summary, date_str, label)

        # ── Step 8: Send report ───────────────────────────────────
        print("\n📤 Step 8: Sending report...")
        wa_ok = send_group_summary(summary, date_str, label)
        send_report_email(report_path, summary, date_str, label, wa_failed=not wa_ok)

        _finalize_cycle(conn, cycle_id, len(emails), len(match_records), match_records)

        print(f"\n✅ Cycle {cycle_id} complete!")
        print(f"   Matches: {len(match_records)} | Report: {report_path}")

    except Exception as e:
        log_audit(cycle_id, "CYCLE_ERROR", str(e))
        print(f"❌ Cycle error: {e}")
        send_error_alert(cycle_id, str(e))
        raise
    finally:
        conn.close()


def process_response(match_id: str, responder: str, response_text: str):
    """
    Process an incoming response from seller or buyer.
    responder: 'seller' | 'buyer'
    response_text: the message they sent
    """
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT * FROM matches WHERE match_id=?", (match_id,)
        ).fetchone()
        if not row:
            print(f"Match {match_id} not found")
            return

        positive = _is_positive_response(response_text)
        ts = datetime.utcnow().isoformat()

        if responder == "seller":
            status = "Seller Confirmed" if positive else "Seller Declined"
            conn.execute(
                "UPDATE matches SET seller_status=?, seller_replied_at=?, updated_at=? WHERE match_id=?",
                (status, ts, ts, match_id)
            )
            log_audit(row["cycle_id"], f"SELLER_{status.upper().replace(' ','_')}", match_id)

        elif responder == "buyer":
            if positive:
                status = "Buyer Interested"
                conn.execute(
                    "UPDATE matches SET buyer_status=?, buyer_replied_at=?, updated_at=? WHERE match_id=?",
                    (status, ts, ts, match_id)
                )
                # Step 4: Send property details
                seller = dict(conn.execute(
                    "SELECT * FROM leads WHERE id=?", (row["seller_id"],)
                ).fetchone())
                buyer  = dict(conn.execute(
                    "SELECT * FROM leads WHERE id=?", (row["buyer_id"],)
                ).fetchone())
                send_buyer_property_details(match_id, buyer, seller, row["cycle_id"])
            else:
                status = "Buyer Declined"
                conn.execute(
                    "UPDATE matches SET buyer_status=?, updated_at=? WHERE match_id=?",
                    (status, ts, match_id)
                )
            log_audit(row["cycle_id"], f"BUYER_{status.upper().replace(' ','_')}", match_id)

        conn.commit()
        print(f"✅ Processed {responder} response for {match_id}: {status}")

    finally:
        conn.close()


def check_no_responses():
    """Mark leads as No Response if 24h have passed without reply."""
    conn = get_conn()
    cutoff = (datetime.utcnow() - timedelta(hours=24)).isoformat()

    conn.execute("""
        UPDATE matches SET seller_status='No Response', updated_at=datetime('now')
        WHERE seller_status='Pending'
        AND seller_msg_sent IS NOT NULL
        AND seller_msg_sent < ?
    """, (cutoff,))

    conn.execute("""
        UPDATE matches SET buyer_status='No Response', updated_at=datetime('now')
        WHERE buyer_status='Pending'
        AND buyer_msg_sent IS NOT NULL
        AND buyer_msg_sent < ?
    """, (cutoff,))

    conn.commit()
    conn.close()
    log_audit(None, "NO_RESPONSE_CHECK", f"cutoff={cutoff}")


# ── Helpers ───────────────────────────────────────────────────────

def _is_positive_response(text: str) -> bool:
    text = text.lower().strip()
    positive_words = [
        "أيوه", "آيوه", "ايوه", "نعم", "صح", "تمام", "موافق", "أكيد",
        "اكيد", "ابعت", "أبعت", "يلا", "ماشي", "اوك", "ok", "yes",
        "confirm", "agree", "send", "interested"
    ]
    return any(w in text for w in positive_words)

def _build_summary(emails_read: int, matches: list) -> dict:
    confirmed     = sum(1 for m in matches if "Full Confirmed" in m.get("overall_status", ""))
    needs_followup = sum(1 for m in matches if "Needs Follow-up" in m.get("overall_status", ""))
    not_suitable  = sum(1 for m in matches if "Not Suitable" in m.get("overall_status", ""))
    avg_score     = sum(m.get("score", 0) for m in matches) / max(len(matches), 1)

    return {
        "emails_read":    emails_read,
        "total_matches":  len(matches),
        "confirmed":      confirmed,
        "needs_followup": needs_followup,
        "not_suitable":   not_suitable,
        "avg_score":      avg_score,
    }

def _finalize_cycle(conn, cycle_id, emails_read, matches_made, matches):
    conn.execute("""
        UPDATE cycles SET status='done', emails_read=?, matches_made=?, finished_at=datetime('now')
        WHERE id=?
    """, (emails_read, matches_made, cycle_id))
    conn.commit()
    log_audit(cycle_id, "CYCLE_DONE", f"emails={emails_read} matches={matches_made}")


if __name__ == "__main__":
    import sys
    cycle_type = sys.argv[1] if len(sys.argv) > 1 else "morning"
    run_cycle(cycle_type)
