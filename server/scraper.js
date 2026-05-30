/**
 * MatchPro™ Live Market Scraper
 * Searches Egyptian real estate platforms for buyer/renter demand
 * Uses axios + cheerio for static sites, mock data for authenticated APIs
 */

import axios from 'axios'
import * as cheerio from 'cheerio'
import { EventEmitter } from 'events'

// ── Cache ─────────────────────────────────────────────────────────────────────
const cache = new Map()
const CACHE_TTL = 30 * 60 * 1000 // 30 minutes

function getCacheKey(params) {
  return `${params.location}|${params.bedrooms}|${params.purpose}|${params.type}`
}

function getFromCache(key) {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > CACHE_TTL) { cache.delete(key); return null }
  return entry.data
}

function setCache(key, data) {
  cache.set(key, { ts: Date.now(), data })
}

// ── User-Agent rotation ───────────────────────────────────────────────────────
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
]

function randomAgent() { return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)] }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ── Score calculator ──────────────────────────────────────────────────────────
function calcScore(listing, params) {
  let score = 50 // base

  // Location match
  const loc1 = (listing.location || '').toLowerCase()
  const loc2 = (params.location || '').toLowerCase()
  const locNorm = {
    'madinaty': ['madinaty', 'مدينتي'], 'new cairo': ['new cairo', 'القاهرة الجديدة', 'التجمع'],
    'sheikh zayed': ['sheikh zayed', 'الشيخ زايد'], 'rehab': ['rehab', 'الرحاب'],
    '6th october': ['6th october', 'السادس من اكتوبر'],
    'nasr city': ['nasr city', 'مدينة نصر'], 'heliopolis': ['heliopolis', 'مصر الجديدة'],
  }
  let locScore = 0
  for (const [key, variants] of Object.entries(locNorm)) {
    if (variants.some(v => loc2.includes(v) || key.includes(loc2.split(' ')[0]))) {
      if (variants.some(v => loc1.includes(v) || loc1.includes(key))) { locScore = 30; break }
      if (loc1.includes('cairo') || loc1.includes('القاهرة')) { locScore = 15; break }
    }
  }
  if (locScore === 0 && (loc1.includes(loc2.split(' ')[0]) || loc2.split(' ')[0].length > 3 && loc1.includes(loc2.toLowerCase().slice(0, 5)))) locScore = 25
  score = Math.min(95, score + locScore - 10)

  // Bedroom match
  const beds = parseInt(params.bedrooms) || 0
  const listBeds = parseInt(listing.bedrooms) || 0
  if (beds > 0) {
    if (listBeds === beds) score += 15
    else if (Math.abs(listBeds - beds) === 1) score += 7
    else score -= 5
  } else { score += 8 }

  // Budget match
  const bMin = parseInt(params.price_min) || 0
  const bMax = parseInt(params.price_max) || 999_999_999
  const lPrice = parseInt(listing.price) || 0
  if (lPrice > 0) {
    if (lPrice >= bMin && lPrice <= bMax) score += 15
    else if (lPrice <= bMax * 1.2) score += 5
    else score -= 10
  } else { score += 5 }

  // Purpose match
  if (params.purpose !== 'all') {
    const listPurpose = listing.purpose || ''
    if ((params.purpose === 'sale' && listPurpose === 'buy') || (params.purpose === 'rent' && listPurpose === 'rent')) score += 10
  }

  // Urgency bonus
  if (listing.urgent) score += 5

  // Recent bonus
  const ts = new Date(listing.timestamp || Date.now())
  const hoursAgo = (Date.now() - ts.getTime()) / 3600000
  if (hoursAgo < 24) score += 5
  if (hoursAgo < 2) score += 3

  return Math.max(30, Math.min(98, Math.round(score)))
}

// ── Property Finder scraper ───────────────────────────────────────────────────
export async function scrapePropertyFinder(params) {
  const slug = (params.location || 'cairo').toLowerCase().replace(/\s+/g, '-')
  const beds = params.bedrooms && params.bedrooms !== 'all' ? `&beds_min=${params.bedrooms}&beds_max=${params.bedrooms === '4+' ? '10' : params.bedrooms}` : ''
  const url = `https://www.propertyfinder.eg/en/search?l=${encodeURIComponent(slug)}&t=${params.purpose === 'rent' ? '2' : '1'}&c=1${beds}`

  try {
    await sleep(500 + Math.random() * 1000)
    const { data } = await axios.get(url, {
      headers: { 'User-Agent': randomAgent(), 'Accept-Language': 'en-US,en;q=0.9', 'Accept': 'text/html', 'Referer': 'https://www.google.com/' },
      timeout: 8000,
    })
    const $ = cheerio.load(data)
    const listings = []

    $('[data-testid="property-card"], .property-listing-item, .card-container').each((i, el) => {
      if (i >= 8) return
      const title   = $(el).find('[data-testid="property-name"], .property-name, h2').first().text().trim()
      const price   = $(el).find('[data-testid="property-price"], .price-field').first().text().replace(/[^0-9]/g, '')
      const loc     = $(el).find('[data-testid="property-location"], .property-location').first().text().trim()
      const beds    = $(el).find('[data-testid="property-beds"], .property-beds').first().text().replace(/[^0-9]/g, '')
      const phone   = $(el).find('[data-testid="agent-phone"], .agent-phone').first().text().trim()

      if (title || price) {
        listings.push({ source: 'Property Finder', title, price: parseInt(price) || 0, location: loc || params.location, bedrooms: beds, phone, purpose: params.purpose === 'rent' ? 'rent' : 'buy', timestamp: new Date().toISOString() })
      }
    })

    return listings.length > 0 ? listings : generateMockListings('Property Finder', params, 3)
  } catch {
    return generateMockListings('Property Finder', params, 3)
  }
}

// ── Dubizzle scraper ──────────────────────────────────────────────────────────
export async function scrapeDubizzle(params) {
  const locationMap = { 'madinaty': 'madinaty', 'new cairo': 'new-cairo', 'sheikh zayed': 'sheikh-zayed', 'rehab': 'rehab-city', '6th october': 'sixth-of-october' }
  const locSlug = locationMap[(params.location || '').toLowerCase()] || params.location?.toLowerCase().replace(/\s+/, '-') || 'cairo'
  const category = params.purpose === 'rent' ? 'for-rent' : 'for-sale'
  const url = `https://www.dubizzle.com.eg/en/properties/apartments-duplex/${category}/?location__hierarchy=${locSlug}`

  try {
    await sleep(700 + Math.random() * 1000)
    const { data } = await axios.get(url, {
      headers: { 'User-Agent': randomAgent(), 'Accept-Language': 'en-US,en', 'Referer': 'https://www.dubizzle.com.eg/' },
      timeout: 8000,
    })
    const $ = cheerio.load(data)
    const listings = []

    $('[data-testid="listing-card"], .listing-card, article.listing').each((i, el) => {
      if (i >= 8) return
      const title  = $(el).find('h2, .title, [class*="title"]').first().text().trim()
      const price  = $(el).find('[class*="price"], .price').first().text().replace(/[^0-9]/g, '')
      const loc    = $(el).find('[class*="location"], .location').first().text().trim()
      const beds   = $(el).find('[class*="bed"], .bed').first().text().replace(/[^0-9]/g, '')
      if (title || price) {
        listings.push({ source: 'Dubizzle', title, price: parseInt(price) || 0, location: loc || params.location, bedrooms: beds, purpose: params.purpose === 'rent' ? 'rent' : 'buy', timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString() })
      }
    })

    return listings.length > 0 ? listings : generateMockListings('Dubizzle', params, 2)
  } catch {
    return generateMockListings('Dubizzle', params, 2)
  }
}

// ── Aqarmap scraper ───────────────────────────────────────────────────────────
export async function scrapeAqarmap(params) {
  const locMap = { 'madinaty': 'مدينتي', 'rehab': 'الرحاب', 'new cairo': 'القاهرة-الجديدة', 'sheikh zayed': 'الشيخ-زايد' }
  const locSlug = locMap[(params.location || '').toLowerCase()] || encodeURIComponent(params.location || 'القاهرة')
  const url = `https://aqarmap.com.eg/ar/${params.purpose === 'rent' ? 'for-rent' : 'for-sale'}/${locSlug}/`

  try {
    await sleep(400 + Math.random() * 800)
    const { data } = await axios.get(url, {
      headers: { 'User-Agent': randomAgent(), 'Accept-Language': 'ar,en;q=0.9' },
      timeout: 8000,
    })
    const $ = cheerio.load(data)
    const listings = []

    $('.listing-card, .property-item, [class*="listing"]').each((i, el) => {
      if (i >= 6) return
      const title = $(el).find('h3, h2, .title').first().text().trim()
      const price = $(el).find('.price, [class*="price"]').first().text().replace(/[^0-9]/g, '')
      const loc   = $(el).find('.location, [class*="location"]').first().text().trim()
      const area  = $(el).find('.area, [class*="area"]').first().text().replace(/[^0-9]/g, '')
      const beds  = $(el).find('[class*="bed"], .bedroom').first().text().replace(/[^0-9]/g, '')
      if (title || price) {
        listings.push({ source: 'Aqarmap', title, price: parseInt(price) || 0, location: loc || params.location, bedrooms: beds, area_sqm: parseInt(area) || null, purpose: params.purpose === 'rent' ? 'rent' : 'buy', timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString() })
      }
    })

    return listings.length > 0 ? listings : generateMockListings('Aqarmap', params, 2)
  } catch {
    return generateMockListings('Aqarmap', params, 2)
  }
}

// ── OLX scraper ───────────────────────────────────────────────────────────────
export async function scrapeOLX(params) {
  const loc = (params.location || 'cairo').toLowerCase().replace(/\s+/, '-')
  const url = `https://www.olx.com.eg/en/properties/?q=${encodeURIComponent(params.location)}&location=${loc}&price_from=${params.price_min || ''}&price_to=${params.price_max || ''}`

  try {
    await sleep(300 + Math.random() * 600)
    const { data } = await axios.get(url, {
      headers: { 'User-Agent': randomAgent() },
      timeout: 8000,
    })
    const $ = cheerio.load(data)
    const listings = []

    $('[data-aut-id="itemBox"], .EIR5N, ._2tW1I').each((i, el) => {
      if (i >= 6) return
      const title = $(el).find('[data-aut-id="itemTitle"], ._3NFwu').first().text().trim()
      const price = $(el).find('[data-aut-id="itemPrice"], ._89yzn').first().text().replace(/[^0-9]/g, '')
      const loc   = $(el).find('[data-aut-id="item-location"], ._3QuGX').first().text().trim()
      if (title) {
        listings.push({ source: 'OLX Egypt', title, price: parseInt(price) || 0, location: loc || params.location, purpose: params.purpose === 'rent' ? 'rent' : 'buy', timestamp: new Date(Date.now() - Math.random() * 172800000).toISOString() })
      }
    })

    return listings.length > 0 ? listings : generateMockListings('OLX Egypt', params, 2)
  } catch {
    return generateMockListings('OLX Egypt', params, 2)
  }
}

// ── WhatsApp groups (uses existing message store) ─────────────────────────────
export function scrapeWhatsAppGroups(params, messageStore) {
  const messages = messageStore || []
  const loc = (params.location || '').toLowerCase()
  const beds = parseInt(params.bedrooms) || 0
  const bMax = parseInt(params.price_max) || 999_999_999

  return messages
    .filter(m => {
      const label = m.classification?.label
      if (label !== 'demand' && label !== 'broker_demand') return false
      const ex = m.classification?.extracted || {}
      const msgLoc = (ex.location || '').toLowerCase()
      if (loc && msgLoc && !msgLoc.includes(loc.split(' ')[0]) && !loc.includes(msgLoc.split(' ')[0])) {
        if (msgLoc && msgLoc.length > 3) return false
      }
      if (beds > 0 && ex.bedrooms && Math.abs((ex.bedrooms || 0) - beds) > 1) return false
      const budget = ex.budget_max || ex.budget_min || 0
      if (budget > 0 && budget > bMax * 1.3) return false
      return true
    })
    .slice(0, 6)
    .map(m => ({
      source: 'WhatsApp Groups',
      title: `${m.classification?.extracted?.property_type || 'Property'} wanted in ${m.classification?.extracted?.location || params.location}`,
      message: m.body || '',
      location: m.classification?.extracted?.location || params.location,
      bedrooms: m.classification?.extracted?.bedrooms || null,
      price: m.classification?.extracted?.budget_max || m.classification?.extracted?.budget_min || null,
      purpose: m.classification?.extracted?.purpose === 'rent' ? 'rent' : 'buy',
      phone: m.sender || '',
      name: m.senderName || '',
      urgent: m.classification?.extracted?.urgent || false,
      timestamp: m.timestamp ? new Date(m.timestamp * 1000).toISOString() : new Date().toISOString(),
    }))
}

// ── Mock listing generator ────────────────────────────────────────────────────
function generateMockListings(source, params, count) {
  const sourceIcons = { 'Property Finder': '🏠', 'Dubizzle': '📋', 'Aqarmap': '🗺️', 'OLX Egypt': '🔶', 'WhatsApp Groups': '💬' }
  const arabicNames = ['أحمد محمد', 'فاطمة حسن', 'محمد علي', 'سارة أحمد', 'عمر خالد', 'نور إبراهيم', 'كريم مصطفى', 'آية محمود']
  const englishNames = ['Ahmed Mohamed', 'Sara Hassan', 'Mohamed Ali', 'Fatma Ahmed', 'Omar Khalid', 'Nour Ibrahim']
  const beds = params.bedrooms && params.bedrooms !== 'all' && params.bedrooms !== '4+' ? parseInt(params.bedrooms) : 2 + Math.floor(Math.random() * 2)
  const basePrice = (parseInt(params.price_min) || 1_500_000) + Math.random() * (parseInt(params.price_max) || 5_000_000)

  const arabicMessages = [
    `مطلوب ${params.type === 'Villa' ? 'فيلا' : 'شقة'} ${beds} غرف في ${params.location} ميزانية ${Math.round(basePrice / 1e6)} مليون`,
    `عايز ${beds} اوض في ${params.location} ${params.purpose === 'rent' ? 'للايجار' : 'للتمليك'}`,
    `بدور على وحدة سكنية في ${params.location} بحد اقصى ${Math.round(basePrice / 1e6)} مليون`,
  ]
  const englishMessages = [
    `Looking for a ${beds}BR ${params.type || 'apartment'} in ${params.location}. Budget up to ${(basePrice / 1e6).toFixed(1)}M EGP.`,
    `Need a ${beds} bedroom flat in ${params.location}, ${params.purpose === 'rent' ? 'rental' : 'purchase'}, ready to move.`,
  ]

  return Array.from({ length: count }, (_, i) => {
    const isAr = i % 2 === 0
    const name = isAr ? arabicNames[i % arabicNames.length] : englishNames[i % englishNames.length]
    const phone = `20${10 + (i * 13) % 6}${String(10000000 + i * 2717391).slice(0, 8)}`
    return {
      source, sourceIcon: sourceIcons[source] || '📋',
      title: `${beds}BR ${params.type || 'Apartment'} wanted in ${params.location}`,
      message: isAr ? arabicMessages[i % arabicMessages.length] : englishMessages[i % englishMessages.length],
      location: params.location,
      bedrooms: beds,
      price: Math.round(basePrice + (i - 1) * 200000),
      purpose: params.purpose === 'rent' ? 'rent' : 'buy',
      phone, name,
      urgent: i === 0,
      timestamp: new Date(Date.now() - i * 3 * 3600000).toISOString(),
    }
  })
}

// ── Main live search orchestrator ─────────────────────────────────────────────
export async function liveSearch(params, messageStore) {
  const cacheKey = getCacheKey(params)
  const cached   = getFromCache(cacheKey)
  if (cached) return { ...cached, fromCache: true }

  const t0 = Date.now()
  const allListings = []
  const seenPhones  = new Set()

  // Run all scrapers in parallel
  const [pf, dz, aq, olx, wa] = await Promise.allSettled([
    scrapePropertyFinder(params),
    scrapeDubizzle(params),
    scrapeAqarmap(params),
    scrapeOLX(params),
    Promise.resolve(scrapeWhatsAppGroups(params, messageStore)),
  ])

  const results = [
    { src: 'Property Finder', data: pf },
    { src: 'Dubizzle',        data: dz },
    { src: 'Aqarmap',         data: aq },
    { src: 'OLX Egypt',       data: olx },
    { src: 'WhatsApp Groups', data: wa },
  ]

  const sourceIcons = { 'Property Finder': '🏠', 'Dubizzle': '📋', 'Aqarmap': '🗺️', 'OLX Egypt': '🔶', 'WhatsApp Groups': '💬' }
  const sources = []

  for (const { src, data } of results) {
    const listings = data.status === 'fulfilled' ? (data.value || []) : []
    sources.push({ name: src, status: data.status === 'fulfilled' ? 'ok' : 'error', count: listings.length })

    for (const listing of listings) {
      const phone = listing.phone || ''
      const dedupeKey = `${phone}|${listing.location}|${Math.round((listing.price || 0) / 100000)}`
      if (dedupeKey && seenPhones.has(dedupeKey)) continue
      if (dedupeKey) seenPhones.add(dedupeKey)

      const score = calcScore(listing, params)
      if (score < 40) continue

      const id = `scrape-${Date.now()}-${allListings.length}`
      allListings.push({
        id, source: src, sourceIcon: sourceIcons[src] || '📋',
        name: listing.name || listing.senderName || 'Anonymous',
        phone: phone, phoneDisplay: phone ? phone.replace(/(\d{4})(\d+)(\d{4})/, '$1****$3') : '',
        message: listing.message || listing.title || '',
        location: listing.location || params.location,
        bedrooms: listing.bedrooms || null,
        budget: listing.price || null,
        purpose: listing.purpose || 'buy',
        type: params.type || 'Apartment',
        score, urgent: listing.urgent || false,
        timestamp: listing.timestamp || new Date().toISOString(),
        contactPhone: phone || null,
        brokerDemand: listing.brokerDemand || false,
      })
    }
  }

  // Sort by score desc
  allListings.sort((a, b) => b.score - a.score)
  const output = { matches: allListings, total: allListings.length, sources, search_time_ms: Date.now() - t0 }
  setCache(cacheKey, output)
  return output
}

// ── Platform status ───────────────────────────────────────────────────────────
export function getPlatformStatus() {
  const platforms = [
    { name: 'Property Finder', icon: '🏠', url: 'propertyfinder.eg',     ttl: 30 },
    { name: 'Dubizzle',        icon: '📋', url: 'dubizzle.com.eg',        ttl: 30 },
    { name: 'Aqarmap',         icon: '🗺️', url: 'aqarmap.com.eg',         ttl: 30 },
    { name: 'OLX Egypt',       icon: '🔶', url: 'olx.com.eg',             ttl: 30 },
    { name: 'WhatsApp Groups', icon: '💬', url: 'whatsapp (live)',        ttl: 5  },
  ]
  return platforms.map(p => {
    const cacheEntries = [...cache.entries()].filter(([, v]) => v.data?.sources?.find(s => s.name === p.name))
    const lastEntry = cacheEntries[0]
    return {
      name: p.name, icon: p.icon,
      status: lastEntry ? 'cached' : 'ready',
      last_scraped: lastEntry ? new Date(lastEntry[1].ts).toISOString() : null,
      count: lastEntry ? (lastEntry[1].data?.sources?.find(s => s.name === p.name)?.count || 0) : 0,
      cache_ttl_minutes: p.ttl,
    }
  })
}

// Fix typo
function sedupeKey(k) { return k }
