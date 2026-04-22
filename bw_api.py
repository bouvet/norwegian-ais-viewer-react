"""BarentsWatch AIS REST API client."""

import os
from datetime import datetime

import requests
from dotenv import load_dotenv

load_dotenv()

_TOKEN_URL = "https://id.barentswatch.no/connect/token"
# _VESSELS_URL = "https://live.ais.barentswatch.no/v1/latest/combined?modelType=Full"
_VESSELS_URL = "https://live.ais.barentswatch.no/v1/latest/combined"


def get_token() -> str:
    """Fetch an OAuth2 access token using client credentials.

    Reads BW_CLIENT_ID and BW_CLIENT_SECRET from environment variables.

    Returns:
        Access token string.

    Raises:
        requests.HTTPError: If the token request fails.
    """
    resp = requests.post(
        _TOKEN_URL,
        data={
            "client_id": os.environ["BW_CLIENT_ID"],
            "client_secret": os.environ["BW_CLIENT_SECRET"],
            "scope": "ais",
            "grant_type": "client_credentials",
        },
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def get_vessels(token: str) -> dict:
    """Fetch all current vessel positions from the BarentsWatch combined endpoint.

    Maps the API response fields to the internal vessel dictionary structure used
    by build_map and the sidebar legend.

    Args:
        token: Valid OAuth2 access token.

    Returns:
        Dict keyed by MMSI string, each value containing lat, lon, course,
        speed, ship_type, name, mmsi, timestamp, nav_status, destination,
        draught, and imo.

    Raises:
        requests.HTTPError: If the API request fails (caller handles 401 retry).
    """
    resp = requests.get(
        _VESSELS_URL,
        headers={"Authorization": f"Bearer {token}"},
    )
    resp.raise_for_status()

    vessels: dict = {}
    for v in resp.json():
        mmsi = str(v.get("mmsi", ""))
        if not mmsi:
            continue

        raw_ts = v.get("msgtime")
        try:
            ts = datetime.fromisoformat(raw_ts.replace("Z", "+00:00")) if raw_ts else None
        except (ValueError, AttributeError):
            ts = None

        vessels[mmsi] = {
            "mmsi": mmsi,
            "name": (v.get("name") or "").strip(),
            "lat": v.get("latitude"),
            "lon": v.get("longitude"),
            "course": v.get("courseOverGround"),
            "speed": v.get("speedOverGround"),
            "ship_type": v.get("shipType") or 0,
            "timestamp": ts,
            "nav_status": v.get("navigationalStatus"),
            "destination": v.get("destination"),
            "draught": v.get("draught"),
            "imo": v.get("imoNumber"),
        }

    return vessels
