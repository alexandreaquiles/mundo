import { useState, type FormEvent } from 'react';
import { Screen } from '../components/Chrome';
import { BY_CCA3, flagUrl } from '../data/countries';
import { MAX_GAME_SCORE } from '../domain/scoring';
import { formatKm } from '../domain/geo';
import { NAME_MAX } from '../domain/limits';
import type { GameOverState } from '../domain/machine';

export interface GameOverScreenProps {
  state: GameOverState;
  /** Nome sugerido para quem ainda não tem um. */
  suggestedName: string;
  onSubmitName: (name: string) => void;
  onSkip: () => void;
  onShare: () => void;
  shareState: 'idle' | 'copiado' | 'erro';
  onPlayAgain: () => void;
  onLeaderboard: () => void;
}

const MENSAGEM: Partial<Record<GameOverState['submit'], string>> = {
  pending: 'Enviando sua pontuação…',
  error: 'Não consegui enviar ao ranking agora.',
  offline: 'Você está offline — a pontuação sobe assim que a conexão voltar.',
  skipped: 'Esta partida ficou fora do ranking.',
};

export function GameOverScreen({
  state,
  suggestedName,
  onSubmitName,
  onSkip,
  onShare,
  shareState,
  onPlayAgain,
  onLeaderboard,
}: GameOverScreenProps) {
  const perfectRounds = state.results.filter((r) => r.points === 120).length;
  const best = state.results
    .map((r) => r.distanceKm)
    .filter((d): d is number => d !== null)
    .sort((a, b) => a - b)[0];

  const pedindoNome = state.submit === 'needsName' || state.submit === 'nameTaken';

  return (
    <Screen className="screen--over">
      <h2 className="question">Fim de jogo{state.name ? `, ${state.name}` : ''}!</h2>
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

      <div className="actions">
        <button type="button" className="btn btn--primary" onClick={onShare}>
          {shareState === 'copiado' ? 'Copiado!' : shareState === 'erro' ? 'Não consegui copiar' : 'Compartilhar'}
        </button>
      </div>

      {pedindoNome && (
        <NameForm
          suggestedName={suggestedName}
          taken={state.submit === 'nameTaken'}
          onSubmit={onSubmitName}
          onSkip={onSkip}
        />
      )}

      {state.submit === 'ok' && state.rank !== null && (
        <p className="rank-note" aria-live="polite">
          {state.personalBest ? (
            <>
              Você está em <strong>{state.rank}º</strong>
              {state.playersInRanking !== null && <> de {state.playersInRanking}</>} no ranking global.
            </>
          ) : (
            <>
              Sua melhor partida segue em <strong>{state.rank}º</strong>
              {state.playersInRanking !== null && <> de {state.playersInRanking}</>} — desta vez você fez menos pontos.
            </>
          )}
        </p>
      )}
      {MENSAGEM[state.submit] && <p className="muted" aria-live="polite">{MENSAGEM[state.submit]}</p>}

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

function NameForm({
  suggestedName,
  taken,
  onSubmit,
  onSkip,
}: {
  suggestedName: string;
  taken: boolean;
  onSubmit: (name: string) => void;
  onSkip: () => void;
}) {
  const [name, setName] = useState(suggestedName);

  function submit(e: FormEvent) {
    e.preventDefault();
    const limpo = name.trim();
    if (limpo) onSubmit(limpo);
  }

  return (
    <form className="name-form" onSubmit={submit}>
      <label htmlFor="player-name">Entrar no ranking como</label>
      <input
        id="player-name"
        name="name"
        value={name}
        onChange={(e) => setName(e.target.value.slice(0, NAME_MAX))}
        maxLength={NAME_MAX}
        autoComplete="nickname"
        aria-invalid={taken}
        aria-describedby={taken ? 'name-error' : undefined}
      />
      {taken && (
        <p className="home__error" id="name-error">
          Esse nome já é de outra pessoa. Escolha outro.
        </p>
      )}
      <div className="actions">
        <button type="submit" className="btn btn--primary" disabled={!name.trim()}>
          Entrar no ranking
        </button>
        <button type="button" className="btn btn--ghost" onClick={onSkip}>Agora não</button>
      </div>
    </form>
  );
}
