import { describe, expect, it } from 'vitest';
import { NAME_MAX, hashIp, isPlayerId, normaliseName, validateSubmission } from '../../worker/lib/validate';
import { GAME_TIME_MS, MAX_GAME_SCORE } from '../../src/domain/scoring';
import { RULESET } from '../../src/domain/ruleset';

const PLAYER = 'a'.repeat(32);
const valid = {
  playerId: PLAYER,
  name: 'Ana',
  score: 1240,
  rounds: 15,
  durationMs: 222_000,
  seed: 'a1b2c3d4',
  ruleset: RULESET,
};

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

describe('isPlayerId', () => {
  it('aceita 32 hexadecimais e recusa o resto', () => {
    expect(isPlayerId(PLAYER)).toBe(true);
    expect(isPlayerId('A'.repeat(32))).toBe(false); // maiúscula não é o formato gerado
    expect(isPlayerId('a'.repeat(31))).toBe(false);
    expect(isPlayerId(undefined)).toBe(false);
  });
});

describe('validateSubmission', () => {
  it('aceita um envio bem formado', () => {
    const r = validateSubmission(valid);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.name).toBe('Ana');
      expect(r.value.playerId).toBe(PLAYER);
    }
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
    ['sem identidade do aparelho', { playerId: undefined }, 'playerId'],
    ['identidade curta demais', { playerId: 'abc' }, 'playerId'],
    ['identidade fora do hexadecimal', { playerId: 'z'.repeat(32) }, 'playerId'],
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

describe('cronômetro e regra vigente', () => {
  it('recusa quem não declara a regra', () => {
    const { ruleset, ...semRegra } = valid;
    void ruleset;
    const r = validateSubmission(semRegra);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fields).toContain('ruleset');
  });

  it('recusa uma regra que não é a vigente', () => {
    // é este caso que barra uma aba antiga no cache do service worker, que
    // jogaria sem relógio e entraria no ranking novo
    for (const ruleset of [RULESET - 1, RULESET + 1, '2', null]) {
      const r = validateSubmission({ ...valid, ruleset });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.fields).toContain('ruleset');
    }
  });

  it('aceita exatamente o orçamento do relógio', () => {
    expect(validateSubmission({ ...valid, durationMs: GAME_TIME_MS }).ok).toBe(true);
  });

  it('recusa tempo acima do orçamento', () => {
    // nenhuma partida honesta soma mais que os 15 relógios de 20 s
    const r = validateSubmission({ ...valid, durationMs: GAME_TIME_MS + 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fields).toContain('durationMs');
  });

  it('devolve a regra vigente em vez de confiar no que veio', () => {
    const r = validateSubmission(valid);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.ruleset).toBe(RULESET);
  });
});

describe('hashIp', () => {
  it('o sal muda o hash', async () => {
    // é isto que impede recuperar o IP a partir da tabela: sem o sal, quem a
    // tivesse enumeraria os 2³² endereços de IPv4 em segundos
    const a = await hashIp('203.0.113.7', '2026-10-02', 'sal-um');
    const b = await hashIp('203.0.113.7', '2026-10-02', 'sal-dois');
    expect(a).not.toBe(b);
  });

  it('o mesmo IP no mesmo dia dá o mesmo hash', async () => {
    // o limite por IP depende disso
    const a = await hashIp('203.0.113.7', '2026-10-02', 'sal');
    const b = await hashIp('203.0.113.7', '2026-10-02', 'sal');
    expect(a).toBe(b);
  });

  it('o mesmo IP em dias diferentes dá hashes diferentes', async () => {
    const a = await hashIp('203.0.113.7', '2026-10-02', 'sal');
    const b = await hashIp('203.0.113.7', '2026-10-03', 'sal');
    expect(a).not.toBe(b);
  });

  it('sem sal ainda funciona, para o limite não cair com config ausente', async () => {
    const a = await hashIp('203.0.113.7', '2026-10-02', undefined);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashIp('203.0.113.8', '2026-10-02', undefined)).not.toBe(a);
  });
});
