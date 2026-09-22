import { describe, expect, it } from 'vitest';
import { geoDistance } from 'd3-geo';
import { EARTH_RADIUS_KM, formatKm, haversineKm } from '../src/domain/geo';
import type { LngLat } from '../src/domain/types';
import { mulberry32 } from '../src/domain/rng';

const LONDRES: LngLat = [-0.1276, 51.5072];
const PARIS: LngLat = [2.3522, 48.8566];
const NOVA_YORK: LngLat = [-74.006, 40.7128];
const SAO_PAULO: LngLat = [-46.6333, -23.5505];
const RIO: LngLat = [-43.1729, -22.9068];

describe('haversineKm', () => {
  it('bate com distâncias conhecidas', () => {
    expect(haversineKm(LONDRES, PARIS)).toBeCloseTo(343.5, 0);
    expect(haversineKm(PARIS, NOVA_YORK)).toBeCloseTo(5837, -1);
    expect(haversineKm(SAO_PAULO, RIO)).toBeCloseTo(360, -1);
  });

  it('é zero para o mesmo ponto e ~20.015 km para antípodas', () => {
    expect(haversineKm(RIO, RIO)).toBe(0);
    expect(haversineKm([0, 0], [180, 0])).toBeCloseTo(Math.PI * EARTH_RADIUS_KM, 3);
  });

  it('é simétrica', () => {
    expect(haversineKm(LONDRES, SAO_PAULO)).toBeCloseTo(haversineKm(SAO_PAULO, LONDRES), 9);
  });

  it('concorda com d3.geoDistance em 10.000 pares aleatórios', () => {
    const rng = mulberry32(7);
    const pt = (): LngLat => [rng() * 360 - 180, rng() * 180 - 90];
    for (let i = 0; i < 10_000; i++) {
      const a = pt();
      const b = pt();
      expect(haversineKm(a, b)).toBeCloseTo(geoDistance(a, b) * EARTH_RADIUS_KM, 6);
    }
  });
});

describe('formatKm', () => {
  it('usa separador brasileiro e uma casa decimal só em distâncias curtas', () => {
    expect(formatKm(4.25)).toBe('4,3 km');
    expect(formatKm(1340.7)).toBe('1.341 km');
  });
});
