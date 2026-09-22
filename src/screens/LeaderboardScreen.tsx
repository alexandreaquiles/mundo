import { useEffect, useState } from 'react';
import { Screen } from '../components/Chrome';
import { fetchLeaderboard, type LeaderboardEntry } from '../api/client';

export function LeaderboardScreen({ onBack, highlight }: { onBack: () => void; highlight?: string }) {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchLeaderboard(50)
      .then((e) => !cancelled && setEntries(e))
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Screen className="screen--leaderboard">
      <h2 className="question">Ranking global</h2>

      {!entries && !error && <p className="muted">Carregando…</p>}
      {error && <p className="muted">Sem conexão com o ranking agora. {error}</p>}
      {entries?.length === 0 && <p className="muted">Ninguém pontuou ainda. Seja a primeira pessoa.</p>}

      {entries && entries.length > 0 && (
        <ol className="ranking">
          {entries.map((e) => (
            <li
              key={`${e.rank}-${e.name}-${e.createdAt}`}
              className={highlight && e.name === highlight ? 'ranking__row ranking__row--me' : 'ranking__row'}
            >
              <span className="ranking__pos">{e.rank}</span>
              <span className="ranking__name">{e.name}</span>
              <span className="ranking__score">{e.score}</span>
            </li>
          ))}
        </ol>
      )}

      <button type="button" className="btn btn--ghost" onClick={onBack}>Voltar</button>
    </Screen>
  );
}
