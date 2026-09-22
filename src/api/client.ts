import type {
  LeaderboardEntry,
  LeaderboardPage,
  PlayerAttempt,
  PlayerSummary,
  ScoreSubmission,
  SubmitResponse,
} from './types';

export type { LeaderboardEntry, LeaderboardPage, PlayerAttempt, PlayerSummary, SubmitResponse };

const SUMMARY_KEY = 'mundo:summary';

const PENDING_KEY = 'mundo:pending-score';

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  return res.json() as Promise<T>;
}

/** Erro que a pessoa consegue resolver trocando o nome. */
export class NameTakenError extends Error {}

export async function submitScore(submission: ScoreSubmission): Promise<SubmitResponse> {
  const res = await fetch('/api/scores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(submission),
  });
  if (!res.ok) {
    const detail = (await res.json().catch(() => ({}))) as { error?: string };
    const message = detail.error ?? `Erro ${res.status}`;
    throw res.status === 409 ? new NameTakenError(message) : new Error(message);
  }
  return res.json() as Promise<SubmitResponse>;
}

/** O nome está livre para este aparelho? */
export async function checkName(name: string, playerId: string): Promise<boolean> {
  const data = await getJson<{ available: boolean }>(
    `/api/names?name=${encodeURIComponent(name)}&playerId=${playerId}`,
  );
  return data.available;
}

export function fetchLeaderboard(limit = 15, offset = 0): Promise<LeaderboardPage> {
  return getJson<LeaderboardPage>(`/api/scores/top?limit=${limit}&offset=${offset}`);
}

/** As outras partidas de um mesmo nome, para expandir a linha. */
export async function fetchPlayerAttempts(name: string): Promise<PlayerAttempt[]> {
  const data = await getJson<{ entries: PlayerAttempt[] }>(
    `/api/scores/player?name=${encodeURIComponent(name)}`,
  );
  return data.entries;
}

/**
 * Resumo de quem joga neste aparelho. `null` quando ainda não há partida.
 *
 * Guarda em cache no localStorage: a home precisa mostrar as boas-vindas na
 * hora, inclusive offline, sem esperar a rede.
 */
export async function fetchMe(playerId: string): Promise<PlayerSummary | null> {
  const res = await fetch(`/api/me?playerId=${playerId}`);
  if (res.status === 204) {
    cacheSummary(null);
    return null;
  }
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  const summary = (await res.json()) as PlayerSummary;
  cacheSummary(summary);
  return summary;
}

export function cacheSummary(summary: PlayerSummary | null) {
  try {
    if (summary) localStorage.setItem(SUMMARY_KEY, JSON.stringify(summary));
    else localStorage.removeItem(SUMMARY_KEY);
  } catch {
    /* sem cache; a home só espera a rede */
  }
}

export function cachedSummary(): PlayerSummary | null {
  try {
    const raw = localStorage.getItem(SUMMARY_KEY);
    return raw ? (JSON.parse(raw) as PlayerSummary) : null;
  } catch {
    return null;
  }
}

/** Guarda uma pontuação que não conseguiu subir, para tentar de novo depois. */
export function queueScore(submission: ScoreSubmission) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(submission));
  } catch {
    /* sem fila offline; a partida em si não depende disso */
  }
}

export function takeQueuedScore(): ScoreSubmission | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    localStorage.removeItem(PENDING_KEY);
    return JSON.parse(raw) as ScoreSubmission;
  } catch {
    return null;
  }
}
