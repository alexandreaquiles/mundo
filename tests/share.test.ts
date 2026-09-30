import { describe, expect, it } from 'vitest';
import { BY_CCA3, COUNTRIES } from '../src/data/countries';
import { buildShareText, flagEmoji, roundEmoji } from '../src/domain/share';
import { MAX_ROUND_SCORE } from '../src/domain/scoring';
import type { RoundResult } from '../src/domain/types';

const countryOf = (cca3: string) => BY_CCA3.get(cca3);

const round = (over: Partial<RoundResult>): RoundResult => ({
  cca3: 'BRA',
  reached: 'done',
  flagCorrect: true,
  capitalCorrect: true,
  guess: [0, 0],
  distanceKm: 500,
  points: 60,
  ms: 4_000,
  timedOut: false,
  ...over,
});

describe('flagEmoji', () => {
  it('traduz o código de duas letras', () => {
    expect(flagEmoji('BR')).toBe('🇧🇷');
    expect(flagEmoji('JP')).toBe('🇯🇵');
    expect(flagEmoji('br')).toBe('🇧🇷');
  });

  it('gera uma sequência válida para os 195 países', () => {
    for (const c of COUNTRIES) {
      const emoji = flagEmoji(c.cca2);
      const pontos = [...emoji].map((ch) => ch.codePointAt(0)!);
      expect(pontos).toHaveLength(2);
      for (const p of pontos) {
        expect(p).toBeGreaterThanOrEqual(0x1f1e6);
        expect(p).toBeLessThanOrEqual(0x1f1ff);
      }
    }
  });

  it('não repete bandeira entre países diferentes', () => {
    expect(new Set(COUNTRIES.map((c) => flagEmoji(c.cca2))).size).toBe(COUNTRIES.length);
  });
});

describe('roundEmoji', () => {
  it('usa uma cor por desfecho', () => {
    expect(roundEmoji(round({ points: MAX_ROUND_SCORE }))).toBe('🟢');
    expect(roundEmoji(round({ points: 60 }))).toBe('🟡');
    expect(roundEmoji(round({ capitalCorrect: false, points: 10 }))).toBe('🟠');
    expect(roundEmoji(round({ flagCorrect: false, capitalCorrect: false, points: 0 }))).toBe('🔴');
  });
});

describe('buildShareText', () => {
  const url = 'https://mundo.exemplo/';

  it('resume a melhor cravada, e só entre as rodadas perfeitas', () => {
    const texto = buildShareText({
      score: 240,
      durationMs: 222_000,
      results: [
        round({ cca3: 'BRA', points: MAX_ROUND_SCORE, distanceKm: 12 }),
        round({ cca3: 'ITA', points: MAX_ROUND_SCORE, distanceKm: 4 }),
        round({ cca3: 'JPN', points: 60, distanceKm: 800 }),
      ],
      countryOf,
      url,
    });
    expect(texto).toContain('🇧🇷🟢');
    expect(texto).toContain('🇯🇵🟡');
    expect(texto).toContain('🟢 melhor pino: 4 km');
    expect(texto).not.toContain('800 km');
    expect(texto).not.toContain('12 km');
  });

  it('não põe a linha do pino quando não houve rodada perfeita', () => {
    const texto = buildShareText({ score: 10, durationMs: 222_000, results: [round({ points: 60 })], countryOf, url });
    expect(texto).not.toContain('melhor pino');
  });

  it('agrupa as 15 rodadas em 5 linhas de 3', () => {
    const results = Array.from({ length: 15 }, () => round({ points: 60 }));
    const grade = buildShareText({ score: 0, durationMs: 222_000, results, countryOf, url })
      .split('\n')
      .filter((l) => l.includes('🟡'));
    expect(grade).toHaveLength(5);
    for (const linha of grade) expect(linha.split(' ')).toHaveLength(3);
  });

  it('mantém a linha estreita o bastante para a bolha do WhatsApp', () => {
    const results = Array.from({ length: 15 }, () => round({ points: 60 }));
    const grade = buildShareText({ score: 0, durationMs: 222_000, results, countryOf, url })
      .split('\n')
      .filter((l) => l.includes('🟡'));
    // 3 células de 2 emojis + 2 espaços; foi a largura de 5 que o WhatsApp quebrou
    for (const linha of grade) expect([...linha].length).toBeLessThanOrEqual(12);
  });

  it('põe pontuação no topo e link no fim', () => {
    const linhas = buildShareText({ score: 430, durationMs: 222_000, results: [round({})], countryOf, url }).split('\n');
    expect(linhas[0]).toBe('Mundo — 430/1800');
    expect(linhas.at(-1)).toBe(url);
  });

  it('cabe em poucas linhas mesmo com as 15 rodadas', () => {
    const results = Array.from({ length: 15 }, () => round({ flagCorrect: false, points: 0 }));
    const linhas = buildShareText({ score: 0, durationMs: 222_000, results, countryOf, url }).split('\n');
    // título + vazia + 5 da grade + vazia + tempo + vazia + link
    expect(linhas).toHaveLength(11);
  });

  it('fecha a última linha mesmo com rodadas de menos', () => {
    const results = Array.from({ length: 7 }, () => round({ points: 60 }));
    const grade = buildShareText({ score: 0, durationMs: 222_000, results, countryOf, url })
      .split('\n')
      .filter((l) => l.includes('🟡'));
    expect(grade).toHaveLength(3);
    expect(grade[2]!.split(' ')).toHaveLength(1);
  });

  it('não quebra se o país não for encontrado', () => {
    const texto = buildShareText({ score: 0, durationMs: 222_000, results: [round({ cca3: 'XXX' })], countryOf, url });
    expect(texto).toContain('🏳️');
  });
});

describe('tempo no compartilhamento', () => {
  const url = 'https://mundo.exemplo/';
  const countryOf = (cca3: string) => BY_CCA3.get(cca3);

  it('mostra o tempo da partida', () => {
    const texto = buildShareText({
      score: 430,
      durationMs: 222_000,
      results: [round({})],
      countryOf,
      url,
    });
    expect(texto).toContain('⏱ 3:42');
  });

  it('põe o tempo em linha própria, e não ao lado do placar', () => {
    // é a linha mais larga que decide onde o WhatsApp quebra a bolha; juntar
    // placar e tempo no título alargaria a mensagem inteira
    const linhas = buildShareText({
      score: 430,
      durationMs: 222_000,
      results: [round({})],
      countryOf,
      url,
    }).split('\n');
    expect(linhas[0]).toBe('Mundo — 430/1800');
    expect(linhas.find((l) => l.includes('⏱'))).toBe('⏱ 3:42');
  });

  it('o tempo vem antes do melhor pino', () => {
    const linhas = buildShareText({
      score: 240,
      durationMs: 60_000,
      results: [round({ points: MAX_ROUND_SCORE, distanceKm: 8 })],
      countryOf,
      url,
    }).split('\n');
    const tempo = linhas.findIndex((l) => l.includes('⏱'));
    const pino = linhas.findIndex((l) => l.includes('melhor pino'));
    expect(tempo).toBeGreaterThan(-1);
    expect(pino).toBe(tempo + 1);
  });
});
