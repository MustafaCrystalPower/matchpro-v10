"""
MatchPro™ — Matching & Scoring Engine
Matches buyers to sellers based on location, type, price, specs.
"""
from config import (WEIGHT_LOCATION, WEIGHT_TYPE, WEIGHT_PRICE,
                    WEIGHT_SPECS, MIN_MATCH_SCORE, GOOD_MATCH_SCORE)

# Location similarity groups (areas close to each other)
LOCATION_CLUSTERS = [
    {"التجمع الخامس", "مدينتي", "الرحاب", "مستقبل سيتي", "القاهرة الجديدة", "بدر"},
    {"الشيخ زايد", "6 أكتوبر"},
    {"المعادي", "حلوان"},
    {"مصر الجديدة", "النزهة", "عين شمس"},
    {"مدينة نصر", "المطرية"},
    {"الزمالك", "الدقي", "الجيزة"},
]

def location_score(seller_loc: str, buyer_loc: str) -> float:
    """Returns 0-100 location match score."""
    if not seller_loc or not buyer_loc:
        return 50  # unknown = neutral
    if seller_loc == buyer_loc:
        return 100
    # Same cluster = 70%
    sl, bl = seller_loc.strip(), buyer_loc.strip()
    for cluster in LOCATION_CLUSTERS:
        if sl in cluster and bl in cluster:
            return 70
    # Partial string match
    if sl in bl or bl in sl:
        return 60
    return 0

def type_score(seller_type: str, buyer_type: str) -> float:
    """Returns 0-100 property type match score."""
    if not seller_type or not buyer_type:
        return 50
    if seller_type == buyer_type:
        return 100
    # Compatible types
    compatible = {
        ("villa", "apartment"), ("apartment", "villa"),
        ("studio", "apartment"), ("apartment", "studio"),
    }
    if (seller_type, buyer_type) in compatible:
        return 40
    return 0

def price_score(seller_price: float, buyer_min: float, buyer_max: float) -> float:
    """Returns 0-100 price match score."""
    if not seller_price:
        return 50
    # If buyer has a range
    if buyer_max:
        bmin = buyer_min or 0
        bmax = buyer_max
        if bmin <= seller_price <= bmax:
            return 100
        # Within 10% of range
        if seller_price <= bmax * 1.10 and seller_price >= bmin * 0.90:
            return 75
        # Within 20%
        if seller_price <= bmax * 1.20 and seller_price >= bmin * 0.80:
            return 50
        return 10
    return 50  # no buyer budget info

def specs_score(seller_area: float, buyer_lead: dict) -> float:
    """Returns 0-100 specs match (area, rooms, etc.)."""
    # Basic area check — if we have no specs, neutral
    if not seller_area:
        return 50
    # We don't have buyer area preference explicitly yet → neutral
    return 60

def calculate_match_score(seller: dict, buyer: dict) -> dict:
    """
    Calculate full match score between a seller and buyer lead.
    Returns score breakdown dict.
    """
    loc  = location_score(seller.get("location_ar"), buyer.get("location_ar"))
    typ  = type_score(seller.get("prop_type"), buyer.get("prop_type"))
    pri  = price_score(
        seller.get("price"),
        buyer.get("budget_min"),
        buyer.get("budget_max")
    )
    spc  = specs_score(seller.get("area_sqm"), buyer)

    total = (
        loc * WEIGHT_LOCATION / 100 +
        typ * WEIGHT_TYPE     / 100 +
        pri * WEIGHT_PRICE    / 100 +
        spc * WEIGHT_SPECS    / 100
    )

    return {
        "score":          round(total, 1),
        "score_location": round(loc, 1),
        "score_type":     round(typ, 1),
        "score_price":    round(pri, 1),
        "score_specs":    round(spc, 1),
    }

def run_matching(sellers: list, buyers: list) -> list:
    """
    Match all buyers to best sellers.
    Returns list of match dicts sorted by score desc.
    Only includes matches with score >= MIN_MATCH_SCORE.
    """
    matches = []
    for buyer in buyers:
        for seller in sellers:
            scores = calculate_match_score(seller, buyer)
            if scores["score"] >= MIN_MATCH_SCORE:
                matches.append({
                    "seller": seller,
                    "buyer":  buyer,
                    **scores,
                })

    # Sort by score descending
    matches.sort(key=lambda x: x["score"], reverse=True)

    # De-duplicate: don't pair same seller with same buyer twice
    seen = set()
    unique = []
    for m in matches:
        key = (m["seller"].get("id"), m["buyer"].get("id"))
        if key not in seen:
            seen.add(key)
            unique.append(m)

    return unique

def classify_match(score: float, seller_status: str, buyer_status: str) -> str:
    """Return ✅ / ⚠️ / ❌ classification."""
    if score >= GOOD_MATCH_SCORE and seller_status == "Seller Confirmed" and buyer_status == "Buyer Confirmed":
        return "✅ Full Confirmed"
    if score >= MIN_MATCH_SCORE and (seller_status in ("Pending", "Seller Confirmed") or
                                      buyer_status in ("Pending", "Buyer Confirmed")):
        return "⚠️ Needs Follow-up"
    return "❌ Not Suitable"
