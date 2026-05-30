"""
MatchPro™ Engine Configuration
Crystal Power Investments LLC
"""

# ── Green API (WhatsApp) ──────────────────────────────────────────
GREEN_API_INSTANCE = "7105409203"
GREEN_API_TOKEN    = "0e7ca429980f4331ae5fee4360c955a9db2d6fe3ca6545a4b3"
GREEN_API_BASE     = f"https://7105.api.greenapi.com/waInstance{GREEN_API_INSTANCE}"

# WhatsApp Group ID — MatchPro group
# Link: https://chat.whatsapp.com/IVVBqxj1bZF45bxwQ23Unw
MATCHPRO_GROUP_ID  = "120363409205401520@g.us"

# ── Email ─────────────────────────────────────────────────────────
REPORT_EMAIL       = "mmaisara@crystalpowerinvestment.com"
FROM_EMAIL         = "maisaramoamen@genspark.email"

# Inbox to monitor for buyer/seller requests
INBOX_EMAIL        = "mmaisara@crystalpowerinvestment.com"
INBOX_TYPE         = "outlook"   # gmail | outlook

# ── Matching thresholds ───────────────────────────────────────────
MIN_MATCH_SCORE    = 75     # % minimum to consider a match
GOOD_MATCH_SCORE   = 85     # % for "confirmed good match"

# Scoring weights (must sum to 100)
WEIGHT_LOCATION    = 35
WEIGHT_TYPE        = 25
WEIGHT_PRICE       = 25
WEIGHT_SPECS       = 15

# ── Timing ───────────────────────────────────────────────────────
TIMEZONE           = "Africa/Cairo"
MORNING_CYCLE      = "09:00"   # analyses 21:00 yesterday → 09:00 today
EVENING_CYCLE      = "21:00"   # analyses 09:00 today → 21:00 today

# Response wait window (hours)
RESPONSE_WINDOW_HOURS = 24

# ── Paths ────────────────────────────────────────────────────────
import os
BASE_DIR     = os.path.dirname(os.path.abspath(__file__))
DB_PATH      = os.path.join(BASE_DIR, "matchpro.db")
LOG_PATH     = os.path.join(BASE_DIR, "audit.log")
REPORTS_DIR  = os.path.join(BASE_DIR, "reports")
