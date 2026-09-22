import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as topojson from 'topojson-client';
import { COUNTRIES } from '../src/data/countries';
import { haversineKm } from '../src/domain/geo';
import type { LngLat, Region } from '../src/domain/types';

const root = resolve(import.meta.dirname, '..');
const readJson = <T>(p: string): T => JSON.parse(readFileSync(resolve(root, p), 'utf8')) as T;

const REGIONS: Region[] = ['Africa', 'Americas', 'Asia', 'Europe', 'Oceania'];
const ptPtBlocklist = new Set(readJson<string[]>('data/pt-pt-blocklist.json'));
const capitals = readJson<Record<string, { en: string; pt: string; reviewed: boolean }>>('data/capitals.pt-BR.json');
const capitalBlocklist = new Set(readJson<string[]>('data/capitals-blocklist.json'));

/**
 * Países cuja capital fica longe do centroide por motivo legítimo:
 * territórios ultramarinos ou geografia muito alongada puxam o centroide.
 */
const CENTROID_TOLERANCE_KM: Record<string, number> = {
  RUS: 4000, CAN: 2500, AUS: 2000, USA: 2000, IDN: 1800, MYS: 1500,
};
const DEFAULT_TOLERANCE_KM = 1500;

describe('roster', () => {
  it('tem exatamente 195 países', () => {
    expect(COUNTRIES).toHaveLength(195);
  });

  it('não repete código nem nome', () => {
    expect(new Set(COUNTRIES.map((c) => c.cca2)).size).toBe(195);
    expect(new Set(COUNTRIES.map((c) => c.cca3)).size).toBe(195);
    expect(new Set(COUNTRIES.map((c) => c.name)).size).toBe(195);
  });
});

describe.each(COUNTRIES)('$cca3 ($name)', (c) => {
  it('tem códigos, nome e capital preenchidos', () => {
    expect(c.cca2).toMatch(/^[A-Z]{2}$/);
    expect(c.cca3).toMatch(/^[A-Z]{3}$/);
    expect(c.ccn3).toMatch(/^[0-9]{3}$/);
    expect(c.name.trim()).not.toBe('');
    expect(c.capital.trim()).not.toBe('');
    expect(REGIONS).toContain(c.region);
    expect(c.weight).toBeGreaterThan(0);
    expect(c.weight).toBeLessThanOrEqual(1);
  });

  it('tem coordenada de capital válida', () => {
    expect(Number.isFinite(c.capitalLat)).toBe(true);
    expect(Number.isFinite(c.capitalLng)).toBe(true);
    expect(c.capitalLat).toBeGreaterThanOrEqual(-90);
    expect(c.capitalLat).toBeLessThanOrEqual(90);
    expect(c.capitalLng).toBeGreaterThanOrEqual(-180);
    expect(c.capitalLng).toBeLessThanOrEqual(180);
    // guarda contra a "ilha nula" em 0,0
    expect(c.capitalLat === 0 && c.capitalLng === 0).toBe(false);
  });

  it('tem a bandeira no lugar certo', () => {
    expect(existsSync(resolve(root, `public/flags/${c.cca2.toLowerCase()}.svg`))).toBe(true);
  });

  /** Pega latitude e longitude trocadas, que é o erro clássico com GeoJSON. */
  it('tem a capital perto do próprio país', () => {
    const capital: LngLat = [c.capitalLng, c.capitalLat];
    const centroid: LngLat = [c.centroidLng, c.centroidLat];
    const tolerance = CENTROID_TOLERANCE_KM[c.cca3] ?? DEFAULT_TOLERANCE_KM;
    expect(haversineKm(capital, centroid)).toBeLessThan(tolerance);
  });
});

describe('português do Brasil', () => {
  it('não deixou passar nenhuma forma de português europeu', () => {
    for (const c of COUNTRIES) {
      expect(ptPtBlocklist.has(c.name), `${c.cca3}: "${c.name}" é pt-PT`).toBe(false);
    }
  });

  it('não deixou nenhuma capital com a grafia em inglês', () => {
    for (const c of COUNTRIES) {
      expect(capitalBlocklist.has(c.capital), `${c.cca3}: "${c.capital}" está em inglês`).toBe(false);
    }
  });

  it('tem todas as 195 capitais revisadas à mão', () => {
    expect(Object.keys(capitals)).toHaveLength(195);
    for (const [code, row] of Object.entries(capitals)) {
      expect(row.reviewed, `${code} não revisado`).toBe(true);
      expect(row.pt.trim()).not.toBe('');
    }
  });
});

describe('mapa', () => {
  const topo = readJson<any>('public/data/world-50m.json');
  const ids = new Set(topo.objects.countries.geometries.map((g: any) => String(g.id)));

  /** Tuvalu é pequeno demais para o Natural Earth 50m; entra como marcador. */
  const KNOWN_WITHOUT_POLYGON = new Set(['TUV']);

  it('tem polígono para todo país, tirando as exceções conhecidas', () => {
    const missing = COUNTRIES.filter((c) => !ids.has(c.ccn3));
    expect(missing.map((c) => c.cca3).sort()).toEqual([...KNOWN_WITHOUT_POLYGON].sort());
  });

  it('continua sendo um TopoJSON válido depois da quantização', () => {
    const fc = topojson.feature(topo, topo.objects.countries) as any;
    expect(fc.features.length).toBeGreaterThan(200);
    for (const f of fc.features) expect(f.geometry).toBeTruthy();
  });
});
