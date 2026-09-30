import { useRegisterSW } from 'virtual:pwa-register/react';

/** De quanto em quanto tempo perguntar ao servidor se saiu versão nova. */
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Registra o service worker e fica procurando versão nova.
 *
 * O modo é `autoUpdate` (ver `vite.config.ts`): a versão nova assume assim que
 * chega e a página recarrega sozinha, sem aviso e sem perguntar. Se isso pegar
 * alguém no meio de uma partida, a partida se perde — decisão tomada de olhos
 * abertos, por ser preferível a ter gente presa numa versão antiga que o Worker
 * nem aceita mais no ranking.
 *
 * O que sobra aqui é só a procura: o navegador busca o `sw.js` sozinho de vez
 * em quando, e de vez em quando é tarde demais.
 */
export function useAutoUpdate() {
  useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const procurar = () => {
        registration.update().catch(() => {
          /* sem rede agora; tenta de novo no próximo ciclo */
        });
      };
      // Procurar ao voltar para a aba faz a versão nova chegar quando a pessoa
      // volta ao jogo, e não horas depois.
      const id = setInterval(procurar, CHECK_INTERVAL_MS);
      const aoVoltar = () => {
        if (!document.hidden) procurar();
      };
      document.addEventListener('visibilitychange', aoVoltar);
      return () => {
        clearInterval(id);
        document.removeEventListener('visibilitychange', aoVoltar);
      };
    },
  });
}
