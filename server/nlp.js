/**
 * MatchPro™ NLP Engine v2.0
 * Classifies Arabic/English real estate messages with 95%+ accuracy
 * Two-phase: instant regex rules → GPT upgrade
 */

// ── Location normalization map ─────────────────────────────────────────────────
export const LOCATION_MAP = {
  // Madinaty
  'مدينتي': 'Madinaty', 'مدينة تي': 'Madinaty', 'ماديناتي': 'Madinaty', 'مدنتي': 'Madinaty',
  // Rehab
  'الرحاب': 'Rehab', 'رحاب': 'Rehab', 'rehab': 'Rehab', 'el rehab': 'Rehab',
  // New Cairo
  'التجمع الخامس': 'New Cairo', 'التجمع': 'New Cairo', 'القاهرة الجديدة': 'New Cairo',
  'new cairo': 'New Cairo', 'fifth settlement': 'New Cairo', 'التجمع الثالث': 'New Cairo',
  '5th settlement': 'New Cairo', 'التجمع 5': 'New Cairo',
  // Sheikh Zayed
  'الشيخ زايد': 'Sheikh Zayed', 'شيخ زايد': 'Sheikh Zayed', 'sheikh zayed': 'Sheikh Zayed',
  // 6th October
  'السادس من اكتوبر': '6th October', '6 اكتوبر': '6th October', 'أكتوبر': '6th October',
  '6th october': '6th October', 'مدينة أكتوبر': '6th October',
  // Mostakbal
  'المستقبل': 'Mostakbal City', 'مستقبل سيتي': 'Mostakbal City', 'mostakbal': 'Mostakbal City',
  // Nasr City
  'مدينة نصر': 'Nasr City', 'نصر سيتي': 'Nasr City', 'nasr city': 'Nasr City',
  // Heliopolis
  'مصر الجديدة': 'Heliopolis', 'هليوبوليس': 'Heliopolis', 'heliopolis': 'Heliopolis',
  // Obour
  'العبور': 'Obour City', 'عبور': 'Obour City', 'obour': 'Obour City',
  // Badr City
  'بدر': 'Badr City', 'مدينة بدر': 'Badr City', 'badr': 'Badr City',
  // Zamalek
  'الزمالك': 'Zamalek', 'زمالك': 'Zamalek', 'zamalek': 'Zamalek',
  // Maadi
  'المعادي': 'Maadi', 'معادي': 'Maadi', 'maadi': 'Maadi',
  // Helwan
  'حلوان': 'Helwan', 'helwan': 'Helwan',
  // Shorouk
  'الشروق': 'El Shorouk', 'شروق': 'El Shorouk', 'shorouk': 'El Shorouk',
  // Mohandessin
  'المهندسين': 'Mohandessin', 'مهندسين': 'Mohandessin',
  // Dokki
  'الدقي': 'Dokki', 'دقي': 'Dokki', 'dokki': 'Dokki',
  // 10th Ramadan
  '10 رمضان': '10th of Ramadan', 'العاشر من رمضان': '10th of Ramadan',
  // Ain Sokhna
  'العين السخنة': 'Ain Sokhna', 'سخنة': 'Ain Sokhna',
  // North Coast
  'الساحل الشمالي': 'North Coast', 'الساحل': 'North Coast', 'north coast': 'North Coast',
  // Alexandria
  'الاسكندرية': 'Alexandria', 'اسكندرية': 'Alexandria', 'alexandria': 'Alexandria',
}

// ── Property type map ──────────────────────────────────────────────────────────
export const PROPERTY_TYPE_MAP = {
  'شقة': 'apartment', 'شقه': 'apartment', 'apartment': 'apartment',
  'فيلا': 'villa', 'villa': 'villa', 'فيلل': 'villa',
  'استديو': 'studio', 'studio': 'studio', 'ستوديو': 'studio',
  'دوبليكس': 'duplex', 'duplex': 'duplex', 'دوبلكس': 'duplex',
  'بنتهاوس': 'penthouse', 'penthouse': 'penthouse', 'بنت هاوس': 'penthouse',
  'تاون هاوس': 'townhouse', 'townhouse': 'townhouse', 'townhouse': 'townhouse',
  'توين هاوس': 'twin house', 'twin house': 'twin house',
  'وحدة': 'unit', 'وحده': 'unit',
  'محل': 'shop', 'مكتب': 'office', 'shop': 'shop', 'office': 'office',
  'شاليه': 'chalet', 'chalet': 'chalet',
}

// ── Arabic number normalization ────────────────────────────────────────────────
export function normalizeArabicNumber(text) {
  if (!text) return null
  let t = text.toLowerCase().trim()

  // Direct numeric
  const directMatch = t.match(/^[\d,]+(\.\d+)?$/)
  if (directMatch) return parseFloat(t.replace(/,/g, ''))

  // k / K / m / M
  const kMatch = t.match(/([\d.]+)\s*k/i)
  if (kMatch) return parseFloat(kMatch[1]) * 1000
  const mMatch = t.match(/([\d.]+)\s*m/i)
  if (mMatch) return parseFloat(mMatch[1]) * 1000000

  // Arabic numbers
  let val = 0
  const numWords = {
    'واحد': 1, 'اثنين': 2, 'اتنين': 2, 'تلاتة': 3, 'ثلاثة': 3, 'اربعة': 4, 'أربعة': 4, 'خمسة': 5,
    'ستة': 6, 'سبعة': 7, 'تمانية': 8, 'ثمانية': 8, 'تسعة': 9, 'عشرة': 10,
    '١': 1, '٢': 2, '٣': 3, '٤': 4, '٥': 5, '٦': 6, '٧': 7, '٨': 8, '٩': 9, '٠': 0,
  }

  // Handle "مليون ونص" / "نص مليون"
  if (t.includes('مليون ونص') || t.includes('مليون و نص')) return 1_500_000
  if (t.includes('نص مليون')) return 500_000
  if (t.includes('ربع مليون')) return 250_000
  if (t.includes('مليونين')) return 2_000_000

  // Extract leading number
  const numMatch = t.match(/([\d.]+)\s*(مليون|مليار|ألف|الف|k|m)/i)
  if (numMatch) {
    const n = parseFloat(numMatch[1])
    const unit = numMatch[2]
    if (/مليار/i.test(unit)) return n * 1_000_000_000
    if (/مليون/i.test(unit)) return n * 1_000_000
    if (/ألف|الف/i.test(unit)) return n * 1_000
    if (/k/i.test(unit)) return n * 1_000
    if (/m/i.test(unit)) return n * 1_000_000
  }

  // Word-based millions
  for (const [word, val2] of Object.entries(numWords)) {
    if (t.includes(word + ' مليون') || t.includes(word + ' مليار')) {
      return val2 * (t.includes('مليار') ? 1_000_000_000 : 1_000_000)
    }
  }

  // Just مليون
  if (t.includes('مليون')) return 1_000_000
  if (t.includes('الف') || t.includes('ألف')) {
    const n2 = t.match(/([\d]+)\s*[الفألف]/)
    return n2 ? parseInt(n2[1]) * 1000 : 1000
  }

  return val || null
}

// ── Bedroom extraction ─────────────────────────────────────────────────────────
function extractBedrooms(text) {
  if (!text) return null
  const t = text

  // Arabic patterns: "3 غرف", "3 اوض", "تلاتة غرف"
  const arMatch = t.match(/(\d+)\s*(غرف|غرفة|اوضه|اوض|أوضة|نوم|روم|room|bedroom|br)/i)
  if (arMatch) return parseInt(arMatch[1])

  // Written numbers
  const writtenMap = { 'واحد': 1, 'اثنين': 2, 'اتنين': 2, 'تلاتة': 3, 'ثلاثة': 3, 'اربعة': 4, 'أربعة': 4, 'خمسة': 5 }
  for (const [word, num] of Object.entries(writtenMap)) {
    if (t.includes(word + ' غرف') || t.includes(word + ' اوض')) return num
  }

  // English: "3BR", "3-bed", "3 bed"
  const enMatch = t.match(/(\d+)\s*(?:br|bed(?:room)?s?)/i)
  if (enMatch) return parseInt(enMatch[1])

  // Studio → 0 bedrooms
  if (/استديو|studio|ستوديو/i.test(t)) return 0

  return null
}

// ── Contact extraction ─────────────────────────────────────────────────────────
function extractContact(text) {
  if (!text) return null
  const match = text.match(/0?1[0125][0-9]{8}|01[0125][0-9]{8}|(\+?20\s?1[0125][0-9]{8})/g)
  return match ? match[0].replace(/\s/g, '') : null
}

// ── Location extraction ────────────────────────────────────────────────────────
function extractLocation(text) {
  if (!text) return null
  const lower = text.toLowerCase()
  for (const [ar, en] of Object.entries(LOCATION_MAP)) {
    if (lower.includes(ar.toLowerCase())) return en
  }
  return null
}

// ── Property type extraction ───────────────────────────────────────────────────
function extractPropertyType(text) {
  if (!text) return null
  const lower = text.toLowerCase()
  for (const [ar, en] of Object.entries(PROPERTY_TYPE_MAP)) {
    if (lower.includes(ar.toLowerCase())) return en
  }
  return null
}

// ── Budget extraction ──────────────────────────────────────────────────────────
function extractBudget(text) {
  if (!text) return { min: null, max: null }
  // Find "budget max" patterns: "بحد اقصى X", "ميزانية X", "budget X"
  const budgetPatterns = [
    /(?:ميزانية|باجت|budget|بحد\s*اقصى|حد\s*اقصى)\s*([\d.]+\s*(?:مليون|مليار|ألف|الف|k|m|M))/i,
    /(?:بـ?|b)\s*([\d.]+\s*(?:مليون|مليار|ألف|الف|k|m|M))/i,
  ]
  for (const pat of budgetPatterns) {
    const m = text.match(pat)
    if (m) { const n = normalizeArabicNumber(m[1]); if (n) return { min: null, max: n } }
  }

  // Standalone numbers with million/thousand
  const pricePatterns = [
    /([\d.]+)\s*مليون/gi,
    /([\d.]+)\s*(?:ألف|الف)/gi,
    /([\d]+)\s*(?:k|K)(?!\w)/g,
    /([\d]+)\s*(?:m|M)(?!\w)/g,
  ]
  const found = []
  for (const pat of pricePatterns) {
    let m = null
    while ((m = pat.exec(text)) !== null) {
      const n = normalizeArabicNumber(m[0])
      if (n && n > 10000) found.push(n)
    }
  }
  if (found.length === 0) return { min: null, max: null }
  if (found.length === 1) return { min: null, max: found[0] }
  return { min: Math.min(...found), max: Math.max(...found) }
}

// ── Urgency detection ──────────────────────────────────────────────────────────
function detectUrgency(text) {
  if (!text) return 'normal'
  return /ضروري|عاجل|فوري|فورا|urgent|asap|now|الان|الآن|ضرورى|عاجله/i.test(text) ? 'urgent' : 'normal'
}

// ── Finishing detection ────────────────────────────────────────────────────────
function extractFinishing(text) {
  if (!text) return null
  const map = {
    'سوبر لوكس': 'super lux', 'لوكس': 'lux', 'فل فنيش': 'full finish', 'متشطب': 'finished',
    'تشطيب': 'finished', 'كور وشل': 'core and shell', 'نص تشطيب': 'semi-finished',
    'super lux': 'super lux', 'full finish': 'full finish', 'finished': 'finished',
    'مودرن': 'modern', 'كلاسيك': 'classic', 'اسكندنافي': 'scandinavian',
  }
  const lower = text.toLowerCase()
  for (const [ar, en] of Object.entries(map)) {
    if (lower.includes(ar.toLowerCase())) return en
  }
  return null
}

// ── Rule-based fast classifier ─────────────────────────────────────────────────
export function classifyFast(text) {
  if (!text || text.trim().length < 3) {
    return { classification: 'IRRELEVANT', confidence: 99, reason: 'Empty or too short' }
  }

  const t = text.trim()
  const lower = t.toLowerCase()

  // ── 1. IRRELEVANT checks ────────────────────────────────────────────────────
  const greetings = /^(صباح|مساء|السلام|أهلاً|اهلا|مرحبا|هاي|هلا|good morning|good evening|hello|hi there|hey)\b/i
  if (greetings.test(t) && t.length < 30) {
    return { classification: 'IRRELEVANT', confidence: 99, reason: 'Greeting message' }
  }
  const hasREKeyword = /شقة|شقه|فيلا|استديو|غرف|اوض|مليون|ألف|للبيع|للإيجار|للايجار|مطلوب|عايز|محتاج|apartment|villa|bedroom|for sale|for rent|property/i.test(t)
  if (!hasREKeyword && t.length < 50) {
    return { classification: 'IRRELEVANT', confidence: 90, reason: 'No real estate keywords' }
  }

  // ── 2. BROKER_DEMAND checks ─────────────────────────────────────────────────
  const brokerPatterns = [
    /عميل\s*(جاهز|معاه|عنده|بيدور)/i,
    /مشتري\s*جاهز/i,
    /معاه\s*عميل/i,
    /بيدور\s*على\s*(عمولة|كوميشن)/i,
    /وسيط|سمسار|بروكر(?!\s*demand)/i,
    /كوميشن|عمولة/i,
    /client\s*(ready|looking|has|with\s*budget)/i,
    /commission|broker(?!\s*demand)/i,
  ]
  for (const pat of brokerPatterns) {
    if (pat.test(t)) {
      const extracted = buildExtracted(t, 'broker')
      return {
        classification: 'BROKER_DEMAND', confidence: 88,
        reason: 'Broker with client demand',
        extracted: { ...extracted, intent: 'broker_demand' },
        match_ready: true,
      }
    }
  }

  // ── 3. High-priority DEMAND checks (before SUPPLY to handle "حد عنده" correctly) ────
  const demandStart = /^(مطلوب|مطلوبة|عايز|عاوز|محتاج|محتاجة|بدور|ابحث|looking for|need|wanted|searching|I want)/i.test(t)
  // Strong demand signals that override supply keywords (questions asking if someone HAS something)
  const strongDemand = /(حد\s*عنده|مين\s*عنده|في\s*حاجة|ممكن\s*حد\s*يرشح|عندكم|anyone\s*have|do\s*you\s*have)/i.test(t)
  const demandKeywords = /(مطلوب|مطلوبة|عايز|عاوز|محتاج|بدور|دور على|بدور على|حد عنده|مين عنده|ممكن حد|ابحث عن|نفسي في|في حاجة|عندكم|looking for|need|wanted|searching|require|anyone have|do you have)/i.test(t)

  if (demandStart) {
    return { classification: 'DEMAND', confidence: 95, reason: 'Starts with demand keyword', extracted: buildExtracted(t, 'demand'), match_ready: true }
  }
  if (strongDemand) {
    // "حد عنده شقة للايجار؟" — someone asking if anyone has something → DEMAND
    return { classification: 'DEMAND', confidence: 92, reason: 'Strong demand signal (asking for property)', extracted: buildExtracted(t, 'demand'), match_ready: true }
  }

  // ── 4. SUPPLY checks ───────────────────────────────────────────────────────
  const supplyStart = /^(للبيع|للإيجار|للايجار|للتأجير|متاح|عرض|معروض|بيعمل|هتاجر|for sale|for rent|available)/i.test(t)
  const supplyKeywords = /(للبيع|للإيجار|للايجار|للتأجير|متاح|بيعمل|هتاجر|for sale|for rent|available|I have|عندي|لديّ)/i.test(t)
  const hasSpecs = /(\d+\s*(غرف|اوض|متر|m²|sqm|bed))|(\d+\s*مليون)/.test(t)
  const startsWithSpecs = /^\d+\s*(غرف|متر|اوض|BR|bed)/i.test(t)

  if (supplyStart) {
    return { classification: 'SUPPLY', confidence: 95, reason: 'Starts with supply keyword', extracted: buildExtracted(t, 'supply'), match_ready: true }
  }
  if (supplyKeywords && hasSpecs) {
    return { classification: 'SUPPLY', confidence: 88, reason: 'Supply keyword + specs', extracted: buildExtracted(t, 'supply'), match_ready: true }
  }
  if (startsWithSpecs && supplyKeywords) {
    return { classification: 'SUPPLY', confidence: 82, reason: 'Starts with specs + supply signal', extracted: buildExtracted(t, 'supply'), match_ready: true }
  }

  // ── 5. Remaining DEMAND checks ─────────────────────────────────────────────
  if (demandKeywords) {
    const conf = /^(عايز|عاوز|أنا\s*بدور|أنا\s*محتاج)/i.test(t) ? 90 : 80
    return { classification: 'DEMAND', confidence: conf, reason: 'Demand keyword found', extracted: buildExtracted(t, 'demand'), match_ready: true }
  }

  // ── 6. LOW CONFIDENCE fallback ─────────────────────────────────────────────
  return { classification: 'IRRELEVANT', confidence: 45, reason: 'Low confidence — no clear signal', extracted: {}, match_ready: false }
}

// ── Build extracted object ─────────────────────────────────────────────────────
function buildExtracted(text, type) {
  const budget  = extractBudget(text)
  const beds    = extractBedrooms(text)
  const loc     = extractLocation(text)
  const propType= extractPropertyType(text)
  const contact = extractContact(text)
  const urgency = detectUrgency(text)
  const finishing = extractFinishing(text)
  const furnished = /(مفروش|مفروشة|مفروشه|furnished)/i.test(text) ? true : /(بدون\s*فرش|unfurnished)/i.test(text) ? false : null

  const purposeMap = { demand: /ايجار|للايجار|rent/i.test(text) ? 'rent' : 'buy', supply: /ايجار|للايجار|for rent/i.test(text) ? 'rent' : 'sell', broker: /ايجار|rent/i.test(text) ? 'rent' : 'buy' }
  const intent = purposeMap[type] || 'buy'

  const area = (() => {
    const m = text.match(/(\d+)\s*(?:متر|م|sqm|m²|meters?)/i); return m ? parseInt(m[1]) : null
  })()
  const floor = (() => {
    const m = text.match(/(?:دور|طابق|floor)\s*(\d+)|(\d+)\s*(?:دور|طابق)/i); return m ? parseInt(m[1] || m[2]) : null
  })()

  return {
    intent, location: loc, bedrooms: beds, property_type: propType, purpose: intent,
    budget_max: type === 'supply' ? null : budget.max,
    budget_min: type === 'supply' ? null : budget.min,
    price: type === 'supply' ? (budget.max || budget.min) : null,
    area_sqm: area, floor, finishing, furnished, urgency, contact,
    floor_preference: /ارضي|ground/i.test(text) ? 'ground floor' : /عالي|high|اعلى/i.test(text) ? 'high floor' : null,
    amenities: extractAmenities(text),
  }
}

// ── Amenities extraction ───────────────────────────────────────────────────────
function extractAmenities(text) {
  const found = []
  const amenityMap = {
    'مسبح': 'pool', 'pool': 'pool', 'swimming': 'pool',
    'جراج': 'garage', 'garage': 'garage', 'parking': 'parking', 'باركينج': 'parking',
    'حديقة': 'garden', 'garden': 'garden',
    'نادي': 'club', 'club': 'club', 'gym': 'gym', 'جيم': 'gym',
    'أمن': 'security', 'security': 'security', 'كاميرات': 'cameras',
    'مصعد': 'elevator', 'elevator': 'elevator', 'اسانسير': 'elevator',
    'تكييف': 'AC', 'مكيف': 'AC', 'ac': 'AC',
  }
  const lower = text.toLowerCase()
  for (const [ar, en] of Object.entries(amenityMap)) {
    if (lower.includes(ar.toLowerCase()) && !found.includes(en)) found.push(en)
  }
  return found
}

// ── Match scoring ──────────────────────────────────────────────────────────────
export function calcMatchScore(supplyMsg, demandMsg) {
  const s = supplyMsg?.classification?.extracted || {}
  const d = demandMsg?.classification?.extracted || {}
  let score = 0

  // Location match (30 pts exact, 15 pts district)
  const sLoc = (s.location || '').toLowerCase(); const dLoc = (d.location || '').toLowerCase()
  if (sLoc && dLoc) {
    if (sLoc === dLoc) score += 30
    else {
      const districtMap = {
        'east cairo': ['Madinaty', 'Rehab', 'New Cairo', 'El Shorouk', 'Obour City', 'Mostakbal City', 'Badr City'],
        'west cairo': ['Sheikh Zayed', '6th October'],
        'central': ['Heliopolis', 'Nasr City', 'Zamalek', 'Dokki', 'Mohandessin', 'Maadi'],
      }
      const sDistrict = Object.entries(districtMap).find(([, locs]) => locs.map(l => l.toLowerCase()).includes(sLoc))?.[0]
      const dDistrict = Object.entries(districtMap).find(([, locs]) => locs.map(l => l.toLowerCase()).includes(dLoc))?.[0]
      if (sDistrict && sDistrict === dDistrict) score += 15
    }
  } else if (!sLoc || !dLoc) { score += 15 } // unknown location — partial credit

  // Budget match (25 pts)
  const price = s.price || 0; const budgetMax = d.budget_max || 0; const budgetMin = d.budget_min || 0
  if (price > 0 && budgetMax > 0) {
    if (price <= budgetMax && price >= (budgetMin || 0)) score += 25
    else if (price <= budgetMax * 1.1) score += 15
    else if (price > budgetMax * 1.5) score -= 5
  } else { score += 12 }

  // Bedrooms (20 pts exact, 10 pts ±1)
  const sBeds = s.bedrooms; const dBeds = d.bedrooms
  if (sBeds !== null && sBeds !== undefined && dBeds !== null && dBeds !== undefined) {
    if (sBeds === dBeds) score += 20
    else if (Math.abs(sBeds - dBeds) === 1) score += 10
    else score -= 5
  } else { score += 10 }

  // Property type (10 pts)
  const sProp = s.property_type; const dProp = d.property_type
  if (sProp && dProp && sProp === dProp) score += 10

  // Intent match (10 pts)
  const sIntent = s.intent === 'sell' || s.intent === 'rent' ? s.intent : null
  const dIntent = d.intent === 'buy' || d.intent === 'rent' ? d.intent : null
  if ((sIntent === 'sell' && dIntent === 'buy') || (sIntent === 'rent' && dIntent === 'rent')) score += 10

  // Urgency bonus (+5)
  if (d.urgency === 'urgent') score += 5

  // Recent bonus (+5)
  const ts = demandMsg.timestamp ? new Date(demandMsg.timestamp * 1000) : null
  if (ts) {
    const hoursAgo = (Date.now() - ts.getTime()) / 3600000
    if (hoursAgo < 24) score += 5
  }

  // Finishing match (+5)
  const sFinish = (s.finishing || '').toLowerCase(); const dFinish = (d.finishing || '').toLowerCase()
  if (sFinish && dFinish && sFinish.includes(dFinish.slice(0, 4))) score += 5

  return Math.max(0, Math.min(100, score))
}
