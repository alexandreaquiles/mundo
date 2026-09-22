import { Screen } from '../components/Chrome';

/**
 * Sem formulário: o jogo começa num toque. O nome é pedido no fim, quando já
 * existe uma pontuação para guardar — pedir antes é cobrar cadastro por nada.
 */
export function HomeScreen({
  playerName,
  onStart,
  onLeaderboard,
}: {
  /** Nome usado da última vez, se houver. */
  playerName: string;
  onStart: () => void;
  onLeaderboard: () => void;
}) {
  return (
    <Screen className="screen--home">
      <h1 className="logo">Mundo</h1>
      <p className="tagline">
        Quinze bandeiras. Acerte o país, depois a capital,
        <br />e mostre no mapa onde ela fica.
      </p>

      <button type="button" className="btn btn--primary" onClick={onStart}>Jogar</button>
      <button type="button" className="btn btn--ghost" onClick={onLeaderboard}>Ver o ranking</button>

      {playerName && <p className="muted">jogando como <strong>{playerName}</strong></p>}

      <details className="howto">
        <summary>Como funciona a pontuação</summary>
        <ul>
          <li><strong>10 pontos</strong> por acertar o país da bandeira.</li>
          <li><strong>+10 pontos</strong> por acertar a capital.</li>
          <li><strong>até 100 pontos</strong> pelo pino: 100 se cravar a menos de 25 km, caindo até zero aos 5.000 km.</li>
          <li>Errar encerra a rodada — a próxima bandeira aparece na hora.</li>
          <li>Partida perfeita: <strong>1800 pontos</strong>.</li>
        </ul>
      </details>
    </Screen>
  );
}
