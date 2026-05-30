/**
 * MatchPro Market Intelligence v2 — Server Extensions
 * Canonical location system, enhanced endpoints, public API
 * Appended to index.js via require('./market-v2')(app, db)
 */

const https = require('https');

// ─── CANONICAL LOCATION SYSTEM ───────────────────────────────────────────────

const LOCATION_ALIASES = {
  'مدينتي': 'madinaty', 'مدينتى': 'madinaty', 'Madinaty': 'madinaty', 'madinaty': 'madinaty',
  'القاهرة الجديدة': 'new_cairo', 'New Cairo': 'new_cairo', 'new cairo': 'new_cairo',
  'الرحاب': 'rehab', 'Al Rehab': 'rehab', 'al rehab': 'rehab',
  'الشيخ زايد': 'sheikh_zayed', 'Sheikh Zayed': 'sheikh_zayed', 'sheikh zayed': 'sheikh_zayed',
  '6 أكتوبر': '6_october', '6 October': '6_october', '6th October': '6_october', '6 october': '6_october',
  'التجمع الخامس': '5th_settlement', '5th Settlement': '5th_settlement', '5th settlement': '5th_settlement',
  'العاصمة الإدارية': 'new_capital', 'New Capital': 'new_capital', 'New Administrative Capital': 'new_capital',
  'الساحل الشمالي': 'north_coast', 'North Coast': 'north_coast', 'north coast': 'north_coast',
  'دريملاند': 'dreamland', 'Dreamland': 'dreamland', 'dreamland': 'dreamland',
  'القاهرة': 'cairo', 'Cairo': 'cairo', 'cairo': 'cairo',
  'الدقي': 'dokki', 'Dokki': 'dokki', 'dokki': 'dokki',
  'الزمالك': 'zamalek', 'Zamalek': 'zamalek', 'zamalek': 'zamalek',
  'مصر الجديدة': 'heliopolis', 'Heliopolis': 'heliopolis', 'heliopolis': 'heliopolis',
  'المهندسين': 'mohandessin', 'Mohandessin': 'mohandessin', 'mohandessin': 'mohandessin',
};

const CANONICAL_LABELS = {
  'madinaty': 'Madinaty', 'new_cairo': 'New Cairo', 'rehab': 'Al Rehab',
  'sheikh_zayed': 'Sheikh Zayed', '6_october': '6th October',
  '5th_settlement': '5th Settlement', 'new_capital': 'New Capital',
  'north_coast': 'North Coast', 'dreamland': 'Dreamland', 'cairo': 'Cairo',
  'dokki': 'Dokki', 'zamalek': 'Zamalek', 'heliopolis': 'Heliopolis',
  'mohandessin': 'Mohandessin',
};

const CANONICAL_COORDS = {
  'madinaty':       { lat: 30.1128, lng: 31.6411 },
  'new_cairo':      { lat: 30.0271, lng: 31.4961 },
  'rehab':          { lat: 30.0549, lng: 31.5422 },
  'sheikh_zayed':   { lat: 30.0626, lng: 30.9854 },
  '6_october':      { lat: 29.9418, lng: 30.9458 },
  '5th_settlement': { lat: 30.0131, lng: 31.4716 },
  'new_capital':    { lat: 30.0131, lng: 31.7269 },
  'north_coast':    { lat: 30.9408, lng: 29.2467 },
  'dreamland':      { lat: 29.9850, lng: 30.9800 },
  'cairo':          { lat: 30.0444, lng: 31.2357 },
  'dokki':          { lat: 30.0516, lng: 31.2101 },
  'zamalek':        { lat: 30.0650, lng: 31.2170 },
  'heliopolis':     { lat: 30.0900, lng: 31.3300 },
  'mohandessin':    { lat: 30.0600, lng: 31.2050 },
  // Sub-locations (cluster around Madinaty)
  'B6':  { lat: 30.1100, lng: 31.6350 }, 'B7': { lat: 30.1105, lng: 31.6355 },
  'B8':  { lat: 30.1110, lng: 31.6360 }, 'B10': { lat: 30.1115, lng: 31.6365 },
  'B11': { lat: 30.1120, lng: 31.6370 }, 'B12': { lat: 30.1125, lng: 31.6375 },
  'B14': { lat: 30.1130, lng: 31.6380 }, 'B15': { lat: 30.1135, lng: 31.6385 },
  'B1':  { lat: 30.1095, lng: 31.6345 }, 'B2':  { lat: 30.1097, lng: 31.6347 },
  'B3':  { lat: 30.1099, lng: 31.6349 }, 'B4':  { lat: 30.1101, lng: 31.6351 },
  'B5':  { lat: 30.1103, lng: 31.6353 }, 'B9':  { lat: 30.1112, lng: 31.6362 },
  'B13': { lat: 30.1127, lng: 31.6377 }, 'B16': { lat: 30.1137, lng: 31.6387 },
  'Privado':        { lat: 30.1090, lng: 31.6340 },
  'Noor City':      { lat: 30.0900, lng: 31.6200 },
  'Hyde Park':      { lat: 30.0050, lng: 31.4700 },
  'Mivida':         { lat: 30.0400, lng: 31.5200 },
  'mountain view':  { lat: 30.0350, lng: 31.5000 },
  'Mountain View':  { lat: 30.0350, lng: 31.5000 },
  'مدينة بدر':      { lat: 30.1120, lng: 31.7200 },
  'الشروق':         { lat: 30.1450, lng: 31.6100 },
  'العين السخنة':   { lat: 29.5500, lng: 32.3500 },
  'Cairo Festival City': { lat: 30.1200, lng: 31.6800 },
};

function canonicalKey(loc) {
  if (!loc) return null;
  const trimmed = loc.trim();
  return LOCATION_ALIASES[trimmed] || LOCATION_ALIASES[trimmed.toLowerCase()] || null;
}

function getCoordsV2(loc) {
  if (!loc) return null;
  const key = canonicalKey(loc);
  if (key && CANONICAL_COORDS[key]) return { ...CANONICAL_COORDS[key], key };
  // Try direct match in CANONICAL_COORDS (for sub-locations)
  if (CANONICAL_COORDS[loc]) return { ...CANONICAL_COORDS[loc], key: loc };
  if (CANONICAL_COORDS[loc.trim()]) return { ...CANONICAL_COORDS[loc.trim()], key: loc.trim() };
  return null;
}

function getLabelV2(loc) {
  if (!loc) return loc;
  const key = canonicalKey(loc);
  return (key && CANONICAL_LABELS[key]) ? CANONICAL_LABELS[key] : loc;
}

function getMarketSignal(pressureIndex) {
  if (pressureIndex > 2.5) return 'seller';
  if (pressureIndex < 0.8) return 'buyer';
  return 'balanced';
}

module.exports = function attachMarketV2(app, dbFn) {

  // ─── /api/market/analysis/v2 ─────────────────────────────────────────────
  app.get('/api/market/analysis/v2', (req, res) => {
    try {
      const d = dbFn();

      // Get all unique locations from supply + demand
      const supplyLocs = d.prepare("SELECT DISTINCT location FROM supply WHERE location IS NOT NULL AND location != ''").all().map(r => r.location);
      const demandLocs = d.prepare("SELECT DISTINCT location FROM demand WHERE location IS NOT NULL AND location != ''").all().map(r => r.location);

      // Build canonical map: canonical_key -> { aliases: [], ... }
      const canonicalMap = {};

      function initCanon(key, label, coords) {
        if (!canonicalMap[key]) {
          canonicalMap[key] = {
            canonical_key: key,
            label: label || CANONICAL_LABELS[key] || key,
            lat: coords?.lat || null,
            lng: coords?.lng || null,
            supply_count: 0, demand_count: 0,
            price_sum: 0, price_count: 0,
            budget_sum: 0, budget_count: 0,
            sale_supply: 0, rent_supply: 0,
            purpose_demand: {},
            prop_type_supply: {},
            bedrooms_demand: {},
          };
        }
      }

      // Process supply
      for (const loc of supplyLocs) {
        const key = canonicalKey(loc) || loc.trim();
        const coordsObj = getCoordsV2(loc);
        initCanon(key, getLabelV2(loc), coordsObj);

        // Aggregate supply
        const sc = d.prepare("SELECT COUNT(*) c FROM supply WHERE location = ?").get(loc).c;
        canonicalMap[key].supply_count += sc;

        // Valid prices
        const pdata = d.prepare("SELECT AVG(price) avg, COUNT(*) c FROM supply WHERE location = ? AND price > 50000 AND price < 100000000").get(loc);
        if (pdata.c > 0) {
          canonicalMap[key].price_sum += (pdata.avg * pdata.c);
          canonicalMap[key].price_count += pdata.c;
        }

        // Min/Max
        const prange = d.prepare("SELECT MIN(price) mn, MAX(price) mx FROM supply WHERE location = ? AND price > 50000 AND price < 100000000").get(loc);
        if (!canonicalMap[key].min_price || (prange.mn && prange.mn < canonicalMap[key].min_price)) canonicalMap[key].min_price = prange.mn;
        if (!canonicalMap[key].max_price || (prange.mx && prange.mx > canonicalMap[key].max_price)) canonicalMap[key].max_price = prange.mx;

        // Purpose breakdown
        const purposes = d.prepare("SELECT purpose, COUNT(*) c FROM supply WHERE location = ? AND purpose IS NOT NULL GROUP BY purpose").all(loc);
        for (const p of purposes) {
          if (p.purpose && p.purpose.toLowerCase().includes('sale')) canonicalMap[key].sale_supply += p.c;
          else if (p.purpose && p.purpose.toLowerCase().includes('rent')) canonicalMap[key].rent_supply += p.c;
        }

        // Property types
        const ptypes = d.prepare("SELECT property_type, COUNT(*) c FROM supply WHERE location = ? AND property_type IS NOT NULL GROUP BY property_type").all(loc);
        for (const pt of ptypes) {
          canonicalMap[key].prop_type_supply[pt.property_type] = (canonicalMap[key].prop_type_supply[pt.property_type] || 0) + pt.c;
        }
      }

      // Process demand
      for (const loc of demandLocs) {
        const key = canonicalKey(loc) || loc.trim();
        const coordsObj = getCoordsV2(loc);
        initCanon(key, getLabelV2(loc), coordsObj);

        const dc = d.prepare("SELECT COUNT(*) c FROM demand WHERE location = ?").get(loc).c;
        canonicalMap[key].demand_count += dc;

        // Valid budgets
        const bdata = d.prepare("SELECT AVG(price_max) avg, COUNT(*) c FROM demand WHERE location = ? AND price_max > 10000 AND price_max < 100000000").get(loc);
        if (bdata.c > 0) {
          canonicalMap[key].budget_sum += (bdata.avg * bdata.c);
          canonicalMap[key].budget_count += bdata.c;
        }

        // Bedrooms
        const beds = d.prepare("SELECT bedrooms, COUNT(*) c FROM demand WHERE location = ? AND bedrooms IS NOT NULL GROUP BY bedrooms ORDER BY c DESC").all(loc);
        for (const b of beds) {
          canonicalMap[key].bedrooms_demand[b.bedrooms] = (canonicalMap[key].bedrooms_demand[b.bedrooms] || 0) + b.c;
        }

        // Purpose demand
        const pdems = d.prepare("SELECT purpose, COUNT(*) c FROM demand WHERE location = ? AND purpose IS NOT NULL GROUP BY purpose").all(loc);
        for (const p of pdems) {
          canonicalMap[key].purpose_demand[p.purpose] = (canonicalMap[key].purpose_demand[p.purpose] || 0) + p.c;
        }
      }

      d.close();

      // Build output
      const markets = Object.values(canonicalMap)
        .filter(m => m.supply_count > 0 || m.demand_count > 0)
        .map(m => {
          const avg_price = m.price_count > 0 ? Math.round(m.price_sum / m.price_count) : 0;
          const avg_budget = m.budget_count > 0 ? Math.round(m.budget_sum / m.budget_count) : 0;
          const pressure_index = m.supply_count > 0 ? parseFloat((m.demand_count / m.supply_count).toFixed(2)) : (m.demand_count > 0 ? 99 : 0);
          const total_purpose_supply = m.sale_supply + m.rent_supply;
          const sale_pct = total_purpose_supply > 0 ? parseFloat((m.sale_supply / total_purpose_supply * 100).toFixed(1)) : 0;
          const rent_pct = total_purpose_supply > 0 ? parseFloat((m.rent_supply / total_purpose_supply * 100).toFixed(1)) : 0;
          const top_prop = Object.entries(m.prop_type_supply).sort((a,b)=>b[1]-a[1])[0]?.[0] || null;
          const top_beds = Object.entries(m.bedrooms_demand).sort((a,b)=>b[1]-a[1])[0]?.[0] || null;
          const market_signal = getMarketSignal(pressure_index);

          return {
            canonical_key: m.canonical_key,
            label: m.label,
            lat: m.lat,
            lng: m.lng,
            supply_count: m.supply_count,
            demand_count: m.demand_count,
            avg_price,
            min_price: m.min_price || 0,
            max_price: m.max_price || 0,
            avg_budget,
            pressure_index,
            sale_pct,
            rent_pct,
            top_property_type: top_prop,
            top_bedrooms: top_beds ? parseInt(top_beds) : null,
            market_signal,
          };
        })
        .sort((a, b) => b.demand_count - a.demand_count);

      res.json({ count: markets.length, markets, generated_at: new Date().toISOString() });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  // ─── /api/market/heatmap/v2 ──────────────────────────────────────────────
  app.get('/api/market/heatmap/v2', (req, res) => {
    try {
      const d = dbFn();
      const demandLocs = d.prepare("SELECT location, COUNT(*) cnt FROM demand WHERE location IS NOT NULL AND location != '' GROUP BY location").all();
      const supplyLocs = d.prepare("SELECT location, COUNT(*) cnt FROM supply WHERE location IS NOT NULL AND location != '' GROUP BY location").all();
      d.close();

      // Merge by canonical key
      const byKey = {};
      for (const r of demandLocs) {
        const key = canonicalKey(r.location) || r.location.trim();
        if (!byKey[key]) byKey[key] = { demand: 0, supply: 0, label: getLabelV2(r.location), coords: getCoordsV2(r.location) };
        byKey[key].demand += r.cnt;
      }
      for (const r of supplyLocs) {
        const key = canonicalKey(r.location) || r.location.trim();
        if (!byKey[key]) byKey[key] = { demand: 0, supply: 0, label: getLabelV2(r.location), coords: getCoordsV2(r.location) };
        byKey[key].supply += r.cnt;
      }

      const rows = Object.entries(byKey)
        .map(([key, v]) => {
          const coords = v.coords || CANONICAL_COORDS[key];
          if (!coords) return null;
          const pressure_index = v.supply > 0 ? parseFloat((v.demand / v.supply).toFixed(2)) : (v.demand > 0 ? 99 : 0);
          return {
            canonical_key: key,
            location_label: v.label || key,
            lat: coords.lat,
            lng: coords.lng,
            demand_count: v.demand,
            supply_count: v.supply,
            pressure_index,
            intensity: v.demand,
          };
        })
        .filter(Boolean)
        .sort((a, b) => b.demand_count - a.demand_count);

      res.json({ count: rows.length, rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  // ─── /api/public/market-intelligence ─────────────────────────────────────
  app.get('/api/public/market-intelligence', (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    try {
      const d = dbFn();
      const total_supply = d.prepare("SELECT COUNT(*) c FROM supply").get().c;
      const total_demand = d.prepare("SELECT COUNT(*) c FROM demand").get().c;
      const total_matches = d.prepare("SELECT COUNT(*) c FROM matches").get().c;

      // Build canonical market data
      const demandLocs = d.prepare("SELECT location, COUNT(*) cnt, AVG(price_max) avg_budget FROM demand WHERE location IS NOT NULL AND location != '' GROUP BY location").all();
      const supplyLocs = d.prepare("SELECT location, COUNT(*) cnt, AVG(price) avg_price FROM supply WHERE location IS NOT NULL AND location != '' GROUP BY location").all();

      const byKey = {};
      for (const r of supplyLocs) {
        const key = canonicalKey(r.location) || r.location.trim();
        const coords = getCoordsV2(r.location) || CANONICAL_COORDS[key];
        if (!byKey[key]) byKey[key] = { label: getLabelV2(r.location), coords, supply_cnt: 0, demand_cnt: 0, price_sum: 0, price_wt: 0, budget_sum: 0, budget_wt: 0, sale: 0, rent: 0 };
        byKey[key].supply_cnt += r.cnt;

        // Valid price avg
        const pv = d.prepare("SELECT AVG(price) avg, COUNT(*) c FROM supply WHERE location = ? AND price > 50000 AND price < 100000000").get(r.location);
        if (pv.c > 0) { byKey[key].price_sum += pv.avg * pv.c; byKey[key].price_wt += pv.c; }

        // Purpose
        const purp = d.prepare("SELECT purpose, COUNT(*) c FROM supply WHERE location = ? GROUP BY purpose").all(r.location);
        for (const p of purp) {
          if ((p.purpose||'').toLowerCase().includes('sale')) byKey[key].sale += p.c;
          else if ((p.purpose||'').toLowerCase().includes('rent')) byKey[key].rent += p.c;
        }
      }
      for (const r of demandLocs) {
        const key = canonicalKey(r.location) || r.location.trim();
        const coords = getCoordsV2(r.location) || CANONICAL_COORDS[key];
        if (!byKey[key]) byKey[key] = { label: getLabelV2(r.location), coords, supply_cnt: 0, demand_cnt: 0, price_sum: 0, price_wt: 0, budget_sum: 0, budget_wt: 0, sale: 0, rent: 0 };
        byKey[key].demand_cnt += r.cnt;

        const bv = d.prepare("SELECT AVG(price_max) avg, COUNT(*) c FROM demand WHERE location = ? AND price_max > 10000 AND price_max < 100000000").get(r.location);
        if (bv.c > 0) { byKey[key].budget_sum += bv.avg * bv.c; byKey[key].budget_wt += bv.c; }
      }

      d.close();

      const markets = Object.entries(byKey)
        .filter(([, v]) => v.supply_cnt > 0 || v.demand_cnt > 0)
        .map(([key, v]) => {
          const avg_price = v.price_wt > 0 ? Math.round(v.price_sum / v.price_wt) : 0;
          const avg_budget = v.budget_wt > 0 ? Math.round(v.budget_sum / v.budget_wt) : 0;
          const pressure_index = v.supply_cnt > 0 ? parseFloat((v.demand_cnt / v.supply_cnt).toFixed(2)) : 99;
          const total_sup = v.sale + v.rent;
          return {
            location: v.label || key,
            canonical: key,
            lat: v.coords?.lat || null,
            lng: v.coords?.lng || null,
            supply: {
              count: v.supply_cnt,
              avg_price_egp: avg_price,
              sale_pct: total_sup > 0 ? parseFloat((v.sale / total_sup * 100).toFixed(1)) : 0,
              rent_pct: total_sup > 0 ? parseFloat((v.rent / total_sup * 100).toFixed(1)) : 0,
            },
            demand: {
              count: v.demand_cnt,
              avg_budget_egp: avg_budget,
            },
            pressure_index,
            market_signal: getMarketSignal(pressure_index),
          };
        })
        .sort((a, b) => b.demand.count - a.demand.count);

      res.json({
        version: '10.0.0',
        generated_at: new Date().toISOString(),
        summary: { total_supply, total_demand, total_matches, active_locations: markets.length },
        markets,
      });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  // ─── Enhanced /api/public/embed/:location ────────────────────────────────
  app.get('/api/public/embed/v2/:location', (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    try {
      const loc = req.params.location;
      const d = dbFn();

      // Find all aliases for this location
      const key = canonicalKey(loc) || loc;
      const aliases = Object.entries(LOCATION_ALIASES).filter(([, v]) => v === key).map(([k]) => k);
      if (!aliases.includes(loc)) aliases.push(loc);

      const placeholders = aliases.map(() => '?').join(',');
      const demand_count = d.prepare(`SELECT COUNT(*) c FROM demand WHERE location IN (${placeholders})`).get(...aliases).c;
      const supply_count = d.prepare(`SELECT COUNT(*) c FROM supply WHERE location IN (${placeholders})`).get(...aliases).c;
      const avgRow = d.prepare(`SELECT AVG(price) v FROM supply WHERE location IN (${placeholders}) AND price > 50000 AND price < 100000000`).get(...aliases);
      const avg_price = Math.round(avgRow.v || 0);
      const pressure_index = supply_count > 0 ? parseFloat((demand_count / supply_count).toFixed(2)) : 99;
      d.close();

      const coords = CANONICAL_COORDS[key] || null;
      res.json({
        location: CANONICAL_LABELS[key] || loc,
        canonical: key,
        lat: coords?.lat || null,
        lng: coords?.lng || null,
        demand_count,
        supply_count,
        avg_price,
        pressure_index,
        market_signal: getMarketSignal(pressure_index),
        last_updated: new Date().toISOString(),
      });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  // ─── /api/whatsapp/notify ────────────────────────────────────────────────
  app.post('/api/whatsapp/notify', (req, res) => {
    const { message, chatId } = req.body;
    if (!message) return res.status(400).json({ error: 'message required' });
    const target = chatId || '201066505665@c.us';
    const body = JSON.stringify({ chatId: target, message });
    const url = 'https://7105.api.greenapi.com/waInstance7105409203/sendMessage/0e7ca429980f4331ae5fee4360c955a9db2d6fe3ca6545a4b3';
    const reqHttp = require('https').request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, resp => {
      let data = '';
      resp.on('data', c => data += c);
      resp.on('end', () => res.json({ ok: true, status: resp.statusCode, response: data }));
    });
    reqHttp.on('error', e => res.status(500).json({ error: e.message }));
    reqHttp.write(body);
    reqHttp.end();
  });

  // ─── Enhanced webhook with location-aware alerts ─────────────────────────
  // Monkey-patch the existing webhook by adding location-detection logic
  // We'll add a new endpoint for v2 webhook processing
  app.post('/webhook/whatsapp/v2', (req, res) => {
    res.status(200).json({ ok: true });
    setImmediate(async () => {
      try {
        const payload = req.body;
        const msgData = payload.messageData || {};
        const senderData = payload.senderData || {};
        const textMsg = msgData.textMessageData?.textMessage || msgData.extendedTextMessageData?.text || '';
        if (!textMsg) return;

        const senderPhone = (senderData.sender || '').replace('@c.us','');
        const senderName = senderData.senderName || '';

        // Detect location in message
        let detectedLocation = null;
        let detectedKey = null;
        for (const [alias, key] of Object.entries(LOCATION_ALIASES)) {
          if (textMsg.includes(alias)) {
            detectedLocation = alias;
            detectedKey = key;
            break;
          }
        }

        if (!detectedLocation) return; // no location found

        // Get market data for this location
        const d = dbFn();
        const aliases = Object.entries(LOCATION_ALIASES).filter(([, v]) => v === detectedKey).map(([k]) => k);
        const ph = aliases.map(() => '?').join(',');

        const supply_count = d.prepare(`SELECT COUNT(*) c FROM supply WHERE location IN (${ph})`).get(...aliases).c;
        const demand_count = d.prepare(`SELECT COUNT(*) c FROM demand WHERE location IN (${ph})`).get(...aliases).c;
        const top_supply = d.prepare(`SELECT location, property_type, bedrooms, price, purpose, sender_phone FROM supply WHERE location IN (${ph}) AND price > 50000 AND price < 100000000 ORDER BY created_at DESC LIMIT 3`).all(...aliases);
        const top_demand = d.prepare(`SELECT location, property_type, bedrooms, price_max, purpose FROM demand WHERE location IN (${ph}) AND price_max > 10000 AND price_max < 100000000 ORDER BY created_at DESC LIMIT 3`).all(...aliases);
        d.close();

        const label = CANONICAL_LABELS[detectedKey] || detectedLocation;
        const pressure = supply_count > 0 ? (demand_count / supply_count).toFixed(1) : '∞';
        const signal = getMarketSignal(parseFloat(pressure));
        const signalEmoji = signal === 'seller' ? '🔴 Seller\'s Market' : signal === 'buyer' ? '🟢 Buyer\'s Market' : '🟡 Balanced';

        let notif = `🔔 *MatchPro — Location Alert: ${label}*\n\n`;
        notif += `📱 From: ${senderName || senderPhone}\n`;
        notif += `💬 "${textMsg.slice(0, 150)}"\n\n`;
        notif += `📊 *${label} Market Snapshot:*\n`;
        notif += `• 🏠 Supply: ${supply_count.toLocaleString()} listings\n`;
        notif += `• 👥 Demand: ${demand_count.toLocaleString()} buyers/renters\n`;
        notif += `• 📈 Pressure: ${pressure}x — ${signalEmoji}\n\n`;

        if (top_supply.length) {
          notif += `🏷️ *Top Supply (${label}):*\n`;
          top_supply.forEach((s, i) => {
            const price = s.price ? s.price.toLocaleString('en-EG') + ' EGP' : 'N/A';
            notif += `${i+1}. ${s.property_type || 'Property'} ${s.bedrooms ? s.bedrooms+'BR' : ''} — ${price} [${s.purpose || ''}]\n`;
          });
          notif += '\n';
        }
        if (top_demand.length) {
          notif += `🔍 *Active Buyers (${label}):*\n`;
          top_demand.forEach((dem, i) => {
            const budget = dem.price_max ? dem.price_max.toLocaleString('en-EG') + ' EGP' : 'N/A';
            notif += `${i+1}. ${dem.property_type || 'Any'} ${dem.bedrooms ? dem.bedrooms+'BR' : ''} — Budget: ${budget}\n`;
          });
        }

        const wa = require('https');
        const waBody = JSON.stringify({ chatId: '201066505665@c.us', message: notif });
        const waUrl = 'https://7105.api.greenapi.com/waInstance7105409203/sendMessage/0e7ca429980f4331ae5fee4360c955a9db2d6fe3ca6545a4b3';
        const waReq = wa.request(waUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(waBody) }
        }, r => { r.resume(); });
        waReq.on('error', e => console.error('WA notify error:', e.message));
        waReq.write(waBody);
        waReq.end();
      } catch(e) { console.error('Webhook v2 error:', e.message); }
    });
  });

  console.log('✅ Market Intelligence v2 endpoints attached');
};
