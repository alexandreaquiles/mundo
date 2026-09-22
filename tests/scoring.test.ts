import { describe, expect, it } from 'vitest';
import {
  MAX_GAME_SCORE,
  MAX_ROUND_SCORE,
  PERFECT_KM,
  PIN_MAX_POINTS,
  ROUNDS_PER_GAME,
  ZERO_KM,
  pinPoints,
} from '../src/domain/scoring';

describe('pinPoints', () => {
  it('dá pontuação cheia dentro do raio perfeito', () => {
    expect(pinPoints(0)).toBe(PIN_MAX_POINTS);
    expect(pinPoints(PERFECT_KM)).toBe(PIN_MAX_POINTS);
  });

  it('zera a partir do limite e para entradas inválidas', () => {
    expect(pinPoints(ZERO_KM)).toBe(0);
    expect(pinPoints(20_000)).toBe(0);
    expect(pinPoints(-1)).toBe(0);
    expect(pinPoints(Number.NaN)).toBe(0);
  });

  it('nunca cresce com a distância', () => {
    let previous = PIN_MAX_POINTS;
    for (let d = 0; d <= 6000; d += 1) {
      const p = pinPoints(d);
      expect(p).toBeLessThanOrEqual(previous);
      previous = p;
    }
  });

  it('devolve sempre um inteiro entre 0 e 100', () => {
    for (let d = 0; d <= 6000; d += 7) {
      const p = pinPoints(d);
      expect(Number.isInteger(p)).toBe(true);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(PIN_MAX_POINTS);
    }
  });

  it('é contínua na borda dos 5.000 km', () => {
    expect(pinPoints(ZERO_KM - 1)).toBeLessThanOrEqual(1);
  });
});

describe('totais', () => {
  it('fecha em 1800 numa partida perfeita', () => {
    expect(MAX_ROUND_SCORE).toBe(120);
    expect(ROUNDS_PER_GAME).toBe(15);
    expect(MAX_GAME_SCORE).toBe(1800);
  });
});
