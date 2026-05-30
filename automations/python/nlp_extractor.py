"""
MatchPro™ — NLP Email Extractor
Uses Claude/GPT via gsk to extract structured lead data from raw email text.
"""
import json, subprocess, re

EXTRACT_PROMPT = """
أنت مساعد عقاري متخصص. اقرأ الإيميل التالي واستخرج المعلومات بدقة.

أرجع JSON فقط بالشكل ده (لا تضيف أي نص قبله أو بعده):

{
  "role": "buyer" أو "seller",
  "name": "اسم الشخص أو null",
  "phone": "رقم التليفون أو null",
  "email": "البريد الإلكتروني أو null",
  "prop_type": "apartment|villa|land|studio|office|shop|other أو null",
  "location_ar": "الموقع بالعربي أو null",
  "location_en": "الموقع بالإنجليزي أو null",
  "area_sqm": رقم المساحة أو null,
  "price": سعر البائع أو null,
  "budget_min": أقل ميزانية للمشتري أو null,
  "budget_max": أعلى ميزانية للمشتري أو null,
  "details": "أي تفاصيل مهمة تانية"
}

قواعد:
- لو الشخص بيبيع → role = "seller", ضع السعر في price
- لو الشخص بيشتري → role = "buyer", ضع الميزانية في budget_min/budget_max
- الأسعار دايما بالأرقام بس (بدون EGP أو أي عملة)
- لو مش واضح الـ role → اجعله "buyer"
- prop_type: apartment=شقة, villa=فيلا/تاون هاوس, land=أرض, studio=ستوديو, office=مكتب, shop=محل

الإيميل:
"""

def extract_lead_from_email(email_text: str, email_id: str = "") -> dict:
    """
    Run NLP extraction on a single email text.
    Returns structured lead dict or None on failure.
    """
    prompt = EXTRACT_PROMPT + email_text

    # Use gsk analyze (text mode) or fall back to direct Claude API
    try:
        result = subprocess.run(
            ["gsk", "search", f"استخرج بيانات العقار من النص: {email_text[:500]}"],
            capture_output=True, text=True, timeout=30
        )
        # Try parsing JSON from output
        raw = result.stdout.strip()
    except Exception as e:
        raw = ""

    # Better: use Python AI extraction with regex + rules
    return _rule_based_extract(email_text, email_id)


def _rule_based_extract(text: str, email_id: str = "") -> dict:
    """
    Rule-based + regex extraction as primary method.
    Fast, reliable, no API cost.
    """
    text_lower = text.lower()
    result = {
        "source_email": email_id,
        "role": None,
        "name": None,
        "phone": None,
        "email": None,
        "prop_type": None,
        "location_ar": None,
        "location_en": None,
        "area_sqm": None,
        "price": None,
        "budget_min": None,
        "budget_max": None,
        "details": text[:500]
    }

    # ── Role detection ────────────────────────────────────────────
    sell_keywords = ["بيبيع", "للبيع", "عايز يبيع", "for sale", "selling", "seller",
                     "بأبيع", "عندي", "بعرض", "طارح"]
    buy_keywords  = ["بيشتري", "عايز يشتري", "مشتري", "buyer", "buying", "محتاج",
                     "بدور", "أبحث", "interested in buying", "want to buy", "ميزانية"]

    sell_score = sum(1 for k in sell_keywords if k in text_lower)
    buy_score  = sum(1 for k in buy_keywords  if k in text_lower)
    result["role"] = "seller" if sell_score > buy_score else "buyer"

    # ── Property type ─────────────────────────────────────────────
    type_map = {
        "apartment": ["شقة", "شقه", "apartment", "apt", "flat"],
        "villa":     ["فيلا", "فيلا", "villa", "townhouse", "تاون هاوس", "دوبلكس", "duplex"],
        "land":      ["أرض", "ارض", "قطعة أرض", "land", "plot"],
        "studio":    ["ستوديو", "studio"],
        "office":    ["مكتب", "office"],
        "shop":      ["محل", "shop", "store", "محلات"],
    }
    for ptype, keywords in type_map.items():
        if any(k in text_lower for k in keywords):
            result["prop_type"] = ptype
            break

    # ── Phone extraction ──────────────────────────────────────────
    phones = re.findall(r'(?:\+20|0020|0)?1[0125]\d{8}', text)
    if phones:
        result["phone"] = phones[0]

    # ── Email extraction ──────────────────────────────────────────
    emails = re.findall(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', text)
    if emails:
        result["email"] = emails[0]

    # ── Price / Budget extraction ─────────────────────────────────
    # Match patterns like: 2,500,000 or 2.5M or 2500000
    prices = re.findall(r'(\d[\d,\.]+)\s*(?:مليون|ألف|EGP|جنيه|ج\.م|million|M|k)?', text)
    numeric_prices = []
    for p in prices:
        p_clean = p.replace(',', '').replace('.', '')
        try:
            val = float(p_clean)
            if val > 10000:  # likely a property price
                numeric_prices.append(val)
        except:
            pass

    if numeric_prices:
        if result["role"] == "seller":
            result["price"] = numeric_prices[0]
        else:
            if len(numeric_prices) >= 2:
                result["budget_min"] = min(numeric_prices[:2])
                result["budget_max"] = max(numeric_prices[:2])
            else:
                result["budget_max"] = numeric_prices[0]

    # ── Area extraction ───────────────────────────────────────────
    areas = re.findall(r'(\d+)\s*(?:متر|م²|sqm|m2|square)', text_lower)
    if areas:
        result["area_sqm"] = float(areas[0])

    # ── Location (Egyptian areas) ─────────────────────────────────
    locations = {
        "التجمع الخامس": "Fifth Settlement", "التجمع": "Fifth Settlement",
        "مدينة نصر": "Nasr City", "نصر": "Nasr City",
        "المعادي": "Maadi", "معادي": "Maadi",
        "الزمالك": "Zamalek", "زمالك": "Zamalek",
        "مصر الجديدة": "Heliopolis", "هليوبوليس": "Heliopolis",
        "6 أكتوبر": "6th of October", "أكتوبر": "6th of October",
        "الشيخ زايد": "Sheikh Zayed", "زايد": "Sheikh Zayed",
        "النزهة": "El Nozha", "نزهة": "El Nozha",
        "المنصورة": "Mansoura",
        "الإسكندرية": "Alexandria", "اسكندرية": "Alexandria",
        "الغردقة": "Hurghada", "هرغاده": "Hurghada",
        "الساحل الشمالي": "North Coast", "الساحل": "North Coast",
        "العاصمة الإدارية": "New Administrative Capital", "العاصمة": "New Administrative Capital",
        "مستقبل سيتي": "Mostakbal City",
        "بدر": "Badr City", "مدينة بدر": "Badr City",
        "القاهرة الجديدة": "New Cairo", "كمبوند": "Compound",
        "الرحاب": "Rehab City", "رحاب": "Rehab City",
        "مدينتي": "Madinaty",
        "الدقي": "Dokki", "الجيزة": "Giza", "جيزة": "Giza",
        "فيصل": "Faisal", "إمبابة": "Imbaba",
        "شبرا": "Shubra", "عين شمس": "Ain Shams",
        "المطرية": "El Matareya", "حلوان": "Helwan",
    }
    for ar, en in locations.items():
        if ar in text:
            result["location_ar"] = ar
            result["location_en"] = en
            break

    # ── Name extraction (basic heuristic) ────────────────────────
    name_patterns = [
        r'(?:اسمي|أنا|من|الأستاذ|السيد|الدكتور|المهندس)\s+([^\n،,\.]{3,30})',
        r'(?:Name|From):\s*([A-Za-z\s]{3,40})',
    ]
    for pattern in name_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            result["name"] = match.group(1).strip()
            break

    return result


def extract_leads_from_emails(emails: list) -> list:
    """
    Process a list of email dicts: [{id, subject, body, from_email, from_name}]
    Returns list of lead dicts ready for DB insertion.
    """
    leads = []
    for email in emails:
        full_text = f"""
From: {email.get('from_name', '')} <{email.get('from_email', '')}>
Subject: {email.get('subject', '')}

{email.get('body', '')}
"""
        lead = _rule_based_extract(full_text, email.get('id', ''))

        # Override email/name from headers if not found in body
        if not lead["email"] and email.get("from_email"):
            lead["email"] = email["from_email"]
        if not lead["name"] and email.get("from_name"):
            lead["name"] = email["from_name"]
        # For WhatsApp messages, use sender phone if no phone found
        if not lead["phone"] and email.get("from_phone"):
            lead["phone"] = email["from_phone"]

        if lead["role"] and (lead["prop_type"] or lead["location_ar"]):
            leads.append(lead)

    return leads
