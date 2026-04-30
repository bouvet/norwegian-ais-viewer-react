# CLAUDE.md — Norwegian AIS Vessel Traffic Viewer (React/FastAPI)

## Project overview
Full-stack web application displaying live AIS vessel traffic in Norwegian waters
(Norwegian Sea + North Sea), with vessel type filtering, 24-hour track visualisation,
vessel name search, and AI-powered Russian tanker detection.

**Data source**: BarentsWatch AIS REST API (OAuth2 client credentials)
**Stack**: FastAPI (Python) backend + React (TypeScript) frontend
**Local AI**: Ollama + Mistral 7B for Russian vessel name classification

---

## Monorepo structure

```
norwegian-ais-viewer-react/
├── CLAUDE.md
├── backend/
│   ├── main.py          ← FastAPI app: all endpoints + BarentsWatch client + Ollama calls
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── App.tsx                        ← Root component, layout
    │   ├── components/
    │   │   ├── VesselMap.tsx              ← react-leaflet map, markers, track polyline
    │   │   └── Sidebar.tsx                ← legend/filter, search, Russian detection UI
    │   ├── hooks/
    │   │   └── useVessels.ts              ← data fetching from backend
    │   ├── utils/
    │   │   └── vesselTypes.ts             ← AIS ship_type → category + colour mapping
    │   └── data/
    │       └── midLookup.ts               ← MMSI first 3 digits → flag/country name
    ├── index.css                          ← all app styles, dark sidebar theme
    ├── package.json
    └── vite.config.ts
```

---

## How to run

**Backend** (always run from inside the `/backend` folder):
```
cd backend
uvicorn main:app --reload
```
Runs on `http://localhost:8000`

**Frontend**:
```
cd frontend
npm run dev
```
Runs on `http://localhost:5173`

**For Russian tanker detection**: Ollama must be running with Mistral pulled.
Start Ollama from the Windows Start menu, then verify with:
```
ollama list
```
Mistral is called via `http://localhost:11434` — this port is always the same.

---

## Environment variables
Credentials live in `backend/.env` (never commit this file):
```
BW_CLIENT_ID=your_client_id
BW_CLIENT_SECRET=your_client_secret
```
Backend fails fast on startup if these are missing.

---

## Key backend endpoints

| Endpoint | Description |
|---|---|
| `GET /api/vessels` | Full vessel snapshot from BarentsWatch |
| `GET /api/vessels/{mmsi}/track` | 24h track from BarentsWatch Historic API |
| `GET /api/capabilities` | Returns `{"russian_detection": true/false}` based on Ollama availability |
| `POST /api/vessels/classify-russian` | Classifies a vessel name via Ollama/Mistral |
| `GET /api/vessels/russian-tankers` | Returns list of suspected Russian tankers |

---

## Map tile layers
- **Light mode**: CartoDB Voyager
  `https://cartodb-basemaps-{s}.global.ssl.fastly.net/rastertiles/voyager/{z}/{x}/{y}.png`
- **Dark mode**: Stadia Alidade Smooth Dark
  `https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}.png`

Both are set in `VesselMap.tsx` based on the `darkMode` prop passed from the sidebar toggle.

---

## Vessel type colour scheme

| Category | AIS ship_type codes | Colour |
|---|---|---|
| Tanker | 80–89 | `#FF0000` |
| Cargo | 70–79 | `#008000` |
| Passenger | 60–69 | `#00BFFF` |
| Fishing | 30 | `#FFA500` |
| Tug / Special craft | 50–59 | `#FFFF00` |
| High speed craft | 40–49 | `#FF69B4` |
| Sailing / Pleasure | 36–37 | `#9400D3` |
| Other / Unknown | everything else | `#808080` |

---

## Russian tanker detection logic
A tanker is flagged as suspected Russian if TWO OR MORE of these signals are true:
1. MMSI starts with `273` (Russian registry)
2. Flag state is a known flag of convenience (Cyprus 209/210/212, Bahamas 311,
   Gambia 629, Liberia 636/637, Panama 370/371/372, Tuvalu 577, Cook Islands 518,
   Antigua & Barbuda 305, Palau 511, Cameroon 613, Gabon 626)
3. Vessel name classified as Russian-sounding by Ollama/Mistral

Classification results are cached in memory — same vessel name is never classified twice
in the same session. First scan is slow (~2 min for all tankers), subsequent scans instant.

Suspected Russian tankers are shown with a thicker white SVG stroke on the map marker.

---

## Coding conventions
- **Python**: all functions must have docstrings with parameter descriptions
- **TypeScript/React**: functional components only, hooks for data fetching
- Add brief inline comments on non-obvious logic
- Do not use any form of polling, autorefresh loop, or time.sleep in the frontend
- All vessel type filtering happens client-side — never re-fetch from backend just to filter

## Security
- CORS restricted to `http://localhost:3000` and `http://localhost:5173`
- No credentials or sensitive values anywhere in the frontend code
- Backend validates presence of env vars at startup

## Git branches
- `main` — clean app without Russian tanker detection, safe for company GitHub
- `feature/russian-tanker-detection` — full app including AI detection feature
