import { useState, useCallback, useEffect } from 'react';
import type { Vessel } from '../types';

const API_URL = 'http://localhost:8000/api/vessels';

interface UseVesselsResult {
  vessels: Vessel[];
  lastUpdated: Date | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useVessels(): UseVesselsResult {
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(API_URL)
      .then(res => {
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        return res.json() as Promise<Vessel[]>;
      })
      .then(data => {
        setVessels(data);
        setLastUpdated(new Date());
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Failed to load vessels');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { vessels, lastUpdated, loading, error, refresh };
}
