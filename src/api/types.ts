/** Contrato entre o cliente e o Worker. Compartilhado pelos dois lados. */
export interface ScoreSubmission {
  name: string;
  score: number;
  rounds: number;
  durationMs: number;
  seed: string;
}

export interface SubmitResponse {
  rank: number;
  total: number;
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  score: number;
  durationMs: number;
  country: string | null;
  createdAt: number;
}
