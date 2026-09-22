import type { LngLat } from './types';

/** Raio médio da Terra (IUGG). */
export const EARTH_RADIUS_KM = 6371.0088;

const RAD = Math.PI / 180;

/** Distância de grande círculo entre dois pontos [lng, lat], em quilômetros. */
export function haversineKm(a: LngLat, b: LngLat): number {
  const lat1 = a[1] * RAD;
  const lat2 = b[1] * RAD;
  const dLat = (b[1] - a[1]) * RAD;
  const dLng = (b[0] - a[0]) * RAD;
  const sLat = Math.sin(dLat / 2);
  const sLng = Math.sin(dLng / 2);
  const h = sLat * sLat + Math.cos(lat1) * Math.cos(lat2) * sLng * sLng;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Formata uma distância para exibição: "12 km", "1.340 km". */
export function formatKm(km: number): string {
  const rounded = km < 10 ? Math.round(km * 10) / 10 : Math.round(km);
  return `${rounded.toLocaleString('pt-BR')} km`;
}
