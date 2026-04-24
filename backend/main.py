"""FastAPI backend for Norwegian AIS Viewer."""

import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logger = logging.getLogger(__name__)

load_dotenv()

_TOKEN_URL = "https://id.barentswatch.no/connect/token"
_VESSELS_URL = "https://live.ais.barentswatch.no/v1/latest/combined"
_TRACK_URL = "https://historic.ais.barentswatch.no/v1/historic/trackslast24hours/{mmsi}"
_OLLAMA_TAGS_URL = "http://localhost:11434/api/tags"
_OLLAMA_GENERATE_URL = "http://localhost:11434/api/generate"

_token: str | None = None
_token_expiry: datetime | None = None
_russian_detection_available: bool = False
_classification_cache: dict[str, bool] = {}

_FOC_MIDS = {
    "209", "210", "212",  # Cyprus
    "311",                 # Bahamas
    "629",                 # Gambia
    "636", "637",          # Liberia
    "370", "371", "372",  # Panama
    "577",                 # Tuvalu
    "518",                 # Cook Islands
    "305",                 # Antigua & Barbuda
    "511",                 # Palau
    "613",                 # Cameroon
    "626",                 # Gabon
}

_RUSSIAN_PROMPT = (
    "Is the vessel name {name} Russian-sounding? This could indicate a "
    "Russian-operated vessel. Russian vessel names typically contain Slavic "
    "words, Russian personal names, Russian geographical references, or "
    "common Russian transliteration patterns such as endings like -ov, -ev, "
    "-sky, -ski, -enko, -grad, -novy, -arktik. Answer only yes or no, "
    "nothing else."
)


async def _fetch_token() -> str:
    global _token, _token_expiry
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            _TOKEN_URL,
            data={
                "client_id": os.environ["BW_CLIENT_ID"],
                "client_secret": os.environ["BW_CLIENT_SECRET"],
                "scope": "ais",
                "grant_type": "client_credentials",
            },
        )
        resp.raise_for_status()
        data = resp.json()
    _token = data["access_token"]
    expires_in = int(data.get("expires_in", 3600))
    _token_expiry = datetime.now(timezone.utc) + timedelta(seconds=expires_in - 60)
    return _token


async def _get_token() -> str:
    now = datetime.now(timezone.utc)
    if _token and _token_expiry and now < _token_expiry:
        return _token
    return await _fetch_token()


async def _classify_russian(name: str) -> bool:
    """Classify a vessel name as Russian-sounding via Ollama/Mistral. Results are cached."""
    if name in _classification_cache:
        return _classification_cache[name]
    prompt = _RUSSIAN_PROMPT.format(name=name)
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                _OLLAMA_GENERATE_URL,
                json={"model": "mistral", "prompt": prompt, "stream": False},
            )
            resp.raise_for_status()
            answer = resp.json().get("response", "").strip().lower()
            result = "yes" in answer
    except Exception as exc:
        logger.warning("[ollama] classify failed for %r: %s", name, exc)
        result = False
    _classification_cache[name] = result
    return result


@asynccontextmanager
async def _lifespan(_app: FastAPI):
    global _russian_detection_available
    _required = ("BW_CLIENT_ID", "BW_CLIENT_SECRET")
    _missing = [v for v in _required if not os.getenv(v)]
    if _missing:
        raise RuntimeError(
            f"Missing required environment variable(s): {', '.join(_missing)}. "
            "Copy backend/.env.example to backend/.env and fill in your BarentsWatch credentials."
        )
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(_OLLAMA_TAGS_URL)
            if resp.status_code == 200:
                data = resp.json()
                models = [m.get("name", "") for m in data.get("models", [])]
                _russian_detection_available = any("mistral" in m for m in models)
            else:
                _russian_detection_available = False
    except Exception:
        _russian_detection_available = False
    logger.info("[ollama] russian_detection_available=%s", _russian_detection_available)
    yield


app = FastAPI(title="Norwegian AIS Viewer API", lifespan=_lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/api/capabilities")
async def get_capabilities() -> dict:
    return {"russian_detection": _russian_detection_available}


class ClassifyRequest(BaseModel):
    name: str


@app.post("/api/vessels/classify-russian")
async def classify_russian(req: ClassifyRequest) -> dict:
    if not _russian_detection_available:
        raise HTTPException(status_code=503, detail="Ollama/Mistral not available")
    result = await _classify_russian(req.name.strip())
    return {"russian_sounding": result}


@app.get("/api/vessels/russian-tankers")
async def get_russian_tankers() -> list[dict]:
    global _token, _token_expiry

    token = await _get_token()

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.get(
            _VESSELS_URL,
            headers={"Authorization": f"Bearer {token}"},
        )
        if resp.status_code == 401:
            _token = None
            _token_expiry = None
            token = await _fetch_token()
            resp = await client.get(
                _VESSELS_URL,
                headers={"Authorization": f"Bearer {token}"},
            )
        try:
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise HTTPException(
                status_code=exc.response.status_code, detail=str(exc)
            ) from exc

    tankers = [v for v in resp.json() if 80 <= (v.get("shipType") or 0) <= 89]

    results: list[dict] = []
    for v in tankers:
        mmsi = str(v.get("mmsi") or "")
        lat = v.get("latitude")
        lon = v.get("longitude")
        if not mmsi or lat is None or lon is None:
            continue

        signals: list[str] = []

        if mmsi.startswith("273"):
            signals.append("russian_mmsi")

        if mmsi[:3] in _FOC_MIDS:
            signals.append("flag_of_convenience")

        if _russian_detection_available:
            name = (v.get("name") or "").strip()
            if name and await _classify_russian(name):
                signals.append("russian_name")

        if len(signals) >= 2:
            results.append(
                {
                    "mmsi": mmsi,
                    "name": (v.get("name") or "").strip(),
                    "lat": lat,
                    "lon": lon,
                    "course": v.get("courseOverGround"),
                    "speed": v.get("speedOverGround"),
                    "shipType": v.get("shipType") or 0,
                    "msgtime": v.get("msgtime"),
                    "navStatus": v.get("navigationalStatus"),
                    "destination": v.get("destination"),
                    "draught": v.get("draught"),
                    "imo": v.get("imoNumber"),
                    "signals": signals,
                }
            )

    return results


@app.get("/api/vessels")
async def get_vessels() -> list[dict]:
    global _token, _token_expiry

    token = await _get_token()

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.get(
            _VESSELS_URL,
            headers={"Authorization": f"Bearer {token}"},
        )
        if resp.status_code == 401:
            _token = None
            _token_expiry = None
            token = await _fetch_token()
            resp = await client.get(
                _VESSELS_URL,
                headers={"Authorization": f"Bearer {token}"},
            )
        try:
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise HTTPException(
                status_code=exc.response.status_code, detail=str(exc)
            ) from exc

    result: list[dict] = []

    for v in resp.json():
        mmsi = str(v.get("mmsi") or "")
        lat = v.get("latitude")
        lon = v.get("longitude")
        if not mmsi or lat is None or lon is None:
            continue
        result.append(
            {
                "mmsi": mmsi,
                "name": (v.get("name") or "").strip(),
                "lat": lat,
                "lon": lon,
                "course": v.get("courseOverGround"),
                "speed": v.get("speedOverGround"),
                "shipType": v.get("shipType") or 0,
                "msgtime": v.get("msgtime"),
                "navStatus": v.get("navigationalStatus"),
                "destination": v.get("destination"),
                "draught": v.get("draught"),
                "imo": v.get("imoNumber"),
            }
        )
    return result


_EMPTY_FC: dict = {"type": "FeatureCollection", "features": []}


@app.get("/api/vessels/{mmsi}/track")
async def get_vessel_track(mmsi: str) -> dict:
    global _token, _token_expiry

    token = await _get_token()
    url = _TRACK_URL.format(mmsi=mmsi)

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(url, headers={"Authorization": f"Bearer {token}"})
        if resp.status_code == 401:
            _token = None
            _token_expiry = None
            token = await _fetch_token()
            resp = await client.get(url, headers={"Authorization": f"Bearer {token}"})
        if resp.status_code == 404:
            logger.info("[track] MMSI=%s → 404 (no data)", mmsi)
            return _EMPTY_FC
        try:
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            logger.error(
                "[track] MMSI=%s → HTTP %d: %s", mmsi, exc.response.status_code, exc.response.text[:500]
            )
            raise HTTPException(
                status_code=exc.response.status_code, detail=str(exc)
            ) from exc

    logger.info("[track] MMSI=%s → %d, body preview: %s", mmsi, resp.status_code, resp.text[:500])

    data = resp.json()

    # BarentsWatch historic API may return either a GeoJSON FeatureCollection
    # or a plain JSON array of position objects.  Handle both.
    if isinstance(data, list):
        coords = [
            [p["longitude"], p["latitude"]]
            for p in data
            if p.get("longitude") is not None and p.get("latitude") is not None
        ]
        if not coords:
            return _EMPTY_FC
        return {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {"type": "LineString", "coordinates": coords},
                    "properties": {},
                }
            ],
        }

    if isinstance(data, dict) and "features" in data:
        return data

    logger.warning("[track] MMSI=%s → unexpected response type: %s", mmsi, type(data).__name__)
    return _EMPTY_FC
