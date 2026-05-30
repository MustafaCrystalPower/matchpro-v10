"""
MatchPro™ — Messenger
Sends WhatsApp messages (Green API) and emails (gsk).
Enforces privacy rules: no cross-disclosure.
"""
import requests, subprocess, json, os
from datetime import datetime
from config import (GREEN_API_BASE, GREEN_API_TOKEN, GREEN_API_INSTANCE,
                    MATCHPRO_GROUP_ID, FROM_EMAIL, REPORT_EMAIL)
from audit import log_audit

# ── WhatsApp (Green API) ──────────────────────────────────────────

def _wa_send(chat_id: str, message: str) -> bool:
    """Send a WhatsApp message via Green API."""
    url = f"{GREEN_API_BASE}/sendMessage/{GREEN_API_TOKEN}"
    payload = {"chatId": chat_id, "message": message}
    try:
        resp = requests.post(url, json=payload, timeout=15)
        resp.raise_for_status()
        return True
    except Exception as e:
        log_audit(None, "WA_SEND_FAILED", f"chat_id={chat_id} error={e}")
        return False

def send_seller_confirmation_request(match_id: str, seller: dict, prop: dict, cycle_id: str) -> bool:
    """Step 2 — Ask seller to confirm property details."""
    msg = f"""السلام عليكم {seller.get('name', 'أستاذ')},

عندنا مشتري مهتم بعقارك.

ممكن تأكدلنا التفاصيل دي:
- النوع: {prop.get('prop_type', '—')}
- الموقع: {prop.get('location_ar', '—')}
- المساحة: {prop.get('area_sqm', '—')} م²
- السعر: {_fmt_price(prop.get('price'))}

كل التفاصيل صح؟

MatchPro™ - Crystal Power Investments"""

    phone = seller.get("phone")
    if not phone:
        log_audit(cycle_id, "SELLER_NO_PHONE", f"match={match_id}")
        return False

    chat_id = _normalize_chat_id(phone)
    success = _wa_send(chat_id, msg)
    log_audit(cycle_id, "SELLER_MSG_SENT" if success else "SELLER_MSG_FAILED",
              f"match={match_id} phone={phone}")
    return success

def send_buyer_interest_message(match_id: str, buyer: dict, prop: dict, cycle_id: str) -> bool:
    """Step 3 — Notify buyer of a matching property (no seller info)."""
    msg = f"""السلام عليكم {buyer.get('name', 'أستاذ')},

لقينالك عقار بيناسب طلبك في {prop.get('location_ar', '—')}.
النوع: {prop.get('prop_type', '—')} - {prop.get('area_sqm', '—')} م² - السعر في نطاق ميزانيتك.

تحب حضرتك أبعتلك التفاصيل؟

MatchPro™ - Crystal Power Investments"""

    phone = buyer.get("phone")
    if not phone:
        log_audit(cycle_id, "BUYER_NO_PHONE", f"match={match_id}")
        return False

    chat_id = _normalize_chat_id(phone)
    success = _wa_send(chat_id, msg)
    log_audit(cycle_id, "BUYER_MSG_SENT" if success else "BUYER_MSG_FAILED",
              f"match={match_id} phone={phone}")
    return success

def send_buyer_property_details(match_id: str, buyer: dict, prop: dict, cycle_id: str) -> bool:
    """Step 4 — Send full property details to confirmed buyer (NO seller info)."""
    msg = f"""تفاصيل العقار:
- النوع: {prop.get('prop_type', '—')}
- الموقع: {prop.get('location_ar', '—')}
- المساحة: {prop.get('area_sqm', '—')} م²
- السعر: {_fmt_price(prop.get('price'))} EGP
{prop.get('details', '')}

عجبك؟ قولنا ونرتب الخطوة الجاية.

MatchPro™ - Crystal Power Investments"""

    phone = buyer.get("phone")
    if not phone:
        return False

    chat_id = _normalize_chat_id(phone)
    success = _wa_send(chat_id, msg)
    log_audit(cycle_id, "BUYER_DETAILS_SENT" if success else "BUYER_DETAILS_FAILED",
              f"match={match_id}")
    return success

def send_group_summary(summary: dict, date_str: str, cycle_label: str) -> bool:
    """Step 8B — Send summary to MatchPro WhatsApp group."""
    if MATCHPRO_GROUP_ID == "PENDING":
        log_audit(None, "GROUP_NOT_CONFIGURED", "WhatsApp group ID not set")
        return False

    msg = f"""📊 MatchPro™ | {date_str} - {cycle_label}

✅ ماتشات مؤكدة: {summary.get('confirmed', 0)}
⚠️ محتاجة متابعة: {summary.get('needs_followup', 0)}
❌ مش مناسبة: {summary.get('not_suitable', 0)}
📨 إيميلات اتحللت: {summary.get('emails_read', 0)}
📈 متوسط الـ Score: {summary.get('avg_score', 0):.0f}%

الريبورت الكامل اتبعت على الإيميل.

MatchPro™ - Crystal Power Investments"""

    success = _wa_send(MATCHPRO_GROUP_ID, msg)
    log_audit(None, "GROUP_SUMMARY_SENT" if success else "GROUP_SUMMARY_FAILED", cycle_label)
    return success

# ── Email (gsk) ───────────────────────────────────────────────────

def send_report_email(report_path: str, summary: dict, date_str: str,
                      cycle_label: str, wa_failed: bool = False) -> bool:
    """Step 8A — Email the full report to Mo'men."""
    subject = f"MatchPro™ | تقرير التأكيدات | {date_str} - {cycle_label}"

    wa_note = "\n⚠️ تعذّر الإرسال على واتساب" if wa_failed else ""

    body = f"""# MatchPro™ | تقرير التأكيدات
**التاريخ:** {date_str} — {cycle_label}{wa_note}

---

## الملخص التنفيذي

| البيان | العدد |
|--------|-------|
| 📨 إيميلات اتحللت | {summary.get('emails_read', 0)} |
| 🔗 ماتشات اتعملت | {summary.get('total_matches', 0)} |
| ✅ ماتشات مؤكدة | {summary.get('confirmed', 0)} |
| ⚠️ محتاجة متابعة | {summary.get('needs_followup', 0)} |
| ❌ مش مناسبة | {summary.get('not_suitable', 0)} |
| 📈 متوسط الـ Score | {summary.get('avg_score', 0):.0f}% |

---

الريبورت الكامل في الـ attachment.

MatchPro™ - Crystal Power Investments
"""

    try:
        cmd = [
            "gsk", "email", "send", body,
            "--to", REPORT_EMAIL,
            "--subject", subject,
        ]
        if report_path and os.path.exists(report_path):
            cmd += ["--attachment", report_path]

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        success = result.returncode == 0
        log_audit(None, "REPORT_EMAIL_SENT" if success else "REPORT_EMAIL_FAILED",
                  f"path={report_path}")
        return success
    except Exception as e:
        log_audit(None, "REPORT_EMAIL_ERROR", str(e))
        return False

def send_error_alert(cycle_id: str, error_msg: str) -> None:
    """Send error notification to Mo'men via email + WhatsApp group."""
    subject = f"⚠️ MatchPro™ Cycle Error | {cycle_id}"
    body = f"حدث خطأ في الـ cycle:\n\n{error_msg}"

    subprocess.run(
        ["gsk", "email", "send", body, "--to", REPORT_EMAIL, "--subject", subject],
        capture_output=True, timeout=20
    )

    if MATCHPRO_GROUP_ID != "PENDING":
        _wa_send(MATCHPRO_GROUP_ID, f"⚠️ MatchPro™ Cycle Error\n{cycle_id}\n{error_msg[:200]}")

# ── Helpers ───────────────────────────────────────────────────────

def _normalize_chat_id(phone: str) -> str:
    """Convert phone number to Green API chatId format."""
    phone = re.sub(r'[^\d+]', '', phone)
    if phone.startswith('+'):
        phone = phone[1:]
    if phone.startswith('0020'):
        phone = '20' + phone[4:]
    elif phone.startswith('00'):
        phone = phone[2:]
    elif phone.startswith('0') and len(phone) == 11:
        phone = '20' + phone[1:]
    return f"{phone}@c.us"

def _fmt_price(price) -> str:
    if not price:
        return "—"
    try:
        return f"{int(float(price)):,}"
    except:
        return str(price)

import re
