import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/** De quanto em quanto tempo perguntar ao servidor se saiu versão nova. */
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Aviso de versão nova.
 *
 * Sem isto o app fica preso na versão antiga para sempre: o service worker
 * novo instala, entra em `waiting` e só assume quando alguém manda — e esse
 * alguém é este componente. É o modo `prompt`, escolhido para a atualização
 * não acontecer no meio de uma partida; o preço é precisar avisar.
 */
export function ReloadPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
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

  // Recarregar no meio de uma partida perderia o progresso, então o aviso
  // fica visível e espera; quem decide é a pessoa.
  useEffect(() => {
    if (needRefresh) console.info('[mundo] versão nova disponível');
  }, [needRefresh]);

  if (!needRefresh) return null;

  return (
    <div className="update" role="status" aria-live="polite">
      <span className="update__text">Saiu uma versão nova do Mundo.</span>
      <button type="button" className="update__go" onClick={() => void updateServiceWorker(true)}>
        Atualizar
      </button>
      <button
        type="button"
        className="update__later"
        onClick={() => setNeedRefresh(false)}
        aria-label="Agora não"
      >
        ✕
      </button>
    </div>
  );
}
