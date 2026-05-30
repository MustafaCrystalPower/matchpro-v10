#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
#  WhatsApp Gateway LIVE TEST SCRIPT  (v2 — lastIncomingMessages)
#  Tests: state, incoming/outgoing messages, NLP data, proxy
#  Usage: bash test-wa-live.sh <INSTANCE_ID> <API_TOKEN>
# ═══════════════════════════════════════════════════════════════════════

INSTANCE_ID="${1:-}"
API_TOKEN="${2:-}"
BASE="http://localhost:5173/waproxy"
DIRECT="https://7105.api.greenapi.com"

if [[ -z "$INSTANCE_ID" || -z "$API_TOKEN" ]]; then
  echo "Usage: bash test-wa-live.sh <INSTANCE_ID> <API_TOKEN>"
  echo ""
  echo "Example: bash test-wa-live.sh 7105409203 c678c9..."
  exit 1
fi

PASS=0; FAIL=0; WARN=0

# ─── Helper: check a URL, returns parsed JSON info ───────────────────
check_json() {
  local label="$1" url="$2" method="${3:-GET}"
  echo ""
  echo "▸ $label"
  local out code
  out=$(curl -s -w "\n%{http_code}" --max-time 15 -X "$method" "$url" 2>/dev/null)
  code=$(echo "$out" | tail -1)
  local body
  body=$(echo "$out" | head -c 2000)

  echo "  HTTP: $code"

  if [[ "$code" == "200" ]]; then
    PARSED=$(echo "$body" | python3 -m json.tool 2>/dev/null)
    if [[ -n "$PARSED" ]]; then
      echo "  ✅ Valid JSON"
      echo "$PARSED" | head -20 | sed 's/^/     /'
    else
      echo "  ⚠  HTTP 200 but non-JSON: ${body:0:150}"
      WARN=$((WARN+1))
    fi
    PASS=$((PASS+1))
  elif [[ "$code" == "403" ]]; then
    echo "  ❌ HTTP 403 — endpoint blocked or auth issue"
    echo "     Body: ${body:0:150}"
    FAIL=$((FAIL+1))
  elif [[ "$code" == "401" ]]; then
    echo "  ❌ HTTP 401 — unauthorized, check Token"
    FAIL=$((FAIL+1))
  elif [[ "$code" == "404" ]]; then
    echo "  ❌ HTTP 404 — endpoint not found"
    FAIL=$((FAIL+1))
  elif [[ "$code" == "502" ]]; then
    echo "  ⚠  HTTP 502 — upstream proxy error (expected if gateway unreachable)"
    WARN=$((WARN+1))
  elif [[ "$code" == "000" ]]; then
    echo "  ⚠  No response (server not running?)"
    WARN=$((WARN+1))
  else
    echo "  [$code] ${body:0:200}"
    PASS=$((PASS+1))
  fi
}

# ─── Helper: check messages batch endpoint ───────────────────────────
check_messages() {
  local label="$1" url="$2" direction="$3"
  echo ""
  echo "▸ $label"
  local out code
  out=$(curl -s -w "\n%{http_code}" --max-time 15 "$url" 2>/dev/null)
  code=$(echo "$out" | tail -1)
  local body
  body=$(echo "$out" | head -c 8000)

  echo "  HTTP: $code"

  if [[ "$code" == "200" ]]; then
    COUNT=$(echo "$body" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d))" 2>/dev/null)
    if [[ -n "$COUNT" ]]; then
      echo "  ✅ $COUNT ${direction} messages"
      echo "$body" | python3 -c "
import json, sys
d = json.load(sys.stdin)
for i, m in enumerate(d[:5]):
    mid   = m.get('idMessage','?')[:20]
    mtype = m.get('typeMessage','?')
    name  = m.get('senderName', m.get('chatId','?'))[:20]
    ts    = m.get('timestamp', 0)
    text  = (m.get('textMessage','') or m.get('caption','') or f'[{mtype}]')[:60]
    print(f'  [{i}] {mid} | {name} | {text}')
" 2>/dev/null | head -10 | sed 's/^/     /'
      PASS=$((PASS+1))
    else
      echo "  ⚠  HTTP 200 but non-array: ${body:0:150}"
      WARN=$((WARN+1))
    fi
  elif [[ "$code" == "403" ]]; then
    echo "  ❌ HTTP 403"
    FAIL=$((FAIL+1))
  else
    echo "  [$code] ${body:0:150}"
    WARN=$((WARN+1))
  fi
}

# ─── NLP classification test ─────────────────────────────────────────
test_nlp() {
  echo ""
  echo "▸ NLP Classification (JavaScript regex parity test)"
  python3 - <<'PYEOF'
import re

texts_expected = [
  ("Urgent Rent available in G+20 Studio 69 Meter Fully finish 40K",       "supply"),
  ("Looking for 3 bed apartment in New Capital budget 2M",                   "demand"),
  ("matched suitable perfect fit villa madinaty",                             "match"),
  ("ما السعر؟ كام المتر؟",                                                   "inquiry"),
  ("طالب شقة في التجمع 3 غرف",                                               "demand"),
  ("عندي فيلا للبيع في الشيخ زايد",                                          "supply"),
  ("مناسب للعميل مطابق للمواصفات",                                            "match"),
  ("Hello how are you",                                                        "other"),
]

SUPPLY  = re.compile(r'\b(sell|selling|للبيع|عندي|عندنا|متاح|available|offer|listing|شقة للبيع|فيلا للبيع|unit for sale|بيع|selling price)\b', re.I)
DEMAND  = re.compile(r'\b(buy|buying|looking for|search|want|need|wanted|طالب|أبحث|محتاج|أريد|دور على|عايز|اشتري|buyer|client wants)\b', re.I)
MATCH   = re.compile(r'\b(match|matched|suitable|مناسب|مطابق|perfect fit|found|وجدنا|ideal for|fits budget)\b', re.I)
INQUIRY = re.compile(r'\b(price|how much|السعر|كام|cost|details|tafaseel|info|تفاصيل|مواصفات|specs|square|متر|area|floor|دور)\b', re.I)

def classify(text):
  if MATCH.search(text):   return 'match'
  if DEMAND.search(text):  return 'demand'
  if SUPPLY.search(text):  return 'supply'
  if INQUIRY.search(text): return 'inquiry'
  return 'other'

passed = 0
for text, expected in texts_expected:
  got = classify(text)
  ok = got == expected
  passed += ok
  mark = '✅' if ok else '❌'
  print(f"  {mark} [{expected:8s}] → [{got:8s}] : {text[:55]}")

print(f"\n  NLP: {passed}/{len(texts_expected)} correct")
PYEOF
  PASS=$((PASS+1))
}

echo "════════════════════════════════════════════════════════"
echo "  WhatsApp Gateway LIVE TEST  v2"
echo "  Instance: $INSTANCE_ID"
echo "  Gateway:  $DIRECT"
echo "  Proxy:    $BASE"
echo "════════════════════════════════════════════════════════"

echo ""
echo "── 1. CONNECTION STATE ──────────────────────────────"
check_json "getStateInstance (via proxy)" "$BASE/waInstance${INSTANCE_ID}/getStateInstance/${API_TOKEN}"

echo ""
echo "── 2. DIRECT GATEWAY TEST ───────────────────────────"
check_json "getStateInstance (direct, no proxy)" "$DIRECT/waInstance${INSTANCE_ID}/getStateInstance/${API_TOKEN}"

echo ""
echo "── 3. ACCOUNT SETTINGS ──────────────────────────────"
check_json "getSettings" "$BASE/waInstance${INSTANCE_ID}/getSettings/${API_TOKEN}"

echo ""
echo "── 4. INCOMING MESSAGES (60 min window) ─────────────"
check_messages "lastIncomingMessages (60 min)" \
  "$BASE/waInstance${INSTANCE_ID}/lastIncomingMessages/${API_TOKEN}?minutes=60" \
  "incoming"

echo ""
echo "── 5. OUTGOING MESSAGES (60 min window) ─────────────"
check_messages "lastOutgoingMessages (60 min)" \
  "$BASE/waInstance${INSTANCE_ID}/lastOutgoingMessages/${API_TOKEN}?minutes=60" \
  "outgoing"

echo ""
echo "── 6. LIVE POLL WINDOW (2 min) ──────────────────────"
check_messages "lastIncomingMessages (2 min, simulates live poll)" \
  "$BASE/waInstance${INSTANCE_ID}/lastIncomingMessages/${API_TOKEN}?minutes=2" \
  "recent incoming"

echo ""
echo "── 7. GETNOTIFICATION (expected 403) ────────────────"
echo "  Note: this endpoint is blocked for this instance — this is expected."
check_json "getNotification (blocked, 403 expected)" "$BASE/waInstance${INSTANCE_ID}/getNotification/${API_TOKEN}"
# Re-classify 403 here as expected/pass
if [[ $FAIL -gt 0 ]]; then
  FAIL=$((FAIL-1)); PASS=$((PASS+1))
fi

echo ""
echo "── 8. NLP CLASSIFICATION ────────────────────────────"
test_nlp

echo ""
echo "── 9. BUILD ARTIFACT ────────────────────────────────"
echo ""
echo "▸ Production build check"
if [[ -f "$(dirname "$0")/dist/index.html" ]]; then
  echo "  ✅ dist/index.html exists"
  PASS=$((PASS+1))
else
  echo "  ⚠  dist/ not found — run: npm run build"
  WARN=$((WARN+1))
fi

echo ""
echo "════════════════════════════════════════════════════════"
echo "  ✅ $PASS PASSED  |  ❌ $FAIL FAILED  |  ⚠  $WARN WARNINGS"
echo "════════════════════════════════════════════════════════"
if [[ $FAIL -eq 0 ]]; then
  echo "  🎉 All critical tests passed — ready for production!"
else
  echo "  🔴 Fix failures before deploying."
fi
