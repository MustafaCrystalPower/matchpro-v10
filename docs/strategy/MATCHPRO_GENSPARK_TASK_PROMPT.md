# MATCHpro™ — Genspark Sheets Task Prompt
## Ready to paste directly into Genspark Sheets agent

---

## TASK PROMPT (copy-paste this):

```
Build a Google Sheets system for MATCHpro™ Reverse Discovery Engine.

CONTEXT:
MATCHpro™ is a real-time matching platform that connects supply and demand 
across 3 markets (Real Estate, Recruitment, Import/Export) from WhatsApp, 
Facebook, LinkedIn, Twitter/X.

The core idea: any signal (supply OR demand) posted → instantly returns 
ALL matching signals from BOTH sides, ranked by 24hr close probability.

BUILD THESE 6 SHEETS:

═══════════════════════════════════════════════════════════════

SHEET 1: 🔥 HOT MATCHES (Auto-updated every 6 hours)
Columns:
A: Match Score (0-100%)
B: 24hr Close Probability
C: Signal Type A (Supply/Demand)
D: Name A | Phone A
E: Signal Type B (Supply/Demand)  
F: Name B | Phone B
G: Market (Real Estate/Recruitment/Trade)
H: Area/Location
I: Budget/Salary/Price
J: Property Type / Role / Product
K: Urgency (🔥 URGENT / ⚡ WARM / ❄️ COLD)
L: Message A (truncated 150 chars)
M: Message B (truncated 150 chars)
N: Match Date
O: Source A (WhatsApp/Facebook/LinkedIn)
P: Source B
Q: Status (Pending/Shown/Contacted/Closed)

Rules:
- Only show matches with score > 75%
- Sort by 24hr close probability DESC
- Highlight red: urgency = URGENT + score > 85%
- Auto-filter: market selector dropdown at top

═══════════════════════════════════════════════════════════════

SHEET 2: 📊 SIGNALS DATABASE (All markets, all sources)
Columns:
A: Signal ID
B: Market (Real Estate/Recruitment/Trade)
C: Type (Demand/Supply/Unclear)
D: Source (WhatsApp/Facebook/LinkedIn/Twitter/Manual)
E: Sender Name
F: Sender Phone
G: Location City
H: Location Area
I: Budget Min (EGP)
J: Budget Max (EGP)
K: Property Type / Role / Product
L: Bedrooms / Experience Years / Quantity
M: Purpose (Sale/Rent/Buy/Hire/Export/Import)
N: Urgency
O: Confidence Score (0-1)
P: Is Broker (Yes/No)
Q: Raw Message (first 200 chars)
R: Timestamp
S: Group/Source Name

Filter dropdowns: Market | Type | Source | Urgency | Area | Date range
Color coding: Green = Demand | Blue = Supply | Gray = Unclear

═══════════════════════════════════════════════════════════════

SHEET 3: 🏢 REAL ESTATE — Area Heatmap
Layout: Areas as rows, data as columns

Rows (Areas — sorted by activity):
مدينتي | التجمع الخامس | الرحاب | الشيخ زايد | نيو كايرو | 
المعادي | مدينة نصر | العبور | السادس من أكتوبر | مناطق أخرى

Columns:
A: Area Name (Arabic)
B: Total Demand (last 48h)
C: Total Supply (last 48h)
D: Demand/Supply Ratio
E: HOT Matches (score >85%)
F: Avg Budget (EGP millions)
G: Most Wanted Type (Villa/Apt/Studio...)
H: Top Budget Range
I: Active Brokers Count
J: Market Temperature (🔥🔥🔥 / 🔥🔥 / 🔥 / ❄️)
K: 7-day trend (↑↑ / ↑ / → / ↓)

Bottom summary row: TOTALS + CITY AVERAGE

═══════════════════════════════════════════════════════════════

SHEET 4: 💼 RECRUITMENT SIGNALS
Columns for Job Offers:
A: Company Name
B: Role/Title  
C: Seniority (Junior/Mid/Senior/Director)
D: Salary Min (EGP)
E: Salary Max (EGP)
F: Location
G: Required Skills (comma-separated)
H: Experience Required
I: Gender Preference
J: Equity Offered (Yes/No + %)
K: Remote (Yes/No)
L: Urgency
M: Contact
N: Posted Date
O: Source

Columns for Candidates:
Same sheet, second table below
A: Candidate Name
B: Current Role
C: Years Experience
D: Salary Expectation
E: Location
F: Top Skills
G: Languages
H: Education
I: Availability
J: Open to Equity
K: Contact
L: Date Active

Matching panel at bottom:
Auto-formula: highlight candidate rows that match active job offers

═══════════════════════════════════════════════════════════════

SHEET 5: 🚢 TRADE SIGNALS (Import/Export)
Columns:
A: Signal Type (Export Offer/Import Demand)
B: Product Name
C: HS Code
D: Quantity + Unit
E: Origin Country
F: Destination Country
G: Price (USD/unit)
H: Incoterm (FOB/CIF/EXW)
I: Payment Terms (LC/TT/CAD)
J: Certifications
K: Sample Available
H: Min Order (containers/tons)
I: Company Type (Manufacturer/Trader/Agent)
J: Contact
K: Timeline
L: Source
M: Date

Match panel: Auto-highlight export offers that match import demands

═══════════════════════════════════════════════════════════════

SHEET 6: 📈 DAILY DIGEST (WhatsApp-ready output)
Auto-generated daily summary formatted for WhatsApp sending:

Format:
"📊 MATCHpro Daily Digest — [DATE]
─────────────────────
🔥 TOP 5 HOT MATCHES TODAY:

1. [Area] [Type] — Score: [X]% | Close prob: [Y]%
   Buyer: [Name] [Phone] — Budget: [X]M EGP
   Seller: [Name] [Phone] — Price: [Y]M EGP
   [View full match →]

2. ... etc

📍 HOTTEST AREAS:
• مدينتي: [X] demand, [Y] supply, [Z] matches
• التجمع الخامس: ...

💼 TOP RECRUITMENT MATCH:
[Role] — [Company] looking for [Profile]

📊 STATS:
• New signals today: [X]
• Matches found: [Y]  
• High confidence (>85%): [Z]"

Output: Text in cell A1, ready to copy-paste to WhatsApp
Auto-update: formula recalculates daily at midnight
```

═══════════════════════════════════════════════════════════════

ADDITIONAL REQUIREMENTS:
1. All sheets must have Arabic RTL support
2. Conditional formatting: 
   - Score > 90% = dark red background
   - Score 75-89% = orange
   - Score 50-74% = yellow
3. Freeze top rows (headers always visible)
4. Auto-filter on every sheet
5. Data validation: dropdowns for all categorical fields
6. Summary dashboard on Sheet 1 with key KPIs:
   - Total active signals
   - Matches found today
   - Average match score
   - Top area by demand
   - Top area by supply
```

---

## FOR AI DEVELOPER (separate task):

Build POST /api/discover:
```json
Request:
{
  "market": "real_estate",
  "signal": "شقة 3 غرف مدينتي بادجت 4M تمليك",
  "limit": 20,
  "min_score": 0.70
}

Response:
{
  "parsed": {
    "type": "demand",
    "location_area": "مدينتي",
    "bedrooms": 3,
    "budget_max": 4000000,
    "purpose": "sale"
  },
  "matches": [
    {
      "signal_id": "abc123",
      "score": 0.94,
      "close_prob_24h": 0.78,
      "type": "supply",
      "name": "Mohamed",
      "phone": "01234567890",
      "area": "مدينتي",
      "price": 3800000,
      "message": "شقة للبيع مدينتي B11...",
      "days_ago": 2
    }
  ],
  "total": 15,
  "query_ms": 43
}
```
