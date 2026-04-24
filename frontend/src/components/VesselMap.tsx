import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Vessel } from '../types';
import { getVesselCategory, NAV_STATUS } from '../utils/vesselTypes';
import { getMidCountry } from '../data/midLookup';
import type { NavTarget } from '../App';

const LIGHT_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const LIGHT_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
const DARK_URL = 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png';
const DARK_ATTR = '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const TRACK_API = (mmsi: string) => `http://localhost:8000/api/vessels/${mmsi}/track`;

// highlighted=true: pulse animation (white stroke 1.5)
// suspectedRussian=true: thick white outline (stroke 3) — only when not highlighted
function createVesselIcon(color: string, course: number, highlighted = false, suspectedRussian = false): L.DivIcon {
  const stroke = highlighted ? 'white' : suspectedRussian ? 'white' : 'rgba(0,0,0,0.45)';
  const strokeWidth = highlighted ? '1.5' : suspectedRussian ? '2' : '0.8';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 16" width="10" height="16"><polygon points="5,0 10,16 5,11 0,16" fill="${color}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round"/></svg>`;
  return L.divIcon({
    html: `<div class="${highlighted ? 'vessel-pulse' : ''}" style="transform:rotate(${course}deg);transform-origin:5px 8px;width:10px;height:16px;line-height:0">${svg}</div>`,
    className: '',
    iconSize: [10, 16],
    iconAnchor: [5, 8],
    popupAnchor: [0, -10],
  });
}

function formatMsgTime(msgtime: string | null): string {
  if (!msgtime) return '—';
  try {
    const d = new Date(msgtime);
    if (isNaN(d.getTime())) return msgtime;
    return d.toISOString().slice(11, 19) + ' UTC';
  } catch {
    return msgtime;
  }
}

// ─── GeoJSON helpers ────────────────────────────────────────────

interface ActiveTrack {
  mmsi: string;
  positions: [number, number][];
  color: string;
}

function extractPositions(data: unknown): [number, number][] {
  if (!data || typeof data !== 'object') return [];
  const fc = data as { features?: unknown[] };
  if (!Array.isArray(fc.features)) return [];

  const out: [number, number][] = [];
  for (const f of fc.features) {
    const feature = f as { geometry?: { type?: string; coordinates?: unknown } };
    const geom = feature?.geometry;
    if (!geom) continue;

    if (geom.type === 'LineString') {
      const coords = geom.coordinates as number[][];
      for (const c of coords) {
        if (c.length >= 2) out.push([c[1], c[0]]);
      }
    } else if (geom.type === 'MultiLineString') {
      const lines = geom.coordinates as number[][][];
      for (const line of lines) {
        for (const c of line) {
          if (c.length >= 2) out.push([c[1], c[0]]);
        }
      }
    }
  }
  return out;
}

// ─── TrackLayer ─────────────────────────────────────────────────

interface TrackLayerProps {
  track: ActiveTrack | null;
  onClear: () => void;
}

function TrackLayer({ track, onClear }: TrackLayerProps) {
  useMapEvents({ popupclose: onClear });

  if (!track || track.positions.length === 0) return null;

  return (
    <Polyline
      positions={track.positions}
      pathOptions={{ color: track.color, opacity: 0.72, weight: 2 }}
    />
  );
}

// ─── NavigationController ───────────────────────────────────────

interface NavigationControllerProps {
  navTarget: NavTarget | null;
  markerRefs: React.RefObject<Map<string, L.Marker>>;
  flaggedMmsis: Set<string>;
  viewResetSeq: number;
}

function NavigationController({ navTarget, markerRefs, flaggedMmsis, viewResetSeq }: NavigationControllerProps) {
  const map = useMap();
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep a ref so the revert-icon callback always sees the latest flaggedMmsis
  // without making it a dependency of the navTarget effect.
  const flaggedRef = useRef(flaggedMmsis);
  flaggedRef.current = flaggedMmsis;

  useEffect(() => {
    if (!navTarget) return;
    const { vessel } = navTarget;
    const marker = markerRefs.current.get(vessel.mmsi);

    // Pan + zoom to the vessel
    map.flyTo([vessel.lat, vessel.lon], 10, { animate: true, duration: 0.8 });

    // Open popup slightly after fly-to duration (0.8 s animation + 100 ms buffer)
    if (openTimer.current) clearTimeout(openTimer.current);
    openTimer.current = setTimeout(() => {
      marker?.openPopup();
      openTimer.current = null;
    }, 900);

    // Highlight: switch to glowing icon, revert after 2 s (matches 4× 0.5 s pulse cycles)
    if (marker) {
      const { color } = getVesselCategory(vessel.shipType);
      const course = vessel.course ?? 0;
      marker.setIcon(createVesselIcon(color, course, true));

      if (highlightTimer.current) clearTimeout(highlightTimer.current);
      highlightTimer.current = setTimeout(() => {
        const isSuspected = flaggedRef.current.has(vessel.mmsi);
        marker.setIcon(createVesselIcon(color, course, false, isSuspected));
        highlightTimer.current = null;
      }, 2000);
    }

    return () => {
      if (openTimer.current) clearTimeout(openTimer.current);
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
    };
  }, [navTarget, map, markerRefs]);

  useEffect(() => {
    if (viewResetSeq === 0) return;
    map.setView([65, 14], 5);
  }, [viewResetSeq, map]);

  return null;
}

// ─── VesselPopup ────────────────────────────────────────────────

type TrackState = 'idle' | 'loading' | 'empty' | 'error';

interface VesselPopupProps {
  vessel: Vessel;
  color: string;
  activeTrackMmsi: string | null;
  onShowTrack: (mmsi: string, color: string, positions: [number, number][]) => void;
  onClearTrack: () => void;
  isSuspected: boolean;
}

function VesselPopup({ vessel, color, activeTrackMmsi, onShowTrack, onClearTrack, isSuspected }: VesselPopupProps) {
  const [trackState, setTrackState] = useState<TrackState>('idle');

  const isTrackActive = activeTrackMmsi === vessel.mmsi;

  const { name: catName } = getVesselCategory(vessel.shipType);
  const flag = getMidCountry(vessel.mmsi);
  const status =
    vessel.navStatus != null
      ? (NAV_STATUS[vessel.navStatus] ?? `Code ${vessel.navStatus}`)
      : '—';
  const speed = vessel.speed != null ? `${vessel.speed.toFixed(1)} kn` : '—';
  const course = vessel.course != null ? `${Math.round(vessel.course)}°` : '—';

  function handleShowTrack(e: React.MouseEvent) {
    e.stopPropagation();
    setTrackState('loading');
    fetch(TRACK_API(vessel.mmsi))
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        const positions = extractPositions(data);
        if (positions.length === 0) {
          setTrackState('empty');
        } else {
          onShowTrack(vessel.mmsi, color, positions);
          setTrackState('idle');
        }
      })
      .catch(() => setTrackState('error'));
  }

  function handleClearTrack(e: React.MouseEvent) {
    e.stopPropagation();
    onClearTrack();
    setTrackState('idle');
  }

  return (
    // stopPropagation on the container prevents any click inside the popup
    // from bubbling to the Leaflet map and triggering closePopupOnClick.
    <div className="vessel-popup" onClick={e => e.stopPropagation()}>
      <div className="popup-name">{vessel.name || 'Unknown vessel'}</div>
      {isSuspected && (
        <div className="popup-russian-warning">⚠️ Suspected Russian tanker</div>
      )}
      <dl className="popup-fields">
        <dt>MMSI</dt><dd>{vessel.mmsi}</dd>
        <dt>Flag</dt><dd>{flag}</dd>
        <dt>Type</dt><dd>{catName}</dd>
        <dt>Status</dt><dd>{status}</dd>
        <dt>Speed</dt><dd>{speed}</dd>
        <dt>Course</dt><dd>{course}</dd>
        <dt>Updated</dt><dd>{formatMsgTime(vessel.msgtime)}</dd>
      </dl>

      <div className="popup-track">
        {isTrackActive ? (
          <button className="track-btn track-btn--clear" onClick={handleClearTrack}>
            ✕ Clear track
          </button>
        ) : trackState === 'loading' ? (
          <span className="track-loading">Loading track…</span>
        ) : (
          <>
            <button className="track-btn track-btn--show" onClick={handleShowTrack}>
              ↗ Show track
            </button>
            {trackState === 'empty' && (
              <span className="track-msg">No track data available</span>
            )}
            {trackState === 'error' && (
              <span className="track-msg track-msg--error">Failed to load track</span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── VesselLayer ────────────────────────────────────────────────

interface VesselLayerProps {
  vessels: Vessel[];
  enabledCategories: Set<string>;
  activeTrackMmsi: string | null;
  onShowTrack: (mmsi: string, color: string, positions: [number, number][]) => void;
  onClearTrack: () => void;
  setMarkerRef: (mmsi: string, marker: L.Marker | null) => void;
  flaggedMmsis: Set<string>;
}

function VesselLayer({
  vessels,
  enabledCategories,
  activeTrackMmsi,
  onShowTrack,
  onClearTrack,
  setMarkerRef,
  flaggedMmsis,
}: VesselLayerProps) {
  const visible = useMemo(
    () => vessels.filter(v => enabledCategories.has(getVesselCategory(v.shipType).name)),
    [vessels, enabledCategories],
  );

  return (
    <>
      {visible.map(vessel => {
        const { color } = getVesselCategory(vessel.shipType);
        const icon = createVesselIcon(color, vessel.course ?? 0, false, flaggedMmsis.has(vessel.mmsi));
        return (
          <Marker
            key={vessel.mmsi}
            position={[vessel.lat, vessel.lon]}
            icon={icon}
            eventHandlers={{
              add(e) { setMarkerRef(vessel.mmsi, e.target as L.Marker); },
              remove() { setMarkerRef(vessel.mmsi, null); },
            }}
          >
            <Popup>
              <VesselPopup
                vessel={vessel}
                color={color}
                activeTrackMmsi={activeTrackMmsi}
                onShowTrack={onShowTrack}
                onClearTrack={onClearTrack}
                isSuspected={flaggedMmsis.has(vessel.mmsi)}
              />
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

// ─── VesselMap ──────────────────────────────────────────────────

interface VesselMapProps {
  vessels: Vessel[];
  enabledCategories: Set<string>;
  darkMode: boolean;
  navTarget: NavTarget | null;
  flaggedMmsis: Set<string>;
  viewResetSeq: number;
}

export default function VesselMap({ vessels, enabledCategories, darkMode, navTarget, flaggedMmsis, viewResetSeq }: VesselMapProps) {
  const [activeTrack, setActiveTrack] = useState<ActiveTrack | null>(null);
  const markerRefs = useRef<Map<string, L.Marker>>(new Map());

  const handleShowTrack = useCallback(
    (mmsi: string, color: string, positions: [number, number][]) => {
      setActiveTrack({ mmsi, color, positions });
    },
    [],
  );

  const handleClearTrack = useCallback(() => setActiveTrack(null), []);

  const setMarkerRef = useCallback((mmsi: string, marker: L.Marker | null) => {
    if (marker) markerRefs.current.set(mmsi, marker);
    else markerRefs.current.delete(mmsi);
  }, []);

  return (
    <MapContainer
      center={[65, 14]}
      zoom={5}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        key={darkMode ? 'dark' : 'light'}
        url={darkMode ? DARK_URL : LIGHT_URL}
        attribution={darkMode ? DARK_ATTR : LIGHT_ATTR}
      />
      <TrackLayer track={activeTrack} onClear={handleClearTrack} />
      <NavigationController navTarget={navTarget} markerRefs={markerRefs} flaggedMmsis={flaggedMmsis} viewResetSeq={viewResetSeq} />
      <VesselLayer
        vessels={vessels}
        enabledCategories={enabledCategories}
        activeTrackMmsi={activeTrack?.mmsi ?? null}
        onShowTrack={handleShowTrack}
        onClearTrack={handleClearTrack}
        setMarkerRef={setMarkerRef}
        flaggedMmsis={flaggedMmsis}
      />
    </MapContainer>
  );
}
