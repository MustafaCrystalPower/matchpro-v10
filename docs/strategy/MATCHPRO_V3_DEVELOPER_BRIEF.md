# MATCHpro™ v3.0 — Full Developer Brief
## Reverse Discovery Engine + Social Connectors
**Prepared by:** Genspark Claw | **Date:** May 5, 2026
**For:** AI Developer / Genspark Agent

---

## 🎯 THE CORE CONCEPT (Read This First)

**MATCHpro is NOT a search engine. It's a Reverse Discovery Engine.**

```
Traditional portals:         MATCHpro:
User searches →              User posts ANY signal →
Gets listings                System INSTANTLY returns:
                               • All matching supply (if you have demand)
                               • All matching demand (if you have supply)
                               • From ALL sides simultaneously
                               • Ranked by 24hr close probability
```

### The 3 Discovery Modes:

| Mode | User Input | System Returns |
|------|-----------|----------------|
| **I have something to SELL/OFFER** | Post your property/product/candidate | All buyers/importers/employers who want exactly this |
| **I need something to BUY/FIND** | Describe what you want | All offers matching your exact need |
| **MUTUAL** | Any signal | Both sides simultaneously — best match wins |

**Goal:** Any signal posted → closed deal within 24 hours.

---

## 🏗️ ARCHITECTURE OVERVIEW

```
INPUT LAYER (any source)          BRAIN                    OUTPUT LAYER
─────────────────────────         ──────────────           ─────────────────────
WhatsApp Groups (live)      →     Signal Parser     →      Demand DB
Facebook Groups (scraped)   →     Market Detector   →      Supply DB
LinkedIn (scraped)          →     NLP Extractor     →      Match Engine
Twitter/X (scraped)         →     Dedup Engine      →      Reverse Discovery API
CSV/Excel upload            →     Classifier        →      Dashboard UI
Manual entry (UI form)      →     Broker Filter     →      Notifications
                                  Score Engine      →      24hr close probability
```

---

## 📡 MARKET 1: REAL ESTATE (Priority — already has live data)

### What to extract from EVERY message:

```json
{
  "signal_type": "demand | supply | unclear",
  "purpose": "sale | rent | investment",
  "property_type": "apartment | villa | twin_house | townhouse | duplex | studio | shop | office | land | chalet | penthouse",
  "location": {
    "city": "Cairo | Giza | Alex | ...",
    "area": "Madinaty | New Cairo | Sheikh Zayed | Rehab | ...",
    "compound": "Mountain View | SODIC | Palm Hills | ...",
    "cluster": "B1 | B7 | E3 | ..."
  },
  "size": {
    "min_m2": 120,
    "max_m2": 200,
    "land_m2": 500,
    "bua_m2": 350
  },
  "budget": {
    "min_egp": 3000000,
    "max_egp": 5000000,
    "currency": "EGP | USD | SAR",
    "payment_type": "cash | installments | both",
    "down_payment": 500000,
    "monthly_installment": 15000
  },
  "bedrooms": 3,
  "bathrooms": 2,
  "floor": "ground | 1st | 2nd | any",
  "finishing": "core_shell | semi_finished | fully_finished | furnished | super_lux",
  "view": "garden | lake | golf | sea | landscape | street",
  "features": ["elevator", "garden", "pool", "private_entrance"],
  "urgency": "urgent | normal | flexible",
  "timeline": "immediate | 3months | 1year | flexible",
  "sender": {
    "name": "...",
    "phone": "...",
    "is_broker": true,
    "broker_confidence": 0.85
  },
  "confidence": 0.92,
  "raw_message": "...",
  "source": "whatsapp | facebook | linkedin | manual",
  "group_id": "...",
  "timestamp": "..."
}
```

### Critical Arabic NLP Rules:

```
"مطلوب شقة" → demand (looking for apartment)
"مطلوب 5 مليون" → supply (asking price)
"متاح" → supply (available)
"بادجيت X" → demand budget
"مساحة Xم" → SIZE (not budget!)
"مطلوب ضروري" → high urgency demand
"أول مالك" → supply (first owner selling)
"مجموعة X + غرف + تشطيب" → supply listing (spec dump)
"عميل جاهز" → broker with buyer = demand
"Urgent request" → demand
"For sale" → supply
"BUA: X" → supply (size of listed property)
```

### Reverse Discovery Query Examples:

```
User inputs: "شقة 3 غرف مدينتي تمليك بادجت 4M"
→ Returns: All مدينتي apartments, 3BR, for sale, 3-5M EGP range
→ Sorted by: match score, urgency, recency

User inputs: "عندي شقة 131م B11 مدينتي مطلوب 5.5M"
→ Returns: All buyers looking for مدينتي, B11, budget 5M+, ≥3BR
→ Sorted by: budget match, urgency, broker reliability
```

---

## 💼 MARKET 2: RECRUITMENT

### What to extract:

```json
{
  "signal_type": "job_offer | candidate | unclear",
  "role": "Sales Manager | Developer | PA | ...",
  "seniority": "junior | mid | senior | director | c-level",
  "sector": "real_estate | tech | finance | construction | ...",
  "location": {
    "city": "Cairo | Dubai | Riyadh | Remote",
    "area": "New Cairo | Madinaty | ..."
  },
  "salary": {
    "min_egp": 15000,
    "max_egp": 30000,
    "currency": "EGP | USD | SAR",
    "type": "fixed | commission | equity | hybrid"
  },
  "experience_years": {"min": 3, "max": 7},
  "skills": ["CRM", "Arabic", "driving_license", "MBA", "real_estate"],
  "gender_preference": "male | female | any",
  "education": "bachelor | MBA | diploma | any",
  "languages": ["Arabic", "English", "French"],
  "availability": "immediate | 1month | 3months",
  "urgency": "urgent | normal",
  "company_type": "startup | corporate | family_office",
  "equity_offered": true,
  "remote": false,
  "source": "linkedin | whatsapp | facebook | csv"
}
```

### Reverse Discovery:

```
Company posts: "محتاج Sales Manager نيو كايرو خبرة عقارات"
→ Returns: All candidates: sales background, New Cairo, real estate exp

Candidate posts: "MBA، خبرة 8 سنين في العقارات، بدور وظيفة بيع"
→ Returns: All companies hiring sales roles in real estate
```

---

## 🚢 MARKET 3: IMPORT/EXPORT

### What to extract:

```json
{
  "signal_type": "export_offer | import_demand | unclear",
  "product": "marble | furniture | electronics | food | ...",
  "hs_code": "680221",
  "quantity": {"value": 500, "unit": "ton | pcs | container | kg"},
  "origin_country": "Egypt | China | Germany | Turkey",
  "destination_country": "Saudi Arabia | UAE | Germany | ...",
  "price": {
    "value": 150,
    "unit_egp": null,
    "unit_usd": 150,
    "incoterm": "FOB | CIF | EXW | DDP"
  },
  "certifications": ["CE", "ISO", "Halal", "FDA"],
  "payment_terms": "LC | TT | CAD | open_account",
  "timeline": "immediate | 3months | quarterly",
  "sample_available": true,
  "minimum_order": {"value": 1, "unit": "container"},
  "company_type": "manufacturer | trader | agent",
  "source": "linkedin | whatsapp | tradeleads"
}
```

---

## 📱 SOCIAL CONNECTORS — What Developer Must Build

### 1. Facebook Groups Connector

**What to scrape:**
```
From each group post:
- post_id, group_id, group_name
- author_name, author_id
- post_text (full — up to 2000 chars)
- comments (first 5 — often contain phone numbers)
- post_timestamp
- reactions_count (urgency signal)
- shares_count
- images (for property photos)
```

**Target group types:**
- Real estate groups (Cairo/Alex/Madinaty)
- Job boards (Egyptian market)
- Trade/import-export groups
- WhatsApp group invite links (forward to WA connector)

**Technical approach:**
```python
# Option A: Graph API (requires Page/Group admin token)
GET /v19.0/{group-id}/feed?fields=id,message,created_time,from,comments

# Option B: Playwright scraper (no token needed — personal account)
# Login → navigate group → scroll → extract posts
# Rate limit: max 200 posts/day per group to avoid ban

# Option C: RSS via RSS Bridge (lightweight)
# rss-bridge.example.com/?action=display&bridge=FacebookBridge&...
```

**Accuracy boosters:**
- Extract phone numbers from comments (Egyptian format: 01X-XXXX-XXXX)
- Match Arabic property descriptions using keyword rules
- Flag "وسيط"/"سمسار" = broker (lower priority)
- "مالك مباشر" = direct owner (higher priority)

---

### 2. LinkedIn Connector

**What to scrape for Recruitment market:**
```
From job posts:
- job_title, company_name, company_size
- job_description (full text)
- required_skills (list)
- location, remote_option
- salary_range (if disclosed)
- posted_date, applications_count
- seniority_level

From candidate profiles (search results):
- name, headline, location
- current_company, current_role
- years_of_experience
- top_skills
- education
- languages
- open_to_work flag
- contact_info (if visible)
```

**Technical approach:**
```python
# Option A: LinkedIn API (requires approved access — hard)
# Option B: Playwright scraper with session cookies
# Option C: ProxyCurl API ($0.01/profile — recommended for quality)

# For job posts: search LinkedIn Jobs → scrape results
# Rate limit: max 100 profiles/day to avoid block
# Use rotating proxies or residential IPs
```

**For Import/Export on LinkedIn:**
```
Search: "export manager" OR "import director" + country
Extract: company, role, contact, product specialty
```

---

### 3. Twitter/X Connector

**What to scrape:**
```
Keywords to monitor:
- Arabic: "مطلوب شقة", "للبيع فيلا", "محتاج مهندس", "عايز مستورد"
- English: "looking for apartment cairo", "need developer egypt", "export marble"

From each tweet:
- tweet_id, user_id, username, display_name
- tweet_text (full)
- created_at, likes, retweets
- reply_to (for thread context)
- location (if set)
- phone/email in bio or tweet
```

**Technical approach:**
```python
# Twitter API v2 Basic ($100/month) — recommended
# OR Playwright scraper (free, less reliable)
# Focus: keyword streams, not user timelines
```

---

### 4. WhatsApp (Already Live — Enhance It)

**Current:** Webhook receiving messages from 13 groups
**Need to add:**
```
- Image analysis: extract property photos → auto-tag (villa/apartment/studio)
- Voice note transcription: Arabic STT → text → parse
- PDF/document parsing: broker sheets, price lists
- Multi-language: handle Franco-Arabic (Arabizi)
- Auto-thread: connect replies to original message
```

---

## 🧠 THE MATCHING ENGINE — Core Logic

### Signal Comparison Algorithm:

```python
def match_score(signal_a, signal_b):
    """
    Returns 0.0-1.0 match confidence between any two signals.
    Works regardless of which is supply/demand.
    """
    score = 0.0
    weights = {
        'market':        0.20,  # Must be same market
        'location':      0.25,  # Area match is critical
        'property_type': 0.15,  # Type match
        'budget':        0.20,  # Budget overlap
        'size':          0.10,  # Size range overlap
        'bedrooms':      0.05,  # Bedroom count
        'purpose':       0.05,  # Sale vs rent
    }
    
    # Market: binary
    if signal_a['market'] == signal_b['market']:
        score += weights['market']
    else:
        return 0.0  # Different markets = no match
    
    # Location: hierarchical scoring
    if signal_a['location']['area'] == signal_b['location']['area']:
        score += weights['location']  # Same area
    elif signal_a['location']['city'] == signal_b['location']['city']:
        score += weights['location'] * 0.4  # Same city
    
    # Budget: overlap scoring
    # If buyer budget range overlaps seller price range → score
    buyer_max = signal_a.get('budget_max') or signal_b.get('budget_max')
    buyer_min = signal_a.get('budget_min') or signal_b.get('budget_min')
    seller_price = signal_b.get('price') or signal_a.get('price')
    if buyer_max and seller_price:
        if buyer_min <= seller_price <= buyer_max:
            score += weights['budget']
        elif seller_price <= buyer_max * 1.1:  # 10% flexibility
            score += weights['budget'] * 0.7
    
    # Size: overlap
    # ... similar logic
    
    return round(score, 3)


def close_probability_24h(match_score, signal_a, signal_b):
    """
    Probability this match closes within 24 hours.
    """
    base = match_score
    
    # Boost factors
    if signal_a.get('urgency') == 'urgent': base *= 1.3
    if signal_b.get('urgency') == 'urgent': base *= 1.3
    if signal_a.get('payment_type') == 'cash': base *= 1.2
    if (datetime.now() - signal_a['timestamp']).hours < 6: base *= 1.2
    if (datetime.now() - signal_b['timestamp']).hours < 6: base *= 1.2
    
    return min(base, 0.99)
```

---

## 🖥️ UI — What to Build

### Page 1: Discovery (Main Feature)

```
┌─────────────────────────────────────────────────────────┐
│  🔍 MATCHpro Reverse Discovery Engine                    │
│                                                          │
│  Market: [Real Estate ▾] [Recruitment ▾] [Trade ▾]      │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Paste or type any signal in Arabic or English... │   │
│  │                                                  │   │
│  │ Examples:                                        │   │
│  │ • "شقة 3 غرف مدينتي بادجت 4M"                   │   │
│  │ • "عندي فيلا E3 مطلوب 72M"                       │   │
│  │ • "محتاج Sales Manager نيو كايرو"                │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  [🔍 Find Matches Now]   [📋 Use Template]               │
│                                                          │
│  ─────────────────────────────────────────────────────  │
│  RESULTS: 23 matches found (0.3 seconds)                 │
│                                                          │
│  🔥 URGENT MATCHES (close in 24hr)     [12]             │
│  ┌─────────────────────────────────────────────────┐    │
│  │ #1 Score: 94% | 24hr close: 78%                 │    │
│  │ Name: Ahmed | 📞 01124302042                    │    │
│  │ Budget: 30M EGP cash | مدينتي | Standalone      │    │
│  │ "مطلوب فيلا ستاندالون متشطبة بادجت ٣٠ مليون"   │    │
│  │ [📋 Copy Contact] [💬 WhatsApp] [📊 Full Match] │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  ⚡ WARM MATCHES                         [11]           │
└─────────────────────────────────────────────────────────┘
```

### Page 2: Live Feed (all markets, real-time)

### Page 3: Market Analytics (heatmaps per market)

### Page 4: Connector Setup (FB/LinkedIn/WA/X)

### Page 5: Version Roadmap (v1→v10 visual timeline)

---

## 📊 DATABASE SCHEMA

```sql
-- Universal signal table (works for all markets)
CREATE TABLE signals (
    id              TEXT PRIMARY KEY,
    market          TEXT NOT NULL,  -- real_estate | recruitment | trade
    source          TEXT NOT NULL,  -- whatsapp | facebook | linkedin | twitter | manual
    signal_type     TEXT,           -- demand | supply | unclear
    
    -- Parsed fields (JSON — flexible per market)
    parsed          JSON,           -- all extracted fields above
    
    -- Common fields (indexed for fast matching)
    location_city   TEXT,
    location_area   TEXT,
    budget_min      INTEGER,
    budget_max      INTEGER,
    urgency         TEXT,
    purpose         TEXT,
    
    -- Source metadata
    sender_name     TEXT,
    sender_phone    TEXT,
    sender_id       TEXT,
    group_id        TEXT,
    group_name      TEXT,
    
    -- Quality
    confidence      REAL,
    broker_score    REAL,
    is_broker       BOOLEAN,
    
    -- Raw
    raw_text        TEXT,
    
    -- Timestamps
    signal_ts       DATETIME,  -- when signal was posted
    ingested_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Dedup
    content_hash    TEXT UNIQUE
);

-- Matches table
CREATE TABLE matches (
    id              TEXT PRIMARY KEY,
    signal_a_id     TEXT REFERENCES signals(id),
    signal_b_id     TEXT REFERENCES signals(id),
    match_score     REAL,
    close_prob_24h  REAL,
    status          TEXT,  -- pending | shown | contacted | closed | expired
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Brokers table
CREATE TABLE brokers (
    phone           TEXT PRIMARY KEY,
    name            TEXT,
    broker_score    REAL,  -- 0-1, how likely they are a broker
    message_count   INTEGER,
    groups          JSON,
    verified        BOOLEAN
);
```

---

## 🚀 DEPLOYMENT SPECS

```
Server: VM at 20.69.29.54 (Azure West Central US)
OS: Ubuntu 22.04 | Node.js 22 | Python 3.10
Process Manager: PM2
Proxy: Caddy (HTTPS auto)
DB: SQLite (current) → PostgreSQL (v4+)
Ports: 3075 (current MatchPro) | 3076 (v3 new build)

Stack Recommendation:
- Backend: Node.js + Hono OR Python FastAPI
- Frontend: React + Tailwind OR Next.js
- DB: SQLite → PostgreSQL
- Queue: Redis + Bull (for scraper jobs)
- NLP: custom rules + GPT-4o-mini (for budget/location extraction)
- Scrapers: Playwright (browser automation)
```

---

## ✅ DEVELOPER TASK LIST (Priority Order)

### Phase 1 — Foundation (Week 1)
- [ ] Build universal Signal schema (JSON + SQLite)
- [ ] Build classify_signal() — rules-based Arabic/English NLP
- [ ] Build extract_fields() — location, budget, type, purpose
- [ ] Build match_score() — cross-signal comparison engine
- [ ] Build /api/discover endpoint — POST signal → GET matches
- [ ] Build Discovery UI page with instant results

### Phase 2 — Social Connectors (Week 2)
- [ ] Facebook Groups scraper (Playwright)
- [ ] LinkedIn Jobs + Candidates scraper
- [ ] Twitter/X keyword stream monitor
- [ ] WhatsApp voice note transcription (Whisper API)
- [ ] WhatsApp image property detector (GPT-4o Vision)

### Phase 3 — Intelligence (Week 3)
- [ ] 24hr close probability scoring
- [ ] Broker detection + filtering
- [ ] Dedup engine (similar messages from same broker)
- [ ] Market heatmap per area
- [ ] Auto-notification when high-score match found

### Phase 4 — Scale (Week 4)
- [ ] Multi-language support (Franco-Arabic/Arabizi)
- [ ] PDF/document parser (broker price lists)
- [ ] API key system (for white-label in v8)
- [ ] PostgreSQL migration
- [ ] Performance: <100ms match query on 100K signals

---

## 📋 GENSPARK SHEETS TASK TEMPLATE

For each market, generate these sheets automatically:
1. **HOT Matches** — Score >80%, last 48h
2. **All Signals** — Full database with filters
3. **Area Heatmap** — Demand/supply by area
4. **Broker Report** — Per broker: signals, matches, quality
5. **Daily Digest** — Top 10 matches per day → WhatsApp

---

*End of Developer Brief*
*Version: 1.0 | MATCHpro™ v3.0 Architecture*
