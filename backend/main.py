"""FastAPI backend for Norwegian AIS Viewer."""

import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

logger = logging.getLogger(__name__)

load_dotenv()

_TOKEN_URL = "https://id.barentswatch.no/connect/token"
_VESSELS_URL = "https://live.ais.barentswatch.no/v1/latest/combined"
_TRACK_URL = "https://historic.ais.barentswatch.no/v1/historic/trackslast24hours/{mmsi}"

_token: str | None = None
_token_expiry: datetime | None = None


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


@asynccontextmanager
async def _lifespan(_app: FastAPI):
    _required = ("BW_CLIENT_ID", "BW_CLIENT_SECRET")
    _missing = [v for v in _required if not os.getenv(v)]
    if _missing:
        raise RuntimeError(
            f"Missing required environment variable(s): {', '.join(_missing)}. "
            "Copy backend/.env.example to backend/.env and fill in your BarentsWatch credentials."
        )
    yield


app = FastAPI(title="Norwegian AIS Viewer API", lifespan=_lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
    ],
    allow_methods=["GET"],
    allow_headers=["*"],
)


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
