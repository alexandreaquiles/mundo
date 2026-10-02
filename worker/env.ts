/// <reference types="@cloudflare/workers-types" />

/** Bindings do Worker. Fica separado porque só este arquivo depende dos
 *  tipos do runtime da Cloudflare — o resto do Worker é testável em Node. */
export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  APP_VERSION: string;
  /**
   * Sal secreto do hash de IP (`npx wrangler secret put IP_SALT`).
   *
   * Opcional para o Worker não quebrar sem ele, mas sem o sal o hash guardado
   * em `scores.ip_hash` é reversível por força bruta — são só 2³² endereços.
   */
  IP_SALT?: string;
  /** Opcional: binding de rate limiting da Cloudflare. */
  SUBMIT_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
}
