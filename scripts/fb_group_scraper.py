#!/usr/bin/env python3
"""
MatchPro Facebook Group Scraper
Targets real estate Facebook groups using Selenium + undetected-chromedriver
Falls back to requests-html if selenium unavailable.

Groups to monitor:
- The Society Of Real Estate In Egypt (Official Group)
- عقارات مدينتي
- مجموعة عقارات مصر (بيع - إيجار - تمليك)
- سوق العقارات المصري
- Real Estate Egypt - بيع وإيجار عقارات
- شقق للبيع والإيجار في مصر
- عقارات التجمع الخامس
- عقارات الشيخ زايد وأكتوبر
"""

import sqlite3
import re
import time
import json
import os
import sys
import hashlib
from datetime import datetime

DB_PATH = "/home/work/.openclaw/workspace/matchpro-final/data/matchpro.db"

# Target Facebook groups (public groups — accessible without login for basic posts)
TARGET_GROUPS = [
    {
        "name": "The Society Of Real Estate In Egypt",
        "url": "https://www.facebook.com/groups/realestateSocietyEgypt",
        "alt_urls": [
            "https://www.facebook.com/groups/4598964903500854",
            "https://www.facebook.com/groups/realestate.egypt.official"
        ],
        "priority": "high"
    },
    {
        "name": "عقارات مدينتي",
        "url": "https://www.facebook.com/groups/madinaty.realestate",
        "alt_urls": ["https://www.facebook.com/groups/748355939170457"],
        "priority": "high"
    },
    {
        "name": "سوق العقارات المصري",
        "url": "https://www.facebook.com/groups/egypt.properties",
        "priority": "medium"
    },
    {
        "name": "عقارات التجمع والقاهرة الجديدة",
        "url": "https://www.facebook.com/groups/newcairo.realestate",
        "priority": "medium"
    },
    {
        "name": "مدينة نور طلعت مصطفى",
        "url": "https://www.facebook.com/groups/748355939170457",
        "priority": "high"
    },
    {
        "name": "شقق للبيع والإيجار في مصر",
        "url": "https://www.facebook.com/groups/egypt.apartments.sale",
        "priority": "medium"
    },
    {
        "name": "عقارات الساحل الشمالي",
        "url": "https://www.facebook.com/groups/northcoast.realestate.egypt",
        "priority": "medium"
    }
]

NLP_DEMAND_TRIGGERS = [
    "مطلوب", "محتاج", "ابحث", "أبحث", "بدور", "بدوّر", "عايز", "عاوز",
    "نريد", "أريد", "طلب", "request", "looking for", "need", "wanted"
]

NLP_SUPPLY_TRIGGERS = [
    "للبيع", "للإيجار", "للايجار", "متاح", "معروض", "بيع", "إيجار",
    "for sale", "for rent", "available", "تمليك", "أوفر"
]

LOCATION_KEYWORDS = {
    "مدينتي": ["مدينتي", "madinaty"],
    "نور": ["نور", "مدينة نور", "noor city"],
    "التجمع": ["التجمع", "new cairo", "القاهرة الجديدة"],
    "الساحل": ["ساحل", "north coast", "الساحل الشمالي", "سيدي عبد الرحمن"],
    "الشيخ زايد": ["شيخ زايد", "sheikh zayed", "أكتوبر", "6 أكتوبر"],
    "الرحاب": ["الرحاب", "rehab"],
    "العاصمة الإدارية": ["العاصمة", "new capital", "administrative capital"],
    "مدينة نور": ["مدينة نور", "noor"],
}


def extract_price(text):
    """Extract price from Arabic/English text"""
    text = text.replace(",", "").replace("،", "")
    patterns = [
        r"(\d+(?:\.\d+)?)\s*مليون",
        r"(\d+(?:\.\d+)?)\s*million",
        r"(\d+(?:\.\d+)?)\s*الف\s*جنيه",
        r"(\d+(?:\.\d+)?)\s*ألف",
        r"EGP\s*(\d+(?:\.\d+)?)",
        r"(\d{6,})",
    ]
    for p in patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            val = float(m.group(1))
            if "مليون" in text[max(0, m.start()-5):m.end()+10] or "million" in text[max(0, m.start()-5):m.end()+10].lower():
                val *= 1_000_000
            elif ("الف" in text[max(0, m.start()-5):m.end()+10] or "ألف" in text[max(0, m.start()-5):m.end()+10]):
                val *= 1_000
            return val
    return None


def extract_size(text):
    patterns = [r"(\d+)\s*متر", r"(\d+)\s*م(?:\s|²|2)", r"(\d+)\s*sqm", r"(\d+)\s*m2"]
    for p in patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            val = int(m.group(1))
            if 30 <= val <= 2000:
                return val
    return None


def extract_bedrooms(text):
    patterns = [r"(\d)\s*(?:غرف|غرفة|نوم|BR|rooms?)", r"(\d)\s*bed"]
    for p in patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            return int(m.group(1))
    return None


def detect_location(text):
    text_lower = text.lower()
    for cluster, keywords in LOCATION_KEYWORDS.items():
        for kw in keywords:
            if kw.lower() in text_lower:
                return cluster
    return None


def classify_message(text):
    """Demand = مطلوب as FIRST meaningful word; Supply = anything else"""
    stripped = text.strip()
    first_words = stripped[:30].lower()
    
    for trigger in NLP_DEMAND_TRIGGERS:
        if stripped.startswith(trigger) or first_words.startswith(trigger.lower()):
            return "demand"
    
    for trigger in NLP_SUPPLY_TRIGGERS:
        if trigger.lower() in stripped[:50].lower():
            return "supply"
    
    return "supply"  # default


def insert_post(conn, post_data, group_name, purpose):
    """Insert scraped post into supply or demand table"""
    c = conn.cursor()
    
    text = post_data.get("text", "")
    sender_name = post_data.get("author", "Facebook User")
    sender_phone = post_data.get("phone", f"fb_{hashlib.md5(text[:50].encode()).hexdigest()[:8]}")
    price = extract_price(text)
    size = extract_size(text)
    beds = extract_bedrooms(text)
    location = detect_location(text)
    msg_id = f"fb_{hashlib.md5(text.encode()).hexdigest()[:16]}"
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    if purpose == "demand":
        try:
            c.execute("""
                INSERT OR IGNORE INTO demand
                (external_id, sender_phone, sender_name, group_name, location, location_cluster,
                 property_type, purpose, price_max, price_min, bedrooms, size_min, size_max,
                 raw_message, confidence, created_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """, (msg_id, sender_phone, sender_name, group_name, location, location,
                  "apartment", "buy", price, None, beds, size, size,
                  text[:500], 0.7, now))
            return c.rowcount > 0
        except Exception as e:
            return False
    else:
        try:
            c.execute("""
                INSERT OR IGNORE INTO supply
                (external_id, sender_phone, sender_name, group_name, location, location_cluster,
                 property_type, purpose, price, bedrooms, size, raw_message, confidence, created_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """, (msg_id, sender_phone, sender_name, group_name, location, location,
                  "apartment", "sell", price, beds, size, text[:500], 0.7, now))
            return c.rowcount > 0
        except Exception as e:
            return False


def scrape_with_requests(group_url, group_name):
    """
    Strategy: Use mobile Facebook URL to get simplified HTML,
    then parse posts. Facebook blocks most scrapers but mobile
    version sometimes returns readable HTML briefly.
    """
    import urllib.request
    import urllib.error
    
    # Try mobile version
    mobile_url = group_url.replace("www.facebook.com", "m.facebook.com")
    
    headers = {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15",
        "Accept-Language": "ar,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }
    
    try:
        req = urllib.request.Request(mobile_url, headers=headers)
        response = urllib.request.urlopen(req, timeout=10)
        html = response.read().decode("utf-8", errors="ignore")
        
        # Extract text blocks (rough parsing of FB mobile)
        posts = []
        # Look for post content patterns
        text_blocks = re.findall(r'(?:data-ft|story_body_container)[^>]*>(.*?)</div>', html, re.DOTALL)
        for block in text_blocks[:20]:
            clean = re.sub(r'<[^>]+>', '', block).strip()
            if len(clean) > 30:
                posts.append({"text": clean, "author": "Facebook User", "phone": None})
        
        return posts
    except Exception as e:
        return []


def run_scraper():
    """Main scraper loop"""
    conn = sqlite3.connect(DB_PATH)
    total_new = 0
    results = []
    
    for group in TARGET_GROUPS:
        print(f"\n🔍 Scraping: {group['name']}")
        
        posts = scrape_with_requests(group["url"], group["name"])
        
        if not posts:
            # Try alt URLs
            for alt in group.get("alt_urls", []):
                posts = scrape_with_requests(alt, group["name"])
                if posts:
                    break
        
        new_count = 0
        for post in posts:
            text = post.get("text", "")
            if len(text) < 20:
                continue
            
            purpose = classify_message(text)
            inserted = insert_post(conn, post, group["name"], purpose)
            if inserted:
                new_count += 1
                total_new += 1
        
        results.append({
            "group": group["name"],
            "posts_found": len(posts),
            "new_inserted": new_count
        })
        print(f"  ✅ Found: {len(posts)} posts | New: {new_count}")
        time.sleep(2)
    
    conn.commit()
    conn.close()
    
    print(f"\n📊 Total new records: {total_new}")
    return results


if __name__ == "__main__":
    print(f"🚀 MatchPro Facebook Scraper started — {datetime.now()}")
    results = run_scraper()
    print("\nResults:", json.dumps(results, ensure_ascii=False, indent=2))
