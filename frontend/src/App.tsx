import { useState, useCallback, useRef } from 'react';
import { VESSEL_CATEGORIES } from './utils/vesselTypes';
import { useVessels } from './hooks/useVessels';
import Sidebar from './components/Sidebar';
import VesselMap from './components/VesselMap';
import type { Vessel } from './types';

const ALL_CATEGORIES = new Set(VESSEL_CATEGORIES.map(c => c.name));

export interface NavTarget {
  vessel: Vessel;
  seq: number;
}

export default function App() {
  const { vessels, lastUpdated, loading, error, refresh } = useVessels();
  const [enabledCategories, setEnabledCategories] = useState<Set<string>>(ALL_CATEGORIES);
  const [darkMode, setDarkMode] = useState(false);
  const [navTarget, setNavTarget] = useState<NavTarget | null>(null);
  const navSeq = useRef(0);

  const toggleCategory = useCallback((name: string) => {
    setEnabledCategories(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }, []);

  const toggleDark = useCallback(() => setDarkMode(d => !d), []);

  const selectVessel = useCallback((vessel: Vessel) => {
    navSeq.current += 1;
    setNavTarget({ vessel, seq: navSeq.current });
  }, []);

  return (
    <div className="app">
      <Sidebar
        vessels={vessels}
        enabledCategories={enabledCategories}
        onToggleCategory={toggleCategory}
        onSelectVessel={selectVessel}
        darkMode={darkMode}
        onToggleDark={toggleDark}
        lastUpdated={lastUpdated}
        onRefresh={refresh}
        loading={loading}
        error={error}
      />
      <div className="map-wrapper">
        <VesselMap
          vessels={vessels}
          enabledCategories={enabledCategories}
          darkMode={darkMode}
          navTarget={navTarget}
        />
      </div>
    </div>
  );
}
