"""AIS ship_type code to vessel category and colour mapping."""

VESSEL_CATEGORIES = [
    {"name": "Tanker",              "codes": list(range(80, 90)), "color": "#FF0000"},
    {"name": "Cargo",               "codes": list(range(70, 80)), "color": "#008000"},
    {"name": "Passenger",           "codes": list(range(60, 70)), "color": "#00BFFF"},
    {"name": "Fishing",             "codes": [30],                "color": "#FFA500"},
    {"name": "Tug / Special craft", "codes": list(range(50, 60)), "color": "#FFFF00"},
    {"name": "High speed craft",    "codes": list(range(40, 50)), "color": "#FF69B4"},
    {"name": "Sailing / Pleasure",  "codes": [36, 37],            "color": "#9400D3"},
    {"name": "Other / Unknown",     "codes": [],                  "color": "#808080"},
]

# Flat lookup: ship_type int -> (category_name, color_hex)
_CODE_MAP: dict[int, tuple[str, str]] = {}
for _cat in VESSEL_CATEGORIES:
    for _code in _cat["codes"]:
        _CODE_MAP[_code] = (_cat["name"], _cat["color"])


def get_vessel_category(ship_type: int) -> tuple[str, str]:
    """Return (category_name, color_hex) for an AIS ship_type code.

    Args:
        ship_type: Integer AIS ship_type field value.

    Returns:
        Tuple of (category label, hex colour string).
        Falls back to ('Other / Unknown', '#808080') for unmapped codes.
    """
    try:
        code = int(ship_type) if ship_type else 0
    except (TypeError, ValueError):
        code = 0
    return _CODE_MAP.get(code, ("Other / Unknown", "#808080"))


ALL_CATEGORY_NAMES: list[str] = [cat["name"] for cat in VESSEL_CATEGORIES]

NAV_STATUS: dict[int, str] = {
    0: "Underway",
    1: "At anchor",
    2: "Not under command",
    3: "Restricted manoeuvrability",
    5: "Moored",
    8: "Underway sailing",
    15: "Undefined",
}
