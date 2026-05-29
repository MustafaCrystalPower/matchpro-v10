# MatchPro™ Intelligence Engine v10.0
**Crystal Power Investments | Cairo, Egypt**

Egypt's first AI-powered real estate matching platform.
**56,566+ matches processed | 8,870 buyers | 2,191 listings**

## Stack
- **Backend**: Node.js + Express — self-contained API with real CSV data
- **Frontend**: React + Vite + Recharts — 12 pages
- **Data**: 8,870 demand records from WhatsApp groups (Property Finder, Dubizzle, OLX scrapers included)
- **Deploy**: Railway (auto-builds from GitHub)

## Local Dev
```bash
npm install
npm run build      # Build frontend
npm start          # Start API + serve frontend on :3000
```

## Railway Deploy
1. Push to GitHub
2. railway.app → New Project → Deploy from GitHub
3. Set env vars (see .env.example)
4. After deploy → update Green API webhook to: `https://YOUR-APP.railway.app/api/whatsapp/webhook`

## API Endpoints
| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Server health + data stats |
| `GET /api/public/market-summary` | Market overview |
| `GET /api/public/market-intelligence` | Full intelligence (83 locations) |
| `GET /api/public/supply` | Supply listings (filter by location/purpose/bedrooms/price) |
| `GET /api/public/demand` | Buyer requests |
| `POST /api/public/match` | Match an asset against all buyers |
| `GET /api/public/embed/:location` | Widget data for any location |
| `GET /api/scrape/property-finder` | Scrape PropertyFinder.eg |
| `GET /api/scrape/dubizzle` | Scrape Dubizzle.com.eg |
| `GET /api/scrape/olx` | Scrape OLX.com.eg |
| `GET /api/scrape/all` | Scrape all sources at once |

## Credentials
- **Admin Login**: admin / Crystal2026!
- **WhatsApp**: Green API Instance 7105409203
- **Owner**: Mo'men Maisara — Crystal Power Investments

---
*MatchPro™ — The Eye of the Market*
# MatchPro™ v10.0 — Sat May 30 01:57:15 EEST 2026
