const KEY = 'mundo:player-id';

/**
 * Identidade anônima do aparelho. É ela que agrupa as partidas no ranking —
 * o nome é só o rótulo visível. Assim ninguém toma a sua linha digitando o
 * seu nome, e não há nada para a pessoa criar ou lembrar.
 *
 * O preço: aparelho novo é jogador novo. É a troca que evita cadastro.
 */
function create(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function getPlayerId(): string {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && /^[0-9a-f]{32}$/.test(saved)) return saved;
    const fresh = create();
    localStorage.setItem(KEY, fresh);
    return fresh;
  } catch {
    // Sem localStorage (janela anônima), a identidade dura só esta sessão.
    return create();
  }
}
