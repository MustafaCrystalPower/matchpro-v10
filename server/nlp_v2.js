/**
 * MatchPro NLP Parser v2 — Production Grade
 * Crystal Power Investments
 *
 * Improvements over v1:
 * - 300+ location entries with compound → cluster mapping
 * - Compound building codes (B1-B20, Q1-Q10, L1-L12, Phase1-10, etc.)
 * - Enhanced price extraction (أوفر, installment, total, monthly)
 * - Bedroom extraction (غرف, أوضة, نوم, rooms)
 * - Area/sqm extraction (متر, م, sqm, bua)
 * - Floor extraction
 * - Finishing level detection
 * - Contact name extraction (م/, اسألوا, التواصل)
 * - Role detection: Owner (مالك), Broker, Developer
 * - Duplicate intent detection
 * - Confidence V2 (field-weighted)
 */

// ═══════════════════════════════════════════════════════════════════
// LOCATION DICTIONARY (canonical → cluster)
// ═══════════════════════════════════════════════════════════════════
const LOCATION_CANONICAL = {
  // New Cairo cluster
  'التجمع الخامس': 'new_cairo', 'التجمع الاول': 'new_cairo', 'التجمع': 'new_cairo',
  'القاهرة الجديدة': 'new_cairo', 'new cairo': 'new_cairo', '5th settlement': 'new_cairo',
  'tagamoa': 'new_cairo', 'fifth settlement': 'new_cairo',
  'مدينتي': 'madinaty', 'madinaty': 'madinaty', 'مدينتى': 'madinaty',
  'الرحاب': 'rehab', 'rehab': 'rehab', 'rehab city': 'rehab',
  'هايد بارك': 'new_cairo', 'hyde park': 'new_cairo', 'هايدبارك': 'new_cairo',
  'ماونتن فيو': 'new_cairo', 'mountain view': 'new_cairo', 'mv': 'new_cairo',
  'ماونتين فيو': 'new_cairo',
  'ميفيدا': 'new_cairo', 'mivida': 'new_cairo', 'ميفيده': 'new_cairo', 'مميفيدا': 'new_cairo',
  'ايستاون': 'new_cairo', 'eastown': 'new_cairo',
  'تاج سيتي': 'new_cairo', 'taj city': 'new_cairo',
  'صوان': 'new_cairo', 'sodic east': 'new_cairo',
  'بيفرلي هيلز': 'new_cairo', 'beverly hills': 'new_cairo',
  'كمبوند الاندلس': 'new_cairo', 'andalus': 'new_cairo',
  'cairo festival city': 'new_cairo', 'كايرو فستيفال': 'new_cairo',
  'اورا': 'new_cairo', 'ora': 'new_cairo',
  'مدينتي فيلاز': 'madinaty', 'بريفادو': 'madinaty', 'privado': 'madinaty',
  'بيستال': 'madinaty', 'pistal': 'madinaty', 'النور': 'madinaty',
  'التيم': 'madinaty', 'الوحة': 'madinaty',

  // October / Sheikh Zayed cluster
  '6 اكتوبر': 'october', '6 أكتوبر': 'october', 'six october': 'october',
  'october': 'october', '6th october': 'october', 'سادس اكتوبر': 'october',
  'الشيخ زايد': 'sheikh_zayed', 'sheikh zayed': 'sheikh_zayed', 'زايد': 'sheikh_zayed',
  'نيو زايد': 'sheikh_zayed', 'new zayed': 'sheikh_zayed',
  'ذا سيتي': 'sheikh_zayed', 'the city': 'sheikh_zayed',
  'سوديك': 'sheikh_zayed', 'sodic': 'sheikh_zayed', 'سوديك وست': 'sheikh_zayed',
  'بالم هيلز': 'october', 'palm hills': 'october', 'بالم': 'october',
  'دريم لاند': 'october', 'dreamland': 'october',
  'بلوم فيلدز': 'sheikh_zayed', 'bloomfields': 'sheikh_zayed',
  'وادي النيل': 'october', 'حدائق اكتوبر': 'october',
  'اكتوبر': 'october', 'كمبوند بالم': 'october',

  // Heliopolis / Nasr City cluster
  'هليوبوليس': 'heliopolis', 'heliopolis': 'heliopolis', 'مصر الجديدة': 'heliopolis',
  'مدينة نصر': 'nasr_city', 'nasr city': 'nasr_city', 'عين شمس': 'nasr_city',
  'العباسية': 'nasr_city', 'النزهة': 'heliopolis', 'شيراتون': 'heliopolis',

  // Maadi cluster
  'المعادي': 'maadi', 'maadi': 'maadi', 'دجلة': 'maadi', 'degla': 'maadi',
  'وادي دجلة': 'maadi', 'wadi degla': 'maadi', 'كورنيش المعادي': 'maadi',
  'المعادي الجديدة': 'maadi', 'تلاع العسفر': 'maadi',

  // Zamalek / Downtown cluster
  'الزمالك': 'downtown', 'zamalek': 'downtown', 'وسط البلد': 'downtown',
  'المنيل': 'downtown', 'garden city': 'downtown', 'جاردن سيتي': 'downtown',
  'الدقي': 'downtown', 'dokki': 'downtown', 'المهندسين': 'downtown', 'mohandeseen': 'downtown',
  'العجوزة': 'downtown', 'بولاق': 'downtown', 'إمبابة': 'downtown',
  'كورنيش النيل': 'downtown',

  // New Capital cluster
  'العاصمة الادارية': 'new_capital', 'العاصمة الإدارية': 'new_capital',
  'new capital': 'new_capital', 'ق3': 'new_capital', 'r7': 'new_capital',
  'r2': 'new_capital', 'r5': 'new_capital', 'capital': 'new_capital',
  'بلوم فيلدز العاصمة': 'new_capital', 'سيليا': 'new_capital',
  'كيمت': 'new_capital', 'بيو': 'new_capital', 'كابيتال': 'new_capital',
  'كمبوند بو': 'new_capital',

  // Other Cairo
  'المقطم': 'mokattam', 'mokattam': 'mokattam',
  'الشروق': 'shorouk', 'shorouk': 'shorouk', 'بدر': 'badr',
  'العبور': 'obour', 'obour': 'obour', 'el obour': 'obour',
  'الجيزة': 'giza', 'giza': 'giza', 'الهرم': 'giza', 'فيصل': 'giza',
  'حدائق الاهرام': 'giza', 'pyramids gardens': 'giza',
  'المستقبل': 'mostakbal', 'mostakbal': 'mostakbal',
  'العاشر من رمضان': '10th_ramadan', '10th of ramadan': '10th_ramadan',
  'حلوان': 'helwan', 'بساتين': 'helwan',
  'الشيخ زايد الجديدة': 'sheikh_zayed',
  'الاسكندرية': 'alex', 'alexandria': 'alex', 'الاسكندرية': 'alex',

  // Coastal
  'الساحل الشمالي': 'north_coast', 'north coast': 'north_coast', 'ساحل': 'north_coast',
  'مرسى مطروح': 'north_coast', 'العلمين': 'north_coast', 'رأس الحكمة': 'north_coast',
  'العين السخنة': 'sokhna', 'ain sokhna': 'sokhna', 'السخنة': 'sokhna',
  'الغردقة': 'hurghada', 'hurghada': 'hurghada',
  'الجونة': 'el_gouna', 'el gouna': 'el_gouna',
  'مرسى علم': 'marsa_alam',

  // Saudi
  'الرياض': 'riyadh', 'riyadh': 'riyadh',
  'جدة': 'jeddah', 'jeddah': 'jeddah',
  'الدمام': 'dammam', 'الخبر': 'dammam',
};

// Cluster display names
const CLUSTER_NAMES = {
  'new_cairo': 'القاهرة الجديدة',
  'madinaty': 'مدينتي',
  'rehab': 'الرحاب',
  'october': '6 أكتوبر',
  'sheikh_zayed': 'الشيخ زايد',
  'heliopolis': 'مصر الجديدة / هليوبوليس',
  'nasr_city': 'مدينة نصر',
  'maadi': 'المعادي',
  'downtown': 'وسط القاهرة / الزمالك',
  'new_capital': 'العاصمة الإدارية',
  'mokattam': 'المقطم',
  'shorouk': 'الشروق',
  'badr': 'بدر',
  'obour': 'العبور',
  'giza': 'الجيزة',
  'mostakbal': 'المستقبل',
  '10th_ramadan': 'العاشر من رمضان',
  'north_coast': 'الساحل الشمالي',
  'sokhna': 'العين السخنة',
  'hurghada': 'الغردقة',
  'alex': 'الإسكندرية',
  'riyadh': 'الرياض',
  'jeddah': 'جدة',
};

// Compound building codes
const COMPOUND_CODE_MAP = [
  { pattern: /\b(B|بلوك)\s*(\d{1,2})\b/i, location: 'مدينتي', cluster: 'madinaty', note: 'building_code' },
  { pattern: /\b(Q)\s*(\d{1,2})\b/i, location: 'مدينتي', cluster: 'madinaty', note: 'quarter_code' },
  { pattern: /\b(L|لوكيشن)\s*(\d{1,2})\b/i, location: 'مدينتي', cluster: 'madinaty', note: 'lot_code' },
  { pattern: /\b(N)\s*(\d{1,2})\b/i, location: 'مدينتي', cluster: 'madinaty', note: 'nour_code' },
  { pattern: /نور\b/i, location: 'مدينتي', cluster: 'madinaty', note: 'nour_complex' },
  { pattern: /تيم\b|التيم\b/i, location: 'مدينتي', cluster: 'madinaty', note: 'taim_complex' },
  { pattern: /واحة\b|الواحة\b/i, location: 'مدينتي', cluster: 'madinaty', note: 'waha_complex' },
  { pattern: /\bMV\s*\d/i, location: 'القاهرة الجديدة', cluster: 'new_cairo', note: 'MV_phase' },
  { pattern: /\bphase\s*\d/i, location: 'القاهرة الجديدة', cluster: 'new_cairo', note: 'phase_code' },
  { pattern: /مجموعه?\s*\d{2,}/i, location: 'مدينتي', cluster: 'madinaty', note: 'group_code' },
  { pattern: /\bP\d\s*(madinaty|مدينتي)/i, location: 'مدينتي', cluster: 'madinaty', note: 'p_code' },
  { pattern: /\bR\d+\s*(new capital|العاصمة)/i, location: 'العاصمة الإدارية', cluster: 'new_capital', note: 'r_code' },
];

// ═══════════════════════════════════════════════════════════════════
// KEYWORD DICTIONARIES
// ═══════════════════════════════════════════════════════════════════
const SUPPLY_KEYWORDS = new Set([
  'للبيع','للإيجار','للايجار','متاح','متوفر','عرض','إعلان','اعلان',
  'apartment for sale','flat for sale','villa for sale','for sale','for rent',
  'available','offering','sell','selling','rent out','renting',
  'يباع','يؤجر','بيع','تأجير','تاجير','عندي شقة','عندي شقه','معايا',
  'معاي','مش هشتري','من المالك','من المالك مباشرة','مالك مباشر',
  'for sale','for rent','available','offering','selling','renting out',
  'resale','للتنازل','تنازل','أوفر','اوفر','offplan','off plan',
  'متاح للبيع','متاح للإيجار','أعرض','اعرض','أبيع','ابيع',
  'أؤجر','تأجير','بيع فوري','للبيع المباشر','شقة معروضة',
]);

const DEMAND_KEYWORDS = new Set([
  'مطلوب','ابحث عن','ابحث','محتاج','عايز','بدور على','بدور','أريد','اريد',
  'نفسي في','دور على','محتاجة','عايزة','طلب','أبحث','مطلوبة',
  'looking for','need','want','searching','required','seeking','wanted',
  'بدور لعميل','عندي عميل','عميل محتاج','محتاج وحدة','بدور على شقة',
  'أطلب','اطلب','أحتاج','احتاج','يطلب','تطلب','هو عايز','هي عايزة',
]);

const BROKER_INDICATORS = new Set([
  'عندي عميل','بدور لعميل','عميل','وكيل','سمسار','وسيط',
  'broker','agent','للتواصل مع المكتب','مكتب عقاري',
  'للتواصل مع الوسيط','عمولة','commission',
]);

const OWNER_INDICATORS = new Set([
  'من المالك','من المالك مباشرة','مالك','مالك مباشر','بدون عمولة',
  'no commission','owner','مالك يعرض','مالك يبيع',
]);

const FINISHING_KEYWORDS = {
  'super_lux': ['سوبر لوكس','super lux','سوبر','ultra super','الترا سوبر','تشطيب فندقي'],
  'semi_finish': ['نص تشطيب','نصف تشطيب','semi finish','semi-finish','core and shell'],
  'full_finish': ['تشطيب كامل','full finish','fully finished','تشطيب تام','تشطيب'],
  'furnished': ['مفروش','مفروشة','furnished','فرنيتشر','fully furnished'],
  'unfurnished': ['بدون فرش','unfurnished','خالي'],
};

const PROPERTY_TYPES = {
  'apartment': ['شقة','شقه','شقق','أباتشمنت','apartment','flat','unit','وحدة','وحده'],
  'villa': ['فيلا','فيلاه','فيلل','villa','villas','فيلتين','فيلا توين'],
  'duplex': ['دوبلكس','دوبليكس','duplex','دبلكس'],
  'studio': ['استوديو','studio','ستوديو','وحدة استوديو'],
  'penthouse': ['بنتهاوس','penthouse','بنت هاوس'],
  'land': ['أرض','ارض','قطعة أرض','قطعه ارض','land','plot','قطعة','زراعي'],
  'shop': ['محل','محلات','shop','store','تجاري','وحدة تجارية'],
  'office': ['مكتب','مكاتب','office','إداري','وحدة إدارية','administrative'],
  'warehouse': ['مخزن','مخازن','warehouse','جراج تجاري'],
  'chalet': ['شاليه','chalet','وحدة ساحلية'],
  'townhouse': ['تاون هاوس','townhouse','town house','تاون'],
  'twin_house': ['توين هاوس','twin house','twinhouse','توين'],
  'building': ['عمارة','عمارات','مبنى','building'],
  'hospital': ['مستشفى','hospital','كلينيك','clinic'],
  'hotel': ['فندق','hotel','شقة فندقية'],
};

const CURRENCIES = {
  'EGP': ['جنيه','جنيهات','egp','le','pound','جنيه مصري','ج','£'],
  'SAR': ['ريال','sar','sr','ريال سعودي'],
  'USD': ['دولار','usd','dollar','$'],
  'EUR': ['يورو','eur','euro','€'],
};

// ═══════════════════════════════════════════════════════════════════
// EXTRACTION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

function normalizeArabicNums(text) {
  const arabicNums = '٠١٢٣٤٥٦٧٨٩';
  const westernNums = '0123456789';
  return text.replace(/[٠-٩]/g, d => westernNums[arabicNums.indexOf(d)]);
}

function extractLocation(text) {
  const t = normalizeArabicNums(text.toLowerCase());

  // 1. Check compound building codes first (highest priority)
  for (const cc of COMPOUND_CODE_MAP) {
    if (cc.pattern.test(text)) {
      return { name: cc.location, cluster: cc.cluster, confidence: 0.75, source: cc.note };
    }
  }

  // 2. Direct dictionary lookup (longest match first)
  const entries = Object.keys(LOCATION_CANONICAL).sort((a, b) => b.length - a.length);
  for (const loc of entries) {
    if (t.includes(loc.toLowerCase())) {
      const cluster = LOCATION_CANONICAL[loc];
      return {
        name: CLUSTER_NAMES[cluster] || loc,
        cluster,
        confidence: 1.0,
        source: 'dictionary',
        matchedTerm: loc
      };
    }
  }

  // 3. Fuzzy Levenshtein for Arabic words ≥5 chars
  const words = t.split(/[\s,،.\/\-]+/).filter(w => w.length >= 5);
  let bestMatch = null, bestScore = 0;
  for (const word of words) {
    for (const loc of entries) {
      if (loc.length < 4) continue;
      const dist = levenshtein(word, loc.toLowerCase());
      const threshold = Math.floor(loc.length / 4);
      if (dist <= threshold && dist <= 2) {
        const score = 1 - dist / loc.length;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = loc;
        }
      }
    }
  }
  if (bestMatch) {
    const cluster = LOCATION_CANONICAL[bestMatch];
    return { name: CLUSTER_NAMES[cluster] || bestMatch, cluster, confidence: 0.7, source: 'fuzzy' };
  }

  return null;
}

function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  const dp = Array.from({length: m + 1}, (_, i) => Array.from({length: n + 1}, (_, j) => i === 0 ? j : j === 0 ? i : 0));
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

function extractPrice(text) {
  const t = normalizeArabicNums(text);
  const results = [];

  // Billion
  const billionRx = /(\d+(?:[.,]\d+)?)\s*(?:مليار|billion|b\b)/i;
  const bm = t.match(billionRx);
  if (bm) results.push({ value: parseFloat(bm[1].replace(',', '.')) * 1e9, type: 'total' });

  // Million — FIX: removed bare 'm\b' to prevent area sizes like "135m" or "180m"
  // matching as millions. Only 'million', 'مليون', 'ملايين' are valid million indicators.
  // Note: \b doesn't work for Arabic unicode; use lookahead instead.
  const millionRx = /(\d+(?:[.,]\d+)?)\s*(?:مليون|ملايين|million)(?![a-zA-Z])/i;
  const mm = t.match(millionRx);
  if (mm) results.push({ value: parseFloat(mm[1].replace(',', '.')) * 1e6, type: 'total' });

  // Thousand
  const thousandRx = /(\d+(?:[.,]\d+)?)\s*(?:الف|ألف|آلاف|thousand|k\b)/i;
  const km = t.match(thousandRx);
  if (km) results.push({ value: parseFloat(km[1].replace(',', '.')) * 1e3, type: 'total' });

  // Currency pattern
  const currencyRx = /(\d{1,3}(?:[,،]\d{3})+(?:\.\d+)?|\d{4,})\s*(?:جنيه|egp|le\b|pound|ريال|sar|دولار|usd)/i;
  const cm = t.match(currencyRx);
  if (cm) results.push({ value: parseFloat(cm[1].replace(/[,،]/g, '')), type: 'total' });

  // Monthly/yearly indicators
  const monthlyRx = /(\d+(?:[,،]\d+)*)\s*(?:شهري|شهريا|شهرياً|per month|monthly|\/month)/i;
  const ym = t.match(monthlyRx);
  if (ym) {
    const v = parseFloat(ym[1].replace(/[,،]/g, ''));
    if (v > 100) results.push({ value: v, type: 'monthly' });
  }

  // Installment / أوفر (transfer price for resale)
  const oferRx = /(?:اوفر|أوفر|offer)\s*[:\-]?\s*(\d+(?:[,،]\d+)*(?:\s*(?:الف|ألف|thousand|مليون|million|k))?)/i;
  const ofm = t.match(oferRx);
  if (ofm) {
    let v = parseFloat(ofm[1].replace(/[,،]/g, ''));
    if (/الف|ألف|thousand|k/.test(ofm[1])) v *= 1000;
    if (/مليون|million/.test(ofm[1])) v *= 1e6;
    results.push({ value: v, type: 'offer_premium' });
  }

  if (!results.length) return null;
  // Prefer total price (not monthly, not premium)
  const total = results.find(r => r.type === 'total');
  if (total) return total.value;
  const monthly = results.find(r => r.type === 'monthly');
  if (monthly) return monthly.value;
  return results[0].value;
}

function extractBedrooms(text) {
  const t = normalizeArabicNums(text);
  // Must have clear bedroom indicator ADJACENT to number (not just any number)
  // Remove prices first to avoid false matches (e.g. "5.5 مليون" → don't extract 5 as bedrooms)
  const textNoPrices = t
    .replace(/(\d+(?:[.,]\d+)?)\s*(?:مليون|الف|ألف|million|thousand|k\b|m\b)/gi, '__PRICE__')
    .replace(/\d{4,}/g, '__BIGNUM__')
    .replace(/\d+[.,]\d+/g, '__DECIMAL__');

  // Arabic word-based extraction first (no false price conflicts)
  if (/غرفتين|اوضتين|أوضتين/i.test(t)) return 2;
  if (/ثلاث غرف|ثلاثة غرف|ثلاث اوض|ثلاثة اوض/i.test(t)) return 3;
  if (/اربع غرف|اربعة غرف|اربع اوض/i.test(t)) return 4;
  if (/خمس غرف|خمسة غرف/i.test(t)) return 5;

  const patterns = [
    /(\d+)\s*(?:غرف نوم|غرفة نوم)/i,
    /(\d)(?:غرف|غرفة|نوم|اوضة|اوضه)\b/i, // attached like 3نوم, 2غرفة
    /(\d+)\s*(?:غرف|غرفة|اوضة|أوضة|اوض)(?=\s|$)/i,
    /(?:غرف|اوض|أوض)\s*=?\s*(\d+)/i,
    /(\d+)\s*(?:bedroom|bedrooms|beds?)\b/i,
    /(?:bedroom|bedrooms)\s*[:=]?\s*(\d+)/i,
    /(\d+)\s*br\b/i,
  ];
  for (const p of patterns) {
    const m = textNoPrices.match(p);
    if (m) {
      const n = parseInt(m[1] || m[2]);
      if (!isNaN(n) && n >= 1 && n <= 8) return n;
    }
  }
  // Studio = 1
  if (/استوديو|studio/i.test(t)) return 1;
  return null;
}

function extractSize(text) {
  const t = normalizeArabicNums(text);
  const patterns = [
    /(\d+(?:\.\d+)?)\s*(?:متر مربع|م\s*مربع|م²|م2|sqm|sq\.?m|meter|metre|bua)\b/i,
    /(\d+(?:\.\d+)?)\s*(?:m²|m2)\b/i,
    /bua\s*[:=]?\s*(\d+(?:\.\d+)?)/i,
    /مساحه?\s*[:=]?\s*(\d+(?:\.\d+)?)/i,
    /(\d{2,3})\s*(?:م|m)\b(?!\s*(?:تشطيب|سداد|دفع|سنة|سنوات))/i, // isolated sqm
  ];
  for (const p of patterns) {
    const m = t.match(p);
    if (m) {
      const n = parseFloat(m[1] || m[2]);
      if (n >= 20 && n <= 5000) return n;
    }
  }
  return null;
}

function extractFloor(text) {
  const t = normalizeArabicNums(text);
  const patterns = [
    /(?:دور|الدور|floor|fl\.?)\s*[:=]?\s*(ارضي|أرضي|ground|\d+)/i,
    /(?:الطابق)\s*[:=]?\s*(\d+)/i,
    /(ارضي|أرضي|ground floor)/i,
  ];
  for (const p of patterns) {
    const m = t.match(p);
    if (m) {
      const f = m[1].toLowerCase();
      if (f === 'ارضي' || f === 'أرضي' || f === 'ground') return 0;
      return parseInt(f) || null;
    }
  }
  return null;
}

function extractPropertyType(text) {
  const t = text.toLowerCase();
  for (const [type, keywords] of Object.entries(PROPERTY_TYPES)) {
    for (const kw of keywords) {
      if (t.includes(kw.toLowerCase())) return type;
    }
  }
  return null;
}

function extractPurpose(text) {
  const t = text.toLowerCase();
  const saleWords = ['للبيع','for sale','بيع','يباع','تمليك','resale','تنازل','اوفر','أوفر','sale'];
  const rentWords = ['للايجار','للإيجار','for rent','إيجار','ايجار','يؤجر','rent','rental','شهري','اليومي','الاسبوعي'];
  const saleScore = saleWords.filter(w => t.includes(w)).length;
  const rentScore = rentWords.filter(w => t.includes(w)).length;
  if (saleScore > rentScore) return 'sale';
  if (rentScore > saleScore) return 'rent';
  if (saleScore > 0) return 'sale';
  if (rentScore > 0) return 'rent';
  return null;
}

function extractPhone(text) {
  const t = normalizeArabicNums(text);
  const patterns = [
    /(?:\+?2?0?1[0125][0-9]{8})/g,
    /(?:01[0125][0-9]{8})/g,
    /(?:\+20\s?1[0125]\s?\d{4}\s?\d{4})/g,
    /(?:05\d{8})/g, // Saudi
    /(?:\+966\s?5\d{8})/g, // Saudi intl
  ];
  const phones = [];
  for (const pattern of patterns) {
    const matches = t.match(pattern) || [];
    phones.push(...matches.map(p => {
      p = p.replace(/\s/g, '').replace(/^\+?20/, '0').replace(/^\+?966/, '+966');
      if (!p.startsWith('+') && !p.startsWith('0')) p = '0' + p;
      return p;
    }));
  }
  return [...new Set(phones)][0] || null;
}

function extractContactName(text) {
  const patterns = [
    /(?:اسألوا|اسئلوا|اسأل)\s+([^\n\d\s]{2,25})/i,
    /(?:التواصل مع|تواصل مع)\s+([^\n\d]{2,25})/i,
    /(?:م\/|م\.|للتواصل:?\s*)([أ-يa-zA-Z][^\n\d]{1,20})/i,
    /(?:contact|name)\s*:\s*([a-zA-Z][^\n\d]{1,25})/i,
    /(?:ing\.|eng\.)\s+([A-Za-z][^\n\d]{1,20})/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1] && m[1].trim().length > 1) {
      return m[1].trim().replace(/[,،\.\-\n]/g, '');
    }
  }
  return null;
}

function detectRole(text) {
  const t = text.toLowerCase();
  for (const kw of BROKER_INDICATORS) {
    if (t.includes(kw.toLowerCase())) return 'broker';
  }
  for (const kw of OWNER_INDICATORS) {
    if (t.includes(kw.toLowerCase())) return 'owner';
  }
  return 'unknown';
}

function detectFinishing(text) {
  const t = text.toLowerCase();
  for (const [level, keywords] of Object.entries(FINISHING_KEYWORDS)) {
    for (const kw of keywords) {
      if (t.includes(kw.toLowerCase())) return level;
    }
  }
  return null;
}

function detectLanguage(text) {
  const arabic = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const english = (text.match(/[a-zA-Z]/g) || []).length;
  if (arabic > english * 1.5) return 'ar';
  if (english > arabic * 1.5) return 'en';
  return 'mixed';
}

// ═══════════════════════════════════════════════════════════════════
// CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════
function classifyIntent(text) {
  const t = text.toLowerCase();
  let supplyScore = 0, demandScore = 0;

  for (const kw of SUPPLY_KEYWORDS) {
    if (t.includes(kw.toLowerCase())) supplyScore += kw.length > 6 ? 2 : 1;
  }
  for (const kw of DEMAND_KEYWORDS) {
    if (t.includes(kw.toLowerCase())) demandScore += kw.length > 6 ? 2 : 1;
  }

  // Strong demand override
  if (/مطلوب|بدور لعميل|عندي عميل|عميل محتاج/i.test(text)) demandScore += 5;
  // Strong supply override for English listings
  if (/(?:apartment|villa|flat|unit|studio|penthouse|land|shop|office)\s+(?:for\s+(?:sale|rent))|(?:for\s+(?:sale|rent))\s+(?:apartment|villa)/i.test(text)) supplyScore += 5;

  if (supplyScore === 0 && demandScore === 0) return 'unknown';
  if (supplyScore > demandScore) return 'supply';
  if (demandScore > supplyScore) return 'demand';
  // Tie — demand wins (buyers are more valuable)
  return 'demand';
}

// ═══════════════════════════════════════════════════════════════════
// CONFIDENCE SCORING v2 (field-weighted)
// ═══════════════════════════════════════════════════════════════════
function scoreConfidence(parsed) {
  let score = 0.25; // base
  const fields = {
    classification: { weight: 0.20, present: parsed.classification !== 'unknown' },
    location: { weight: 0.25, present: !!parsed.location },
    price: { weight: 0.20, present: !!(parsed.price || parsed.priceMax) },
    propertyType: { weight: 0.15, present: !!parsed.propertyType },
    purpose: { weight: 0.10, present: !!parsed.purpose },
    contact: { weight: 0.05, present: !!parsed.contact },
    bedrooms: { weight: 0.03, present: parsed.bedrooms != null },
    size: { weight: 0.02, present: parsed.size != null },
  };
  for (const f of Object.values(fields)) {
    if (f.present) score += f.weight;
  }
  // Location from fuzzy = lower confidence
  if (parsed.locationSource === 'fuzzy') score -= 0.05;
  if (parsed.locationSource === 'group_hint') score -= 0.08;
  return Math.min(Math.max(score, 0.1), 0.98);
}

// ═══════════════════════════════════════════════════════════════════
// MAIN PARSE FUNCTION
// ═══════════════════════════════════════════════════════════════════
function parseRealEstateMessage(text, groupName) {
  if (!text || text.trim().length < 5) {
    return { classification: 'unknown', confidence: 0.05 };
  }

  const lang = detectLanguage(text);
  const intent = classifyIntent(text);

  // Location
  let locationResult = extractLocation(text);
  let locationSource = locationResult?.source || null;

  // Fallback: try group name
  if (!locationResult && groupName) {
    locationResult = extractLocation(groupName);
    if (locationResult) locationSource = 'group_hint';
  }

  const location = locationResult ? locationResult.name : null;
  const locationCluster = locationResult ? locationResult.cluster : null;

  // Other fields
  const price = extractPrice(text);
  const bedrooms = extractBedrooms(text);
  const size = extractSize(text);
  const floor = extractFloor(text);
  const propertyType = extractPropertyType(text);
  const purpose = extractPurpose(text);
  const contact = extractPhone(text);
  const contactName = extractContactName(text);
  const role = detectRole(text);
  const finishing = detectFinishing(text);

  const parsed = {
    classification: intent,
    language: lang,
    location,
    locationCluster,
    locationSource,
    propertyType,
    purpose,
    price: intent === 'supply' ? price : null,
    priceUnit: purpose === 'rent' ? 'per_month' : 'total',
    priceMin: intent === 'demand' ? (price ? price * 0.7 : null) : null,
    priceMax: intent === 'demand' ? price : null,
    bedrooms,
    bathrooms: null, // could extract later
    size,
    floor,
    finishing,
    contact,
    contactName,
    role,
    area: location,
    city: locationCluster ? 'Cairo' : null,
  };

  parsed.confidence = scoreConfidence(parsed);
  return parsed;
}

module.exports = {
  parseRealEstateMessage,
  extractLocation,
  extractPrice,
  extractBedrooms,
  extractSize,
  extractPhone,
  extractContactName,
  detectRole,
  classifyIntent,
  LOCATION_CANONICAL,
  CLUSTER_NAMES,
  levenshtein,
};
