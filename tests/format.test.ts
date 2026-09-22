import { describe, expect, it } from 'vitest';
import { formatDuration, formatExactDate, formatPlayedAt } from '../src/domain/format';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Um "agora" fixo, para os testes não dependerem do relógio da máquina. */
const NOW = Date.UTC(2026, 8, 22, 15, 0, 0);
const agoBy = (ms: number) => formatPlayedAt(NOW - ms, NOW);

describe('formatPlayedAt', () => {
  it('trata o que é muito recente como "agora"', () => {
    expect(agoBy(0)).toBe('agora');
    expect(agoBy(30 * SECOND)).toBe('agora');
  });

  it('conta minutos e horas', () => {
    expect(agoBy(5 * MINUTE)).toBe('há 5 minutos');
    expect(agoBy(59 * MINUTE)).toBe('há 59 minutos');
    expect(agoBy(2 * HOUR)).toBe('há 2 horas');
  });

  it('usa as palavras do português para os dias próximos', () => {
    expect(agoBy(25 * HOUR)).toBe('ontem');
    expect(agoBy(2 * DAY)).toBe('anteontem');
    expect(agoBy(5 * DAY)).toBe('há 5 dias');
  });

  it('vira data absoluta a partir de uma semana', () => {
    expect(agoBy(6 * DAY)).toBe('há 6 dias');
    // 22/09 menos 7 dias = 15/09
    expect(agoBy(7 * DAY)).toBe('15/09/2026');
    expect(agoBy(400 * DAY)).toMatch(/^\d{2}\/\d{2}\/2025$/);
  });

  it('não mostra partida no futuro quando o relógio do aparelho está atrasado', () => {
    expect(formatPlayedAt(NOW + 5 * MINUTE, NOW)).toBe('agora');
  });

  it('devolve string vazia para entrada inválida', () => {
    expect(formatPlayedAt(Number.NaN, NOW)).toBe('');
    expect(formatPlayedAt(Number.POSITIVE_INFINITY, NOW)).toBe('');
  });
});

describe('formatExactDate', () => {
  it('traz data e hora por extenso', () => {
    const texto = formatExactDate(NOW);
    expect(texto).toContain('2026');
    expect(texto).toContain('setembro');
  });

  it('devolve string vazia para entrada inválida', () => {
    expect(formatExactDate(Number.NaN)).toBe('');
  });
});

describe('formatDuration', () => {
  it('mostra só segundos abaixo de um minuto', () => {
    expect(formatDuration(45 * SECOND)).toBe('45s');
    expect(formatDuration(0)).toBe('0s');
  });

  it('mostra minutos e segundos', () => {
    expect(formatDuration(4 * MINUTE + 12 * SECOND)).toBe('4min 12s');
    expect(formatDuration(5 * MINUTE)).toBe('5min');
  });

  it('mostra horas em partidas longas', () => {
    expect(formatDuration(HOUR + 7 * MINUTE)).toBe('1h 07min');
    expect(formatDuration(2 * HOUR)).toBe('2h 00min');
  });

  it('arredonda os milissegundos em vez de truncar', () => {
    expect(formatDuration(59_600)).toBe('1min');
  });

  it('devolve string vazia para entrada inválida', () => {
    expect(formatDuration(-1)).toBe('');
    expect(formatDuration(Number.NaN)).toBe('');
  });
});
