/**
 * MatchPro Enhanced Matching Engine — V1 algorithms in plain JS
 * Weights: location 40%, price 35%, specs 25%
 * Owner: Mo'men Hisham Maisara / Crystal Power Investments
 */

const LOCATION_WEIGHT = 0.40;
const PRICE_WEIGHT = 0.35;
const SPECS_WEIGHT = 0.25;
const MIN_MATCH_SCORE = 60;
const HIGH_CONFIDENCE_THRESHOLD = 85;
const PRICE_TOLERANCE = 0.20; // ±20%

const LOCATION_CLUSTERS = {
  'new_cairo': ['التجمع الخامس','التجمع الاول','التجمع','القاهرة الجديدة','الرحاب','مدينتي',
    'new cairo','5th settlement','tagamoa','rehab','madinaty'],
  'october': ['6 اكتوبر','الشيخ زايد','october','sheikh zayed','zayed','6th october'],
  'heliopolis': ['هليوبوليس','مصر الجديدة','heliopolis','nasr city','مدينة نصر','عين شمس','ain shams'],
  'maadi': ['المعادي','maadi','degla','دجلة'],
  'downtown': ['وسط البلد','الزمالك','المنيل','zamalek','downtown','garden city','الدقي','المهندسين'],
  'coast': ['الساحل الشمالي','العين السخنة','north coast','ain sokhna','sahel','الغردقة'],
  'new_capital': ['العاصمة الادارية','new capital','administrative capital','بدر','الشروق'],
  'giza': ['الجيزة','giza','حدائق الاهرام','فيصل','الهرم']
};

const PROPERTY_TYPE_GROUPS = {
  'apartment': ['apartment','flat','شقة','شقه','شقق'],
  'villa': ['villa','فيلا','فيلات'],
  'duplex': ['duplex','دوبلكس'],
  'studio': ['studio','استوديو'],
  'penthouse': ['penthouse','بنتهاوس'],
  'land': ['land','أرض','ارض'],
  'shop': ['shop','store','محل'],
  'office': ['office','مكتب'],
  'chalet': ['chalet','شاليه'],
  'townhouse': ['townhouse','تاون هاوس','twin house','توين هاوس']
};

function getLocationCluster(location) {
  if (!location) return null;
  const loc = location.toLowerCase();
  for (const [cluster, locations] of Object.entries(LOCATION_CLUSTERS)) {
    if (locations.some(l => loc.includes(l.toLowerCase()) || l.toLowerCase().includes(loc))) {
      return cluster;
    }
  }
  return loc;
}

function getPropertyTypeGroup(type) {
  if (!type) return null;
  const t = type.toLowerCase();
  for (const [group, types] of Object.entries(PROPERTY_TYPE_GROUPS)) {
    if (types.some(pt => t.includes(pt.toLowerCase()) || pt.toLowerCase().includes(t))) {
      return group;
    }
  }
  return t;
}

function calculateLocationScore(supplyLoc, demandLoc) {
  if (!supplyLoc || !demandLoc) return 50;
  if (supplyLoc.toLowerCase() === demandLoc.toLowerCase()) return 100;
  
  const sc = getLocationCluster(supplyLoc);
  const dc = getLocationCluster(demandLoc);
  if (sc && dc && sc === dc) return 90;
  
  if (supplyLoc.toLowerCase().includes(demandLoc.toLowerCase()) ||
      demandLoc.toLowerCase().includes(supplyLoc.toLowerCase())) return 75;
  
  return 15;
}

function calculatePriceScore(supplyPrice, demandPriceMax) {
  if (!supplyPrice || !demandPriceMax) return 50;
  if (supplyPrice <= demandPriceMax) {
    // Supply price within budget
    const ratio = supplyPrice / demandPriceMax;
    if (ratio >= 0.7) return 100; // Close to budget — ideal
    if (ratio >= 0.5) return 85;
    if (ratio >= 0.3) return 65;
    // Price too far below budget (likely wrong match — e.g. 2M supply vs 376M demand)
    if (ratio < 0.1) return 15; // Penalise extreme mismatches
    return 45;
  }
  // Supply price over budget
  const overBy = (supplyPrice - demandPriceMax) / demandPriceMax;
  if (overBy <= PRICE_TOLERANCE) return 70; // Within tolerance
  if (overBy <= 0.3) return 40;
  return 10;
}

function calculateSpecsScore(supply, demand) {
  let score = 50;
  let checks = 0;
  
  // Property type match
  if (supply.property_type && demand.property_type) {
    checks++;
    const sg = getPropertyTypeGroup(supply.property_type);
    const dg = getPropertyTypeGroup(demand.property_type);
    score += (sg === dg ? 25 : -15);
  }
  
  // Bedroom match
  if (supply.bedrooms && demand.bedrooms) {
    checks++;
    if (supply.bedrooms === demand.bedrooms) score += 20;
    else if (Math.abs(supply.bedrooms - demand.bedrooms) === 1) score += 10;
    else score -= 10;
  }
  
  // Purpose match (sale vs rent)
  if (supply.purpose && demand.purpose) {
    checks++;
    score += (supply.purpose === demand.purpose ? 15 : -30);
  }
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate overall match score between supply and demand
 */
function calculateMatchScore(supply, demand) {
  const locationScore = calculateLocationScore(supply.location, demand.location);
  const priceScore = calculatePriceScore(supply.price, demand.price_max);
  const specsScore = calculateSpecsScore(supply, demand);
  
  const matchScore = Math.round(
    locationScore * LOCATION_WEIGHT +
    priceScore * PRICE_WEIGHT +
    specsScore * SPECS_WEIGHT
  );
  
  return { matchScore, locationScore, priceScore, specsScore };
}

/**
 * Find all matches above minimum threshold from arrays of supply+demand
 */
function findMatches(supplyList, demandList) {
  const matches = [];
  
  for (const supply of supplyList) {
    for (const demand of demandList) {
      const scores = calculateMatchScore(supply, demand);
      if (scores.matchScore >= MIN_MATCH_SCORE) {
        matches.push({
          supplyId: supply.id,
          demandId: demand.id,
          ...scores,
          isHighConfidence: scores.matchScore >= HIGH_CONFIDENCE_THRESHOLD
        });
      }
    }
  }
  
  // Sort by match score descending
  return matches.sort((a, b) => b.matchScore - a.matchScore);
}

module.exports = {
  calculateMatchScore,
  findMatches,
  MIN_MATCH_SCORE,
  HIGH_CONFIDENCE_THRESHOLD
};
