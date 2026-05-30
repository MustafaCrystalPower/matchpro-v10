<<<<<<< HEAD
# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
=======
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
>>>>>>> origin/main
