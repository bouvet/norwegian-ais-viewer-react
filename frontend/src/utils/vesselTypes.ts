export interface VesselCategory {
  name: string;
  codes: number[];
  color: string;
}

export const VESSEL_CATEGORIES: VesselCategory[] = [
  { name: 'Tanker',             codes: Array.from({ length: 10 }, (_, i) => i + 80), color: '#FF0000' },
  { name: 'Cargo',              codes: Array.from({ length: 10 }, (_, i) => i + 70), color: '#008000' },
  { name: 'Passenger',          codes: Array.from({ length: 10 }, (_, i) => i + 60), color: '#00BFFF' },
  { name: 'Fishing',            codes: [30],                                           color: '#FFA500' },
  { name: 'Tug / Special craft',codes: Array.from({ length: 10 }, (_, i) => i + 50), color: '#FFFF00' },
  { name: 'High speed craft',   codes: Array.from({ length: 10 }, (_, i) => i + 40), color: '#FF69B4' },
  { name: 'Sailing / Pleasure', codes: [36, 37],                                      color: '#9400D3' },
  { name: 'Other / Unknown',    codes: [],                                             color: '#808080' },
];

const _codeMap = new Map<number, { name: string; color: string }>();
for (const cat of VESSEL_CATEGORIES) {
  for (const code of cat.codes) {
    _codeMap.set(code, { name: cat.name, color: cat.color });
  }
}

const _fallback = { name: 'Other / Unknown', color: '#808080' };

export function getVesselCategory(shipType: number): { name: string; color: string } {
  return _codeMap.get(shipType) ?? _fallback;
}

export const NAV_STATUS: Record<number, string> = {
  0: 'Underway',
  1: 'At anchor',
  2: 'Not under command',
  3: 'Restricted manoeuvrability',
  4: 'Constrained by draught',
  5: 'Moored',
  6: 'Aground',
  7: 'Fishing',
  8: 'Underway sailing',
  9: 'Reserved',
  10: 'Reserved',
  11: 'Towing astern',
  12: 'Towing alongside',
  14: 'AIS-SART',
  15: 'Undefined',
};
