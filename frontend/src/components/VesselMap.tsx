import { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Vessel } from '../types';
import { getVesselCategory, NAV_STATUS } from '../utils/vesselTypes';
import { getMidCountry } from '../data/midLookup';

const LIGHT_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const LIGHT_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
const DARK_URL = 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png';
const DARK_ATTR = '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function createVesselIcon(color: string, course: number): L.DivIcon {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 16" width="10" height="16"><polygon points="5,0 10,16 5,11 0,16" fill="${color}" stroke="rgba(0,0,0,0.45)" stroke-width="0.8" stroke-linejoin="round"/></svg>`;
  return L.divIcon({
    html: `<div style="transform:rotate(${course}deg);transform-origin:5px 8px;width:10px;height:16px;line-height:0">${svg}</div>`,
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

function VesselPopup({ vessel }: { vessel: Vessel }) {
  const { name: catName } = getVesselCategory(vessel.shipType);
  const flag = getMidCountry(vessel.mmsi);
  const status =
    vessel.navStatus != null
      ? (NAV_STATUS[vessel.navStatus] ?? `Code ${vessel.navStatus}`)
      : '—';
  const speed =
    vessel.speed != null ? `${vessel.speed.toFixed(1)} kn` : '—';
  const course =
    vessel.course != null ? `${Math.round(vessel.course)}°` : '—';

  return (
    <div className="vessel-popup">
      <div className="popup-name">{vessel.name || 'Unknown vessel'}</div>
      <dl className="popup-fields">
        <dt>MMSI</dt><dd>{vessel.mmsi}</dd>
        <dt>Flag</dt><dd>{flag}</dd>
        <dt>Type</dt><dd>{catName}</dd>
        <dt>Status</dt><dd>{status}</dd>
        <dt>Speed</dt><dd>{speed}</dd>
        <dt>Course</dt><dd>{course}</dd>
        <dt>Updated</dt><dd>{formatMsgTime(vessel.msgtime)}</dd>
      </dl>
    </div>
  );
}

interface VesselLayerProps {
  vessels: Vessel[];
  enabledCategories: Set<string>;
}

function VesselLayer({ vessels, enabledCategories }: VesselLayerProps) {
  const visible = useMemo(
    () => vessels.filter(v => enabledCategories.has(getVesselCategory(v.shipType).name)),
    [vessels, enabledCategories],
  );

  return (
    <>
      {visible.map(vessel => {
        const { color } = getVesselCategory(vessel.shipType);
        const icon = createVesselIcon(color, vessel.course ?? 0);
        return (
          <Marker key={vessel.mmsi} position={[vessel.lat, vessel.lon]} icon={icon}>
            <Popup>
              <VesselPopup vessel={vessel} />
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

interface VesselMapProps {
  vessels: Vessel[];
  enabledCategories: Set<string>;
  darkMode: boolean;
}

export default function VesselMap({ vessels, enabledCategories, darkMode }: VesselMapProps) {
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
      <VesselLayer vessels={vessels} enabledCategories={enabledCategories} />
    </MapContainer>
  );
}
