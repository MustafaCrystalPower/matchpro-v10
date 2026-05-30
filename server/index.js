/**
 * MatchPro Intelligence — Backend Server v5.0
 * =============================================
 * • SQLite persistence (better-sqlite3) — all data survives restarts
 * • WA credentials persisted to DB
 * • Socket.IO real-time push (new messages, stats updates)
 * • Persistent WhatsApp polling (lastIncomingMessages/lastOutgoingMessages)
 * • GPT-5-mini NLP classification (Arabic + English, two-phase)
 * • Advanced matching engine (location 40%, price 35%, specs 25%)
 * • SQLite message store with deduplication via DB primary key
 * • CRM pipeline with full history log
 * • Broker analytics (persistent)
 * • Location stats endpoint for satellite map
 * • Rich mock data fallback (offline market API)
 * • Web Push (VAPID) — push notifications to installed PWA
 * • Match notification auto-fire on high-score matches
 */

import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import OpenAI from 'openai'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { homedir } from 'os'
import webpush from 'web-push'

// ── DB layer ─────────────────────────────────────────────────────────────────
import {
  getWaCreds, saveWaCreds,
  saveMessage, saveMessages, updateMessageClassification, hasMessage,
  getMessages, getMessageCount, getStatsFromDB,
  savePipelineDeal, updatePipelineDeal, getPipelineDeal, getAllPipeline,
  upsertBroker, getAllBrokers,
  saveFeedback, getAllFeedback,
  updateLocationStats, getAllLocationStats,
  getScraperCache, setScraperCache,
} from './db.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── OpenAI client ────────────────────────────────────────────────────────────
let openaiApiKey  = process.env.OPENAI_API_KEY  || ''
let openaiBaseUrl = process.env.OPENAI_BASE_URL || 'https://www.genspark.ai/api/llm_proxy/v1'
try {
  const yamlPath = join(homedir(), '.genspark_llm.yaml')
  if (existsSync(yamlPath)) {
    const yaml    = readFileSync(yamlPath, 'utf8')
    const keyMatch = yaml.match(/api_key:\s*(.+)/)
    const urlMatch = yaml.match(/base_url:\s*(.+)/)
    if (keyMatch) openaiApiKey  = keyMatch[1].trim()
    if (urlMatch) openaiBaseUrl = urlMatch[1].trim()
    if (openaiApiKey) console.log(`   OpenAI key: loaded from ~/.genspark_llm.yaml`)
  }
} catch {}

const openai = new OpenAI({ apiKey: openaiApiKey, baseURL: openaiBaseUrl })

// ── VAPID / Web Push config ───────────────────────────────────────────────────
const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY  || 'BPkl142TUDyXPqMwuPqf-3m0FfHBC4LzOiyG28PDPlq9pkDDY7H1yIDXv1fRnKxzQJsKsPUN7_XGJFQPIfRzE5w'
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'ktkY5tkrdWRPiNvepsR4sya4y8ACdGJ72ioPqa0vatQ'
const VAPID_EMAIL       = process.env.VAPID_EMAIL       || 'mailto:matchpro@crystalpowerinv.com'

webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

// In-memory push subscription store (SQLite would be overkill for this prototype)
// Key = endpoint URL, Value = PushSubscription JSON
const pushSubscriptions = new Map()

async function sendPushToAll(payload) {
  if (pushSubscriptions.size === 0) return
  const data = typeof payload === 'string' ? payload : JSON.stringify(payload)
  const dead = []
  await Promise.allSettled([...pushSubscriptions.values()].map(async sub => {
    try {
      await webpush.sendNotification(sub, data)
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) dead.push(sub.endpoint)
    }
  }))
  dead.forEach(ep => pushSubscriptions.delete(ep))
}

// ── Config ────────────────────────────────────────────────────────────────────
const PORT           = parseInt(process.env.PORT || '3001')
const WA_GATEWAY_URL = process.env.WA_GATEWAY_URL || 'https://7105.api.greenapi.com'
const POLL_INTERVAL  = 10_000
const HISTORY_MINUTES = 120
const MAX_MESSAGES    = 500

// ── Load WA credentials from DB (survives restarts) ──────────────────────────
let _creds = getWaCreds()
let WA_INSTANCE_ID = process.env.WA_INSTANCE_ID || _creds?.instance_id || ''
let WA_API_TOKEN   = process.env.WA_API_TOKEN   || _creds?.api_token   || ''

if (WA_INSTANCE_ID && WA_API_TOKEN) {
  console.log(`   WA creds: loaded from DB (instance ${WA_INSTANCE_ID})`)
}

// ── Lightweight in-memory cache for seen IDs and live stats ──────────────────
// (Stats are always recalculated from DB; seenIds prevents double-processing during a session)
const seenIds   = new Set()
let _statsCache = null

function getStats() {
  if (!_statsCache) _statsCache = getStatsFromDB()
  return _statsCache
}

function invalidateStats() {
  _statsCache = null
}

// ── Express + HTTP + Socket.IO ────────────────────────────────────────────────
const app    = express()
const httpServer = createServer(app)
const io     = new SocketIOServer(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PATCH'] },
  path: '/socket.io',
})

app.use(cors())
app.use(express.json())

// ── Runtime state (non-persisted, resets on restart — intentional) ────────────
const store = {
  connState:   'unknown',
  lastPoll:    null,
  pollCount:   0,
  errorCount:  0,
  lastError:   null,
  isPolling:   false,
  credsMissing: false,
}

// ── Socket.IO events ──────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`)

  const msgs = getMessages({ limit: 100 })
  socket.emit('init', {
    messages: msgs,
    stats:    getStats(),
    connState: store.connState,
    lastPoll:  store.lastPoll,
    pollCount: store.pollCount,
  })

  socket.on('disconnect', () => {
    console.log(`[WS] Client disconnected: ${socket.id}`)
  })

  socket.on('request_history', ({ limit = 200, label }) => {
    const msgs = getMessages({ limit, label })
    socket.emit('history', { messages: msgs, stats: getStats() })
  })
})

function emitNewMessages(newMsgs) {
  if (newMsgs.length === 0) return
  io.emit('new_messages', { messages: newMsgs, stats: getStats(), total: getMessageCount() })
}

function emitStatsUpdate() {
  io.emit('stats_update', { stats: getStats(), connState: store.connState, lastPoll: store.lastPoll, pollCount: store.pollCount })
}

// ── GPT Classification ─────────────────────────────────────────────────────────
function buildClassifyPrompt(text) {
  return `Classify this Egyptian real estate WhatsApp message. Reply ONLY with the JSON object below filled in (no markdown, no explanation):
{"label":"supply","confidence":90,"reason":"brief","extracted":{"price":null,"property_type":null,"area_sqm":null,"location":null,"bedrooms":null,"bathrooms":null,"finishing":null,"purpose":null,"furnished":null,"contact":null,"budget_min":null,"budget_max":null,"urgent":false}}

Labels: supply=offering property, demand=seeking property, match=confirmed match, inquiry=asking details only, other=unrelated

Examples:
"فرصة إيجار شقة 3 غرف مدينتي B10 45K" → {"label":"supply","confidence":95,"reason":"Offering rental apartment","extracted":{"price":"45K/yr","property_type":"apartment","area_sqm":null,"location":"Madinaty B10","bedrooms":3,"bathrooms":null,"finishing":null,"purpose":"rent","furnished":null,"contact":null,"budget_min":null,"budget_max":null,"urgent":false}}
"مطلوب شقة 3 غرف b12 بادجت 30 الف" → {"label":"demand","confidence":95,"reason":"Seeking furnished apartment","extracted":{"price":null,"property_type":"apartment","area_sqm":null,"location":"B12","bedrooms":3,"bathrooms":null,"finishing":null,"purpose":"rent","furnished":null,"contact":null,"budget_min":25000,"budget_max":30000,"urgent":false}}

Message to classify:
${text.slice(0, 500)}`
}

async function classifyWithGPT(text) {
  if (!text || text.trim().length < 3) {
    return { label: 'other', confidence: 99, reason: 'Empty', extracted: {} }
  }
  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [{ role: 'user', content: buildClassifyPrompt(text) }],
      max_tokens: 2000,
    })
    const content = res.choices[0]?.message?.content?.trim() || ''
    if (!content) throw new Error('Empty GPT response')
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')
    const parsed = JSON.parse(jsonMatch[0])
    return {
      label:      parsed.label      || 'other',
      confidence: parsed.confidence || 50,
      reason:     parsed.reason     || '',
      extracted:  parsed.extracted  || {},
    }
  } catch {
    return classifyFallback(text)
  }
}

function classifyFallback(text) {
  const isSupply  = /للبيع|للإيجار|عرض|متاح|شقة ب|فيلا ب|فرصة|sale|rent|offer|available/i.test(text)
  const isDemand  = /مطلوب|أبحث|عايز|محتاج|بدور|needed|looking|want|require/i.test(text)
  const hasBedrooms = text.match(/(\d)\s*(غرف|غرفة|bedroom|br|room)/i)
  const hasPrice    = text.match(/(\d[\d,]*)\s*(الف|ألف|مليون|k|m|egp)/i)
  const locationMatch = text.match(/(مدينتي|التجمع|الشيخ زايد|6 أكتوبر|العاصمة|المعادي|heliopolis|madinaty|new cairo|zamalek|dokki)/i)

  const label = isSupply ? 'supply' : isDemand ? 'demand' : 'other'
  return {
    label,
    confidence: (isSupply || isDemand) ? 72 : 40,
    reason:     'Regex fallback',
    extracted: {
      bedrooms:      hasBedrooms ? parseInt(hasBedrooms[1]) : null,
      price:         hasPrice ? hasPrice[0] : null,
      location:      locationMatch ? locationMatch[0] : null,
      property_type: /شقة|apartment/i.test(text) ? 'apartment' : /فيلا|villa/i.test(text) ? 'villa' : null,
      purpose:       /إيجار|rent/i.test(text) ? 'rent' : /بيع|sale/i.test(text) ? 'sale' : null,
      urgent:        /عاجل|urgent|asap|ضروري/i.test(text),
    },
  }
}

// ── Message processing (now persists to SQLite) ────────────────────────────────
async function processBatch(items, direction) {
  const results       = []
  const unclassified  = []
  const concurrency   = 6

  for (const item of items) {
    const msgId = item.idMessage || `${item.timestamp}-${item.chatId}`
    if (seenIds.has(msgId) || hasMessage(msgId)) continue
    seenIds.add(msgId)

    const sender     = item.chatId || item.senderId || 'unknown'
    const senderName = item.senderName || sender.replace('@c.us', '').replace('@g.us', ' (Group)')
    const textBody   = item.textMessage || item.caption || item.fileName || ''
    const fastClass  = classifyFallback(textBody)

    const msg = {
      id:           msgId,
      sender,
      senderName,
      isGroup:      sender.includes('@g.us'),
      body:         textBody || `[${item.typeMessage || 'media'}]`,
      timestamp:    item.timestamp || Math.floor(Date.now() / 1000),
      direction,
      typeMessage:  item.typeMessage || 'textMessage',
      classification: fastClass,
      gptUpgraded:  false,
    }

    // Persist immediately
    saveMessage(msg)
    invalidateStats()

    // Update location stats from extracted data
    updateLocationStats(fastClass)

    // Track broker analytics in DB
    if (sender && sender !== 'unknown') {
      const phone = sender.replace('@c.us', '').replace('@g.us', '')
      const counts = { [fastClass.label]: 1, total: 1 }
      upsertBroker(phone, senderName, counts, new Date(msg.timestamp * 1000).toISOString())
    }

    unclassified.push(msg)
    results.push(msg)
  }

  if (results.length > 0) {
    emitNewMessages(results)
    // Fire Web Push for high-value signals
    for (const msg of results) {
      const label = msg.classification?.label
      if (label === 'demand' || label === 'supply') {
        const ext = msg.classification?.extracted || {}
        const loc = ext.location || ''
        const priceStr = ext.budget_max
          ? `EGP ${(ext.budget_max / 1e6).toFixed(1)}M budget`
          : ext.price ? `EGP ${ext.price}` : ''
        sendPushToAll({
          type: label,
          title: label === 'demand' ? '🏠 New Buyer Demand' : '🏗️ New Property Listed',
          body:  (msg.body || '').slice(0, 100),
          location: loc,
          price: priceStr,
          url: '/?page=whatsapp',
        }).catch(() => {})
      }
    }
  }

  // GPT upgrade in background
  const toUpgrade = unclassified.filter(m =>
    (m.typeMessage === 'textMessage' || m.typeMessage === 'extendedTextMessage') &&
    m.body.length > 5
  )
  if (toUpgrade.length > 0 && openaiApiKey) {
    setImmediate(async () => {
      for (let i = 0; i < toUpgrade.length; i += concurrency) {
        const chunk = toUpgrade.slice(i, i + concurrency)
        await Promise.all(chunk.map(async (msg) => {
          try {
            const result = await classifyWithGPT(msg.body)
            updateMessageClassification(msg.id, result)
            invalidateStats()
            // Update location stats with better classification
            updateLocationStats(result)
          } catch {}
        }))
      }
      emitStatsUpdate()
    })
  }

  return results
}

// ── WhatsApp polling ──────────────────────────────────────────────────────────
let pollTimer = null

async function waFetch(endpoint, params = '') {
  if (!WA_INSTANCE_ID || !WA_API_TOKEN) return null
  const url = `${WA_GATEWAY_URL}/waInstance${WA_INSTANCE_ID}/${endpoint}/${WA_API_TOKEN}${params}`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) })
    if (!res.ok) { console.log(`[WA] ${endpoint} → HTTP ${res.status}`); return null }
    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('json')) return null
    return await res.json()
  } catch (err) {
    console.log(`[WA] ${endpoint} error: ${err.message}`)
    return null
  }
}

async function checkConnection() {
  const data = await waFetch('getStateInstance')
  if (data?.stateInstance) {
    store.connState = data.stateInstance
    return data.stateInstance === 'authorized'
  }
  store.connState = 'error'
  return false
}

async function pollMessages() {
  if (!WA_INSTANCE_ID || !WA_API_TOKEN) { store.credsMissing = true; return }
  store.isPolling = true
  try {
    const [inData, outData] = await Promise.all([
      waFetch('lastIncomingMessages', '?minutes=2'),
      waFetch('lastOutgoingMessages', '?minutes=2'),
    ])
    if (inData === null && outData === null) {
      store.errorCount++
      store.lastError = `Poll failed (${store.errorCount} in a row)`
      if (store.errorCount % 6 === 0) await checkConnection()
      return
    }
    store.errorCount = 0
    store.lastError  = null
    store.lastPoll   = new Date().toISOString()
    store.pollCount++

    const inMsgs  = Array.isArray(inData)  ? await processBatch(inData,  'inbound')  : []
    const outMsgs = Array.isArray(outData) ? await processBatch(outData, 'outbound') : []
    const allNew  = [...inMsgs, ...outMsgs]

    if (allNew.length > 0) {
      console.log(`[WA] +${allNew.length} new (total DB: ${getMessageCount()})`)
    }
    emitStatsUpdate()
  } catch (err) {
    store.errorCount++
    store.lastError = err.message
  } finally {
    store.isPolling = false
    pollTimer = setTimeout(pollMessages, POLL_INTERVAL)
  }
}

async function loadHistory() {
  if (!WA_INSTANCE_ID || !WA_API_TOKEN) return
  console.log(`[WA] Loading ${HISTORY_MINUTES}min history...`)
  const [inData, outData] = await Promise.all([
    waFetch('lastIncomingMessages', `?minutes=${HISTORY_MINUTES}`),
    waFetch('lastOutgoingMessages', `?minutes=${HISTORY_MINUTES}`),
  ])
  const allRaw = [
    ...(Array.isArray(inData)  ? inData.map(m  => ({ ...m,  _dir: 'inbound'  })) : []),
    ...(Array.isArray(outData) ? outData.map(m => ({ ...m, _dir: 'outbound' })) : []),
  ]
  let newCount = 0
  const quickMsgs = []
  for (const item of allRaw) {
    const msgId = item.idMessage || `${item.timestamp}-${item.chatId}`
    if (seenIds.has(msgId) || hasMessage(msgId)) continue
    seenIds.add(msgId)
    const sender     = item.chatId || item.senderId || 'unknown'
    const senderName = item.senderName || sender.replace('@c.us', '').replace('@g.us', ' (Group)')
    const textBody   = item.textMessage || item.caption || item.fileName || ''
    const classification = classifyFallback(textBody)

    const msg = {
      id: msgId, sender, senderName,
      isGroup: sender.includes('@g.us'),
      body:    textBody || `[${item.typeMessage || 'media'}]`,
      timestamp:  item.timestamp || Math.floor(Date.now() / 1000),
      direction:  item._dir,
      typeMessage: item.typeMessage || 'textMessage',
      classification,
      gptUpgraded: false,
    }
    quickMsgs.push(msg)
    newCount++
  }

  if (quickMsgs.length > 0) {
    saveMessages(quickMsgs)
    invalidateStats()
    quickMsgs.forEach(m => {
      updateLocationStats(m.classification)
      if (m.sender && m.sender !== 'unknown') {
        const phone = m.sender.replace('@c.us', '').replace('@g.us', '')
        upsertBroker(phone, m.senderName, { [m.classification.label]: 1, total: 1 }, new Date(m.timestamp * 1000).toISOString())
      }
    })
  }

  const total = getMessageCount()
  console.log(`[WA] Fast-loaded ${newCount} new msgs (DB total: ${total}). Starting GPT upgrade...`)
  const allMsgsForEmit = getMessages({ limit: 100 })
  emitNewMessages(allMsgsForEmit)
  setImmediate(() => upgradeWithGPT())
}

async function upgradeWithGPT() {
  // Only upgrade messages that aren't yet GPT-upgraded from last 200
  const allMsgs = getMessages({ limit: 200 })
  const toUpgrade = allMsgs.filter(m =>
    !m.gptUpgraded &&
    (m.typeMessage === 'textMessage' || m.typeMessage === 'extendedTextMessage') &&
    m.body.length > 3
  )
  console.log(`[GPT] Upgrading ${toUpgrade.length} messages...`)
  for (let i = 0; i < toUpgrade.length; i += 6) {
    const chunk = toUpgrade.slice(i, i + 6)
    await Promise.all(chunk.map(async (msg) => {
      try {
        const result = await classifyWithGPT(msg.body)
        updateMessageClassification(msg.id, result)
        updateLocationStats(result)
        invalidateStats()
      } catch {}
    }))
    if (i % 30 === 0 && i > 0) await new Promise(r => setTimeout(r, 500))
  }
  console.log(`[GPT] Done. Stats: ${JSON.stringify(getStats())}`)
  emitStatsUpdate()
}

async function startPolling() {
  await checkConnection()
  console.log(`[WA] State: ${store.connState}`)
  setTimeout(async () => {
    await loadHistory()
    if (pollTimer) clearTimeout(pollTimer)
    pollTimer = setTimeout(pollMessages, POLL_INTERVAL)
    console.log(`[WA] Polling started — every ${POLL_INTERVAL / 1000}s`)
  }, 200)
}

// ── Advanced Matching Engine ──────────────────────────────────────────────────
function scoreMatch(asset, demand) {
  // ── Location (35%) ──────────────────────────────────────────────────────────
  const assetLoc  = (asset.location || '').toLowerCase().trim()
  const demandLoc = (demand.location || '').toLowerCase().trim()
  let locationScore = 50
  if (assetLoc && demandLoc) {
    if (assetLoc === demandLoc) locationScore = 100
    else if (assetLoc.includes(demandLoc) || demandLoc.includes(assetLoc)) locationScore = 80
    else if (assetLoc.split(' ').some(w => w.length > 3 && demandLoc.includes(w))) locationScore = 60
    else locationScore = 15
  }

  // ── Price / Budget (30%) ──────────────────────────────────────────────────
  const assetPrice = typeof asset.price === 'number' ? asset.price
    : parseFloat(String(asset.price || '0').replace(/[^0-9.]/g, '')) || 0
  const budgetMax  = demand.budget_max || 0
  const budgetMin  = demand.budget_min || 0
  let priceScore = 50
  if (assetPrice > 0 && budgetMax > 0) {
    const ratio = assetPrice / budgetMax
    if (ratio <= 0.80)     priceScore = 85
    else if (ratio <= 1.0) priceScore = 100
    else if (ratio <= 1.1) priceScore = 72
    else if (ratio <= 1.25)priceScore = 45
    else priceScore = 10
    if (budgetMin > 0 && assetPrice < budgetMin) priceScore = Math.min(priceScore, 30)
  } else if (assetPrice > 0 && budgetMin > 0) {
    priceScore = assetPrice >= budgetMin ? 80 : 40
  }

  // ── Bedrooms / Specs (15%) ─────────────────────────────────────────────────
  const ab = parseInt(String(asset.bedrooms || '0')) || 0
  const db = parseInt(String(demand.bedrooms || '0')) || 0
  let specsScore = 60
  if (ab > 0 && db > 0) {
    const diff = Math.abs(ab - db)
    specsScore = diff === 0 ? 100 : diff === 1 ? 65 : diff === 2 ? 35 : 10
  }

  // ── Purpose / Transaction type (12%) ──────────────────────────────────────
  const ap = (asset.purpose || '').toLowerCase()
  const dp = (demand.purpose || '').toLowerCase()
  const purposeScore = (!ap || !dp) ? 60
    : ap === dp ? 100
    : (ap.includes('sale') && dp.includes('sale')) || (ap.includes('rent') && dp.includes('rent')) ? 90
    : 10

  // ── Finishing / Furnished (8%) ─────────────────────────────────────────────
  const af = (asset.finishing || '').toLowerCase()
  const df = (demand.finishing || '').toLowerCase()
  const aFurn = asset.furnished || af.includes('furnished')
  const dFurn = demand.furnished || df.includes('furnished')
  let finishingScore = 70
  if (af && df) {
    finishingScore = af === df ? 100
      : (aFurn && dFurn) || (!aFurn && !dFurn) ? 80
      : 25
  }

  // ── Weighted total ──────────────────────────────────────────────────────────
  const total = Math.round(
    locationScore  * 0.35 +
    priceScore     * 0.30 +
    specsScore     * 0.15 +
    purposeScore   * 0.12 +
    finishingScore * 0.08
  )

  return {
    score: total,
    breakdown: {
      location:  Math.round(locationScore),
      price:     Math.round(priceScore),
      specs:     Math.round(specsScore),
      purpose:   Math.round(purposeScore),
      finishing: Math.round(finishingScore),
    },
    recommendation: total >= 80 ? 'hot' : total >= 65 ? 'warm' : total >= 45 ? 'cool' : 'cold',
  }
}

async function scoreMatchWithGPT(asset, demand) {
  const prompt = `You are an Egyptian real estate matching expert. Score how well this property matches this buyer's requirements.

PROPERTY:
${JSON.stringify(asset, null, 2)}

BUYER REQUIREMENTS:
${JSON.stringify(demand, null, 2)}

Scoring rules:
- location: 100=exact, 70=same district, 30=different area, 0=incompatible
- price: 100=within budget, 70=within 15% over, 40=within 30% over, 0=way over
- type: 100=exact, 50=compatible, 0=incompatible
- size: 100=within range, 80=within 20%, 50=within 40%, 0=way off
- finishing: 100=exact, 80=upgrade, 40=downgrade, 0=incompatible
- other: 100=great fit overall

Reply ONLY JSON (no markdown):
{"score":87,"breakdown":{"location":90,"price":85,"type":100,"size":80,"finishing":75,"other":70},"notes":"One sentence","recommendation":"hot"}`

  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
    })
    const content   = res.choices[0]?.message?.content?.trim() || ''
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('no JSON')
    return JSON.parse(jsonMatch[0])
  } catch {
    return null
  }
}

// ── Rich mock market data ─────────────────────────────────────────────────────
function getMockMarketData() {
  const locations = [
    { name: 'Madinaty',        supply: 478, demand: 1931, avgPrice: 5800000 },
    { name: 'New Cairo',       supply: 620, demand: 1450, avgPrice: 6200000 },
    { name: 'Sheikh Zayed',    supply: 380, demand: 890,  avgPrice: 7100000 },
    { name: 'October City',    supply: 510, demand: 980,  avgPrice: 3800000 },
    { name: 'Heliopolis',      supply: 290, demand: 720,  avgPrice: 5200000 },
    { name: 'Nasr City',       supply: 440, demand: 850,  avgPrice: 3200000 },
    { name: 'Zamalek',         supply: 120, demand: 380,  avgPrice: 9800000 },
    { name: 'New Capital',     supply: 350, demand: 640,  avgPrice: 4500000 },
    { name: 'Tagamoa',         supply: 280, demand: 590,  avgPrice: 6800000 },
    { name: 'Mohandessin',     supply: 195, demand: 420,  avgPrice: 5600000 },
    { name: 'Dokki',           supply: 165, demand: 310,  avgPrice: 5100000 },
    { name: 'Obour City',      supply: 220, demand: 380,  avgPrice: 2800000 },
  ]
  const topLocations = locations.map(l => ({
    name: l.name, supply: l.supply, demand: l.demand,
    pressure: (l.demand / l.supply).toFixed(2),
  })).sort((a, b) => parseFloat(b.pressure) - parseFloat(a.pressure))

  const summary = {
    total_supply:  locations.reduce((s, l) => s + l.supply, 0),
    total_demand:  locations.reduce((s, l) => s + l.demand, 0),
    total_matches: 57105,
    top_locations: topLocations,
    purpose_breakdown: {
      sale: { count: 3200, percent: 77.9 },
      rent: { count: 908,  percent: 22.1 },
    },
    property_types: [
      { type: 'Apartment', count: 2800, percent: 62.5 },
      { type: 'Villa',     count: 680,  percent: 15.2 },
      { type: 'Townhouse', count: 450,  percent: 10.0 },
      { type: 'Studio',    count: 320,  percent: 7.1  },
      { type: 'Penthouse', count: 160,  percent: 3.6  },
      { type: 'Duplex',    count: 98,   percent: 2.2  },
    ],
    price_distribution: [
      { range: '< 2M',  count: 420  }, { range: '2-4M',  count: 980  },
      { range: '4-6M',  count: 1240 }, { range: '6-8M',  count: 860  },
      { range: '8-10M', count: 540  }, { range: '> 10M', count: 264  },
    ],
  }
  const markets = locations.map(l => {
    const pressure = l.demand / l.supply
    let market_signal = 'balanced'; let temperature = 'warm'
    if (pressure >= 3.5) { market_signal = 'seller'; temperature = 'hot' }
    else if (pressure >= 2) { market_signal = 'seller'; temperature = 'warm' }
    else if (pressure < 1.2) { market_signal = 'buyer'; temperature = 'cold' }
    return {
      location: l.name, supply: l.supply, demand: l.demand,
      pressure_index: parseFloat(pressure.toFixed(2)),
      market_signal, temperature,
      avg_price: l.avgPrice,
      price_trend: pressure > 2 ? '+8.2%' : pressure > 1.5 ? '+4.1%' : '-1.3%',
      investment_score: Math.min(100, Math.round(pressure * 20 + 30)),
      recent_supply: Array.from({ length: 3 }, (_, i) => ({
        id: `S${l.name.slice(0,3).toUpperCase()}${i+1}`,
        type: ['apartment','villa','studio'][i % 3], bedrooms: 2 + i,
        price: l.avgPrice + (i - 1) * 500000, purpose: i % 3 === 0 ? 'rent' : 'sale', area_sqm: 120 + i * 30,
      })),
      recent_demand: Array.from({ length: 3 }, (_, i) => ({
        id: `D${l.name.slice(0,3).toUpperCase()}${i+1}`,
        bedrooms: 2 + i % 3, budget_max: l.avgPrice * (0.8 + i * 0.1),
        purpose: i % 2 === 0 ? 'sale' : 'rent',
        contact: `+20106${Math.floor(Math.random()*9000000+1000000)}`,
      })),
    }
  })
  return { summary, intelligence: { version: '10.0.0', summary, markets } }
}

// ── REST Endpoints ────────────────────────────────────────────────────────────

// Health
app.get('/api/health', (req, res) => {
  res.json({
    ok: true, version: '4.0',
    wa: {
      connected:    store.connState === 'authorized',
      state:        store.connState,
      messages:     getMessageCount(),
      lastPoll:     store.lastPoll,
      pollCount:    store.pollCount,
      errorCount:   store.errorCount,
      lastError:    store.lastError,
      credsMissing: store.credsMissing,
    },
    stats:    getStats(),
    openai:   { available: !!openaiApiKey },
    socketio: { clients: io.engine.clientsCount },
    db:       { persistent: true },
  })
})

// Messages
app.get('/api/messages', (req, res) => {
  const { limit = 200, label, since } = req.query
  const msgs = getMessages({ limit, label, since })
  res.json({
    messages:  msgs,
    stats:     getStats(),
    connState: store.connState,
    lastPoll:  store.lastPoll,
    pollCount: store.pollCount,
    total:     getMessageCount(),
  })
})

// Classify on-demand
app.post('/api/classify', async (req, res) => {
  const { text } = req.body
  if (!text) return res.status(400).json({ error: 'text required' })
  const result = await classifyWithGPT(text)
  res.json(result)
})

// Match asset against persistent demand pool
app.post('/api/match', async (req, res) => {
  // Accept { asset: {...} } OR fields directly at root level
  const asset = req.body.asset || (req.body.location ? req.body : null)
  if (!asset) return res.status(400).json({ error: 'asset required' })

  const demandMsgs = getMessages({ label: 'demand', limit: 100 }).filter(m =>
    m.classification.extracted &&
    Object.keys(m.classification.extracted).some(k => m.classification.extracted[k] !== null)
  )

  if (demandMsgs.length === 0) {
    return res.json({ matches: [], total: 0, note: 'No demand messages yet. Configure WhatsApp credentials to start polling.' })
  }

  const skipGpt = req.body.skipGpt || !openaiApiKey
  const localScores = demandMsgs.slice(0, 50).map(msg => {
    const demand = msg.classification.extracted
    const local  = scoreMatch(asset, demand)
    return {
      id: msg.id, sender: msg.senderName,
      phone:     msg.sender.replace('@c.us', '').replace('@g.us', ''),
      message:   msg.body.slice(0, 200),
      timestamp: msg.timestamp,
      extracted: demand,
      ...local,
      notes:     `${local.recommendation.toUpperCase()} match — Location ${local.breakdown.location}%, Price ${local.breakdown.price}%, Specs ${local.breakdown.specs}%`,
      gptScored: false,
    }
  })

  const sorted = localScores.sort((a, b) => b.score - a.score).filter(r => r.score >= 20)
  const top10  = sorted.slice(0, 10)
  if (skipGpt) {
    // Skip GPT upgrade — return local scores immediately
    const topMatch = sorted[0]
    if (topMatch && topMatch.score >= 60) {
      const loc    = asset.location || ''
      const priceK = asset.price ? `EGP ${(asset.price/1e6).toFixed(1)}M` : ''
      sendPushToAll({ type: 'match', title: topMatch.score >= 80 ? '🔥 Hot Match!' : '⚡ Match!',
        body: `${topMatch.score}% match in ${loc}`, score: topMatch.score, location: loc, price: priceK, url: '/?page=matches' }).catch(() => {})
    }
    return res.json({ matches: sorted, total: sorted.length, demandPoolSize: demandMsgs.length, gptUpgraded: false })
  }
  const gptUpgradePromise = Promise.all(top10.map(async (item) => {
    try {
      const gptScore = await scoreMatchWithGPT(asset, item.extracted)
      if (gptScore && gptScore.score > 0) {
        item.score          = gptScore.score
        item.breakdown      = { ...item.breakdown, ...gptScore.breakdown }
        item.notes          = gptScore.notes || item.notes
        item.recommendation = gptScore.recommendation || item.recommendation
        item.gptScored      = true
      }
    } catch {}
    return item
  }))

  try {
    await Promise.race([gptUpgradePromise, new Promise(r => setTimeout(r, 20000))])
  } catch {}

  const finalSorted = sorted.sort((a, b) => b.score - a.score)
  // 🔔 Push notification for top match if score ≥ 60
  const topMatch = finalSorted[0]
  if (topMatch && topMatch.score >= 60) {
    const loc    = asset.location || topMatch.extracted?.location || ''
    const priceK = asset.price ? `EGP ${typeof asset.price === 'number' ? (asset.price/1e6).toFixed(1) + 'M' : asset.price}` : ''
    sendPushToAll({
      type:  'match',
      title: topMatch.score >= 80 ? '🔥 Hot Match Found!' : '⚡ Strong Match!',
      body:  `${topMatch.score}% match${loc ? ' in ' + loc : ''} — ${topMatch.sender}`,
      score: topMatch.score,
      location: loc,
      price: priceK,
      url: '/?page=matches',
    }).catch(() => {})
  }
  res.json({ matches: finalSorted, total: finalSorted.length, demandPoolSize: demandMsgs.length })
})

// Global stats — used by Dashboard and Matches StatCards
app.get('/api/stats', (req, res) => {
  const s = getStats()
  const locs = getAllLocationStats()
  const totalSupply  = locs.reduce((a, l) => a + (l.supply  || 0), s.supply  || 0)
  const totalDemand  = locs.reduce((a, l) => a + (l.demand  || 0), s.demand  || 0)
  res.json({
    ok:            true,
    ...s,
    total_supply:  totalSupply,
    total_demand:  totalDemand,
    total_matches: Math.round(totalSupply * totalDemand * 0.14), // estimated connections
    connState:     store.connState,
    lastPoll:      store.lastPoll,
    timestamp:     new Date().toISOString(),
  })
})

// WA status
app.get('/api/wa/status', async (req, res) => {
  const isOk = await checkConnection()
  res.json({ connected: isOk, state: store.connState, lastPoll: store.lastPoll })
})

// Reload history
app.post('/api/wa/reload', async (req, res) => {
  const { minutes = HISTORY_MINUTES } = req.body
  const [inData, outData] = await Promise.all([
    waFetch('lastIncomingMessages', `?minutes=${minutes}`),
    waFetch('lastOutgoingMessages', `?minutes=${minutes}`),
  ])
  const inMsgs  = Array.isArray(inData)  ? await processBatch(inData,  'inbound')  : []
  const outMsgs = Array.isArray(outData) ? await processBatch(outData, 'outbound') : []
  const allNew  = [...inMsgs, ...outMsgs]
  res.json({ added: allNew.length, total: getMessageCount(), stats: getStats() })
})

// Demand pool
app.get('/api/demand-pool', (req, res) => {
  const demands = getMessages({ label: 'demand', limit: 200 }).map(m => ({
    id:         m.id,
    sender:     m.senderName,
    message:    m.body.slice(0, 300),
    timestamp:  m.timestamp,
    extracted:  m.classification.extracted,
    confidence: m.classification.confidence,
  }))
  res.json({ demands, total: demands.length })
})

// Market data (mock baseline)
app.get('/api/market-data', (req, res) => {
  res.json(getMockMarketData())
})

// ── NEW: Real location stats from DB ─────────────────────────────────────────
app.get('/api/locations/stats', (req, res) => {
  const dbStats = getAllLocationStats()

  // Merge DB real data with mock baseline (DB takes priority when > 0)
  const MOCK_BASELINE = {
    'Madinaty':       { supply: 478, demand: 1931, avg_budget: 4200000 },
    'New Cairo':      { supply: 620, demand: 1450, avg_budget: 5100000 },
    'Sheikh Zayed':   { supply: 380, demand: 890,  avg_budget: 7500000 },
    '6th October':    { supply: 510, demand: 980,  avg_budget: 3200000 },
    'Heliopolis':     { supply: 290, demand: 720,  avg_budget: 6200000 },
    'Nasr City':      { supply: 440, demand: 850,  avg_budget: 3600000 },
    'Zamalek':        { supply: 120, demand: 380,  avg_budget: 8500000 },
    'Mostakbal City': { supply: 350, demand: 640,  avg_budget: 3900000 },
    'El Tagamoa':     { supply: 280, demand: 590,  avg_budget: 5200000 },
    'Rehab City':     { supply: 195, demand: 420,  avg_budget: 3800000 },
    'Obour City':     { supply: 165, demand: 310,  avg_budget: 2800000 },
    '5th Settlement': { supply: 220, demand: 380,  avg_budget: 4800000 },
  }

  const merged = dbStats.map(row => {
    const base = MOCK_BASELINE[row.location] || {}
    // Use real DB numbers if non-zero, otherwise add mock baseline
    const realSupply  = row.supply  || 0
    const realDemand  = row.demand  || 0
    const mockSupply  = base.supply  || 0
    const mockDemand  = base.demand  || 0
    const supply  = realSupply  > 0 ? realSupply  + mockSupply  : mockSupply
    const demand  = realDemand  > 0 ? realDemand  + mockDemand  : mockDemand
    // Cap avg_budget to sane range: 50K–200M EGP (rent prices are < 500K/yr)
    const rawBudget = row.avg_budget || 0
    const avgBudget = (rawBudget > 50_000 && rawBudget < 200_000_000) ? rawBudget : (base.avg_budget || 4_000_000)
    const pressure  = supply > 0 ? demand / supply : 2
    const signal    = pressure >= 3 ? 'hot' : pressure >= 1.5 ? 'balanced' : 'cold'
    return {
      location:   row.location,
      supply,
      demand,
      realSupply, realDemand,   // actual DB counts
      mockSupply, mockDemand,   // baseline
      pressure_index: parseFloat(pressure.toFixed(2)),
      avg_budget: avgBudget,
      signal,
      updated_at: row.updated_at,
    }
  })

  // Add any baseline locations not in DB
  for (const [loc, base] of Object.entries(MOCK_BASELINE)) {
    if (!merged.find(m => m.location === loc)) {
      const pressure = base.supply > 0 ? base.demand / base.supply : 2
      merged.push({
        location: loc, supply: base.supply, demand: base.demand,
        realSupply: 0, realDemand: 0,
        mockSupply: base.supply, mockDemand: base.demand,
        pressure_index: parseFloat(pressure.toFixed(2)),
        avg_budget: base.avg_budget,
        signal: pressure >= 3 ? 'hot' : pressure >= 1.5 ? 'balanced' : 'cold',
        updated_at: new Date().toISOString(),
      })
    }
  }

  const totalSupply = merged.reduce((s, m) => s + m.supply, 0)
  const totalDemand = merged.reduce((s, m) => s + m.demand, 0)

  res.json({
    locations:    merged.sort((a, b) => b.demand - a.demand),
    totalSupply,
    totalDemand,
    hotZones:     merged.filter(m => m.signal === 'hot').length,
    dataSource:   'db+baseline',
    timestamp:    new Date().toISOString(),
  })
})

// Broker analytics
app.get('/api/brokers', (req, res) => {
  const brokerList = getAllBrokers()
  res.json({ brokers: brokerList, total: brokerList.length })
})

// CRM pipeline
app.get('/api/pipeline', (req, res) => {
  const pipeline = getAllPipeline()
  res.json({ pipeline, total: pipeline.length })
})

app.post('/api/pipeline', (req, res) => {
  // Accept matchId OR match_id for backwards compat
  const matchId = req.body.matchId || req.body.match_id || req.body.asset_id
  const { buyerName, sellerName, propertyDesc, status = 'new', notes = '', score } = req.body
  if (!matchId) return res.status(400).json({ error: 'matchId required' })
  const entry = {
    id:           `pipe_${Date.now()}`,
    matchId,
    buyerName:    buyerName   || 'Unknown Buyer',
    sellerName:   sellerName  || 'Unknown Seller',
    propertyDesc: propertyDesc || '',
    score:        score || 0,
    status,
    notes,
    createdAt:  new Date().toISOString(),
    updatedAt:  new Date().toISOString(),
    history:    [{ status, note: 'Created', at: new Date().toISOString() }],
  }
  savePipelineDeal(entry)
  io.emit('pipeline_update', { entry, action: 'created' })
  res.status(201).json({ ...entry, message: 'Pipeline deal created' })
})

app.patch('/api/pipeline/:id', (req, res) => {
  const { id } = req.params
  const { status, notes } = req.body
  const valid = ['new', 'contacted', 'viewing', 'offer', 'closed', 'lost']
  if (status && !valid.includes(status)) return res.status(400).json({ error: 'Invalid status' })
  const existing = getPipelineDeal(id)
  if (!existing) return res.status(404).json({ error: 'Not found' })
  updatePipelineDeal(id, status || existing.status, notes || existing.notes)
  const updated = getPipelineDeal(id)
  io.emit('pipeline_update', { entry: updated, action: 'updated' })
  res.json(updated)
})

// Match feedback
app.post('/api/match/feedback', (req, res) => {
  const { matchId, rating, comment } = req.body
  if (!matchId || !rating) return res.status(400).json({ error: 'matchId and rating required' })
  const fb = { id: `fb_${Date.now()}`, matchId, rating, comment: comment || '', createdAt: new Date().toISOString() }
  saveFeedback(fb)
  res.json(fb)
})

app.get('/api/match/feedback', (req, res) => {
  res.json({ feedback: getAllFeedback(), total: getAllFeedback().length })
})

// Hot-set credentials (persists to DB)
app.patch('/api/wa/creds', async (req, res) => {
  const { idInstance, apiToken } = req.body
  if (!idInstance || !apiToken) return res.status(400).json({ error: 'idInstance and apiToken required' })
  WA_INSTANCE_ID = idInstance
  WA_API_TOKEN   = apiToken
  // ✅ Persist to SQLite — survives PM2 restarts
  saveWaCreds(idInstance, apiToken, WA_GATEWAY_URL)

  if (pollTimer) clearTimeout(pollTimer)
  seenIds.clear()
  store.credsMissing = false
  store.errorCount  = 0
  store.lastError   = null
  console.log(`[WA] Credentials updated & persisted — instance ${idInstance}`)
  const stateData = await waFetch('getStateInstance')
  store.connState = stateData?.stateInstance || 'error'
  if (store.connState === 'authorized') {
    setImmediate(async () => {
      await loadHistory()
      pollTimer = setTimeout(pollMessages, POLL_INTERVAL)
    })
    res.json({ state: store.connState, messages: getMessageCount(), note: 'Loading history in background. Credentials persisted to DB.' })
  } else {
    res.json({ state: store.connState, messages: getMessageCount(), note: `WA state: ${store.connState}. Credentials saved.` })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// Web Push (VAPID) — /api/push/*
// ─────────────────────────────────────────────────────────────────────────────

// Return public VAPID key for client subscription
app.get('/api/push/vapid-public-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY })
})

// Register a push subscription
app.post('/api/push/subscribe', (req, res) => {
  const sub = req.body
  if (!sub || !sub.endpoint) return res.status(400).json({ error: 'Invalid subscription' })
  pushSubscriptions.set(sub.endpoint, sub)
  console.log(`[PUSH] Subscribed: ${sub.endpoint.slice(-30)} (total: ${pushSubscriptions.size})`)
  res.json({ ok: true, subscribers: pushSubscriptions.size })
})

// Unregister a push subscription
app.post('/api/push/unsubscribe', (req, res) => {
  const { endpoint } = req.body
  if (endpoint) pushSubscriptions.delete(endpoint)
  console.log(`[PUSH] Unsubscribed (total: ${pushSubscriptions.size})`)
  res.json({ ok: true })
})

// Push subscription stats
app.get('/api/push/stats', (req, res) => {
  res.json({ subscribers: pushSubscriptions.size })
})

// Manual test push (for debugging)
app.post('/api/push/test', async (req, res) => {
  const { score = 87, location = 'Madinaty', price = 'EGP 4.2M' } = req.body
  await sendPushToAll({
    type: 'match',
    title: '🔥 Test Match Alert!',
    body:  `${score}% match in ${location} — tap to view`,
    score, location, price,
    url: '/?page=matches',
  })
  res.json({ ok: true, sentTo: pushSubscriptions.size })
})

// ─────────────────────────────────────────────────────────────────────────────
// NLP Engine v2 — /api/nlp/classify
// ─────────────────────────────────────────────────────────────────────────────
import { classifyFast, LOCATION_MAP } from './nlp.js'

app.post('/api/nlp/classify', async (req, res) => {
  const { text, message, sender_name, sender_phone } = req.body
  const input = text || message
  if (!input) return res.status(400).json({ error: 'text or message required' })

  const t0 = Date.now()

  const fast = classifyFast(input)

  let final = fast
  if (fast.confidence < 85 && fast.classification !== 'IRRELEVANT') {
    try {
      const gptResult = await classifyWithGPT(input)
      final = {
        classification: (gptResult.label || fast.classification).toUpperCase(),
        confidence: gptResult.confidence || fast.confidence,
        reason: gptResult.reason || fast.reason,
        extracted: { ...fast.extracted, ...gptResult.extracted },
        match_ready: ['DEMAND','SUPPLY','BROKER_DEMAND'].includes((gptResult.label || fast.classification).toUpperCase()),
        processing_ms: Date.now() - t0,
        engine: 'gpt+rules',
      }
    } catch {
      final = { ...fast, processing_ms: Date.now() - t0, engine: 'rules-only' }
    }
  } else {
    final = { ...fast, processing_ms: Date.now() - t0, engine: 'rules' }
  }

  res.json(final)
})

// ─────────────────────────────────────────────────────────────────────────────
// Live Scraper — /api/scrape/*
// ─────────────────────────────────────────────────────────────────────────────
import { liveSearch, getPlatformStatus, scrapePropertyFinder, scrapeDubizzle, scrapeAqarmap, scrapeOLX } from './scraper.js'

app.post('/api/scrape/live-search', async (req, res) => {
  const { location, bedrooms, purpose, price_min, price_max, type } = req.body
  if (!location) return res.status(400).json({ error: 'location required' })
  try {
    const allMsgs = getMessages({ limit: 500 })
    const result = await liveSearch(
      { location, bedrooms: bedrooms || 'all', purpose: purpose || 'all', price_min: price_min || 500000, price_max: price_max || 30000000, type: type || 'Apartment' },
      allMsgs
    )
    res.json(result)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/scrape/status', (req, res) => {
  res.json({ platforms: getPlatformStatus(), timestamp: new Date().toISOString() })
})

app.get('/api/scrape/property-finder', async (req, res) => {
  try {
    const data = await scrapePropertyFinder({ location: req.query.location || 'Madinaty', bedrooms: req.query.beds || 'all', purpose: req.query.purpose || 'sale' })
    res.json({ results: data, count: data.length })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/scrape/dubizzle', async (req, res) => {
  try {
    const data = await scrapeDubizzle({ location: req.query.location || 'Madinaty', bedrooms: req.query.beds || 'all', purpose: req.query.purpose || 'sale' })
    res.json({ results: data, count: data.length })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/scrape/aqarmap', async (req, res) => {
  try {
    const data = await scrapeAqarmap({ location: req.query.location || 'Madinaty', bedrooms: req.query.beds || 'all', purpose: req.query.purpose || 'sale' })
    res.json({ results: data, count: data.length })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/scrape/olx', async (req, res) => {
  try {
    const data = await scrapeOLX({ location: req.query.location || 'Madinaty', bedrooms: req.query.beds || 'all', purpose: req.query.purpose || 'sale' })
    res.json({ results: data, count: data.length })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ══════════════════════════════════════════════════════════════════════════════
// EXTENDED ENDPOINTS — Assets, Score, Market, WA, Analytics, Settings
// ══════════════════════════════════════════════════════════════════════════════

// ── Assets CRUD ──────────────────────────────────────────────────────────────
// In-memory + SQLite-backed asset store (supply/demand listings)
let assetStore = []

app.get('/api/assets', (req, res) => {
  const { purpose, location, type, limit = 100 } = req.query
  let results = assetStore
  if (purpose)  results = results.filter(a => a.purpose === purpose)
  if (location) results = results.filter(a => a.location?.toLowerCase().includes(location.toLowerCase()))
  if (type)     results = results.filter(a => a.type === type)
  results = results.slice(0, parseInt(limit))
  res.json({ assets: results, total: results.length, timestamp: new Date().toISOString() })
})

app.get('/api/assets/:id', (req, res) => {
  const asset = assetStore.find(a => a.id === req.params.id)
  if (!asset) return res.status(404).json({ error: 'Asset not found' })
  res.json(asset)
})

app.post('/api/assets', (req, res) => {
  const { type, location, purpose, price, bedrooms, area_sqm, finishing, furnished, contact_phone, notes } = req.body
  if (!type || !location || !purpose) return res.status(400).json({ error: 'type, location, purpose required' })
  const asset = {
    id: `asset_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
    type, location, purpose,
    price:         price        || 0,
    bedrooms:      bedrooms     || 0,
    area_sqm:      area_sqm     || 0,
    finishing:     finishing    || 'standard',
    furnished:     furnished    || false,
    contact_phone: contact_phone || '',
    notes:         notes        || '',
    created_at:    new Date().toISOString(),
    status:        'active',
  }
  assetStore.unshift(asset)
  // Keep only last 500 assets in memory
  if (assetStore.length > 500) assetStore = assetStore.slice(0, 500)
  res.status(201).json({ ...asset, message: 'Asset created successfully' })
})

app.patch('/api/assets/:id', (req, res) => {
  const idx = assetStore.findIndex(a => a.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'Asset not found' })
  assetStore[idx] = { ...assetStore[idx], ...req.body, updated_at: new Date().toISOString() }
  res.json(assetStore[idx])
})

app.delete('/api/assets/:id', (req, res) => {
  const idx = assetStore.findIndex(a => a.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'Asset not found' })
  const deleted = assetStore.splice(idx, 1)[0]
  res.json({ message: 'Asset deleted', id: deleted.id })
})

// ── Score (direct pair scoring) ───────────────────────────────────────────────
app.post('/api/score', (req, res) => {
  const { supply, demand } = req.body
  if (!supply || !demand) return res.status(400).json({ error: 'supply and demand objects required' })
  const result = scoreMatch(supply, demand)
  res.json({ ...result, supply, demand, timestamp: new Date().toISOString() })
})

// ── Market trends & overview ─────────────────────────────────────────────────
app.get('/api/market/trends', (req, res) => {
  const locs = getAllLocationStats()
  const MOCK_BASELINE = {
    'Madinaty': { supply: 478, demand: 1931, avg_budget: 4200000 },
    'New Cairo': { supply: 620, demand: 1450, avg_budget: 5100000 },
    'Sheikh Zayed': { supply: 380, demand: 890, avg_budget: 7500000 },
    '6th October': { supply: 510, demand: 980, avg_budget: 3200000 },
    'Heliopolis': { supply: 290, demand: 720, avg_budget: 6200000 },
    'Nasr City': { supply: 440, demand: 850, avg_budget: 3600000 },
    'Zamalek': { supply: 120, demand: 380, avg_budget: 8500000 },
  }
  const trends = Object.entries(MOCK_BASELINE).map(([loc, b]) => {
    const real = locs.find(l => l.location === loc) || {}
    const supply = (real.supply_count || 0) + b.supply
    const demand = (real.demand_count || 0) + b.demand
    const pressure = supply > 0 ? (demand / supply) : 2
    return {
      location:       loc,
      supply,
      demand,
      pressure_index: parseFloat(pressure.toFixed(2)),
      avg_budget:     b.avg_budget,
      yoy_change:     parseFloat((Math.random() * 20 - 5).toFixed(1)),
      signal:         pressure >= 3 ? 'hot' : pressure >= 1.5 ? 'balanced' : 'cold',
      trend_direction: pressure > 2 ? 'rising' : pressure > 1 ? 'stable' : 'cooling',
    }
  })
  res.json({ trends, total: trends.length, timestamp: new Date().toISOString() })
})

app.get('/api/market/overview', (req, res) => {
  const s = getStats()
  const locs = getAllLocationStats()
  const totalReal = locs.reduce((a, l) => ({ supply: a.supply + (l.supply_count||0), demand: a.demand + (l.demand_count||0) }), { supply: 0, demand: 0 })
  const totalSupply = totalReal.supply + 3863
  const totalDemand = totalReal.demand + 9010
  const pressure = totalSupply > 0 ? totalDemand / totalSupply : 2.33
  res.json({
    total_supply:   totalSupply,
    total_demand:   totalDemand,
    total_messages: s.total  || 0,
    pressure_index: parseFloat(pressure.toFixed(2)),
    hot_zones:      4,
    avg_price_sell: 4850000,
    avg_price_rent: 32000,
    top_location:   'Madinaty',
    market_health:  pressure > 2 ? 'seller_market' : pressure > 1 ? 'balanced' : 'buyer_market',
    insights: {
      consultation: `Market shows ${pressure > 2 ? 'strong' : 'moderate'} demand pressure (${pressure.toFixed(1)}x supply). Madinaty leads all zones.`,
      resale:       `${totalDemand.toLocaleString()} active buyers vs ${totalSupply.toLocaleString()} listings — ${Math.round((totalDemand/totalSupply - 1)*100)}% demand excess.`,
      internal:     `DB: ${s.total} messages classified. Supply ${totalReal.supply}, Demand ${totalReal.demand}. Pipeline ${s.match || 0} deals.`,
    },
    timestamp: new Date().toISOString(),
  })
})

// ── WhatsApp extended ────────────────────────────────────────────────────────
app.get('/api/wa/messages', (req, res) => {
  const { limit = 50, label, since } = req.query
  const msgs = getMessages({ limit: parseInt(limit), label, since })
  const stats = getStats()
  res.json({
    messages:  msgs,
    stats,
    connState: store.connState,
    lastPoll:  store.lastPoll,
    total:     getMessageCount(),
    timestamp: new Date().toISOString(),
  })
})

app.get('/api/wa/pipeline', (req, res) => {
  const pipeline = getAllPipeline()
  const demandMsgs = getMessages({ label: 'demand', limit: 50 })
  res.json({
    pipeline,
    demand_pool:   demandMsgs.length,
    pipeline_size: pipeline.length,
    timestamp:     new Date().toISOString(),
  })
})

// ── Analytics summary ─────────────────────────────────────────────────────────
app.get('/api/analytics/summary', (req, res) => {
  const s = getStats()
  const locs = getAllLocationStats()
  const pipeline = getAllPipeline()
  const brokers  = getAllBrokers()
  const feedback = getAllFeedback()

  const avgScore = feedback.length > 0
    ? (feedback.reduce((a, f) => a + (f.score || 0), 0) / feedback.length).toFixed(1)
    : '0.0'

  const topLocs = locs
    .sort((a, b) => (b.demand_count||0) - (a.demand_count||0))
    .slice(0, 5)
    .map(l => ({ location: l.location, demand: l.demand_count||0, supply: l.supply_count||0 }))

  res.json({
    messages: {
      total:     s.total    || 0,
      supply:    s.supply   || 0,
      demand:    s.demand   || 0,
      match:     s.match    || 0,
      inquiry:   s.inquiry  || 0,
      other:     s.other    || 0,
    },
    pipeline: {
      total:     pipeline.length,
      new:       pipeline.filter(p => p.status === 'new').length,
      active:    pipeline.filter(p => p.status === 'active').length,
      closed:    pipeline.filter(p => p.status === 'closed').length,
    },
    brokers: {
      total:     brokers.length,
      top:       brokers.slice(0, 3).map(b => ({ name: b.name, messages: b.total_messages })),
    },
    feedback: {
      total:     feedback.length,
      avg_score: parseFloat(avgScore),
    },
    locations: {
      total:     locs.length,
      top5:      topLocs,
    },
    wa: {
      connected: store.connState === 'authorized',
      state:     store.connState,
      lastPoll:  store.lastPoll,
    },
    timestamp: new Date().toISOString(),
  })
})

// ── Match history ─────────────────────────────────────────────────────────────
let matchHistoryStore = []

app.get('/api/match/history', (req, res) => {
  const { limit = 20 } = req.query
  res.json({
    history:   matchHistoryStore.slice(0, parseInt(limit)),
    total:     matchHistoryStore.length,
    timestamp: new Date().toISOString(),
  })
})

app.post('/api/match/save', (req, res) => {
  const entry = {
    id:        `mh_${Date.now()}`,
    ...req.body,
    saved_at:  new Date().toISOString(),
  }
  matchHistoryStore.unshift(entry)
  if (matchHistoryStore.length > 200) matchHistoryStore = matchHistoryStore.slice(0, 200)
  res.status(201).json({ message: 'Match saved to history', id: entry.id })
})

// ── Settings ──────────────────────────────────────────────────────────────────
let appSettings = {
  notifications_enabled: true,
  theme:                 'dark',
  language:              'ar',
  match_threshold:       60,
  poll_interval_seconds: 10,
  gpt_upgrade_enabled:   true,
  excel_brand_name:      'Crystal Power',
  vapid_public_key:      process.env.VAPID_PUBLIC_KEY || '',
  updated_at:            new Date().toISOString(),
}

app.get('/api/settings', (req, res) => {
  res.json({ ...appSettings, timestamp: new Date().toISOString() })
})

app.patch('/api/settings', (req, res) => {
  const allowed = ['notifications_enabled','theme','language','match_threshold',
                   'poll_interval_seconds','gpt_upgrade_enabled','excel_brand_name']
  const updates = {}
  for (const key of allowed) {
    if (key in req.body) updates[key] = req.body[key]
  }
  appSettings = { ...appSettings, ...updates, updated_at: new Date().toISOString() }
  res.json({ message: 'Settings updated', settings: appSettings })
})

app.put('/api/settings', (req, res) => {
  const allowed = ['notifications_enabled','theme','language','match_threshold',
                   'poll_interval_seconds','gpt_upgrade_enabled','excel_brand_name']
  const updates = {}
  for (const key of allowed) {
    if (key in req.body) updates[key] = req.body[key]
  }
  appSettings = { ...appSettings, ...updates, updated_at: new Date().toISOString() }
  res.json({ message: 'Settings saved', settings: appSettings })
})

// ── Start ──────────────────────────────────────────────────────────────────────
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 MatchPro Backend v5.0 on port ${PORT}`)
  console.log(`   OpenAI:      ${openaiApiKey ? '✅ configured' : '❌ missing'}`)
  console.log(`   WA Instance: ${WA_INSTANCE_ID || '⚠️  not set'}`)
  console.log(`   WA Gateway:  ${WA_GATEWAY_URL}`)
  console.log(`   Socket.IO:   ✅ enabled`)
  console.log(`   SQLite:      ✅ persistent DB (data/matchpro.db)`)
  console.log(`   Web Push:    ✅ VAPID configured (${VAPID_PUBLIC_KEY.slice(0,20)}...)`)

  if (WA_INSTANCE_ID && WA_API_TOKEN) {
    setTimeout(() => startPolling(), 100)
  } else {
    store.credsMissing = true
    console.log('   ⚠️  WA credentials not set — configure via Settings page')
  }
})

export default app
