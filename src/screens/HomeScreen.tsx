import { Screen } from '../components/Chrome';
import { MAX_GAME_SCORE } from '../domain/scoring';
import type { PlayerSummary } from '../api/client';

/**
 * Sem formulário: o jogo começa num toque. O nome é pedido no fim, quando já
 * existe uma pontuação para guardar — pedir antes é cobrar cadastro por nada.
 */
export function HomeScreen({
  summary,
  onStart,
  onLeaderboard,
}: {
  /** Quem já jogou neste aparelho; `null` na primeira visita. */
  summary: PlayerSummary | null;
  onStart: () => void;
  onLeaderboard: () => void;
}) {
  return (
    <Screen className="screen--home">
      <h1 className="logo">Mundo</h1>

      {summary ? (
        <p className="welcome">
          Bem-vindo de volta, <strong>{summary.name}</strong>
        </p>
      ) : (
        <p className="tagline">
          Quinze bandeiras. Acerte o país, depois a capital,
          <br />e mostre no mapa onde ela fica.
        </p>
      )}

      <button type="button" className="btn btn--primary" onClick={onStart}>
        {summary ? 'Jogar de novo' : 'Jogar'}
      </button>

      {summary && (
        <dl className="best">
          <div>
            <dt>Sua melhor</dt>
            <dd>
              <strong>{summary.bestScore}</strong>
              <span> de {MAX_GAME_SCORE}</span>
            </dd>
          </div>
          <div>
            <dt>No ranking</dt>
            <dd>
              <strong>{summary.rank}º</strong>
              <span> de {summary.total}</span>
            </dd>
          </div>
          <div>
            <dt>{summary.games === 1 ? 'Partida' : 'Partidas'}</dt>
            <dd><strong>{summary.games}</strong></dd>
          </div>
        </dl>
      )}

      <button type="button" className="btn btn--ghost" onClick={onLeaderboard}>Ver o ranking</button>

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
