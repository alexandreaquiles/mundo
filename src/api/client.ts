import type { LeaderboardEntry, ScoreSubmission, SubmitResponse } from './types';

export type { LeaderboardEntry, SubmitResponse };

const PENDING_KEY = 'mundo:pending-score';

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error((detail as { error?: string }).error ?? `Erro ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function submitScore(submission: ScoreSubmission): Promise<SubmitResponse> {
  return postJson<SubmitResponse>('/api/scores', submission);
}

export async function fetchLeaderboard(limit = 20): Promise<LeaderboardEntry[]> {
  const res = await fetch(`/api/scores/top?limit=${limit}`);
  if (!res.ok) throw new Error(`Não consegui carregar o ranking (${res.status})`);
  const data = (await res.json()) as { entries: LeaderboardEntry[] };
  return data.entries;
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
