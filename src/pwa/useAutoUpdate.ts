import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/** De quanto em quanto tempo perguntar ao servidor se saiu versão nova. */
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Quanto esperar na home antes de recarregar, se a pessoa não sair da aba.
 *
 * Serve para o caso de ela estar prestes a tocar em "Jogar": se tocar dentro
 * desse prazo, `seguro` vira falso, o efeito é desmontado e a atualização
 * espera o fim da partida. Longo demais nunca atualizaria quem só abre o app,
 * joga e fecha.
 */
const ESPERA_NA_HOME_MS = 3_000;

/**
 * Atualiza o app sozinho, sem aviso, mas nunca no meio de uma partida.
 *
 * O service worker continua em modo `prompt` — o novo instala, entra em
 * `waiting` e espera alguém mandar ativar. A diferença é quem manda: era a
 * pessoa, clicando num aviso, e passou a ser este hook. O modo `autoUpdate`
 * do plugin não serve aqui porque recarrega assim que a versão nova chega, o
 * que no meio de uma rodada joga fora a partida inteira.
 *
 * A troca acontece na home, que é a única tela sem nada a perder: no jogo
 * perderia o progresso, e no fim de partida perderia o resumo e a mensagem de
 * compartilhamento antes de a pessoa usá-los.
 *
 * De preferência com a aba escondida, que é quando a recarga é invisível.
 * Se a pessoa ficar parada na home, recarrega assim mesmo depois de alguns
 * segundos — senão quem nunca troca de aba nunca atualizaria.
 *
 * @param seguro a pessoa está num ponto em que recarregar não custa nada
 */
export function useAutoUpdate(seguro: boolean) {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const procurar = () => {
        registration.update().catch(() => {
          /* sem rede agora; tenta de novo no próximo ciclo */
        });
      };
      // O navegador só busca o sw.js sozinho de vez em quando. Procurar ao
      // voltar para a aba faz a versão nova chegar quando a pessoa volta ao
      // jogo, e não horas depois.
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

  useEffect(() => {
    if (!needRefresh) return;
    console.info('[mundo] versão nova disponível');
    if (!seguro) return;

    // `updateServiceWorker(true)` ativa o que estava esperando e recarrega
    const aplicar = () => void updateServiceWorker(true);

    if (document.hidden) {
      aplicar();
      return;
    }

    const aoEsconder = () => {
      if (document.hidden) aplicar();
    };
    document.addEventListener('visibilitychange', aoEsconder);
    const id = window.setTimeout(aplicar, ESPERA_NA_HOME_MS);

    return () => {
      document.removeEventListener('visibilitychange', aoEsconder);
      window.clearTimeout(id);
    };
  }, [needRefresh, seguro, updateServiceWorker]);
}
