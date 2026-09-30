import { describe, expect, it } from 'vitest';
import { formatDuration } from '../src/domain/time';
import { GAME_TIME_MS, ROUND_TIME_MS } from '../src/domain/scoring';

describe('formatDuration', () => {
  it('escreve como cronômetro, com os segundos em duas casas', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(9_000)).toBe('0:09');
    expect(formatDuration(60_000)).toBe('1:00');
    expect(formatDuration(222_000)).toBe('3:42');
  });

  it('arredonda para cima, nunca para baixo', () => {
    // menos tempo é melhor no ranking: mostrar 0:19 para 19,4 s gastos
    // lisonjearia quem jogou
    expect(formatDuration(19_400)).toBe('0:20');
    expect(formatDuration(1)).toBe('0:01');
  });

  it('aguenta entrada estragada em vez de escrever NaN', () => {
    expect(formatDuration(-5)).toBe('0:00');
    expect(formatDuration(Number.NaN)).toBe('0:00');
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe('0:00');
  });

  it('o orçamento da partida são 5 minutos cravados', () => {
    expect(formatDuration(ROUND_TIME_MS)).toBe('0:20');
    expect(formatDuration(GAME_TIME_MS)).toBe('5:00');
  });
});
