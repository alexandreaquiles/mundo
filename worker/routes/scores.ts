import type { Env, LeaderboardEntry, SubmitResponse } from '../types';
import { hashIp, validateSubmission } from '../lib/validate';

const MAX_BODY_BYTES = 4096;
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;
/** Teto de envios por IP por hora, como segunda camada do rate limit. */
const HOURLY_IP_QUOTA = 20;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

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

  await env.DB.prepare(
    `INSERT INTO scores (id, name, score, rounds, duration_ms, seed, country, ip_hash, hidden, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
  )
    .bind(crypto.randomUUID(), name, score, rounds, durationMs, seed, country, ipHash, now)
    .run();

  // posição = quantas pontuações são estritamente melhores, + 1
  const better = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM scores
      WHERE hidden = 0 AND (score > ? OR (score = ? AND duration_ms < ?))`,
  )
    .bind(score, score, durationMs)
    .first<{ n: number }>();
  const total = await env.DB.prepare('SELECT COUNT(*) AS n FROM scores WHERE hidden = 0').first<{ n: number }>();

  const response: SubmitResponse = { rank: (better?.n ?? 0) + 1, total: total?.n ?? 1 };
  return json(response, 201);
}

export async function getTop(request: Request, env: Env): Promise<Response> {
  const requested = Number(new URL(request.url).searchParams.get('limit') ?? DEFAULT_LIMIT);
  const limit = Number.isFinite(requested) ? Math.min(MAX_LIMIT, Math.max(1, Math.floor(requested))) : DEFAULT_LIMIT;

  const { results } = await env.DB.prepare(
    `SELECT name, score, duration_ms, country, created_at
       FROM scores WHERE hidden = 0
      ORDER BY score DESC, duration_ms ASC, created_at ASC
      LIMIT ?`,
  )
    .bind(limit)
    .all<{ name: string; score: number; duration_ms: number; country: string | null; created_at: number }>();

  const entries: LeaderboardEntry[] = (results ?? []).map((r, i) => ({
    rank: i + 1,
    name: r.name,
    score: r.score,
    durationMs: r.duration_ms,
    country: r.country,
    createdAt: r.created_at,
  }));

  return new Response(JSON.stringify({ entries }), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=30',
    },
  });
}
