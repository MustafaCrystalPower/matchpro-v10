/**
 * MatchPro Matching Engine v2 — Production Grade
 * Crystal Power Investments
 *
 * Improvements over v1:
 * - Cluster-aware location matching (حدائق أكتوبر ↔ 6 أكتوبر = same cluster)
 * - Purpose HARD gate: sale↔rent = 0% (never cross-match)
 * - Price precision: asymmetric tolerance (supply can exceed budget by 15%)
 * - Null penalties: missing fields penalised correctly
 * - Bedroom tolerance: ±1 = partial match, ≥2 gap = penalty
 * - Confidence quality gate: skip low-confidence extractions
 * - Match explanation generator
 */

const { CLUSTER_NAMES } = require('./nlp_v2');

const WEIGHTS = {
  location: 0.40,
  price:    0.30, // reduced from 35% — price often missing
  purpose:  0.15, // increased — purpose mismatch is critical
  specs:    0.15,
};

const MIN_SCORE = 55;
const HIGH_CONFIDENCE = 80;
const PRICE_OVER_BUDGET_TOLERANCE = 0.15; // supply can be 15% over demand budget

// ── Location Scoring ──────────────────────────────────────────────
function scoreLocation(supplyLoc, demandLoc, supplyCluster, demandCluster) {
  if (!supplyLoc && !demandLoc) return 50; // both unknown — neutral
  if (!supplyLoc || !demandLoc) return 30; // one unknown — mild penalty

  const sl = supplyLoc.toLowerCase().trim();
  const dl = demandLoc.toLowerCase().trim();

  // Exact match
  if (sl === dl) return 100;

  // Cluster match (e.g. مدينتي ↔ B12 Group 123 both in madinaty cluster)
  if (supplyCluster && demandCluster && supplyCluster === demandCluster) return 88;

  // Substring match (e.g. "هايد بارك" in "Mountain View Hyde Park")
  if (sl.includes(dl) || dl.includes(sl)) return 78;

  // Partial word overlap (Arabic)
  const sWords = sl.split(/\s+/).filter(w => w.length > 2);
  const dWords = dl.split(/\s+/).filter(w => w.length > 2);
  const shared = sWords.filter(w => dWords.some(dw => dw.includes(w) || w.includes(dw)));
  if (shared.length > 0) return 65;

  // Different locations with no relation
  return 8;
}

// ── Price Scoring ─────────────────────────────────────────────────
function scorePrice(supplyPrice, demandBudget) {
  if (!supplyPrice || supplyPrice <= 0) return 45; // supply has no price
  if (!demandBudget || demandBudget <= 0) return 45; // demand has no budget

  if (supplyPrice <= demandBudget) {
    // Within budget
    const ratio = supplyPrice / demandBudget;
    if (ratio >= 0.80) return 100; // ideal: close to budget
    if (ratio >= 0.60) return 88;
    if (ratio >= 0.40) return 72;
    if (ratio >= 0.20) return 55;
    return 30; // way too cheap (likely different scale)
  } else {
    // Over budget
    const overBy = (supplyPrice - demandBudget) / demandBudget;
    if (overBy <= PRICE_OVER_BUDGET_TOLERANCE) return 75; // 0-15% over
    if (overBy <= 0.30) return 45;
    if (overBy <= 0.50) return 25;
    return 5;
  }
}

// ── Purpose Scoring ───────────────────────────────────────────────
function scorePurpose(supplyPurpose, demandPurpose) {
  if (!supplyPurpose || !demandPurpose) return 50; // unknown — neutral
  if (supplyPurpose === demandPurpose) return 100;
  // Mismatch: sale vs rent or vice versa — HARD gate
  return 0;
}

// ── Specs Scoring ────────────────────────────────────────────────
function scoreSpecs(supply, demand) {
  let score = 50;
  let checks = 0;

  // Property type
  if (supply.property_type && demand.property_type) {
    checks++;
    const sType = normalizeType(supply.property_type);
    const dType = normalizeType(demand.property_type);
    if (sType === dType) score += 22;
    else if (isCompatibleType(sType, dType)) score += 8;
    else score -= 20;
  }

  // Bedrooms
  if (supply.bedrooms && demand.bedrooms) {
    checks++;
    const diff = Math.abs(supply.bedrooms - demand.bedrooms);
    if (diff === 0) score += 18;
    else if (diff === 1) score += 8;
    else if (diff === 2) score -= 5;
    else score -= 18;
  }

  // Size compatibility (if both available)
  if (supply.size && demand.size_min) {
    checks++;
    if (supply.size >= demand.size_min) score += 10;
    else score -= 8;
  }

  return Math.max(0, Math.min(100, score));
}

function normalizeType(t) {
  if (!t) return null;
  const map = {
    'apartment': 'apartment', 'flat': 'apartment',
    'villa': 'villa',
    'duplex': 'apartment', // compatible
    'studio': 'studio',
    'penthouse': 'apartment',
    'land': 'land',
    'shop': 'commercial', 'store': 'commercial', 'office': 'commercial',
    'townhouse': 'villa', 'twin_house': 'villa',
    'chalet': 'chalet',
  };
  return map[t.toLowerCase()] || t.toLowerCase();
}

function isCompatibleType(a, b) {
  const compatible = [
    ['apartment', 'studio'],
    ['apartment', 'duplex'],
    ['villa', 'townhouse'],
    ['villa', 'twin_house'],
    ['shop', 'office'],
    ['shop', 'commercial'],
  ];
  return compatible.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
}

// ── Main Match Calculator ─────────────────────────────────────────
function calculateMatch(supply, demand) {
  // Hard gate: if purpose is known for both and mismatches → 0
  const purposeScore = scorePurpose(
    supply.purpose || supply.supply_purpose,
    demand.purpose || demand.demand_purpose
  );
  if (purposeScore === 0) {
    return { matchScore: 0, reason: 'purpose_mismatch', skip: true };
  }

  const locationScore = scoreLocation(
    supply.location || supply.supply_location,
    demand.location || demand.demand_location,
    supply.locationCluster || supply.location_cluster,
    demand.locationCluster || demand.location_cluster
  );

  const priceScore = scorePrice(
    supply.price || supply.supply_price,
    demand.price_max || demand.demand_price_max || demand.priceMax
  );

  const specsScore = scoreSpecs(supply, demand);

  const matchScore = Math.round(
    locationScore * WEIGHTS.location +
    priceScore    * WEIGHTS.price +
    purposeScore  * WEIGHTS.purpose +
    specsScore    * WEIGHTS.specs
  );

  return {
    matchScore,
    locationScore,
    priceScore,
    purposeScore,
    specsScore,
    isHighConfidence: matchScore >= HIGH_CONFIDENCE,
    skip: matchScore < MIN_SCORE,
  };
}

// ── Match Explanation Generator ───────────────────────────────────
function generateExplanation(supply, demand, scores) {
  const lines = [];
  const { matchScore, locationScore, priceScore, purposeScore, specsScore } = scores;

  // Score bar
  const bar = '█'.repeat(Math.round(matchScore / 10)) + '░'.repeat(10 - Math.round(matchScore / 10));
  lines.push(`🎯 Match Score: ${matchScore}% [${bar}]`);
  lines.push('');

  // Location
  if (locationScore >= 88) lines.push(`✅ Location: Perfect match — both in ${supply.location || supply.supply_location}`);
  else if (locationScore >= 65) lines.push(`⚡ Location: Same area cluster (${supply.location} ↔ ${demand.location})`);
  else lines.push(`⚠️ Location: Different areas (${supply.location || '?'} vs ${demand.location || '?'})`);

  // Price
  const sp = supply.price || supply.supply_price || 0;
  const dp = demand.price_max || demand.demand_price_max || 0;
  if (sp && dp) {
    const savings = dp - sp;
    if (savings >= 0) lines.push(`✅ Price: ${(sp/1e6).toFixed(1)}M EGP fits budget of ${(dp/1e6).toFixed(1)}M EGP (${(savings/1e6).toFixed(1)}M savings)`);
    else lines.push(`⚠️ Price: ${(sp/1e6).toFixed(1)}M EGP is ${(Math.abs(savings)/1e6).toFixed(1)}M over budget`);
  } else {
    lines.push('ℹ️ Price: Could not verify price match (data missing)');
  }

  // Purpose
  const sPurp = supply.purpose || supply.supply_purpose;
  const dPurp = demand.purpose || demand.demand_purpose;
  if (sPurp && dPurp) {
    if (sPurp === dPurp) lines.push(`✅ Purpose: Both ${sPurp === 'sale' ? 'For Sale' : 'For Rent'}`);
  }

  // Specs
  const sBeds = supply.bedrooms;
  const dBeds = demand.bedrooms || demand.demand_bedrooms;
  if (sBeds && dBeds) {
    if (sBeds === parseInt(dBeds)) lines.push(`✅ Bedrooms: ${sBeds} BR match`);
    else lines.push(`⚡ Bedrooms: ${sBeds} BR supply vs ${dBeds} BR demand`);
  }

  const sType = supply.property_type || supply.supply_property_type;
  const dType = demand.property_type || demand.demand_property_type;
  if (sType && dType) {
    if (normalizeType(sType) === normalizeType(dType)) lines.push(`✅ Type: ${sType} match`);
  }

  lines.push('');
  lines.push(`📊 Breakdown: Location ${locationScore}% (×40%) | Price ${priceScore}% (×30%) | Purpose ${purposeScore}% (×15%) | Specs ${specsScore}% (×15%)`);

  return lines.join('\n');
}

// ── Summary Generator ─────────────────────────────────────────────
function generateSummary(supply, demand, matchScore) {
  const sName = supply.supply_name || supply.sender_name || 'Seller';
  const dName = demand.demand_name || demand.sender_name || 'Buyer';
  const sPhone = supply.supply_phone || supply.sender_phone || '—';
  const dPhone = demand.demand_phone || demand.sender_phone || '—';
  const loc = supply.supply_location || supply.location || demand.demand_location || demand.location || '—';
  const sp = supply.supply_price || supply.price;
  const dp = demand.demand_price_max || demand.price_max;
  const type = supply.supply_property_type || supply.property_type || demand.demand_property_type || demand.property_type || 'property';
  const purp = supply.supply_purpose || supply.purpose === 'sale' ? 'For Sale' : supply.supply_purpose || supply.purpose === 'rent' ? 'For Rent' : '';

  return `${dName} (${dPhone}) looking for ${type} in ${loc}${dp ? `, budget ${(dp/1e6).toFixed(1)}M EGP` : ''}\n→ Matched ${matchScore}% with ${sName} (${sPhone}) ${purp}${sp ? ` at ${(sp/1e6).toFixed(1)}M EGP` : ''}`;
}

// ── findBestMatches ────────────────────────────────────────────────
/**
 * Given one demand entry and an array of supply entries, score all supply
 * against the demand using calculateMatch() and return the top N results.
 *
 * @param {object} demandEntry  - A demand row from the DB
 * @param {Array}  supplyList   - Array of supply rows from the DB
 * @param {number} topN         - How many top matches to return (default 3)
 * @returns {Array} Sorted array of { supply, score, scores } objects
 */
function findBestMatches(demandEntry, supplyList, topN = 3) {
  const results = [];

  for (const supply of supplyList) {
    const scores = calculateMatch(supply, demandEntry);
    if (scores.skip) continue; // hard-gate failures (purpose mismatch / below MIN_SCORE)

    results.push({
      supply,
      score: scores.matchScore,
      scores,
    });
  }

  // Sort descending by score and return top N
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topN);
}

module.exports = {
  calculateMatch,
  findBestMatches,
  generateExplanation,
  generateSummary,
  MIN_SCORE,
  HIGH_CONFIDENCE,
  scoreLocation,
  scorePrice,
  scorePurpose,
  scoreSpecs,
};
