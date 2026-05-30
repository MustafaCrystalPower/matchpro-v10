# MatchPro™ v10.0 — Programmer Handoff Brief
**Crystal Power Investments | Mo'men Maisara | Cairo, Egypt**
**Date: May 2026**

---

## Project Overview
MatchPro™ is Egypt's first AI-powered real estate matching platform.
- 8,870+ real buyer records from WhatsApp broker groups
- 83 Egyptian locations with market intelligence  
- Live scrapers: Property Finder, Dubizzle, OLX Egypt
- Already used by 7,626 active buyers | 56,566 matches processed

## Tech Stack
| Layer | Tech |
|-------|------|
| Frontend | React 19 + Vite + Recharts + Lucide icons |
| Backend | Node.js + Express (ES modules) |
| Data | CSV-backed (8,870 rows), upgradeable to MySQL |
| Deploy | Railway.app (railway.toml included) |
| WhatsApp | Green API (instance 7105409203) |

## What's Already Built (DON'T rebuild these)
✅ 12-page dashboard (Dashboard, Market Intel, Supply/Demand, Matches, Asset Matcher, Analytics, HeatMap, WhatsApp, API Explorer, Settings, My Search, Version Manager)
✅ Self-contained API server (api-server.js) — serves real data from CSV
✅ Market intelligence engine (83 Egyptian locations)
✅ Live scrapers for Property Finder, Dubizzle, OLX
✅ Match engine (POST /api/public/match)
✅ Railway deployment config (railway.toml)
✅ PWA manifest + icons

## What Needs To Be Done (Priority Order)

### PRIORITY 1 — Fix Green API Webhook (30 min)
The WhatsApp integration is ready but the webhook URL is dead (old Manus server).
After Railway deploy:
1. Go to console.green-api.com
2. Instance: 7105409203 | Token: 0e7ca429980f4331ae5fee4360c955a9db2d6fe3ca6545a4b3
3. Settings → Webhook URL → set to: https://YOUR-RAILWAY-APP.railway.app/api/whatsapp/webhook
4. This will release 3,204 queued WhatsApp messages immediately

### PRIORITY 2 — Railway Deploy (1 hour)
```bash
# Push to GitHub
git remote add origin https://github.com/CPInvestMo/matchpro-v10.git
git push -u origin main

# Railway
# 1. railway.app → New Project → Deploy from GitHub → matchpro-v10
# 2. Add MySQL plugin → copy DATABASE_URL
# 3. Set env vars (see .env.example)
# 4. Deploy
```

### PRIORITY 3 — Upload Real Data (2 hours)
The CSV file (data.csv, 8,870 rows) needs to be:
- Either committed to Railway Files or
- Migrated to MySQL (schema in README)
- The api-server.js already reads from data.csv — just needs the file present at runtime

### PRIORITY 4 — Property Finder / Dubizzle scrapers (4 hours)
The scraper stubs are in api-server.js (scrapePropertyFinder, scrapeDubizzle, scrapeOLX).
Currently returns sample data because of anti-bot protection.
Upgrade to use:
- Playwright headless browser for JS-rendered pages
- Rotating user agents
- Rate limiting: 1 req / 3 seconds max

### PRIORITY 5 — WhatsApp Message Ingestion (4 hours)
Backend route /api/whatsapp/webhook is ready in the v9 source (server/whatsappHandler.ts).
Needs to be ported to api-server.js as Express route.
Green API sends POST to webhook when messages arrive.
NLP parser (Arabic + English) extracts supply/demand from messages.

## Environment Variables (.env.example included)
```
NODE_ENV=production
PORT=3000
GREEN_API_INSTANCE_ID=7105409203
GREEN_API_TOKEN=0e7ca429980f4331ae5fee4360c955a9db2d6fe3ca6545a4b3
GREEN_API_API_URL=https://7105.api.greenapi.com
GREEN_API_MEDIA_URL=https://7105.media.greenapi.com
APP_URL=https://YOUR-APP.railway.app
JWT_SECRET=d3454f78d857f7b49c213cb0da1eb04749c715ab77b58c9f8f5f09e431157f12
MATCHPRO_ACTIVE_VERSION=3
```

## Admin Login
- URL: https://matchpro.crystalpowerinvestment.com (after custom domain setup)
- Credentials: admin / Crystal2026!
- Owner phone: +201066505665

## File Structure
```
matchpro-v10/
├── api-server.js          ← The brain — Express API + data loader + scrapers
├── src/
│   ├── App.tsx            ← Router + data fetcher
│   ├── components/
│   │   ├── Sidebar.tsx    ← Navigation (12 pages)
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   └── StatCard.tsx
│   └── pages/
│       ├── Dashboard.tsx          ← Main overview
│       ├── MarketIntelligence.tsx ← Location deep-dive
│       ├── SupplyDemand.tsx       ← Browse all listings
│       ├── Matches.tsx            ← Find buyers for a property
│       ├── AssetMatcher.tsx       ← Mo'men's 4 CPI properties
│       ├── Analytics.tsx          ← Charts & trends
│       ├── HeatMap.tsx            ← Geographic view
│       ├── WhatsApp.tsx           ← Live message feed
│       ├── APIExplorer.tsx        ← Interactive API docs
│       ├── MySearch.tsx           ← Search supply
│       ├── VersionManager.tsx     ← v1-v10 unlock
│       └── Settings.tsx           ← Config
├── vite.config.ts         ← Frontend build config
├── package.json
├── railway.toml           ← Auto-deploy config
└── README.md
```

## Contact
Mo'men Maisara | CEO, Crystal Power Investments
mmaisara@crystalpowerinvestment.com | +201066505665
