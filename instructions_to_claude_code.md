# Instructions to Claude Code — Norwegian AIS Viewer (React/FastAPI)

This document contains all the instructions that were passed to Claude Code
during the development of the Norwegian AIS Vessel Traffic Viewer, from the
initial build to the AI-powered Russian tanker detection feature.
Each section corresponds to a distinct development step, in chronological order.

---

## Part 1 — Initial build

Build a vessel traffic web application using FastAPI (Python backend) 
and React (frontend). This is a rewrite of an existing Streamlit app 
— the screenshot 01-Norwegian_AIS_Viewer.jpg provided shows the current 
functionality as a reference for what data to display. You are free to 
improve and modernise the UI/UX.

### Architecture
Use a monorepo structure:
```
norwegian-ais-viewer-react/
├── backend/    # FastAPI
└── frontend/   # React
```

### Backend (FastAPI)
The backend handles all BarentsWatch API communication:
- Authentication via OAuth2 client credentials (see bw_api.py for 
  reference implementation)
- One endpoint: GET /api/vessels — returns all current vessel positions 
  as JSON
- Credentials stored in a .env file: BW_CLIENT_ID and BW_CLIENT_SECRET
- Token caching: fetch a new token only when the current one expires 
  or returns 401
- Enable CORS so the React frontend can call the backend locally

### Frontend (React)
Use react-leaflet for the map. Before starting, check the latest stable 
versions of all libraries and flag any known compatibility issues between 
them before proceeding.

Map behaviour:
- Default center: 65°N, 14°E, zoom level 5 (covers Norway)
- Tile layers: CartoDB Voyager (light) and Stadia Alidade Smooth Dark 
  (dark), switchable via a toggle
- Vessel markers: SVG triangles rotated in the direction of travel, 
  coloured by vessel type (see colour scheme below)
- Clicking a vessel shows a popup with: name, MMSI, flag state (derived 
  from first 3 digits of MMSI using MID lookup), vessel type, 
  navigational status, speed, course, and last update time
- Map zoom and position must be preserved when data refreshes or filters 
  change — this must work correctly from the start

Vessel type colour scheme:
- Tanker (80-89): #FF0000
- Cargo (70-79): #008000
- Passenger (60-69): #00BFFF
- Fishing (30): #FFA500
- Tug / Special craft (50-59): #FFFF00
- High speed craft (40-49): #FF69B4
- Sailing / Pleasure (36-37): #9400D3
- Other / Unknown (everything else): #808080

### Sidebar / UI
The sidebar contains:

1. App title and short description

2. Legend that doubles as the vessel type filter:
   - Each vessel category is shown with its colour swatch and the count 
     of currently visible vessels of that type
   - Clicking a category toggles it on/off directly in the legend
   - When toggled off, the legend item is visually greyed out
   - Toggling updates the map instantly, client-side, with no server call
   - All categories are toggled on by default

3. Total visible vessel count: shows only vessels currently toggled on 
   and visible on the map

4. Data freshness indicator: shows "Last updated: HH:MM UTC" with a 
   small refresh icon next to it. Clicking the icon fetches fresh data 
   from the backend. No large "Refresh now" button.

5. Light/dark map toggle

### MID to country lookup
Include a MID lookup table mapping the first 3 digits of MMSI to country 
name. At minimum include the most common ones relevant to Norwegian waters 
and Russian shadow fleet monitoring:
273 (Russia), 212/209/210 (Cyprus), 311 (Bahamas), 629 (Gambia), 
257/258/259 (Norway), 219/220 (Denmark), 265/266 (Sweden), 
230 (Finland), 232/233/234/235 (UK), 246/247 (Netherlands), 
305 (Antigua & Barbuda), 370/371/372 (Panama), 636/637 (Liberia), 
518 (Cook Islands), 577 (Tuvalu)

### Version requirements
Use the most recent stable versions of all libraries and frameworks. 
Before installing any package, check the latest stable version. 
If there are known breaking changes or compatibility issues between 
the latest version of a library and its ecosystem, flag this before 
proceeding and suggest the most appropriate version to use.

### Reference files
The files bw_api.py and vessel_types.py are provided as reference only. 
Do not copy them directly — use them as inspiration for the FastAPI backend 
and the vessel type mapping in React. The new project must be built from 
scratch in the current directory.
The screenshot 01-Norwegian_AIS_Viewer.jpg is provided as a functional 
reference for what data to display, not as a design constraint. You are 
free to improve and modernise the design.

### Git setup
After creating all files:
- Run git init
- Run git add .
- Commit with message: "Initial commit: Norwegian AIS viewer React/FastAPI rewrite"

---

## Part 2 — Adding README file

Do not change any existing code — only create the README.md file.

Create a README.md file at the root of the project covering:

- Brief description of the app and its purpose (live AIS vessel traffic 
  viewer for Norwegian waters, with focus on tanker monitoring)
- Screenshot: include 01-Norwegian_AIS_Viewer.jpg from the screenshots/ folder
- Architecture overview: FastAPI backend + React frontend (monorepo)
- Requirements: Python 3.10+, Node.js (latest stable), BarentsWatch API credentials
- Setup instructions for both backend and frontend, including .env file 
  creation with BW_CLIENT_ID and BW_CLIENT_SECRET
- How to run both backend and frontend
- Vessel type colour scheme table
- Note about data coverage (Norwegian Economic Zone only, no small fishing 
  vessels or leisure craft)
- Project structure showing the monorepo layout

---

## Part 3 — Adding security

Add security improvements to the existing app. Do not change any 
application logic or UI — only add the security measures described below.

### Backend (FastAPI)

1. CORS configuration: restrict allowed origins to localhost only during 
   development. Replace any wildcard (*) CORS setting with explicit origins:
   - http://localhost:3000
   - http://localhost:5173
   (or whichever port the React frontend runs on)

2. Verify that BW_CLIENT_ID and BW_CLIENT_SECRET are loaded exclusively 
   from the .env file and are never exposed in any response, log output, 
   or error message.

3. Add a check on startup: if BW_CLIENT_ID or BW_CLIENT_SECRET are 
   missing from the environment, the backend should fail fast with a 
   clear error message rather than crashing later on the first API call.

### Frontend (React)

4. Verify that no API credentials or sensitive values are hardcoded or 
   referenced anywhere in the React code or build output. The frontend 
   should only know the backend URL (localhost).

### General

5. Confirm that .env is in .gitignore and will never be committed.
6. Add a .env.example file at the root of the project showing the 
   required variables without their values:
   ```
   BW_CLIENT_ID=
   BW_CLIENT_SECRET=
   ```

---

## Part 4 — Adding vessel track

Add vessel track functionality to the app. When a user clicks on a vessel 
marker, the existing popup appears as normal. Inside the popup, add a 
"Show track" button. When clicked, it fetches and draws the vessel's 
track for the last 24 hours on the map as a coloured polyline.

Do not change any existing functionality — only add the track feature.

### Backend (FastAPI)

Add a new endpoint:
`GET /api/vessels/{mmsi}/track`

This endpoint:
- Takes the MMSI as a path parameter
- Calls the BarentsWatch historic API:
  `https://historic.ais.barentswatch.no/v1/historic/trackslast24hours/{mmsi}`
- Uses the same OAuth token caching mechanism already in place
- Returns the GeoJSON FeatureCollection response from BarentsWatch 
  directly to the frontend
- Handles 401 by refreshing the token and retrying once, same pattern 
  as the existing /api/vessels endpoint
- If no track data is available for the vessel, return an empty 
  FeatureCollection gracefully

### Frontend (React)

In the vessel popup, add a "Show track" button below the existing fields.

When clicked:
- Fetch the track from /api/vessels/{mmsi}/track
- Draw the track on the map as a polyline in the same colour as the 
  vessel type (e.g. red for tanker, green for cargo etc.)
- The polyline should have a slight transparency so it doesn't obscure 
  the map underneath
- Show a small loading indicator in the popup while the track is loading
- If no track data is returned, show a brief message in the popup: 
  "No track data available"

Track display behaviour:
- Only one track is shown at a time — if the user clicks "Show track" 
  on a different vessel, the previous track is cleared and the new one 
  is drawn
- The track is cleared when the popup is closed
- The map zoom and position must not change when the track is drawn
- Add a small "Clear track" button that appears once a track is visible, 
  allowing the user to remove it without closing the popup

---

## Part 5 — Adding vessel name search

Add a vessel name search with autocomplete to the sidebar, positioned 
below the visible vessel count and above any existing dividers.

### Behaviour

- As the user types in the search field, show a dropdown list of matching 
  vessel names below the input field
- Matching is case-insensitive and matches any vessel whose name CONTAINS 
  the typed string, not just vessels starting with it
- Show a maximum of 8 results in the dropdown at a time
- Only search vessels that are currently toggled on (respect the active 
  vessel type filter)
- When the user clicks a result in the dropdown:
  - Close the dropdown
  - Pan and zoom the map to center on that vessel (zoom level 10)
  - Open the vessel popup automatically
  - Highlight the selected vessel marker briefly (e.g. a white outline 
    or a slight pulse animation) so the user can spot it easily
- Pressing Escape closes the dropdown without selecting anything
- Clicking outside the search field closes the dropdown
- Clear the search field when the user clicks the X button inside it
- If no vessels match the search string, show "No vessels found" in 
  the dropdown

### UI

- The search field should have a small search icon on the left inside 
  the field
- It should fit the existing sidebar style (dark or light depending 
  on the current map theme toggle)
- The dropdown should appear directly below the search field and sit 
  on top of the map, not push the sidebar content down
- Separate the search field from the visible vessel count above it using 
  the same thin divider line that is already used between other sidebar 
  elements. Match the existing divider style exactly.

---

## Part 6 — Russian tanker detection

Add a "Russian Tanker Detection" feature to the app. This feature is 
optional and only activates when Ollama is running locally with the 
Mistral model. Follow all instructions below carefully.

### Backend changes

1. At startup, check if Ollama is available by sending a GET request to 
   `http://localhost:11434/api/tags`. If it responds successfully and the 
   mistral model is listed, set a flag `russian_detection_available = True`, 
   otherwise False. Do this check once at startup and cache the result.

2. Add a new endpoint:
   `GET /api/capabilities`
   Returns: `{"russian_detection": true/false}`
   The React frontend calls this on load to know whether to enable the 
   Russian tanker detection section.

3. Add a new endpoint:
   `POST /api/vessels/classify-russian`
   Accepts a JSON body: `{"name": "VESSEL NAME"}`
   Calls Ollama at `http://localhost:11434/api/generate` with this prompt:
   
   > "Is the vessel name {name} Russian-sounding? This could indicate a 
   > Russian-operated vessel. Russian vessel names typically contain Slavic 
   > words, Russian personal names, Russian geographical references, or 
   > common Russian transliteration patterns such as endings like -ov, -ev, 
   > -sky, -ski, -enko, -grad, -novy, -arktik. Answer only yes or no, 
   > nothing else."
   
   Parse the response — if it contains "yes" return `{"russian_sounding": true}`, 
   otherwise return `{"russian_sounding": false}`.
   
   Cache results in memory keyed by vessel name so the same vessel is 
   never classified twice in the same session.
   
   Set `stream: false` in the Ollama request body.

4. Add a new endpoint:
   `GET /api/vessels/russian-tankers`
   This endpoint:
   - Gets the current vessel snapshot from BarentsWatch (reuse existing 
     token caching)
   - Filters to tankers only (ship_type 80-89)
   - For each tanker, applies the following detection logic and flags it 
     as suspected Russian if TWO OR MORE of these signals are true:
     - a) MMSI starts with 273 (Russian registry)
     - b) Flag state (from MID lookup) is a known flag of convenience: 
       Cyprus (209, 210, 212), Bahamas (311), Gambia (629), Liberia 
       (636, 637), Panama (370, 371, 372), Tuvalu (577), Cook Islands 
       (518), Antigua & Barbuda (305), Palau (511), Cameroon (613), Gabon (626)
     - c) Vessel name is classified as Russian-sounding by the Ollama 
       classify-russian endpoint
   - Returns a list of suspected Russian tankers with all vessel fields 
     plus a "signals" array listing which signals triggered the flag
   - If Ollama is not available, still apply signals a) and b) only — 
     a vessel flagged by both a) and b) without c) is still returned

### Frontend changes

5. On app load, call `GET /api/capabilities` and store the result in React state.

6. Add a new section to the sidebar below the search field, titled 
   "Russian Tanker Detection". Separate it from the section above with 
   the same thin divider line used elsewhere in the sidebar.

7. The section header row contains:
   - The section title "Russian Tanker Detection" in the same style as 
     other section titles
   - A small ℹ️ info icon button to the right of the title

8. Clicking the ℹ️ icon opens a modal overlay with the following instructions:

   **Title**: "Enable Russian Tanker Detection"
   
   **Body**:
   > "This feature uses a local AI model (Mistral via Ollama) to classify 
   > vessel names as Russian-sounding. To enable it:
   > 1. Download and install Ollama from ollama.com
   > 2. Open a terminal and run: ollama pull mistral
   > 3. Make sure Ollama is running
   > 4. Restart the app backend
   > Once enabled, the feature will automatically activate on next load."
   
   A close button to dismiss the modal.

9. When `russian_detection` is false (Ollama not available):
   - The entire section content below the title row is greyed out and 
     shows the text "Ollama not available — click ℹ️ to learn more"
   - The ℹ️ icon is still clickable

10. When `russian_detection` is true (Ollama available):
    - Show a "Scan now" button that triggers a call to `GET /api/vessels/russian-tankers`
    - While scanning, show a small loading indicator with text "Scanning vessels..."
    - Once results are returned, display a scrollable list of suspected 
      Russian tankers, maximum 10 visible at a time with scroll for the rest
    - Each list item shows the vessel name and its flag state
    - Clicking a list item:
      - Pans and zooms the map to that vessel (zoom level 10)
      - Opens the vessel popup automatically
      - The popup must include an extra line: "⚠️ Suspected Russian tanker"
      - Briefly highlights the marker with a pulse animation
    - Show the total count of suspected vessels found above the list, 
      e.g. "Found 7 suspected Russian tankers"

11. The "⚠️ Suspected Russian tanker" line in the popup must only appear 
    for vessels that were flagged by the Russian tanker detection scan — 
    not for all tankers. Store the list of flagged MMSIs in React state 
    and check against it when rendering popups.

### Style
12. Match the existing sidebar dark theme for all new UI elements. 
    The modal should have a dark background consistent with the rest of 
    the app. Do not introduce any new colour schemes.

### Do not change any existing functionality
13. All existing features (vessel map, legend filter, search, track) must 
    continue to work exactly as before. Only add the new feature.

---

## Part 7 — Russian tanker detection corrections

Update the Russian Tanker Detection feature with the following changes. 
Do not change any other existing functionality.

### Map behaviour when scan results are returned

1. When the Russian tanker scan results are returned and the list is 
   displayed in the sidebar, automatically:
   - Filter the map to show only Tankers — deselect all other vessel 
     types in the legend filter
   - Reset the map view to the default center (65°N, 14°E) and default 
     zoom level 5
   - The user can still manually re-enable other vessel types by clicking 
     them in the legend — this must not be blocked in any way

2. When the user clicks "Scan again", reset the map view and filter to 
   tankers only again when the new results are returned, same as above.

### Visual distinction of suspected Russian tankers on the map

3. Suspected Russian tanker markers must be visually distinct from regular 
   tanker markers. Apply a thicker white outline to the SVG triangle marker 
   for suspected Russian vessels:
   - Regular tanker: `stroke="white" stroke-width="0.8"` (existing)
   - Suspected Russian tanker: `stroke="white" stroke-width="3"`
   
   The fill colour must remain the same red (#FF0000) as other tankers — 
   only the outline thickness changes.

4. The white outline distinction must be applied based on the list of 
   flagged MMSIs stored in React state from the last scan. Only vessels 
   in that list get the thicker outline.

5. When no scan has been run yet, all tankers must look identical — no 
   outlines applied until the first scan is completed.

### Clicking a vessel from the Russian tanker list

6. Keep the existing behaviour: clicking a vessel in the list pans and 
   zooms the map to that vessel (zoom level 10), opens the popup 
   automatically, and shows the ⚠️ Suspected Russian tanker line in 
   the popup.

### Performance note

7. The classification results are already cached in the backend — do not 
   change this caching behaviour. The slow first scan and instant 
   subsequent scans is expected and correct behaviour.
