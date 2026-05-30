#!/usr/bin/env python3
"""
MatchPro Facebook Browser Scraper
Uses CDP (Chrome DevTools Protocol) via the running Chromium to extract 
real posts from Facebook groups that Mo'men is logged into.
"""

import json
import sqlite3
import hashlib
import re
import time
import urllib.request
import urllib.error
from datetime import datetime

DB_PATH = "/home/work/.openclaw/workspace/matchpro-final/data/matchpro.db"
CDP_URL = "http://127.0.0.1:9222"

# High-value Facebook groups for MatchPro
TARGET_GROUPS = [
    {"id": "4598964903500854", "name": "عقارات مدينة نور طلعت مصطفى", "priority": "high"},
    {"id": "748355939170457",  "name": "مدينة نور noor (مجموعة طلعت مصطفى)", "priority": "high"},
    {"id": "1340519436595585", "name": "إتحاد ملاك مدينة نور — ومدينتي (بدون عمولة)", "priority": "high"},
    {"id": "6341897975888220", "name": "شقق نور للبيع والإيجار", "priority": "high"},
    {"id": "3482213665371944", "name": "SouthMED North Coast", "priority": "high"},
    {"id": "2412622575429100", "name": "SouthMED Resale Group", "priority": "high"},
    {"id": "1036199990198210", "name": "North Coast Properties Egypt", "priority": "medium"},
    {"id": "realestateSocietyEgypt", "name": "The Society Of Real Estate In Egypt", "priority": "high"},
    {"id": "madinaty.properties", "name": "مدينتي بيع وإيجار — ملاك فقط", "priority": "high"},
]

LOCATION_MAP = {
    "مدينتي": ["مدينتي", "madinaty", "b1","b2","b3","b6","b7","b10","b11","b12","b15"],
    "نور": ["نور", "مدينة نور", "noor", "noor city"],
    "التجمع": ["التجمع", "new cairo", "القاهرة الجديدة", "fifth settlement"],
    "الساحل": ["ساحل", "north coast", "الساحل", "سيدي عبد الرحمن", "marina", "hacienda"],
    "الشيخ زايد": ["شيخ زايد", "sheikh zayed", "أكتوبر", "6 أكتوبر"],
    "الرحاب": ["الرحاب", "rehab"],
    "العاصمة الإدارية": ["العاصمة", "new capital", "administrative capital", "مدينة المستقبل"],
    "SouthMED": ["southmed", "south med", "ساوث ميد", "فيزا الخيمة"],
}


def get_tab_id():
    """Get the active browser tab ID via CDP"""
    try:
        req = urllib.request.Request(f"{CDP_URL}/json")
        resp = urllib.request.urlopen(req, timeout=5)
        tabs = json.loads(resp.read())
        for tab in tabs:
            if tab.get("type") == "page" and "facebook" in tab.get("url", "").lower():
                return tab["id"]
        # Return first page tab
        for tab in tabs:
            if tab.get("type") == "page":
                return tab["id"]
    except Exception as e:
        print(f"CDP error: {e}")
    return None


def navigate_and_extract(tab_id, group_id):
    """Navigate browser to group and extract posts via CDP evaluate"""
    import subprocess
    
    group_url = f"https://www.facebook.com/groups/{group_id}"
    
    # Navigate using CDP
    nav_cmd = json.dumps({
        "id": 1,
        "method": "Page.navigate",
        "params": {"url": group_url}
    })
    
    # Use curl to send CDP commands
    ws_url = f"ws://127.0.0.1:9222/devtools/page/{tab_id}"
    
    # Use evaluate via a temp JS file approach
    js_extract = """
    (() => {
        const posts = [];
        // Get all post text content from feed
        const feedItems = document.querySelectorAll('[data-pagelet="FeedUnit"] [dir="auto"], [role="article"] [dir="auto"]');
        feedItems.forEach(el => {
            const text = el.innerText || el.textContent || '';
            if (text.length > 30 && text.length < 2000) {
                // Try to find author
                const article = el.closest('[role="article"]');
                let author = '';
                if (article) {
                    const authorEl = article.querySelector('h2 a, h3 a, [role="link"]');
                    if (authorEl) author = authorEl.innerText || '';
                }
                // Extract phone if present
                const phoneMatch = text.match(/01[0-9]{9}/);
                posts.push({
                    text: text.trim().substring(0, 500),
                    author: author.trim().substring(0, 50),
                    phone: phoneMatch ? phoneMatch[0] : null
                });
            }
        });
        // Deduplicate by text
        const seen = new Set();
        return posts.filter(p => {
            const key = p.text.substring(0, 50);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    })()
    """
    
    return js_extract


def extract_price(text):
    text = text.replace(",", "").replace("،", "")
    patterns = [
        (r"(\d+(?:\.\d+)?)\s*مليون", 1_000_000),
        (r"(\d+(?:\.\d+)?)\s*million", 1_000_000),
        (r"(\d+(?:\.\d+)?)\s*ألف\s*جنيه", 1_000),
        (r"(\d+(?:\.\d+)?)\s*الف", 1_000),
        (r"(\d{7,})", 1),
    ]
    for p, mult in patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            return float(m.group(1)) * mult
    return None


def extract_size(text):
    for p in [r"(\d+)\s*متر", r"(\d+)\s*م(?:\s|²|2)", r"(\d+)\s*sqm"]:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            v = int(m.group(1))
            if 30 <= v <= 2000:
                return v
    return None


def extract_beds(text):
    for p in [r"(\d)\s*(?:غرف|نوم|BR|bedroom)", r"(\d)\s*bed"]:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            return int(m.group(1))
    return None


def detect_location(text):
    tl = text.lower()
    for cluster, kws in LOCATION_MAP.items():
        for kw in kws:
            if kw.lower() in tl:
                return cluster
    return None


def classify(text):
    stripped = text.strip()
    demand_starters = ["مطلوب", "محتاج", "ابحث", "أبحث", "بدور", "بدوّر", "عايز", "عاوز", "نريد", "أريد", "looking for", "need", "wanted", "request"]
    for d in demand_starters:
        if stripped.lower().startswith(d.lower()):
            return "demand"
    supply_kws = ["للبيع", "للإيجار", "للايجار", "متاح", "معروض", "for sale", "for rent", "available", "تمليك"]
    for s in supply_kws:
        if s.lower() in stripped[:100].lower():
            return "supply"
    return "supply"


def insert_record(conn, text, author, phone, group_name, group_id):
    c = conn.cursor()
    msg_id = f"fb_{hashlib.md5((text[:100]+group_id).encode()).hexdigest()[:16]}"
    purpose = classify(text)
    price = extract_price(text)
    size = extract_size(text)
    beds = extract_beds(text)
    location = detect_location(text) or group_name[:20]
    phone_clean = phone or f"fb_{msg_id[-8:]}"
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    if purpose == "demand":
        try:
            c.execute("""INSERT OR IGNORE INTO demand
                (external_id,sender_phone,sender_name,group_name,location,location_cluster,
                property_type,purpose,price_max,bedrooms,size_min,raw_message,confidence,created_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (msg_id, phone_clean, author or "Facebook", group_name, location, location,
                 "apartment", "buy", price, beds, size, text[:500], 0.75, now))
        except: pass
    else:
        try:
            c.execute("""INSERT OR IGNORE INTO supply
                (external_id,sender_phone,sender_name,group_name,location,location_cluster,
                property_type,purpose,price,bedrooms,size,raw_message,confidence,created_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (msg_id, phone_clean, author or "Facebook", group_name, location, location,
                 "apartment", "sell", price, beds, size, text[:500], 0.75, now))
        except: pass
    return c.rowcount > 0


def run(tab_id, max_groups=9):
    """Main scraper using browser eval via CDP HTTP"""
    conn = sqlite3.connect(DB_PATH)
    total = 0
    
    print(f"\n🚀 Facebook Scraper — browser mode | Tab: {tab_id}")
    print(f"📋 Targeting {len(TARGET_GROUPS)} groups\n")
    
    for group in TARGET_GROUPS[:max_groups]:
        gid = group["id"]
        gname = group["name"]
        
        try:
            # Navigate
            nav_url = f"https://www.facebook.com/groups/{gid}"
            nav_payload = json.dumps({"id": 1, "method": "Page.navigate", "params": {"url": nav_url}})
            
            req = urllib.request.Request(
                f"{CDP_URL}/json/new",
                data=None, method="GET"
            )
            
            # Use subprocess for CDP websocket
            import subprocess
            
            # Navigate via simple GET trick (use existing tab)
            result = subprocess.run(
                ["node", "-e", f"""
const WebSocket = require('ws');
const ws = new WebSocket('ws://127.0.0.1:9222/devtools/page/{tab_id}');
ws.on('open', () => {{
    ws.send(JSON.stringify({{id:1,method:'Page.navigate',params:{{url:'https://www.facebook.com/groups/{gid}'}}}}) );
    setTimeout(() => {{
        ws.send(JSON.stringify({{id:2,method:'Runtime.evaluate',params:{{expression:`
            JSON.stringify((() => {{
                const posts = [];
                const els = document.querySelectorAll('[role=article]');
                els.forEach(el => {{
                    const text = el.innerText || '';
                    if(text.length > 40 && text.length < 1500) {{
                        const authorEl = el.querySelector('h2 a, h3 a');
                        const phoneM = text.match(/01[0-9]{{9}}/);
                        posts.push({{t: text.substring(0,500), a: authorEl ? authorEl.innerText.substring(0,40) : '', p: phoneM ? phoneM[0] : null}});
                    }}
                }});
                const seen = new Set();
                return posts.filter(x => {{ const k=x.t.substring(0,40); if(seen.has(k)) return false; seen.add(k); return true; }});
            }})())
        `,returnByValue:true}}}});
    }}, 6000);
    setTimeout(() => {{ process.exit(0); }}, 8000);
}});
ws.on('message', msg => {{
    const d = JSON.parse(msg);
    if(d.id === 2 && d.result && d.result.result) {{
        console.log(d.result.result.value || '[]');
    }}
}});
ws.on('error', e => {{ console.error('WS error'); process.exit(1); }});
"""],
                capture_output=True, text=True, timeout=12
            )
            
            raw = result.stdout.strip()
            posts = []
            if raw:
                try:
                    posts = json.loads(raw)
                except:
                    pass
            
            new_count = 0
            for post in posts:
                text = post.get("t", "")
                if len(text) > 30:
                    inserted = insert_record(conn, text, post.get("a",""), post.get("p"), gname, gid)
                    if inserted:
                        new_count += 1
                        total += 1
            
            print(f"  ✅ {gname}: {len(posts)} posts | {new_count} new added")
            
        except subprocess.TimeoutExpired:
            print(f"  ⏱️ {gname}: timeout")
        except Exception as e:
            print(f"  ❌ {gname}: {e}")
        
        time.sleep(3)
    
    conn.commit()
    conn.close()
    print(f"\n📊 Total new Facebook records: {total}")
    return total


if __name__ == "__main__":
    tab_id = get_tab_id()
    if not tab_id:
        print("❌ No browser tab found")
    else:
        print(f"🔗 Using tab: {tab_id}")
        run(tab_id)
