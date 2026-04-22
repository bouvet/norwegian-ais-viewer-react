import { useState, useCallback } from 'react';
import { VESSEL_CATEGORIES } from './utils/vesselTypes';
import { useVessels } from './hooks/useVessels';
import Sidebar from './components/Sidebar';
import VesselMap from './components/VesselMap';

const ALL_CATEGORIES = new Set(VESSEL_CATEGORIES.map(c => c.name));

export default function App() {
  const { vessels, lastUpdated, loading, error, refresh } = useVessels();
  const [enabledCategories, setEnabledCategories] = useState<Set<string>>(ALL_CATEGORIES);
  const [darkMode, setDarkMode] = useState(false);

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

  return (
    <div className="app">
      <Sidebar
        vessels={vessels}
        enabledCategories={enabledCategories}
        onToggleCategory={toggleCategory}
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
        />
      </div>
    </div>
  );
}
