import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Duas rotas, com a History API pura — não vale puxar um router de 10 KB
 * para isso. O Worker já devolve o index.html para qualquer caminho fora de
 * /api (`not_found_handling: single-page-application`), então abrir
 * /ranking direto funciona.
 */
export type Route = 'jogo' | 'ranking';

export const RANKING_PATH = '/ranking';

/** Marca as entradas de histórico que este app criou. */
const MARKER = { mundo: true };

function currentRoute(): Route {
  return typeof location !== 'undefined' && location.pathname === RANKING_PATH ? 'ranking' : 'jogo';
}

export function useRoute() {
  const [route, setRoute] = useState<Route>(currentRoute);
  /** Quantas entradas nós empilhamos — só podemos voltar pelas nossas. */
  const pushed = useRef(0);

  // O botão Voltar do navegador precisa voltar uma tela, não sair do jogo.
  useEffect(() => {
    const onPop = () => {
      pushed.current = Math.max(0, pushed.current - 1);
      setRoute(currentRoute());
    };
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((next: Route) => {
    const path = next === 'ranking' ? RANKING_PATH : '/';
    if (location.pathname !== path) {
      history.pushState(MARKER, '', path);
      pushed.current += 1;
    }
    setRoute(next);
  }, []);

  /**
   * Volta uma tela. Usa o histórico quando fomos nós que empilhamos, para o
   * botão do navegador não acumular entradas; quando a pessoa chegou direto
   * em /ranking por um link, troca a URL no lugar em vez de sair do site.
   */
  const back = useCallback(() => {
    if (pushed.current > 0) {
      history.back();
    } else {
      history.replaceState(MARKER, '', '/');
      setRoute('jogo');
    }
  }, []);

  return { route, navigate, back };
}
