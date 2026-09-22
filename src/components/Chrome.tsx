import type { ReactNode } from 'react';
import { ROUNDS_PER_GAME } from '../domain/scoring';

export function ScoreBar({
  round,
  total,
  sound,
  onToggleSound,
}: {
  round: number;
  total: number;
  sound: boolean;
  onToggleSound: () => void;
}) {
  return (
    <header className="bar">
      <span className="bar__round">
        Rodada <strong>{round + 1}</strong>/{ROUNDS_PER_GAME}
      </span>
      <span className="bar__score" aria-live="polite">
        <strong>{total}</strong> pts
      </span>
      <button
        type="button"
        className="bar__mute"
        onClick={onToggleSound}
        aria-pressed={!sound}
        aria-label={sound ? 'Desligar o som' : 'Ligar o som'}
        title={sound ? 'Desligar o som' : 'Ligar o som'}
      >
        {sound ? '🔊' : '🔇'}
      </button>
    </header>
  );
}

export function Pips({ results }: { results: { points: number; flagCorrect: boolean }[] }) {
  return (
    <ol className="pips" aria-label="Progresso das rodadas">
      {Array.from({ length: ROUNDS_PER_GAME }, (_, i) => {
        const r = results[i];
        const state = !r ? 'todo' : r.points === 0 ? 'miss' : r.points >= 100 ? 'great' : 'ok';
        return <li key={i} className={`pips__dot pips__dot--${state}`} />;
      })}
    </ol>
  );
}

export function Screen({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <main className={`screen ${className}`}>{children}</main>;
}
