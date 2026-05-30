#!/bin/bash
# MatchPro Hot Buyer Alert — runs every 30 minutes
# Checks for high-priority demand signals and alerts Mo'men via WhatsApp

DB="/home/work/.openclaw/workspace/matchpro-final/data/matchpro.db"
WA_URL="https://7105.api.greenapi.com/waInstance7105409203/sendMessage/0e7ca429980f4331ae5fee4360c955a9db2d6fe3ca6545a4b3"
CHAT_ID="201066505665@c.us"
LOCK_FILE="/tmp/matchpro_hot_alert.lock"

# Priority rules:
# 🔴 P1: "أنا المشتري" or "أنا المالك" at any position = DIRECT BUYER
# 🟠 P2: "عميل جاد" or "تنفيذ فوري" or "Urgent" or "ضروري" = URGENT  
# 🟡 P3: "مطلوب" at START of message = DEMAND (not supply)
# Rule: "مطلوب" in MIDDLE = could be supply listing price ("مطلوب X جنيه")

# Check for new high-priority entries in last 30 minutes
# Use JSON output via Python to avoid shell parsing issues with Arabic + newlines
RESULTS_JSON=$(python3 - <<'PYEOF'
import sqlite3, json, os, sys

db = "/home/work/.openclaw/workspace/matchpro-final/data/matchpro.db"
try:
    conn = sqlite3.connect(db)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("""
        SELECT 
            COALESCE(NULLIF(TRIM(sender_name),''), 'غير معروف') as name,
            COALESCE(sender_phone, '') as phone,
            COALESCE(purpose, '?') as purpose,
            COALESCE(CAST(price_max as TEXT), '0') as price,
            COALESCE(property_type, 'unknown') as ptype,
            COALESCE(location_cluster, '?') as location,
            REPLACE(REPLACE(SUBSTR(raw_message, 1, 80), char(10), ' '), char(13), ' ') as snippet,
            CASE 
                WHEN raw_message LIKE '%أنا المشتري%' OR raw_message LIKE '%انا المشتري%'
                     OR raw_message LIKE '%أنا المالك%' OR raw_message LIKE '%انا المالك%'
                     OR raw_message LIKE '%من المالك مباشرة%' THEN 'P1_DIRECT'
                WHEN raw_message LIKE '%عميل جاد%' OR raw_message LIKE '%تنفيذ فوري%'
                     OR raw_message LIKE '%Urgent%' OR raw_message LIKE '%urgent%'
                     OR raw_message LIKE '%ضروري%' OR raw_message LIKE '%عاجل%' THEN 'P2_URGENT'
                ELSE 'P3_DEMAND'
            END as priority
        FROM demand
        WHERE (
            raw_message LIKE '%أنا المشتري%' OR raw_message LIKE '%انا المشتري%'
            OR raw_message LIKE '%أنا المالك%' OR raw_message LIKE '%انا المالك%'
            OR raw_message LIKE '%عميل جاد%' OR raw_message LIKE '%تنفيذ فوري%'
            OR raw_message LIKE '%ضروري%' OR raw_message LIKE '%عاجل%'
            OR raw_message LIKE '%Urgent%' OR raw_message LIKE '%urgent%'
        )
        AND created_at >= datetime('now', '-30 minutes')
        AND sender_phone NOT LIKE '%201066505665%'
        GROUP BY sender_phone
        ORDER BY priority, created_at DESC
        LIMIT 8
    """)
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    print(json.dumps(rows, ensure_ascii=False))
except Exception as e:
    print(json.dumps([]))
PYEOF
)

COUNT=$(python3 -c "import json,sys; d=json.loads(sys.argv[1]); print(len(d))" "$RESULTS_JSON" 2>/dev/null)

if [ -z "$COUNT" ] || [ "$COUNT" -eq 0 ]; then
  exit 0
fi

# Build clean message via Python (avoids shell Arabic/newline issues)
MSG=$(python3 - <<PYEOF2
import json, sys

data = json.loads('''$RESULTS_JSON''')
lines = [f"🚨 *MatchPro Alert — {len(data)} طلب أولوية عالية جديد*\n"]

for i, r in enumerate(data, 1):
    phone = r['phone'].replace('@c.us','').replace('2010','010').replace('2011','011').replace('2012','012')
    if phone.startswith('20') and len(phone) == 12:
        phone = '0' + phone[2:]
    priority = r.get('priority','P3_DEMAND')
    emoji = {'P1_DIRECT':'🔴 مشتري مباشر','P2_URGENT':'🟠 عاجل','P3_DEMAND':'🟡 طلب'}. get(priority,'🟡 طلب')
    price = r.get('price','0')
    price_str = f" | {float(price):,.0f} EGP" if price and price != '0' and price != '0.0' else ""
    snippet = r.get('snippet','').strip()
    lines.append(f"{i}. *{r['name']}* — {phone}")
    lines.append(f"{emoji} | {r['ptype']} | {r['location']} | {r['purpose']}{price_str}")
    if snippet:
        lines.append(f"📝 {snippet[:70]}")
    lines.append("")

lines.append("📊 Dashboard: https://lkdsbjzk.gensparkclaw.com/matchpro/")
print('\n'.join(lines))
PYEOF2
)

MSG="${MSG}📊 Dashboard: https://lkdsbjzk.gensparkclaw.com/matchpro/"

# Send WhatsApp
curl -s -X POST "$WA_URL" \
  -H 'Content-Type: application/json' \
  -d "{\"chatId\": \"$CHAT_ID\", \"message\": \"$MSG\"}" > /dev/null

echo "$(date): Sent alert for $COUNT hot buyers"
