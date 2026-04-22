import { useMemo } from 'react';
import type { Vessel } from '../types';
import { VESSEL_CATEGORIES, getVesselCategory } from '../utils/vesselTypes';
import VesselSearch from './VesselSearch';

interface SidebarProps {
  vessels: Vessel[];
  enabledCategories: Set<string>;
  onToggleCategory: (name: string) => void;
  onSelectVessel: (vessel: Vessel) => void;
  darkMode: boolean;
  onToggleDark: () => void;
  lastUpdated: Date | null;
  onRefresh: () => void;
  loading: boolean;
  error: string | null;
}

function formatUtcTime(d: Date): string {
  return d.toISOString().slice(11, 16) + ' UTC';
}

export default function Sidebar({
  vessels,
  enabledCategories,
  onToggleCategory,
  onSelectVessel,
  darkMode,
  onToggleDark,
  lastUpdated,
  onRefresh,
  loading,
  error,
}: SidebarProps) {
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const cat of VESSEL_CATEGORIES) map[cat.name] = 0;
    for (const v of vessels) {
      const name = getVesselCategory(v.shipType).name;
      map[name] = (map[name] ?? 0) + 1;
    }
    return map;
  }, [vessels]);

  const visibleCount = useMemo(
    () =>
      VESSEL_CATEGORIES.filter(c => enabledCategories.has(c.name)).reduce(
        (sum, c) => sum + (counts[c.name] ?? 0),
        0,
      ),
    [counts, enabledCategories],
  );

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1 className="app-title">Norwegian AIS Viewer</h1>
        <p className="app-desc">Live vessel traffic — Norwegian waters</p>
      </div>

      <div className="section">
        <label className="toggle-label" onClick={onToggleDark}>
          <div className={`toggle-track ${darkMode ? 'on' : ''}`}>
            <div className="toggle-thumb" />
          </div>
          <span>Dark map</span>
        </label>
      </div>

      <div className="section">
        <div className="section-title">Vessel types</div>
        <div className="legend-list">
          {VESSEL_CATEGORIES.map(cat => {
            const active = enabledCategories.has(cat.name);
            return (
              <button
                key={cat.name}
                className={`legend-item ${active ? '' : 'disabled'}`}
                onClick={() => onToggleCategory(cat.name)}
                title={active ? 'Click to hide' : 'Click to show'}
              >
                <span
                  className="swatch"
                  style={{ background: cat.color }}
                />
                <span className="cat-name">{cat.name}</span>
                <span className="cat-count">{(counts[cat.name] ?? 0).toLocaleString()}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="section count-section">
        <div className="count-label">Visible vessels</div>
        <div className="count-number">{visibleCount.toLocaleString()}</div>
      </div>

      <div className="section">
        <VesselSearch
          vessels={vessels}
          enabledCategories={enabledCategories}
          onSelectVessel={onSelectVessel}
        />
      </div>

      <div className="section freshness">
        {error ? (
          <span className="error-text" title={error}>⚠ {error}</span>
        ) : (
          <span className="updated-text">
            {lastUpdated ? `Last updated: ${formatUtcTime(lastUpdated)}` : 'Not yet loaded'}
          </span>
        )}
        <button
          className={`refresh-btn ${loading ? 'spinning' : ''}`}
          onClick={onRefresh}
          disabled={loading}
          title="Refresh vessel data"
          aria-label="Refresh"
        >
          ↻
        </button>
      </div>
    </aside>
  );
}
