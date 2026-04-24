export interface Vessel {
  mmsi: string;
  name: string;
  lat: number;
  lon: number;
  course: number | null;
  speed: number | null;
  shipType: number;
  msgtime: string | null;
  navStatus: number | null;
  destination: string | null;
  draught: number | null;
  imo: number | null;
}

export interface SuspectedTanker extends Vessel {
  signals: string[];
}
