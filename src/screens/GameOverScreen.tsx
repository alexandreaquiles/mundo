import { Screen } from '../components/Chrome';
import { BY_CCA3, flagUrl } from '../data/countries';
import { MAX_GAME_SCORE } from '../domain/scoring';
import { formatKm } from '../domain/geo';
import type { GameOverState } from '../domain/machine';

const SUBMIT_MESSAGE: Record<GameOverState['submit'], string> = {
  idle: '',
  pending: 'Enviando sua pontuação…',
  ok: '',
  error: 'Não consegui enviar ao ranking agora.',
  offline: 'Você está offline — a pontuação sobe assim que a conexão voltar.',
};

export function GameOverScreen({
  state,
  onPlayAgain,
  onLeaderboard,
}: {
  state: GameOverState;
  onPlayAgain: () => void;
  onLeaderboard: () => void;
}) {
  const perfectRounds = state.results.filter((r) => r.points === 120).length;
  const best = state.results
    .map((r) => r.distanceKm)
    .filter((d): d is number => d !== null)
    .sort((a, b) => a - b)[0];

  return (
    <Screen className="screen--over">
      <h2 className="question">Fim de jogo, {state.name}!</h2>
      <p className="final-score">
        <strong>{state.total}</strong>
        <span> de {MAX_GAME_SCORE}</span>
      </p>

      <ul className="stats">
        <li><strong>{state.results.filter((r) => r.flagCorrect).length}</strong>/15 bandeiras</li>
        <li><strong>{state.results.filter((r) => r.capitalCorrect).length}</strong>/15 capitais</li>
        {best !== undefined && <li>melhor pino: <strong>{formatKm(best)}</strong></li>}
        {perfectRounds > 0 && <li><strong>{perfectRounds}</strong> rodada(s) perfeita(s)</li>}
      </ul>

      {state.submit === 'ok' && state.rank !== null && (
        <p className="rank-note" aria-live="polite">
          Você entrou em <strong>{state.rank}º</strong> no ranking global.
        </p>
      )}
      {SUBMIT_MESSAGE[state.submit] && <p className="muted" aria-live="polite">{SUBMIT_MESSAGE[state.submit]}</p>}

      <ol className="breakdown">
        {state.results.map((r, i) => {
          const c = BY_CCA3.get(r.cca3)!;
          return (
            <li key={`${r.cca3}-${i}`} className="breakdown__row">
              <img className="flag flag--tiny" src={flagUrl(c)} alt="" width={28} height={21} />
              <span className="breakdown__name">{c.name}</span>
              <span className="breakdown__capital">{c.capital}</span>
              <span className="breakdown__points">{r.points}</span>
            </li>
          );
        })}
      </ol>

      <div className="actions">
        <button type="button" className="btn btn--primary" onClick={onPlayAgain}>Jogar de novo</button>
        <button type="button" className="btn btn--ghost" onClick={onLeaderboard}>Ver o ranking</button>
      </div>
    </Screen>
  );
}
