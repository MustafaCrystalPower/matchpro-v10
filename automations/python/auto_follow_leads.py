#!/usr/bin/env python3
"""
MatchPro Auto Lead Follow-Up
Sends WhatsApp lead summary to Mo'men for top unnotified asset_matches (score >= 75%)
Runs as part of the 9AM/9PM cycle.
"""
import sqlite3, requests, json
from datetime import datetime

DB_PATH = '/home/work/.openclaw/workspace/matchpro-v2/data/matchpro.db'
GREEN_API_BASE = 'https://7105.api.greenapi.com/waInstance7105409203'
GREEN_API_TOKEN = '0e7ca429980f4331ae5fee4360c955a9db2d6fe3ca6545a4b3'
MOMEN_CHAT = '201066505665@c.us'

ASSETS = {
    2: {'code': 'CPI-PRIVADO', 'name': 'Privado 1BR + Garden', 'price': '30K EGP/شهر'},
    3: {'code': 'CPI-DREAMLAND', 'name': 'The Emeralds 3BR', 'price': '30K-80K EGP'},
    4: {'code': 'CPI-B7', 'name': 'B7 Madinaty 3BR', 'price': '55K EGP/شهر'},
    1: {'code': 'A-308605', 'name': 'B11 Madinaty للبيع', 'price': '5.5M EGP'},
}

def run():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    now = datetime.now().strftime('%Y-%m-%d %H:%M')
    cycle = '9AM' if datetime.now().hour < 15 else '9PM'

    report_lines = []
    total_leads = 0

    for asset_id, info in ASSETS.items():
        cur.execute(
            "SELECT am.id, am.match_score, am.demand_phone, am.demand_message "
            "FROM asset_matches am "
            "WHERE am.asset_id=? AND am.match_score>=75 AND am.notified=0 "
            "ORDER BY am.match_score DESC LIMIT 5",
            (asset_id,)
        )
        leads = cur.fetchall()
        if not leads:
            continue
        total_leads += len(leads)
        report_lines.append("\n\U0001f3e0 *" + info['name'] + "* (" + info['price'] + ")")
        for lead in leads:
            phone = lead['demand_phone'].replace('@c.us', '').replace('@s.whatsapp.net', '')
            preview = ((lead['demand_message'] or '')[:80]).replace('\n', ' ')
            report_lines.append("  \u2022 \U0001f4de 0" + phone[-10:] + " | " + str(int(lead['match_score'])) + "% | " + preview)
            cur.execute("UPDATE asset_matches SET notified=1 WHERE id=?", (lead['id'],))

    conn.commit()
    conn.close()

    if total_leads == 0:
        print("[" + now + "] No new leads.")
        return

    msg = "\U0001f3af *MatchPro\u2122 Lead Report | " + now + " | " + cycle + "*\n\n"
    msg += "\u2501" * 18 + "\n"
    msg += "\u0639\u0646\u062f\u0643 *" + str(total_leads) + " lead \u062c\u062f\u064a\u062f* \u064a\u0633\u062a\u062d\u0642 \u0627\u0644\u0645\u062a\u0627\u0628\u0639\u0629:\n"
    msg += ''.join(report_lines)
    msg += "\n\n" + "\u2501" * 18
    msg += "\n\U0001f517 https://lkdsbjzk.gensparkclaw.com/matchpro/"
    msg += "\n\n_MatchPro\u2122 \u2014 Crystal Power Investments_"

    r = requests.post(
        GREEN_API_BASE + '/sendMessage/' + GREEN_API_TOKEN,
        json={'chatId': MOMEN_CHAT, 'message': msg},
        timeout=30
    )
    if r.status_code == 200:
        print("[" + now + "] Sent — " + str(total_leads) + " leads")
    else:
        print("[" + now + "] FAILED: " + str(r.status_code))

if __name__ == '__main__':
    run()
