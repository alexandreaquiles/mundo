import type { Env } from './types';
import { getTop, postScore } from './routes/scores';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

/**
 * O SPA e a API vivem na mesma origem, então não há CORS a liberar —
 * pelo contrário, requisições de outra origem são recusadas.
 */
function crossOrigin(request: Request): boolean {
  const origin = request.headers.get('Origin');
  if (!origin) return false;
  try {
    return new URL(origin).host !== new URL(request.url).host;
  } catch {
    return true;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (!url.pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request);
    }

    if (crossOrigin(request)) return json({ error: 'Origem não permitida.' }, 403);

    if (url.pathname === '/api/health') {
      return json({ ok: true, version: env.APP_VERSION });
    }

    if (url.pathname === '/api/scores' && request.method === 'POST') {
      return postScore(request, env);
    }

    if (url.pathname === '/api/scores/top' && request.method === 'GET') {
      return getTop(request, env);
    }

    return json({ error: 'Rota não encontrada.' }, 404);
  },
} satisfies ExportedHandler<Env>;
