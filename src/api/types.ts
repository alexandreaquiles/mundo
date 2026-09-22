/** Contrato entre o cliente e o Worker. Compartilhado pelos dois lados. */

export interface ScoreSubmission {
  name: string;
  score: number;
  rounds: number;
  durationMs: number;
  seed: string;
}

export interface SubmitResponse {
  /** A partida recém-enviada. */
  id: string;
  /**
   * A partida que representa este nome no ranking — a melhor dele.
   * Igual a `id` quando a jogada de agora foi a melhor até hoje.
   */
  bestId: string;
  /** Posição dessa melhor partida no ranking. */
  rank: number;
  /** Quantos jogadores há no ranking (nomes distintos, não partidas). */
  total: number;
}

export interface LeaderboardEntry {
  id: string;
  rank: number;
  name: string;
  score: number;
  durationMs: number;
  country: string | null;
  createdAt: number;
  /** Quantas partidas este nome jogou. 1 quando esta é a única. */
  attempts: number;
}

export interface LeaderboardPage {
  entries: LeaderboardEntry[];
  /** Total de jogadores, para saber quanto falta carregar. */
  total: number;
}

/** Uma das partidas de um mesmo nome, mostrada ao expandir a linha. */
export interface PlayerAttempt {
  id: string;
  score: number;
  durationMs: number;
  createdAt: number;
}
