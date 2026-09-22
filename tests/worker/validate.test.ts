import { describe, expect, it } from 'vitest';
import { NAME_MAX, normaliseName, validateSubmission } from '../../worker/lib/validate';
import { MAX_GAME_SCORE } from '../../src/domain/scoring';

const valid = { name: 'Ana', score: 1240, rounds: 15, durationMs: 300_000, seed: 'a1b2c3d4' };

describe('normaliseName', () => {
  it('limpa espaços e controles', () => {
    expect(normaliseName('  Ana   Maria ')).toBe('Ana Maria');
    expect(normaliseName('A​na')).toBe('Ana');
    expect(normaliseName('linha\nquebrada')).toBe('linha quebrada');
  });

  it('recusa o que fica vazio', () => {
    expect(normaliseName('   ')).toBeNull();
    expect(normaliseName('​​')).toBeNull();
    expect(normaliseName(42)).toBeNull();
    expect(normaliseName(undefined)).toBeNull();
  });

  it('corta no limite', () => {
    expect(normaliseName('x'.repeat(50))).toHaveLength(NAME_MAX);
  });

  it('mantém acentos e emoji', () => {
    expect(normaliseName('Aleç 🌍')).toBe('Aleç 🌍');
  });
});

describe('validateSubmission', () => {
  it('aceita um envio bem formado', () => {
    const r = validateSubmission(valid);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.name).toBe('Ana');
  });

  it.each([
    ['nome vazio', { name: '  ' }, 'name'],
    ['placar acima do teto', { score: MAX_GAME_SCORE + 1 }, 'score'],
    ['placar negativo', { score: -1 }, 'score'],
    ['placar fracionário', { score: 10.5 }, 'score'],
    ['rodadas erradas', { rounds: 14 }, 'rounds'],
    ['partida rápida demais', { durationMs: 3_000 }, 'durationMs'],
    ['partida longa demais', { durationMs: 99_000_000 }, 'durationMs'],
    ['semente inválida', { seed: 'não-hex' }, 'seed'],
  ])('recusa %s', (_label, patch, field) => {
    const r = validateSubmission({ ...valid, ...patch });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fields).toContain(field);
  });

  it('aceita exatamente o teto de pontos', () => {
    expect(validateSubmission({ ...valid, score: MAX_GAME_SCORE }).ok).toBe(true);
  });

  it('não explode com corpo estranho', () => {
    for (const body of [null, undefined, 'texto', 42, []]) {
      expect(validateSubmission(body).ok).toBe(false);
    }
  });
});
