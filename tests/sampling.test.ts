import { describe, expect, it } from 'vitest';
import { COUNTRIES } from '../src/data/countries';
import { buildCapitalOptions, buildFlagOptions, pickCountries } from '../src/domain/sampling';
import { rngFromSeed } from '../src/domain/rng';
import { ROUNDS_PER_GAME } from '../src/domain/scoring';
import type { Region } from '../src/domain/types';

const seeds = Array.from({ length: 300 }, (_, i) => `seed-${i}`);
const REGIONS: Region[] = ['Africa', 'Americas', 'Asia', 'Europe', 'Oceania'];

describe('pickCountries', () => {
  it('escolhe 15 países distintos', () => {
    for (const seed of seeds) {
      const picked = pickCountries(COUNTRIES, rngFromSeed(seed));
      expect(picked).toHaveLength(ROUNDS_PER_GAME);
      expect(new Set(picked.map((c) => c.cca3)).size).toBe(ROUNDS_PER_GAME);
    }
  });

  it('cobre as cinco regiões em toda partida', () => {
    for (const seed of seeds) {
      const picked = pickCountries(COUNTRIES, rngFromSeed(seed));
      for (const region of REGIONS) {
        expect(picked.filter((c) => c.region === region).length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('é determinístico para a mesma semente', () => {
    const a = pickCountries(COUNTRIES, rngFromSeed('abc')).map((c) => c.cca3);
    const b = pickCountries(COUNTRIES, rngFromSeed('abc')).map((c) => c.cca3);
    expect(a).toEqual(b);
  });

  it('não concentra o sorteio em poucos países', () => {
    const counts = new Map<string, number>();
    for (const seed of seeds) {
      for (const c of pickCountries(COUNTRIES, rngFromSeed(seed))) {
        counts.set(c.cca3, (counts.get(c.cca3) ?? 0) + 1);
      }
    }
    const total = seeds.length * ROUNDS_PER_GAME;
    const worst = Math.max(...counts.values());
    expect(worst / total).toBeLessThan(0.035);
    // e quase todo o mundo aparece ao menos uma vez em 300 partidas
    expect(counts.size).toBeGreaterThan(COUNTRIES.length * 0.9);
  });
});

describe('alternativas', () => {
  it('sempre traz 4 opções, uma correta e sem repetições', () => {
    for (const country of COUNTRIES) {
      for (let i = 0; i < 5; i++) {
        const rng = rngFromSeed(`${country.cca3}:${i}`);
        for (const options of [
          buildFlagOptions(country, COUNTRIES, rng),
          buildCapitalOptions(country, COUNTRIES, rng),
        ]) {
          expect(options).toHaveLength(4);
          expect(options.filter((o) => o.correct)).toHaveLength(1);
          expect(new Set(options.map((o) => o.label)).size).toBe(4);
          expect(new Set(options.map((o) => o.value)).size).toBe(4);
        }
      }
    }
  });

  it('marca como correta a resposta do país sorteado', () => {
    for (const country of COUNTRIES) {
      const rng = rngFromSeed(country.cca3);
      expect(buildFlagOptions(country, COUNTRIES, rng).find((o) => o.correct)?.value).toBe(country.cca3);
      expect(buildCapitalOptions(country, COUNTRIES, rng).find((o) => o.correct)?.value).toBe(country.capital);
    }
  });

  it('puxa distratores da mesma região na maioria das vezes', () => {
    let sameRegion = 0;
    let rounds = 0;
    for (const country of COUNTRIES) {
      const rng = rngFromSeed(`r:${country.cca3}`);
      const wrong = buildCapitalOptions(country, COUNTRIES, rng).filter((o) => !o.correct);
      const regions = wrong.map((o) => COUNTRIES.find((c) => c.capital === o.value)?.region);
      if (regions.filter((r) => r === country.region).length >= 2) sameRegion++;
      rounds++;
    }
    expect(sameRegion / rounds).toBeGreaterThan(0.8);
  });
});
