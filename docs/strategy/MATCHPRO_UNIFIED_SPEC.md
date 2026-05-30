# MatchPro Unified — Full Feature Specification

## Base: matchpro-v2 (Node.js/Express + SQLite)
This is the working production backend with 40K+ matches. Use it as the foundation.

## Features to merge from ALL repos:

### FROM matchpro-v2 (keep all — this is the base):
- [x] Auth system (JWT, admin, broker roles, invitations)
- [x] Subscription/plan management (free/monthly/yearly)
- [x] WhatsApp webhook (Green API)
- [x] NLP parser v2 (Arabic/English, 300+ locations, price/bed/size/floor extraction)
- [x] Enhanced NLP parser (location clusters, levenshtein matching)
- [x] Matching engine v2 (location/price/specs/purpose scoring)
- [x] Enhanced matching (clusters, property type groups)
- [x] Feature gating (per-plan feature access)
- [x] Market config (multi-market support)
- [x] Dashboard API (stats, location-stats)
- [x] Match pipeline with CRM statuses
- [x] Supply/Demand tables with archive
- [x] Live message feed
- [x] Broker analytics/leaderboard
- [x] Market intelligence/heatmap
- [x] CSV/Excel export
- [x] Deep analytics
- [x] NLP classify endpoint (single + batch)
- [x] PDPL broker consent system
- [x] Tables proxy (Manus compat)
- [x] Broker portal (auth, matches, stats)
- [x] Digest system (Excel, email, scheduling)
- [x] Report portal (OTP-protected, per-location)
- [x] My Assets (Excel upload, email on new matches, export leads)
- [x] Broker management (areas config, scheduled sheets)
- [x] Manus upstream sync (backup data source)
- [x] Facebook scraper integration
- [x] WebSocket broadcast
- [x] Ingest API (cross-service message/match injection)

### FROM matchpro-v3 (merge frontend pages):
- [ ] 21 HTML pages with full navigation
- [ ] Dashboard with real-time intelligence feed
- [ ] Market Intelligence page (heatmap, trends)
- [ ] Analytics page (charts, breakdowns)
- [ ] Properties page
- [ ] Buyer Requests page
- [ ] Settings page (Green API config, market settings)
- [ ] Webhook test suite
- [ ] Client-side matching engine
- [ ] Enterprise hub
- [ ] Organization/membership management UI
- [ ] License management UI
- [ ] System health monitoring
- [ ] Off-plan projects hub
- [ ] Sidebar navigation with logo

### FROM matchpro-manus (merge advanced features):
- [ ] Enhanced NLP parser (810 lines — most advanced, use as upgrade)
- [ ] Match summary generator (AI-powered match explanations)
- [ ] Notification service (push/in-app notifications)
- [ ] WhatsApp handler with real-time WebSocket
- [ ] AI Chat box (in-app AI assistant)
- [ ] Map component (location visualization)
- [ ] User profile/onboarding pages
- [ ] Custom notifications management
- [ ] Notification preferences
- [ ] Theme context (dark/light mode)

### FROM matchpro-engine (merge Python utilities):
- [ ] Auto follow leads (automated lead follow-up via WhatsApp)
- [ ] Morning/evening cycle scheduler
- [ ] Outlook email reader integration

### FROM matchpro-production:
- [ ] PWA support (manifest.json, service worker, icons)
- [ ] Deploy scripts (Vercel/Netlify/Railway)

### FROM matchpro-showcase:
- [ ] Marketing/showcase landing page

## Architecture:
- Single Node.js server (Express)
- SQLite database (primary)
- All v3 HTML pages served as static frontend
- Manus-grade NLP from enhanced parser
- PWA-enabled
- WebSocket for real-time updates

## Port: 3001
## Database: SQLite (matchpro.db)
