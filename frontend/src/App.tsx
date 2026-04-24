import { useState, useCallback, useRef, useEffect } from 'react';
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
  const [russianDetection, setRussianDetection] = useState(false);
  const [flaggedMmsis, setFlaggedMmsis] = useState<Set<string>>(new Set());
  const [viewResetSeq, setViewResetSeq] = useState(0);
  const navSeq = useRef(0);

  useEffect(() => {
    fetch('http://localhost:8000/api/capabilities')
      .then(r => r.json())
      .then(data => setRussianDetection(!!data.russian_detection))
      .catch(() => {});
  }, []);

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

  const handleScanComplete = useCallback((mmsis: Set<string>) => {
    setFlaggedMmsis(mmsis);
    setEnabledCategories(new Set(['Tanker']));
    setViewResetSeq(s => s + 1);
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
        russianDetection={russianDetection}
        onScanComplete={handleScanComplete}
      />
      <div className="map-wrapper">
        <VesselMap
          vessels={vessels}
          enabledCategories={enabledCategories}
          darkMode={darkMode}
          navTarget={navTarget}
          flaggedMmsis={flaggedMmsis}
          viewResetSeq={viewResetSeq}
        />
      </div>
    </div>
  );
}
