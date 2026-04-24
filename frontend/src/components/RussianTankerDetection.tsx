import { useState } from 'react';
import type { Vessel, SuspectedTanker } from '../types';
import { getMidCountry } from '../data/midLookup';

const RUSSIAN_TANKERS_API = 'http://localhost:8000/api/vessels/russian-tankers';

interface Props {
  enabled: boolean;
  onSelectVessel: (vessel: Vessel) => void;
  onScanComplete: (mmsis: Set<string>) => void;
}

type ScanState = 'idle' | 'scanning' | 'done' | 'error';

export default function RussianTankerDetection({ enabled, onSelectVessel, onScanComplete }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [results, setResults] = useState<SuspectedTanker[]>([]);

  function handleScan() {
    setScanState('scanning');
    fetch(RUSSIAN_TANKERS_API)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<SuspectedTanker[]>;
      })
      .then(data => {
        setResults(data);
        setScanState('done');
        onScanComplete(new Set(data.map(t => t.mmsi)));
      })
      .catch(() => setScanState('error'));
  }

  return (
    <div className="section">
      <div className="russian-section-header">
        <div className="section-title" style={{ marginBottom: 0 }}>Russian Tanker Detection</div>
        <button
          className="russian-info-btn"
          onClick={() => setModalOpen(true)}
          title="How to enable"
        >
          ℹ️
        </button>
      </div>

      {!enabled ? (
        <div className="russian-unavailable">
          Ollama not available — click ℹ️ to learn more
        </div>
      ) : scanState === 'scanning' ? (
        <div className="russian-scanning">Scanning vessels…</div>
      ) : scanState === 'done' ? (
        <>
          <div className="russian-count">
            Found {results.length} suspected Russian tanker{results.length !== 1 ? 's' : ''}
          </div>
          {results.length > 0 && (
            <div className="russian-results-list">
              {results.map(tanker => (
                <button
                  key={tanker.mmsi}
                  className="russian-result-item"
                  onClick={() => onSelectVessel(tanker)}
                >
                  <span className="russian-result-name">{tanker.name || 'Unknown vessel'}</span>
                  <span className="russian-result-flag">{getMidCountry(tanker.mmsi)}</span>
                </button>
              ))}
            </div>
          )}
          <button className="russian-scan-btn russian-scan-btn--rescan" onClick={handleScan}>
            Scan again
          </button>
        </>
      ) : (
        <>
          <button className="russian-scan-btn" onClick={handleScan}>
            Scan now
          </button>
          {scanState === 'error' && (
            <div className="russian-scan-error">Scan failed — try again</div>
          )}
        </>
      )}

      {modalOpen && (
        <div className="russian-modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="russian-modal" onClick={e => e.stopPropagation()}>
            <h3 className="russian-modal-title">Enable Russian Tanker Detection</h3>
            <div className="russian-modal-body">
              <p>
                This feature uses a local AI model (Mistral via Ollama) to classify vessel names
                as Russian-sounding. To enable it:
              </p>
              <ol>
                <li>Download and install Ollama from ollama.com</li>
                <li>Open a terminal and run: <code>ollama pull mistral</code></li>
                <li>Make sure Ollama is running</li>
                <li>Restart the app backend</li>
              </ol>
              <p>Once enabled, the feature will automatically activate on next load.</p>
            </div>
            <button className="russian-modal-close" onClick={() => setModalOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
