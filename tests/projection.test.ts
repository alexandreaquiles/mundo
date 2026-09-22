import { describe, expect, it } from 'vitest';
import { COUNTRIES } from '../src/data/countries';
import {
  IDENTITY_VIEW,
  K_MAX,
  K_MAX_REVEAL,
  createProjection,
  viewFitting,
  zoomAbout,
  type View,
} from '../src/map/projection';
import { mulberry32 } from '../src/domain/rng';
import type { LngLat } from '../src/domain/types';

const VIEWPORTS: [number, number][] = [
  [360, 640],
  [1440, 900],
];
const ZOOMS = [1, 4, 16, 48];

describe('inversão da projeção', () => {
  it('leva a capital de volta a ela mesma em todo zoom e viewport', () => {
    for (const [w, h] of VIEWPORTS) {
      const mp = createProjection(w, h);
      for (const k of ZOOMS) {
        const projection = mp.apply({ k, x: 0, y: 0 });
        for (const c of COUNTRIES) {
          const p: LngLat = [c.capitalLng, c.capitalLat];
          const screen = projection(p)!;
          const back = projection.invert!(screen)!;
          expect(back[0]).toBeCloseTo(p[0], 6);
          expect(back[1]).toBeCloseTo(p[1], 6);
        }
      }
    }
  });

  it('inverte pontos aleatórios do globo', () => {
    const mp = createProjection(800, 500);
    const projection = mp.apply({ k: 3, x: -40, y: 25 });
    const rng = mulberry32(99);
    for (let i = 0; i < 5000; i++) {
      const p: LngLat = [rng() * 360 - 180, rng() * 170 - 85];
      const back = projection.invert!(projection(p)!)!;
      expect(back[0]).toBeCloseTo(p[0], 6);
      expect(back[1]).toBeCloseTo(p[1], 6);
    }
  });

  it('coincide com a fórmula k·base + (x, y)', () => {
    const mp = createProjection(1000, 600);
    const base = mp.apply(IDENTITY_VIEW);
    const reference = COUNTRIES.map((c) => base([c.capitalLng, c.capitalLat])!.slice() as [number, number]);
    const view: View = { k: 5.5, x: -123.5, y: 77.25 };
    const zoomed = mp.apply(view);
    COUNTRIES.forEach((c, i) => {
      const got = zoomed([c.capitalLng, c.capitalLat])!;
      expect(got[0]).toBeCloseTo(reference[i]![0] * view.k + view.x, 6);
      expect(got[1]).toBeCloseTo(reference[i]![1] * view.k + view.y, 6);
    });
  });
});

describe('zoomAbout', () => {
  it('mantém o ponto de ancoragem parado', () => {
    const rng = mulberry32(5);
    let view: View = { ...IDENTITY_VIEW };
    const mp = createProjection(900, 600);
    for (let i = 0; i < 1000; i++) {
      const anchor: [number, number] = [rng() * 900, rng() * 600];
      const before = mp.apply(view).invert!(anchor);
      view = zoomAbout(view, anchor, 0.6 + rng() * 1.6);
      const after = mp.apply(view).invert!(anchor);
      if (!before || !after) continue;
      expect(after[0]).toBeCloseTo(before[0], 6);
      expect(after[1]).toBeCloseTo(before[1], 6);
    }
  });

  it('respeita os limites de zoom', () => {
    let view: View = { ...IDENTITY_VIEW };
    for (let i = 0; i < 50; i++) view = zoomAbout(view, [0, 0], 2);
    expect(view.k).toBe(K_MAX);
    for (let i = 0; i < 50; i++) view = zoomAbout(view, [0, 0], 0.5);
    expect(view.k).toBe(1);
  });
});

describe('viewFitting', () => {
  it('não estoura o zoom quando o palpite crava a capital', () => {
    const mp = createProjection(390, 500);
    const same: LngLat = [-47.918, -15.7814];
    const view = viewFitting([same, same], mp, 60);
    expect(view.k).toBeLessThanOrEqual(K_MAX_REVEAL);
    const screen = mp.apply(view)(same)!;
    // e o ponto tem de ficar no meio da tela
    expect(screen[0]).toBeCloseTo(195, 0);
    expect(screen[1]).toBeCloseTo(250, 0);
  });

  it('centraliza o par de pontos', () => {
    const mp = createProjection(800, 500);
    const a: LngLat = [-47.918, -15.78];
    const b: LngLat = [2.35, 48.86];
    const projection = mp.apply(viewFitting([a, b], mp, 60));
    const pa = projection(a)!;
    const pb = projection(b)!;
    expect((pa[0] + pb[0]) / 2).toBeCloseTo(400, 0);
    expect((pa[1] + pb[1]) / 2).toBeCloseTo(250, 0);
  });

  it('coloca os dois pontos dentro da tela', () => {
    const mp = createProjection(800, 500);
    const pairs: [LngLat, LngLat][] = [
      [[-47.88, -15.79], [2.35, 48.86]],
      [[139.69, 35.69], [-58.38, -34.6]],
      [[-0.13, 51.51], [-0.2, 51.4]],
    ];
    for (const [a, b] of pairs) {
      const projection = mp.apply(viewFitting([a, b], mp, 48));
      for (const p of [a, b]) {
        const s = projection(p)!;
        expect(s[0]).toBeGreaterThanOrEqual(-1);
        expect(s[0]).toBeLessThanOrEqual(801);
        expect(s[1]).toBeGreaterThanOrEqual(-1);
        expect(s[1]).toBeLessThanOrEqual(501);
      }
    }
  });
});
