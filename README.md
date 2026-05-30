# MatchPro™ v11.0.0 — Real Estate Matching Platform
Crystal Power Investments | Cairo, Egypt

## Overview
Egypt's real estate matching platform. Matches buyer/renter requests (7,640 demand records)
against available properties (4,508 supply records) with 57,105 total matches.

## Tech Stack
- **Backend:** Node.js + Express (server/index.js entry point)
- **Database:** better-sqlite3 (SQLite) — data/matchpro.db (124MB)
- **Frontend:** Vanilla HTML/JS (client/public/)
- **Auth:** JWT (HS256)
- **NLP:** Arabic + English property parsing (server/nlp_v2.js)
- **WebSocket:** Live feed at /ws (ws package)
- **Rate Limiting:** 100 req/min per IP (in-memory)

## Project Structure
```
matchpro/
├── server/
│   ├── index.js              ← Entry point (app setup + route mounting, ~250 lines)
│   ├── routes/
│   │   ├── auth.js           ← JWT login + /api/me
│   │   ├── stats.js          ← /api/stats, /api/verified-stats, /health
│   │   ├── demand.js         ← Buyer requests API
│   │   ├── supply.js         ← Property listings API
│   │   ├── matches.js        ← Match results + run matching
│   │   ├── assets.js         ← CPI assets + asset-specific matches
│   │   ├── map.js            ← Map data (heatmap, lat/lng, heat-map)
│   │   ├── market.js         ← Public market summary
│   │   ├── public.js         ← Public (open CORS) endpoints
│   │   ├── webhook.js        ← WhatsApp webhook (Green API)
│   │   ├── pipeline.js       ← Reports + pipeline + discover
│   │   ├── properties.js     ← CPI properties CRUD
│   │   └── dashboard.js      ← Dashboard data + currencies
│   ├── nlp_v2.js             ← Arabic/English NLP parser
│   ├── matching_v2.js        ← Matching engine
│   ├── brokerDetector.js     ← Broker vs buyer detection
│   ├── market-v2.js          ← Market intelligence v2 endpoints
│   ├── avm.js                ← Automated Valuation Model
│   ├── leads.js              ← Lead management
│   ├── buyers.js             ← Buyer scoring
│   ├── digest.js             ← Daily digest generator
│   ├── broker-portal.js      ← Broker portal routes
│   ├── report-portal.js      ← Report portal routes
│   └── subscriptions.js      ← User registration + subscriptions
├── client/
│   └── public/
│       ├── dashboard.html              ← Main admin dashboard
│       ├── market-intelligence.html    ← Public demo page
│       └── asset-intelligence.html    ← Asset matcher
├── data/
│   └── matchpro.db           ← SQLite database (124MB, DO NOT commit)
├── automations/              ← Cron/scheduled scripts
├── scripts/                  ← Utility scripts
├── config/                   ← Configuration files
└── package.json
```

## API Reference

### Authentication
```
POST /api/auth/login
Body: { username, password }
Returns: { token: "JWT..." }
```
Default credentials: `mmaisara` / `CPI-Admin-2026!`

All protected endpoints require: `Authorization: Bearer <token>` header.

### Public Endpoints (no auth required)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/stats` | Platform totals (supply, demand, matches) |
| GET | `/health` | Full health check with DB stats |
| GET | `/api/public/market-summary` | Top locations with pressure index |
| GET | `/api/public/demand?limit=N` | Recent buyer requests (paginated) |
| GET | `/api/public/supply?limit=N` | Recent property listings (paginated) |
| GET | `/api/public/match` | Match asset against demand (query params) |
| POST | `/api/public/match` | Match asset against demand (body) |
| GET | `/api/public/embed/:location` | Embed widget data for a location |
| GET | `/api/market/analysis/v2` | Full market analysis per location |
| GET | `/api/market/heatmap/v2` | Map heatmap data with lat/lng |
| GET | `/api/market/analysis` | Market analysis (v1) |
| GET | `/api/market/location/:location` | Location-specific market data |
| GET | `/api/map/supply` | Supply records with lat/lng |
| GET | `/api/map/demand` | Demand records with lat/lng |
| GET | `/api/map/heatmap` | Combined heatmap data |
| GET | `/api/heat-map` | Legacy heat map (demand by area) |
| GET | `/api/demand` | Recent demand records |
| GET | `/api/supply` | Recent supply records |
| GET | `/api/matches` | Top matches by score |
| GET | `/api/verified-stats` | Verified demand statistics |

### Protected Endpoints (JWT required)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/me` | Current user info |
| GET | `/api/dashboard` | Full dashboard data |
| GET | `/api/assets` | CPI available assets |
| GET | `/api/assets/:code/matches` | Stored matches for an asset (download JSON) |
| GET | `/api/assets/:code/demand-matches` | Live demand matches for an asset |
| POST | `/api/assets/match-custom` | Custom asset match against demand |
| GET | `/api/demand/:id/supply-matches` | Supply matches for a demand record |
| POST | `/api/demand/match-custom` | Custom demand match against supply |
| POST | `/api/match/run` | Trigger matching cycle |
| GET | `/api/pipeline/daily` | Last 7 days demand pipeline |
| GET | `/api/webhook-leads` | Recent webhook leads |
| GET | `/api/reports` | List generated Excel reports |
| POST | `/api/reports/generate` | Trigger report generation |
| POST | `/api/discover` | Reverse discovery engine |
| GET | `/api/properties` | CPI properties CRUD list |
| POST | `/api/properties` | Create property |
| PUT | `/api/properties/:id` | Update property |
| DELETE | `/api/properties/:id` | Soft-delete property |
| GET | `/api/currencies` | EGP exchange rates |

### WebHook
```
POST /webhook/whatsapp
```
Green API webhook receiver. Categorizes messages (buy/sell/rent/invest), stores leads, sends hot-lead WhatsApp alerts.
Instance: `7105409203`

## Setup
```bash
npm install
npm start        # Production (port 3070)
npm run dev      # Development with nodemon
```

## Environment Variables
```
PORT=3070
JWT_SECRET=<secret>
GREEN_API_INSTANCE_ID=7105409203
GREEN_API_TOKEN=<token>
```

## Database Schema
Key tables:
| Table | Description |
|-------|-------------|
| `demand` | Buyer/renter requests (7,640 records) |
| `supply` | Available properties (4,508 records) |
| `matches` | Matched pairs (57,105 records) |
| `assets` | CPI-owned assets |
| `asset_matches` | Pre-computed asset→demand matches |
| `webhook_leads` | Leads from WhatsApp webhook |
| `messages` | Raw WhatsApp messages |
| `groups` | WhatsApp groups |
| `brokers` | Broker profiles |
| `properties` | CPI managed properties (CRUD) |
| `app_users` | Application users |
| `api_logs` | Request access logs |

## Architecture Notes
- Route files under `server/routes/` each export a factory `(db, ...helpers) => router`
- Shared helpers (db, auth, scoreMatchPair, getCoords) are passed from index.js
- External modules (market-v2, avm, subscriptions, broker-portal, leads, buyers) register directly on `app`
- WebSocket broadcast helper `broadcast(data)` available for live feed push

## Deployment
Served on port 3070. Use Caddy/nginx reverse proxy for HTTPS.
```
# /etc/caddy/conf.d/matchpro.caddy
yourdomain.com {
    reverse_proxy 127.0.0.1:3070
}
```

---
*Crystal Power Investments — Mo'men Hisham Maisara | mmaisara@crystalpowerinvestment.com*
