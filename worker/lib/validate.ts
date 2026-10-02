import { GAME_TIME_MS, MAX_GAME_SCORE, ROUNDS_PER_GAME } from '../../src/domain/scoring';
import { RULESET } from '../../src/domain/ruleset';
import { NAME_MAX } from '../../src/domain/limits';
import type { ScoreSubmission } from '../types';

export { NAME_MAX };
/**
 * Piso baixo de propósito: quem erra as 15 bandeiras clicando rápido termina
 * em uns 15 segundos, e recusar essa partida seria punir jogo legítimo. O
 * valor serve só para barrar envio automatizado em rajada — o limite por IP
 * é quem faz o trabalho de verdade.
 */
const MIN_DURATION_MS = 5_000;
/**
 * O teto agora é o orçamento do relógio, não uma hora arbitrária: com 20 s por
 * rodada, nenhuma partida honesta soma mais que 5 minutos.
 *
 * Isso também é o que barra uma aba antiga no cache do service worker, que
 * jogaria sem relógio e mandaria o tempo de parede — quase sempre acima de
 * 5 min. O `ruleset` abaixo é quem recusa esse caso de propósito; este limite
 * é a rede embaixo dele.
 */
const MAX_DURATION_MS = GAME_TIME_MS;

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

/** Formato do id gerado pelo navegador — 32 hex, como um UUID sem hífens. */
const PLAYER_ID = /^[0-9a-f]{32}$/;

export function isPlayerId(value: unknown): value is string {
  return typeof value === 'string' && PLAYER_ID.test(value);
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

  if (!isPlayerId(b.playerId)) fields.push('playerId');

  // Só a regra vigente entra. Um cliente velho não sabe do cronômetro, e deixá-lo
  // enviar colocaria no ranking novo uma partida jogada sem relógio.
  if (b.ruleset !== RULESET) fields.push('ruleset');

  if (fields.length > 0) return { ok: false, fields };
  return {
    ok: true,
    value: {
      playerId: b.playerId as string,
      name: name!,
      score: score as number,
      rounds: ROUNDS_PER_GAME,
      durationMs: durationMs as number,
      seed: b.seed as string,
      ruleset: RULESET,
    },
  };
}

/**
 * Identificador estável por dia, para limitar abuso sem guardar o IP.
 *
 * O sal secreto não é enfeite. Sem ele o hash é `sha256(ip|data)`, e a data
 * qualquer um sabe: IPv4 tem 2³² endereços, então quem puser as mãos na tabela
 * `scores` enumera o espaço inteiro em segundos e recupera o IP de todos. Com
 * um sal que só o Worker conhece, a tabela sozinha não diz nada.
 *
 * Quando o sal falta o hash continua funcionando — o limite por IP não pode
 * parar de pé por causa de configuração ausente —, mas aí ele é reversível, e
 * `IP_SALT_AUSENTE` deixa isso visível em vez de silencioso.
 */
export async function hashIp(ip: string, day: string, salt: string | undefined): Promise<string> {
  if (!salt) console.warn('IP_SALT_AUSENTE: o hash de IP está reversível; veja o README');
  const data = new TextEncoder().encode(`${ip}|${day}|${salt ?? ''}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
