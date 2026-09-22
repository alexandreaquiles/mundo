export type { LeaderboardEntry, ScoreSubmission, SubmitResponse } from '../src/api/types';

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  APP_VERSION: string;
  /** Opcional: binding de rate limiting da Cloudflare. */
  SUBMIT_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
}
