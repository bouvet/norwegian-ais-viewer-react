import { useState, useMemo, useEffect, useRef } from 'react';
import type { Vessel } from '../types';
import { getVesselCategory } from '../utils/vesselTypes';

interface VesselSearchProps {
  vessels: Vessel[];
  enabledCategories: Set<string>;
  onSelectVessel: (vessel: Vessel) => void;
}

const MAX_RESULTS = 8;

export default function VesselSearch({ vessels, enabledCategories, onSelectVessel }: VesselSearchProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  // Fixed-position coords for the dropdown (escapes sidebar overflow clipping)
  const [dropdownTop, setDropdownTop] = useState(0);
  const [dropdownLeft, setDropdownLeft] = useState(0);
  const [dropdownWidth, setDropdownWidth] = useState(0);

  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return vessels
      .filter(v =>
        v.name &&
        enabledCategories.has(getVesselCategory(v.shipType).name) &&
        v.name.toLowerCase().includes(q),
      )
      .slice(0, MAX_RESULTS);
  }, [query, vessels, enabledCategories]);

  // Compute dropdown position whenever it opens
  useEffect(() => {
    if (open && inputRef.current) {
      const r = inputRef.current.getBoundingClientRect();
      setDropdownTop(r.bottom + 4);
      setDropdownLeft(r.left);
      setDropdownWidth(r.width);
    }
  }, [open, query]);

  // Close on click outside
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    setOpen(!!e.target.value.trim());
  }

  function onFocus() {
    if (query.trim()) setOpen(true);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  function onClear() {
    setQuery('');
    setOpen(false);
    inputRef.current?.focus();
  }

  // Use onMouseDown instead of onClick so the input blur doesn't close dropdown
  // before the click is processed.
  function onSelect(vessel: Vessel) {
    setQuery('');
    setOpen(false);
    onSelectVessel(vessel);
  }

  const showDropdown = open && !!query.trim();

  return (
    <div className="search-wrap" ref={wrapRef}>
      <div className="search-field">
        <svg className="search-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
          <circle cx="6.5" cy="6.5" r="4.5" />
          <line x1="10.2" y1="10.2" x2="14" y2="14" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder="Search vessels…"
          value={query}
          onChange={onInputChange}
          onFocus={onFocus}
          onKeyDown={onKeyDown}
          aria-label="Search vessels by name"
          autoComplete="off"
          spellCheck={false}
        />
        {query && (
          <button className="search-clear" onClick={onClear} aria-label="Clear search">
            ✕
          </button>
        )}
      </div>

      {showDropdown && (
        <ul
          className="search-dropdown"
          style={{
            position: 'fixed',
            top: dropdownTop,
            left: dropdownLeft,
            width: dropdownWidth,
          }}
          role="listbox"
        >
          {results.length === 0 ? (
            <li className="search-empty">No vessels found</li>
          ) : (
            results.map(v => {
              const { color, name: catName } = getVesselCategory(v.shipType);
              return (
                <li
                  key={v.mmsi}
                  className="search-result"
                  onMouseDown={() => onSelect(v)}
                  role="option"
                  aria-selected={false}
                >
                  <span className="search-dot" style={{ background: color }} />
                  <span className="search-name">{v.name}</span>
                  <span className="search-cat">{catName}</span>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
