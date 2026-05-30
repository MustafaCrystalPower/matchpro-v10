#!/usr/bin/env python3
"""
MatchPro v10 - Comprehensive API Test Suite
Tests all endpoints on port 3001
"""
import json
import sys
import time
import urllib.request
import urllib.error

BASE = "http://localhost:3001"
PASS = 0
FAIL = 0
RESULTS = []

def clr(code, text): return f"\033[{code}m{text}\033[0m"
def green(t): return clr("92", t)
def red(t): return clr("91", t)
def yellow(t): return clr("93", t)
def cyan(t): return clr("96", t)
def bold(t): return clr("1", t)

def req(method, path, body=None, expect_status=200, timeout=10):
    global PASS, FAIL
    url = BASE + path
    data = json.dumps(body).encode() if body else None
    headers = {"Content-Type": "application/json"} if body else {}
    try:
        r = urllib.request.Request(url, data=data, headers=headers, method=method)
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            status = resp.status
            raw = resp.read()
            try: payload = json.loads(raw)
            except: payload = raw.decode()[:200]
            ok = status == expect_status
            if ok: PASS += 1
            else: FAIL += 1
            return ok, status, payload
    except urllib.error.HTTPError as e:
        raw = e.read()
        try: payload = json.loads(raw)
        except: payload = raw.decode()[:200]
        ok = e.code == expect_status
        if ok: PASS += 1
        else: FAIL += 1
        return ok, e.code, payload
    except Exception as ex:
        FAIL += 1
        return False, 0, str(ex)

def test(label, method, path, body=None, expect_status=200, checks=None, timeout=10):
    ok, status, payload = req(method, path, body, expect_status, timeout=timeout)
    extra_ok = True
    notes = []
    if checks and isinstance(payload, dict):
        for key, val in checks.items():
            if key not in payload:
                extra_ok = False
                notes.append(f"missing '{key}'")
            elif val is not None and payload[key] != val:
                extra_ok = False
                notes.append(f"'{key}'={payload[key]!r} (expected {val!r})")
    final = ok and extra_ok
    icon = green("✅ PASS") if final else red("❌ FAIL")
    note_str = "  " + yellow(", ".join(notes)) if notes else ""
    print(f"  {icon}  [{method}] {path:<45} → {status}{note_str}")
    if not final:
        preview = str(payload)[:120] if not isinstance(payload, str) else payload[:120]
        print(f"         {yellow('↳')} {preview}")
    RESULTS.append((label, final, status, payload))
    return final, payload

# ─── HEADER ───────────────────────────────────────────────────────────────────
print()
print(bold(cyan("╔═══════════════════════════════════════════════════════════════╗")))
print(bold(cyan("║          MatchPro v10 — Full API Test Suite                   ║")))
print(bold(cyan("╚═══════════════════════════════════════════════════════════════╝")))
print()

# ─── 1. HEALTH & SYSTEM ───────────────────────────────────────────────────────
print(bold("── 1. Health & System ──────────────────────────────────────────────"))
test("health",     "GET", "/api/health",  checks={"ok": True})
test("stats",      "GET", "/api/stats",   checks={"ok": None})
test("vapid-key",  "GET", "/api/push/vapid-public-key")
test("push-stats", "GET", "/api/push/stats")

# ─── 2. ASSETS ────────────────────────────────────────────────────────────────
print()
print(bold("── 2. Assets CRUD ──────────────────────────────────────────────────"))

# List assets
ok, assets_payload = test("list-assets", "GET", "/api/assets", checks={"assets": None})
asset_count = len(assets_payload.get("assets", [])) if isinstance(assets_payload, dict) else 0
print(f"         {cyan(f'↳ {asset_count} assets in DB')}")

# Add a supply asset
ok, add_payload = test("add-asset-supply", "POST", "/api/assets", body={
    "type": "apartment",
    "location": "Madinaty",
    "purpose": "sell",
    "price": 3500000,
    "bedrooms": 3,
    "area_sqm": 150,
    "finishing": "fully_finished",
    "furnished": False,
    "contact_phone": "+201001234567",
    "notes": "API Test Asset - Supply"
}, expect_status=201, checks={"id": None})
new_supply_id = add_payload.get("id") if isinstance(add_payload, dict) else None
print(f"         {cyan(f'↳ Created supply asset id={new_supply_id}')}")

# Add a demand asset (buyer)
ok, add_demand_payload = test("add-asset-demand", "POST", "/api/assets", body={
    "type": "apartment",
    "location": "Madinaty",
    "purpose": "buy",
    "price": 3800000,
    "bedrooms": 3,
    "area_sqm": 140,
    "finishing": "fully_finished",
    "furnished": False,
    "contact_phone": "+201009876543",
    "notes": "API Test Asset - Demand"
}, expect_status=201, checks={"id": None})
new_demand_id = add_demand_payload.get("id") if isinstance(add_demand_payload, dict) else None
print(f"         {cyan(f'↳ Created demand asset id={new_demand_id}')}")

# Get single asset
if new_supply_id:
    test("get-asset-by-id", "GET", f"/api/assets/{new_supply_id}", checks={"id": new_supply_id})

# ─── 3. MATCHING ENGINE ───────────────────────────────────────────────────────
print()
print(bold("── 3. Matching Engine (5-Dimension Score) ──────────────────────────"))

ok, match_payload = test("run-match", "POST", "/api/match", body={
    "location": "Madinaty",
    "type": "apartment",
    "purpose": "sell",
    "price": 3500000,
    "bedrooms": 3,
    "area_sqm": 150,
    "finishing": "fully_finished",
    "furnished": False,
    "skipGpt": True
}, timeout=25)
matches = match_payload.get("matches", []) if isinstance(match_payload, dict) else []
print(f"         {cyan(f'↳ {len(matches)} matches returned')}")
if matches:
    top = matches[0]
    score = top.get("score", 0)
    breakdown = top.get("breakdown", {})
    print(f"         {cyan(f'↳ Top match score={score:.1f}% breakdown={list(breakdown.keys())}')}")

# Score a specific match
ok, score_payload = test("score-match", "POST", "/api/score", body={
    "supply": {"location": "Madinaty", "type": "apartment", "price": 3500000, "bedrooms": 3, "area_sqm": 150, "finishing": "fully_finished"},
    "demand": {"location": "Madinaty", "type": "apartment", "price": 3800000, "bedrooms": 3, "area_sqm": 140, "finishing": "fully_finished"}
})

# ─── 4. LOCATION STATS ────────────────────────────────────────────────────────
print()
print(bold("── 4. Location Stats & Market Data ────────────────────────────────"))
ok, loc_payload = test("location-stats", "GET", "/api/locations/stats")
locs = loc_payload if isinstance(loc_payload, list) else []
print(f"         {cyan(f'↳ {len(locs)} locations in stats')}")
if locs:
    sample = locs[0]
    loc_name = sample.get("location","?")
    sup_cnt = sample.get("supply_count",0)
    dem_cnt = sample.get("demand_count",0)
    avg_bud = sample.get("avg_budget",0)
    print(f"         {cyan(f'Sample: {loc_name} supply={sup_cnt} demand={dem_cnt} avg_budget={avg_bud:,.0f}')}")

test("market-trends", "GET", "/api/market/trends")
test("market-overview", "GET", "/api/market/overview")

# ─── 5. WHATSAPP ──────────────────────────────────────────────────────────────
print()
print(bold("── 5. WhatsApp Integration ─────────────────────────────────────────"))
ok, wa_payload = test("wa-status", "GET", "/api/wa/status", checks={"connected": None})
wa_state = wa_payload.get("state","?")
wa_msgs = wa_payload.get("messages",0)
print(f"         {cyan(f'WA state={wa_state} msgs={wa_msgs}')}")
test("wa-messages", "GET", "/api/wa/messages")
test("wa-pipeline",  "GET", "/api/wa/pipeline")

# ─── 6. PUSH NOTIFICATIONS ────────────────────────────────────────────────────
print()
print(bold("── 6. Push Notifications (Web Push / VAPID) ────────────────────────"))
ok, vapid_payload = test("vapid-key-2", "GET", "/api/push/vapid-public-key")
key = vapid_payload.get("publicKey", "") if isinstance(vapid_payload, dict) else ""
print(f"         {cyan(f'↳ VAPID key={key[:30]}...')}")

ok, push_stats = test("push-stats-2", "GET", "/api/push/stats", checks={"subscribers": None})
subs = push_stats.get("subscribers", 0) if isinstance(push_stats, dict) else 0
print(f"         {cyan(f'↳ {subs} active push subscribers')}")

# ─── 7. PIPELINE / SAVED MATCHES ──────────────────────────────────────────────
print()
print(bold("── 7. Pipeline & Saved Matches ─────────────────────────────────────"))
test("list-pipeline", "GET", "/api/pipeline")
test("save-pipeline", "POST", "/api/pipeline", body={
    "asset_id": new_supply_id or 1,
    "match_id": new_demand_id or 2,
    "score": 87.5,
    "notes": "Test pipeline save"
}, expect_status=201)

# ─── 8. ANALYTICS ─────────────────────────────────────────────────────────────
print()
print(bold("── 8. Analytics & Reporting ────────────────────────────────────────"))
test("analytics-summary", "GET", "/api/analytics/summary")
test("match-history",     "GET", "/api/match/history")

# ─── 9. SETTINGS ──────────────────────────────────────────────────────────────
print()
print(bold("── 9. Settings ─────────────────────────────────────────────────────"))
test("get-settings", "GET", "/api/settings")
test("update-settings", "PATCH", "/api/settings", body={
    "notifications_enabled": True,
    "theme": "dark"
})

# ─── 10. CLEANUP ──────────────────────────────────────────────────────────────
print()
print(bold("── 10. Cleanup Test Data ───────────────────────────────────────────"))
if new_supply_id:
    test("delete-supply-asset", "DELETE", f"/api/assets/{new_supply_id}", expect_status=200)
if new_demand_id:
    test("delete-demand-asset", "DELETE", f"/api/assets/{new_demand_id}", expect_status=200)

# ─── FINAL REPORT ─────────────────────────────────────────────────────────────
total = PASS + FAIL
pct   = int(PASS * 100 / total) if total else 0
print()
print(bold(cyan("╔═══════════════════════════════════════════════════════════════╗")))
print(bold(cyan(f"║  RESULTS:  {green(f'{PASS} PASS')}  {red(f'{FAIL} FAIL')}  /  {total} total   ({pct}% success rate){'  ' + '║' if pct == 100 else '                    ║'}")))
print(bold(cyan("╚═══════════════════════════════════════════════════════════════╝")))
print()

if FAIL > 0:
    print(bold(red("Failed tests:")))
    for label, ok, status, payload in RESULTS:
        if not ok:
            print(f"  • {label}: status={status} payload={str(payload)[:100]}")
    print()

sys.exit(0 if FAIL == 0 else 1)
