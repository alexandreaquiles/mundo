/// <reference types="@cloudflare/workers-types" />

/** Bindings do Worker. Fica separado porque só este arquivo depende dos
 *  tipos do runtime da Cloudflare — o resto do Worker é testável em Node. */
export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  APP_VERSION: string;
  /** Opcional: binding de rate limiting da Cloudflare. */
  SUBMIT_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
}
