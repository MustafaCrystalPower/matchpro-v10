"""
MatchPro Broker Detection Engine v2 — Revised per Mo'men's guidance
=================================================================
RULE (from Mo'men):
  - "مطلوب" at START + structured format = BROKER posting client's request (NOT a real client)
  - "متاح" / listings / emojis at start = BROKER listing
  - Perfect template format (short lines, budget, ضروري/تنفيذ) = BROKER template
  
  REAL CLIENT signals:
  - Personal voice: أنا عايز / محتاج / بدور / بفكر
  - Family situation: أسرة / ولاد / أطفال + their own words
  - Casual/messy writing — NOT a template
  - Foreign: Sudan / Gulf + personal story
  - Story-based: "كنت بدور على..." / "عندي ميزانية..."
  
The KEY insight: brokers post STRUCTURED requests on behalf of clients.
Real clients write PERSONAL, MESSY, STORY-BASED messages.
"""

import re

# ── BROKER PATTERNS (REVISED) ──────────────────────────────────

def count_structure_score(msg: str) -> float:
    """Higher score = more structured = more likely broker"""
    lines = [l.strip() for l in msg.split('\n') if l.strip()]
    if not lines:
        return 0.0
    
    score = 0.0
    n = len(lines)
    
    # Many short lines = structured template
    short_lines = sum(1 for l in lines if len(l) < 45)
    if n >= 4 and short_lines / n > 0.7:
        score += 2.0
    
    # Has budget line as separate line
    if any(re.search(r'^(بادج|budget|ميزانية|المبلغ|السعر)', l, re.I) for l in lines):
        score += 1.5
    
    # Has area/size as separate line
    if any(re.search(r'^\d+\s*م', l) for l in lines):
        score += 1.0
    
    # Ends with keywords like تنفيذ / ضروري on their own line
    if lines and re.match(r'^(تنفيذ|ضروري|عاجل|مهم)$', lines[-1].strip(), re.I):
        score += 1.5
    
    # Starts with مطلوب + structured
    if re.match(r'^مطلوب', msg.strip()):
        score += 1.0
    
    return score


# Hard broker name patterns
BROKER_NAME_PATTERNS = [
    r'real\s?estate', r'عقارات', r'بروكر', r'broker', r'وسيط', r'تسويق',
    r'مكتب\s+', r'شركة\s+', r'properties', r'realty',
    r'سمسار', r'وكيل\s+عقاري', r'للعقار', r'عقاري$', r'للتسويق',
    r'ريل\s+استيت', r'للتطوير',
]

# Hard broker message patterns
BROKER_MSG_PATTERNS = [
    # Listings start
    r'^[🏡🏠💎🔥✨📍]\s*(للبيع|للإيجار|للايجار|متاح|حصري|عرض)',
    r'^للبيع', r'^للإيجار', r'^للايجار', r'^متاح', r'^حصري',
    # Structured emoji bullets (broker listing format)
    r'🔹.+\n🔹', r'📐.+\n🛏', r'📍.+\n📐',
    # Advertising
    r'تواصل\s+معي\s+للمزيد', r'للتواصل\s+\d',
    r'فرصة\s+استثمارية', r'عرض\s+مميز',
    r'متاح\s+للتمليك', r'متاح\s+للبيع',
]

KNOWN_BROKER_NAMES = {
    'raedsharawi', 'رائد مكتب الروضة', 'amar deyap', 'john lnk',
    'prof. ahmed elsoghier', 'real estate marketing', 'real estate madeinty',
    'elegant house madinaty', 'التسويق العقاري', 'mo ashraf tiger realestate',
    'dar noah real estate', 'القيم للاستثمار', 'hani ibrahim',
    'garden 100 m', 'bassant ma7moud',
}


# ── REAL CLIENT PATTERNS ────────────────────────────────────────

CLIENT_PERSONAL_PATTERNS = [
    # Personal pronouns + need
    r'(^|\n)(أنا|انا)\s+(عايز|عايزه|محتاج|محتاجه|بدور|بفكر|بحث)',
    r'(عايز|عايزه|محتاج|محتاجه)\s+(أنا|انا)',
    r'(بدور|بفكر|بحث)\s+على',
    # Direct personal requests (not broker template)
    r'عندي\s+ميزانية', r'معايا\s+(مبلغ|كاش|فلوس)',
    r'(رح|هروح|هاخد|هجيب)\s+(شقة|وحدة|فيلا)',
    # Family situation — anywhere in message (personal story)
    r'(أسرة|اسره|اسرة|عائلة)\s+(سودانية|سودانيه|مصرية|مصريه|محترمة|نظيفة|نظيفه|خليجية|فلسطينية)',
    r'(أسرة|اسره|اسرة|عائلة)\s+\w+\s+(نظيف|محترم|خاص)',
    r'(أطفال|ولاد|ولادي|أهلي)',
    r'(متزوج|مع\s+زوجتي|مع\s+عيلتي)',
    # Foreign personal story
    r'(نازل|قادم|جاي)\s+من\s+(السعودية|الإمارات|دبي|السودان|كندا)',
    r'(مقيم|ساكن)\s+(السعودية|الإمارات|الخارج)',
    r'(سودانية|سودانيه)\s+(نظيف|محترم|خاص|تنفيذ)',
    r'أسره\s+سودانيه', r'اسرة\s+سودانية', r'أسرة\s+سودانية',
    r'أسره\s+مصريه', r'اسرة\s+مصرية',
    # Casual urgency (personal situation)
    r'(بكره|النهارده|دلوقتي)\s+(ضروري|محتاج|عايز)',
    r'تخليص\s+حالا', r'تنفيذ\s+فوري\s+من\s+(أنا|شخصي)',
    # محتاج without being a broker post
    r'^محتاج', r'^محتاجه',
    # Direct request with block/building but no structure
    r'(B\d+|بلوك\s+\d+).*\d+\s*م.*أسر',
]


def is_broker(sender_name: str, message: str) -> bool:
    name_lower = (sender_name or '').lower().strip()
    msg = (message or '').strip()

    # Known broker names
    for known in KNOWN_BROKER_NAMES:
        if known in name_lower:
            return True

    # Name patterns
    for pat in BROKER_NAME_PATTERNS:
        if re.search(pat, sender_name or '', re.IGNORECASE):
            return True

    # Message hard patterns
    for pat in BROKER_MSG_PATTERNS:
        if re.search(pat, msg, re.IGNORECASE | re.MULTILINE):
            return True

    # Structure score: >= 4.0 = very likely broker template
    if count_structure_score(msg) >= 4.0:
        return True

    # "مطلوب" + structure >= 3.0
    if re.match(r'^مطلوب', msg) and count_structure_score(msg) >= 2.5:
        return True

    return False


def is_real_client(sender_name: str, message: str) -> tuple:
    """Returns (bool, reason)"""
    msg = (message or '').strip()

    for pat in CLIENT_PERSONAL_PATTERNS:
        m = re.search(pat, msg, re.IGNORECASE)
        if m:
            return True, f"personal: {pat[:30]}"

    return False, "unknown"


def classify_message(sender_name: str, sender_phone: str, message: str) -> str:
    if is_broker(sender_name, message):
        return 'broker'
    client, _ = is_real_client(sender_name, message)
    if client:
        return 'client'
    return 'unknown'


# ── JS EXPORT ────────────────────────────────────────────────────
def write_js_module(path: str):
    js = r"""// brokerDetector.js — auto-generated from broker_detector.py v2
// Rule: mطلوب + structured = broker. Personal voice = real client.

const BROKER_NAME_PATTERNS = [
  /real\s?estate/i, /عقارات/, /بروكر/, /broker/i, /وسيط/, /تسويق/,
  /مكتب\s+/, /شركة\s+/, /properties/i, /realty/i,
  /سمسار/, /وكيل\s+عقاري/, /للعقار/, /عقاري$/, /للتسويق/,
];

const BROKER_MSG_HARD = [
  /^[🏡🏠💎🔥✨📍]\s*(للبيع|للإيجار|للايجار|متاح|حصري)/m,
  /^للبيع/m, /^للإيجار/m, /^متاح/m, /^حصري/m,
  /🔹.+\n🔹/, /تواصل\s+معي\s+للمزيد/,
  /فرصة\s+استثمارية/, /متاح\s+للتمليك/,
];

const KNOWN_BROKERS = new Set([
  'raedsharawi','رائد مكتب الروضة','amar deyap','john lnk',
  'real estate marketing','hani ibrahim','garden 100 m',
]);

const CLIENT_PERSONAL = [
  /(أنا|انا)\s+(عايز|عايزه|محتاج|بدور|بفكر)/,
  /عندي\s+ميزانية/, /معايا\s+(مبلغ|كاش)/,
  /(أسرة|اسرة|عائلة)\s+(سودانية|مصرية|محترمة|نظيفة)/,
  /(نازل|قادم|جاي)\s+من\s+(السعودية|الإمارات|دبي|السودان)/,
  /(مقيم|ساكن)\s+(السعودية|الإمارات|الخارج)/,
  /تخليص\s+حالا/,
];

function structureScore(msg) {
  const lines = msg.split('\n').map(l => l.trim()).filter(Boolean);
  let score = 0;
  const n = lines.length;
  if (n >= 4 && lines.filter(l => l.length < 45).length / n > 0.7) score += 2;
  if (lines.some(l => /^(بادج|budget|ميزانية)/i.test(l))) score += 1.5;
  if (lines.some(l => /^\d+\s*م/.test(l))) score += 1;
  if (lines.length && /^(تنفيذ|ضروري|عاجل)$/.test(lines[lines.length-1])) score += 1.5;
  if (/^مطلوب/.test(msg)) score += 1;
  return score;
}

function isBroker(name, msg) {
  const nameLow = (name||'').toLowerCase();
  if ([...KNOWN_BROKERS].some(k => nameLow.includes(k.toLowerCase()))) return true;
  if (BROKER_NAME_PATTERNS.some(p => p.test(name||''))) return true;
  if (BROKER_MSG_HARD.some(p => p.test(msg||''))) return true;
  if (structureScore(msg||'') >= 4) return true;
  if (/^مطلوب/.test(msg||'') && structureScore(msg||'') >= 2.5) return true;
  return false;
}

function isRealClient(name, msg) {
  return CLIENT_PERSONAL.some(p => p.test(msg||''));
}

function classifyMessage(name, phone, msg) {
  if (isBroker(name, msg)) return 'broker';
  if (isRealClient(name, msg)) return 'client';
  return 'unknown';
}

module.exports = { isBroker, isRealClient, classifyMessage, structureScore };
"""
    with open(path, 'w') as f:
        f.write(js)


if __name__ == '__main__':
    # Test
    tests = [
        ("Hani Ibrahim",    "201...", "مطلوب للتمليك بمدينتي\nمساحة 89م\nبادجت 4,500,000\nمعاينه بكره\nتنفيذ"),
        ("H ~",             "201095030268", "مطلوب ايجار قانون 165متر بمدينتي b10 ارضي بجاردن بادجيت 25 الف\nأسرة سودانية تنفيذ فوري"),
        ("صابر حسن",        "201...", "مطلوب شقه قانون فاضيه ارضى بجاردن 3 نوم و2 حمام فى B10/11/12 اسره سودانيه نظيفه وخاصة الحمامات بادجيت 30 الف"),
        ("ENG Ibrahim PRE", "01027430817", "مطلوب فيلا ايجار قانون مدينتي نموذج D3 اسره سودانيه بادجت 70,000"),
        ("يوسف",            "201...", "محتاجه شقه قانون 133 متر B11"),
        ("raedsharawi",     "201...", "🤩 متاح للتمليك بمدينتي 107م B1"),
        ("Amar Deyap",      "201...", "شقة للإيجار في بريفادو – أول سكن\nالمساحة: 133 متر\nالتقسيم: 3 غرف"),
        ("Bassant Ma7moud", "201...", "✨ شقة للإيجار بمساحة 124م في B6\n🔹 الدور الثالث\n🔹 3 غرف نوم"),
        ("Carlos Francisco","201...", "مطلوب قانون b12 مساحه ٧٨\nتنفيد أسرة مصرية"),
        ("انا لا اخاف",    "201...", "محتاجه شقه قانون 133 متر B11"),
    ]
    
    print("=== Broker Detector v2 — Test Results ===\n")
    for name, phone, msg in tests:
        result = classify_message(name, phone, msg)
        struct = count_structure_score(msg)
        print(f"[{result.upper():8}] struct={struct:.1f} | {name[:20]:20} | {msg[:60].replace(chr(10),' ')}")
    
    write_js_module('/home/work/.openclaw/workspace/matchpro-final/server/brokerDetector.js')
    print("\n✅ brokerDetector.js updated")
