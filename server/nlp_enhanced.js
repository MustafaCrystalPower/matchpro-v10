/**
 * MatchPro Enhanced NLP Parser — V1 algorithms ported to plain JS
 * Merged from Manus V1 TypeScript source (Feb 2026) + V3 (Mar 2026)
 * Owner: Mo'men Hisham Maisara / Crystal Power Investments
 */

const CAIRO_LOCATIONS = [
  // Core Cairo / Giza areas
  'التجمع الخامس','التجمع الاول','التجمع','الشيخ زايد','المعادي','مدينة نصر',
  'الرحاب','هليوبوليس','المنيل','الزمالك','مصر الجديدة','العبور',
  'القاهرة الجديدة','6 اكتوبر','الساحل الشمالي','العين السخنة','المقطم',
  'حدائق الاهرام','الشروق','بدر','العاشر من رمضان','المستقبل','العاصمة الادارية',
  'مدينتي','الغردقة','الاسكندرية','الجيزة','المهندسين','الدقي','عين شمس',
  'الوايلي','شبرا','امبابة','فيصل','الهرم','حلوان','حلوان الجديدة','المطرية',
  'السلام','البساتين','دار السلام','المرج','منشأة ناصر','الامير','الزيتون',
  'شيراتون','النزهة','مصر القديمة','المقطم','الموسكي','الدرب الاحمر',
  'new cairo','sheikh zayed','maadi','nasr city','rehab','heliopolis','madinaty',
  'zamalek','october','5th settlement','6th october','north coast','ain sokhna',
  'mokattam','shorouk','badr','10th of ramadan','new capital','tagamoa','giza',
  'alexandria','mohandeseen','dokki','obour','el obour','العبور',
  // Compounds (map to location)
  'ميفيدا','mivida','هايد بارك','hyde park','ماونتن فيو','mountain view',
  'ايستاون','eastown','كمبوند','بيستال','pistal','ميراكس','mirax',
  'بالم هيلز','palm hills','وادي دجلة','wadi degla','كيمار','camar',
  'الدار البيضاء','dar el beyda','اوكتوبر','اكتوبر','نيو زايد','new zayed',
  'الشيخ زايد الجديدة','ذا سيتي','the city','بلوم فيلدز','bloomfields',
  'زيد','zayed','سوديك','sodic','الفردوس','الحي الاول','الحي الثاني',
  'الحي العاشر','بيت الوطن','الانتصار','البنفسج','الياسمين','الفيروز',
  'زهراء المعادي','القطامية','قطامية','مدينة الرياضيين',
  // Saudi (for future expansion)
  'الرياض','جدة','الدمام','مكة','المدينة',
  // Coastal
  'مرسى مطروح','العلمين','رأس الحكمة','ras el hikma','الجونة','el gouna'
];

// Compound building codes → location (e.g. B6, Q1, L10 = مدينتي context cues)
const COMPOUND_CODE_PATTERNS = [
  // Madinaty building codes: B1-B15, Q1-Q10, L1-L12, N1-N5, Nour, Taim, Waha
  { pattern: /\b(?:B|Q|L|N)\d{1,2}\b|\bنور\b|\bتيم\b|\bواحة\b|\bماديناتى|مدينتى/i, location: 'مدينتي' },
  // Rehab phases
  { pattern: /\b(?:rehab|الرحاب)\s*\d+|phase\s*\d+.*rehab/i, location: 'الرحاب' },
  // Mivida / Hyde Park / Mountain View clusters
  { pattern: /\b(?:mivida|ميفيدا|ميفيدة)\b/i, location: 'القاهرة الجديدة' },
  { pattern: /\b(?:hyde park|هايد بارك|هايدبارك)\b/i, location: 'القاهرة الجديدة' },
  { pattern: /\b(?:mountain view|ماونتن فيو|ماونتن)\b/i, location: 'القاهرة الجديدة' },
  // Dreamland
  { pattern: /\b(?:dreamland|دريم لاند|دريملاند)\b/i, location: '6 اكتوبر' },
  // Privado (Madinaty)
  { pattern: /\b(?:privado|بريفادو|بريفادوا)\b/i, location: 'مدينتي' },
];

// Compound → canonical location mapping
const COMPOUND_TO_LOCATION = {
  'ميفيدا':'القاهرة الجديدة', 'mivida':'القاهرة الجديدة',
  'هايد بارك':'القاهرة الجديدة', 'hyde park':'القاهرة الجديدة',
  'ماونتن فيو':'القاهرة الجديدة', 'mountain view':'القاهرة الجديدة',
  'ايستاون':'القاهرة الجديدة', 'eastown':'القاهرة الجديدة',
  'بالم هيلز':'6 اكتوبر', 'palm hills':'6 اكتوبر',
  'وادي دجلة':'المعادي', 'wadi degla':'المعادي',
  'نيو زايد':'الشيخ زايد', 'new zayed':'الشيخ زايد',
  'بيستال':'مدينتي', 'pistal':'مدينتي',
  'بلوم فيلدز':'العاصمة الادارية', 'bloomfields':'العاصمة الادارية',
  'سوديك':'الشيخ زايد', 'sodic':'الشيخ زايد',
  'ذا سيتي':'القاهرة الجديدة', 'the city':'القاهرة الجديدة'
};

const PROPERTY_TYPES = {
  'شقة':'apartment','شقه':'apartment','apartment':'apartment','flat':'apartment','شقق':'apartment',
  'فيلا':'villa','villa':'villa','فيلات':'villa',
  'دوبلكس':'duplex','duplex':'duplex',
  'استوديو':'studio','studio':'studio',
  'بنتهاوس':'penthouse','penthouse':'penthouse',
  'أرض':'land','ارض':'land','land':'land',
  'محل':'shop','shop':'shop','store':'shop',
  'مكتب':'office','office':'office',
  'عمارة':'building','building':'building',
  'شاليه':'chalet','chalet':'chalet',
  'تاون هاوس':'townhouse','townhouse':'townhouse','تاون':'townhouse',
  'توين هاوس':'twin house','twin house':'twin house','توين':'twin house'
};

const SUPPLY_KEYWORDS = [
  'للبيع','للإيجار','للايجار','متاح','متوفر','عرض','اعلان','إعلان',
  'يباع','يؤجر','بيع','تأجير','تاجير','عندي','معايا','معاي','مش هشتري',
  'for sale','for rent','available','offering','selling','renting out'
];

const DEMAND_KEYWORDS = [
  'مطلوب','ابحث عن','ابحث','محتاج','عايز','بدور على','بدور','اريد','أريد',
  'نفسي في','دور على','محتاجة','عايزة','ابحث عن',
  'looking for','need','want','searching','required','seeking','wanted'
];

function detectLanguage(text) {
  const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const englishChars = (text.match(/[a-zA-Z]/g) || []).length;
  if (arabicChars > englishChars * 2) return 'ar';
  if (englishChars > arabicChars * 2) return 'en';
  return 'mixed';
}

function extractPhoneNumber(text) {
  const patterns = [
    /(\+?2?0?1[0125][0-9]{8})/,
    /(01[0125][0-9]{8})/,
    /(\+20\s?1[0125]\s?\d{4}\s?\d{4})/
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let phone = match[1].replace(/\s/g, '');
      phone = phone.replace(/^\+?20/, '0');
      if (!phone.startsWith('0')) phone = '0' + phone;
      return phone;
    }
  }
  return null;
}

function extractPrice(text) {
  const textLower = text.toLowerCase();
  
  // Millions pattern — FIX: removed 'm\b' to prevent area sizes (e.g. "135m", "180m")
  // from being parsed as millions. Use only explicit 'مليون' or 'million'.
  // Note: \b doesn't work with Arabic unicode; use negative lookahead for letters.
  const millionPattern = /(\d+(?:[.,]\d+)?)\s*(?:مليون|million)(?![a-zA-Z])/i;
  const millionMatch = text.match(millionPattern);
  if (millionMatch) {
    return parseFloat(millionMatch[1].replace(',', '.')) * 1000000;
  }
  
  // Thousands pattern
  const thousandPattern = /(\d+(?:[.,]\d+)?)\s*(?:الف|ألف|thousand|k\b)/i;
  const thousandMatch = text.match(thousandPattern);
  if (thousandMatch) {
    return parseFloat(thousandMatch[1].replace(',', '.')) * 1000;
  }
  
  // Raw number with currency
  const currencyPattern = /(\d+(?:[,.]?\d+)*)\s*(?:جنيه|egp|le\b|pound)/i;
  const currencyMatch = text.match(currencyPattern);
  if (currencyMatch) {
    return parseFloat(currencyMatch[1].replace(/,/g, ''));
  }

  // Large raw numbers (likely price)
  const largeNumPattern = /\b(\d{1,3}(?:,\d{3})+|\d{6,})\b/;
  const largeMatch = text.match(largeNumPattern);
  if (largeMatch) {
    return parseFloat(largeMatch[1].replace(/,/g, ''));
  }
  
  return null;
}

function extractBedrooms(text) {
  const patterns = [
    /(\d+)\s*(?:غرف|غرفة|غرف نوم|اوض|أوضة|bedroom|bed|br\b|room)/i,
    /(\d+)\s*(?:rooms|room)/i,
    /(?:غرف|غرفة|اوض|أوضة)\s*(\d+)/i
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return parseInt(m[1] || m[2]);
  }
  return null;
}

function extractSize(text) {
  const patterns = [
    /(\d+)\s*(?:متر|م2|م²|sqm|sq\.?m|meter|metre)/i,
    /(\d+)\s*(?:m2|m²)/i
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return parseInt(m[1]);
  }
  return null;
}

// Simple Levenshtein distance for fuzzy matching
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({length:m+1}, (_,i) => Array.from({length:n+1}, (_,j) => i===0?j:j===0?i:0));
  for (let i=1;i<=m;i++) for (let j=1;j<=n;j++)
    dp[i][j] = a[i-1]===b[j-1] ? dp[i-1][j-1] : 1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1]);
  return dp[m][n];
}

function extractLocation(text) {
  const textLower = text.toLowerCase();

  // 0) Check compound code patterns (B8, Q1 Nour, Privado etc.)
  for (const { pattern, location } of COMPOUND_CODE_PATTERNS) {
    if (pattern.test(text)) return location;
  }

  // 1) Check compound → location mapping first
  for (const [compound, canonical] of Object.entries(COMPOUND_TO_LOCATION)) {
    if (textLower.includes(compound.toLowerCase())) return canonical;
  }

  // 2) Exact substring match (longer locations first = more specific)
  const sorted = [...CAIRO_LOCATIONS].sort((a, b) => b.length - a.length);
  for (const loc of sorted) {
    if (textLower.includes(loc.toLowerCase())) return loc;
  }

  // 3) Fuzzy word-level match (Levenshtein ≤ 2 on individual words)
  const words = textLower.split(/[\s،,./]+/).filter(w => w.length >= 4);
  let bestLoc = null, bestDist = 3;
  for (const loc of sorted) {
    const locWords = loc.toLowerCase().split(/\s+/);
    for (const word of words) {
      for (const lw of locWords) {
        if (lw.length >= 4) {
          const d = levenshtein(word, lw);
          if (d < bestDist && d <= Math.floor(lw.length / 3)) {
            bestDist = d; bestLoc = loc;
          }
        }
      }
    }
  }
  if (bestLoc) return bestLoc;

  // 4) Reject generic non-specific terms
  const rejectList = ['egypt','مصر','cairo','القاهرة','الجمهورية','city','مدينة'];
  return null;
}

function extractPropertyType(text) {
  const textLower = text.toLowerCase();
  for (const [key, value] of Object.entries(PROPERTY_TYPES)) {
    if (textLower.includes(key.toLowerCase())) return value;
  }
  return null;
}

function extractPurpose(text) {
  const textLower = text.toLowerCase();
  if (textLower.match(/للبيع|for sale|بيع|يباع/)) return 'sale';
  if (textLower.match(/للايجار|للإيجار|for rent|إيجار|ايجار|يؤجر/)) return 'rent';
  return null;
}

/**
 * extractContactName — looks for Arabic/English contact-name patterns
 * e.g. "اسألوا محمد" / "التواصل مع أحمد" / "contact: Mahmoud"
 */
function extractContactName(text) {
  const patterns = [
    /اسأل(?:وا?|ي)?\s+([^\s\d،,\n.]{2,20})/i,
    /التواصل\s+مع\s+([^\s\d،,\n.]{2,20})/i,
    /تواصل(?:وا?)?\s+مع\s+([^\s\d،,\n.]{2,20})/i,
    /للتواصل\s*[:：]?\s*([^\s\d،,\n.]{2,20})/i,
    /contact\s*[:：]\s*([^\s\d،,\n.]{2,30})/i,
    /اسم(?:ه|ها|ي)?\s*[:：]?\s*([^\s\d،,\n.]{2,20})/i,
    /الاسم\s*[:：]?\s*([^\s\d،,\n.]{2,20})/i,
    /(?:م\/|أ\/|مهندس|دكتور|dr\.?|eng\.?)\s*([^\s\d،,\n.]{2,25})/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1]) {
      const name = m[1].trim().replace(/[.،,]$/, '');
      if (name.length >= 2) return name;
    }
  }
  return null;
}

/**
 * Extract location hint from WhatsApp group name
 */
function extractLocationFromGroupName(groupName) {
  if (!groupName) return null;
  // Check compound codes in group name
  for (const { pattern, location } of COMPOUND_CODE_PATTERNS) {
    if (pattern.test(groupName)) return location;
  }
  // Check compound mapping
  const gLower = groupName.toLowerCase();
  for (const [compound, canonical] of Object.entries(COMPOUND_TO_LOCATION)) {
    if (gLower.includes(compound.toLowerCase())) return canonical;
  }
  // Check direct location list
  const sorted = [...CAIRO_LOCATIONS].sort((a, b) => b.length - a.length);
  for (const loc of sorted) {
    if (gLower.includes(loc.toLowerCase())) return loc;
  }
  return null;
}

/**
 * Main parse function — enhanced V1 algorithm in pure JS
 */
function parseRealEstateMessage(text, groupName) {
  if (!text || text.trim().length < 5) {
    return { classification: 'unknown', confidence: 0 };
  }

  const textLower = text.toLowerCase();
  const language = detectLanguage(text);

  // Classification — with better mixed-message handling
  const isDemand = DEMAND_KEYWORDS.some(k => textLower.includes(k.toLowerCase()));
  const isSupply = SUPPLY_KEYWORDS.some(k => textLower.includes(k.toLowerCase()));
  let classification = 'unknown';
  if (isDemand && isSupply) {
    // Mixed: count demand vs supply lines to pick dominant type
    const lines = text.split(/\n+/);
    let demandLines = 0, supplyLines = 0;
    for (const line of lines) {
      const ll = line.toLowerCase();
      if (DEMAND_KEYWORDS.some(k => ll.includes(k.toLowerCase()))) demandLines++;
      if (SUPPLY_KEYWORDS.some(k => ll.includes(k.toLowerCase()))) supplyLines++;
    }
    classification = demandLines >= supplyLines ? 'demand' : 'supply';
  } else if (isDemand) {
    classification = 'demand';
  } else if (isSupply) {
    classification = 'supply';
  }

  // Extract fields
  const propertyType = extractPropertyType(text);
  const locationFromText = extractLocation(text);
  // Fallback: use group name as location hint if text has no location
  const location = locationFromText || extractLocationFromGroupName(groupName);
  const price = extractPrice(text);
  const bedrooms = extractBedrooms(text);
  const size = extractSize(text);
  const purpose = extractPurpose(text);
  const contact = extractPhoneNumber(text);
  const contactName = extractContactName(text);

  // Confidence scoring
  let confidence = 0.3;
  if (classification !== 'unknown') confidence += 0.2;
  if (propertyType) confidence += 0.15;
  if (location) confidence += 0.2;
  if (price) confidence += 0.1;
  if (bedrooms) confidence += 0.05;
  if (contact) confidence += 0.05;
  confidence = Math.min(confidence, 0.95);

  return {
    classification,
    language,
    propertyType,
    location,
    area: location,
    city: 'Cairo',
    price: classification === 'supply' ? price : null,
    priceMin: classification === 'demand' ? (price ? price * 0.8 : null) : null,
    priceMax: classification === 'demand' ? price : null,
    priceUnit: purpose === 'rent' ? 'per_month' : 'total',
    size,
    bedrooms,
    bathrooms: null,
    floor: null,
    purpose,
    contact,
    contactName,
    features: [],
    confidence
  };
}

module.exports = {
  parseRealEstateMessage,
  detectLanguage,
  extractPhoneNumber,
  extractContactName,
  CAIRO_LOCATIONS,
  COMPOUND_TO_LOCATION,
};
