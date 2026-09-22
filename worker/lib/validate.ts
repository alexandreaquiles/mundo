import { MAX_GAME_SCORE, ROUNDS_PER_GAME } from '../../src/domain/scoring';
import type { ScoreSubmission } from '../types';

export const NAME_MAX = 20;
/**
 * Piso baixo de propósito: quem erra as 15 bandeiras clicando rápido termina
 * em uns 15 segundos, e recusar essa partida seria punir jogo legítimo. O
 * valor serve só para barrar envio automatizado em rajada — o limite por IP
 * é quem faz o trabalho de verdade.
 */
const MIN_DURATION_MS = 5_000;
const MAX_DURATION_MS = 3_600_000;

/**
 * Remove controles e invisíveis, colapsa espaços e corta no limite.
 * Quebra de linha vira espaço (senão "linha\nquebrada" viraria uma palavra só);
 * zero-width e marcas de direção somem de vez.
 */
export function normaliseName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw
    .normalize('NFC')
    .replace(/[\p{Cf}]/gu, '')
    .replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_MAX)
    .trim();
  return cleaned.length > 0 ? cleaned : null;
}

export type Validation =
  | { ok: true; value: ScoreSubmission }
  | { ok: false; fields: string[] };

export function validateSubmission(body: unknown): Validation {
  const b = (body ?? {}) as Record<string, unknown>;
  const fields: string[] = [];

  const name = normaliseName(b.name);
  if (!name) fields.push('name');

  const score = b.score;
  if (!Number.isInteger(score) || (score as number) < 0 || (score as number) > MAX_GAME_SCORE) {
    fields.push('score');
  }

  if (b.rounds !== ROUNDS_PER_GAME) fields.push('rounds');

  const durationMs = b.durationMs;
  if (
    !Number.isInteger(durationMs) ||
    (durationMs as number) < MIN_DURATION_MS ||
    (durationMs as number) > MAX_DURATION_MS
  ) {
    fields.push('durationMs');
  }

  if (typeof b.seed !== 'string' || !/^[0-9a-f]{8,32}$/.test(b.seed)) fields.push('seed');

  if (fields.length > 0) return { ok: false, fields };
  return {
    ok: true,
    value: {
      name: name!,
      score: score as number,
      rounds: ROUNDS_PER_GAME,
      durationMs: durationMs as number,
      seed: b.seed as string,
    },
  };
}

/** Identificador estável por dia, para limitar abuso sem guardar o IP. */
export async function hashIp(ip: string, day: string): Promise<string> {
  const data = new TextEncoder().encode(`${ip}|${day}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
