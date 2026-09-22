import type { LeaderboardEntry, LeaderboardPage, PlayerAttempt, SubmitResponse } from '../../src/api/types';
import type { Env } from '../env';
import { hashIp, isPlayerId, normaliseName, validateSubmission } from '../lib/validate';
import { adoptLegacyRows, isAvailableFor, ownerOf } from '../lib/identity';

const MAX_BODY_BYTES = 4096;
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 15;
const MAX_ATTEMPTS = 20;
/** Teto de envios por IP por hora, como segunda camada do rate limit. */
const HOURLY_IP_QUOTA = 20;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

/**
 * A ordem total do ranking. Está numa constante porque precisa ser
 * *exatamente* a mesma em todo lugar: se a listagem ordenar de um jeito e o
 * cálculo de posição de outro, o "você ficou em 12º" aponta para a linha
 * errada — e a janela de vizinhos, que é calculada a partir dele, desloca
 * junto.
 */
const ORDER = 'score DESC, duration_ms ASC, created_at ASC';

/**
 * Uma linha por jogador: a melhor partida de cada um, com quantas jogou.
 *
 * Agrupa por `player_id`, não por nome. Partidas anteriores à identidade têm
 * player_id nulo, e `PARTITION BY` juntaria TODAS elas num jogador só — daí o
 * COALESCE, que faz as antigas continuarem agrupadas por nome até serem
 * adotadas.
 */
const IDENTITY = `COALESCE(player_id, 'legado:' || name)`;

const BEST_PER_PLAYER = `
  WITH ranked AS (
    SELECT id, name, score, duration_ms, country, created_at, player_id,
           ROW_NUMBER() OVER (PARTITION BY ${IDENTITY} ORDER BY ${ORDER}) AS rn,
           COUNT(*)     OVER (PARTITION BY ${IDENTITY}) AS attempts
      FROM scores WHERE hidden = 0
  ),
  best AS (SELECT * FROM ranked WHERE rn = 1)`;

/** Quantas linhas do ranking vêm antes desta. A posição é isso + 1. */
const COUNT_BETTER = `
  SELECT COUNT(*) AS n FROM best
   WHERE score > ?1
      OR (score = ?1 AND duration_ms < ?2)
      OR (score = ?1 AND duration_ms = ?2 AND created_at < ?3)`;

interface Row {
  id: string;
  name: string;
  score: number;
  duration_ms: number;
  country: string | null;
  created_at: number;
  attempts: number;
}

const toEntry = (r: Row, rank: number): LeaderboardEntry => ({
  id: r.id,
  rank,
  name: r.name,
  score: r.score,
  durationMs: r.duration_ms,
  country: r.country,
  createdAt: r.created_at,
  attempts: r.attempts,
});

function readLimit(url: URL, param: string, fallback: number, max: number): number {
  const raw = Number(url.searchParams.get(param) ?? fallback);
  return Number.isFinite(raw) ? Math.min(max, Math.max(0, Math.floor(raw))) : fallback;
}

export async function postScore(request: Request, env: Env): Promise<Response> {
  if (request.headers.get('Content-Type')?.includes('application/json') !== true) {
    return json({ error: 'Envie JSON.' }, 415);
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: 'Corpo grande demais.' }, 413);

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: 'JSON inválido.' }, 400);
  }

  const result = validateSubmission(body);
  if (!result.ok) return json({ error: 'Dados inválidos.', fields: result.fields }, 400);

  const { playerId } = result.value;

  // O nome pertence ao primeiro aparelho que o usou. Recusar cedo evita
  // gravar uma partida que não vai aparecer no lugar certo.
  const ownership = await ownerOf(env, result.value.name);
  if (!isAvailableFor(ownership, playerId)) {
    return json({ error: 'Esse nome já é de outra pessoa. Escolha outro.', field: 'name' }, 409);
  }

  const ip = request.headers.get('CF-Connecting-IP') ?? '0.0.0.0';
  const now = Date.now();
  const day = new Date(now).toISOString().slice(0, 10);
  const ipHash = await hashIp(ip, day);

  if (env.SUBMIT_LIMITER) {
    const { success } = await env.SUBMIT_LIMITER.limit({ key: ipHash });
    if (!success) return json({ error: 'Muitos envios. Tente daqui a pouco.' }, 429);
  }

  const recent = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM scores WHERE ip_hash = ? AND created_at > ?',
  )
    .bind(ipHash, now - 3_600_000)
    .first<{ n: number }>();
  if ((recent?.n ?? 0) >= HOURLY_IP_QUOTA) {
    return json({ error: 'Muitos envios nesta hora.' }, 429);
  }

  const { name, score, rounds, durationMs, seed } = result.value;
  const country = (request as Request & { cf?: { country?: string } }).cf?.country ?? null;
  const id = crypto.randomUUID();

  // Quem reivindica um nome herda as partidas antigas dele.
  if (ownership.kind === 'herdado') await adoptLegacyRows(env, name, playerId);

  await env.DB.prepare(
    `INSERT INTO scores (id, name, score, rounds, duration_ms, seed, country, ip_hash, hidden, created_at, player_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
  )
    .bind(id, name, score, rounds, durationMs, seed, country, ipHash, now, playerId)
    .run();

  // A posição é a da MELHOR partida deste jogador, que pode não ser a de agora.
  const best = await env.DB.prepare(
    `${BEST_PER_PLAYER} SELECT id, score, duration_ms, created_at FROM best WHERE player_id = ?`,
  )
    .bind(playerId)
    .first<{ id: string; score: number; duration_ms: number; created_at: number }>();

  // A linha acabou de ser inserida, então `best` só seria nulo se algo
  // tivesse apagado a tabela no meio — não há resposta melhor que 1º.
  if (!best) return json({ id, bestId: id, rank: 1, total: 1 } satisfies SubmitResponse, 201);

  const better = await env.DB.prepare(`${BEST_PER_PLAYER} ${COUNT_BETTER}`)
    .bind(best.score, best.duration_ms, best.created_at)
    .first<{ n: number }>();

  const total = await env.DB.prepare(`${BEST_PER_PLAYER} SELECT COUNT(*) AS n FROM best`).first<{ n: number }>();

  return json(
    { id, bestId: best.id, rank: (better?.n ?? 0) + 1, total: total?.n ?? 1 } satisfies SubmitResponse,
    201,
  );
}

export async function getTop(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = Math.max(1, readLimit(url, 'limit', DEFAULT_LIMIT, MAX_LIMIT));
  const offset = readLimit(url, 'offset', 0, Number.MAX_SAFE_INTEGER);

  const { results } = await env.DB.prepare(
    `${BEST_PER_PLAYER}
     SELECT id, name, score, duration_ms, country, created_at, attempts
       FROM best ORDER BY ${ORDER} LIMIT ? OFFSET ?`,
  )
    .bind(limit, offset)
    .all<Row>();

  const total = await env.DB.prepare(`${BEST_PER_PLAYER} SELECT COUNT(*) AS n FROM best`).first<{ n: number }>();

  const page: LeaderboardPage = {
    entries: (results ?? []).map((r, i) => toEntry(r, offset + i + 1)),
    total: total?.n ?? 0,
  };

  return new Response(JSON.stringify(page), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // curto de propósito: uma partida recém-enviada precisa aparecer logo
      'Cache-Control': 'public, max-age=15',
    },
  });
}

/** As outras partidas do mesmo jogador, para expandir a linha do ranking. */
export async function getPlayerAttempts(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const name = normaliseName(url.searchParams.get('name'));
  if (!name) return json({ error: 'Informe um nome.' }, 400);

  // A linha do ranking é identificada pelo nome exibido; as partidas daquele
  // jogador são as que compartilham a mesma identidade que ele.
  const { results } = await env.DB.prepare(
    `SELECT id, score, duration_ms, created_at
       FROM scores WHERE hidden = 0
        AND ${IDENTITY} = (SELECT ${IDENTITY} FROM scores WHERE name = ? LIMIT 1)
      ORDER BY ${ORDER} LIMIT ?`,
  )
    .bind(name, MAX_ATTEMPTS)
    .all<{ id: string; score: number; duration_ms: number; created_at: number }>();

  const entries: PlayerAttempt[] = (results ?? []).map((r) => ({
    id: r.id,
    score: r.score,
    durationMs: r.duration_ms,
    createdAt: r.created_at,
  }));

  return new Response(JSON.stringify({ entries }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=15' },
  });
}

/** O nome está livre para este aparelho? Checado enquanto a pessoa digita. */
export async function getNameAvailability(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const name = normaliseName(url.searchParams.get('name'));
  const playerId = url.searchParams.get('playerId');

  if (!name) return json({ error: 'Informe um nome.' }, 400);
  if (!isPlayerId(playerId)) return json({ error: 'Identificador inválido.' }, 400);

  const ownership = await ownerOf(env, name);
  return json({ name, available: isAvailableFor(ownership, playerId) });
}
