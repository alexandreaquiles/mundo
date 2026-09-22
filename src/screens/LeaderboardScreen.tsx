import { useCallback, useEffect, useState } from 'react';
import { Screen } from '../components/Chrome';
import {
  fetchLeaderboard,
  fetchPlayerAttempts,
  type LeaderboardEntry,
  type PlayerAttempt,
} from '../api/client';
import { formatDuration, formatExactDate, formatPlayedAt } from '../domain/format';

const PAGE = 15;
/** Quantos vizinhos mostrar de cada lado da posição da pessoa. */
const NEIGHBOURS = 2;

export interface LeaderboardScreenProps {
  onBack: () => void;
  /** A partida que representa quem acabou de jogar, para destacar. */
  highlightId?: string;
  /** Posição dessa partida, mesmo que ela esteja fora da página carregada. */
  highlightRank?: number;
}

export function LeaderboardScreen({ onBack, highlightId, highlightRank }: LeaderboardScreenProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [neighbours, setNeighbours] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchLeaderboard(PAGE, 0)
      .then((page) => {
        if (cancelled) return;
        setEntries(page.entries);
        setTotal(page.total);
      })
      .catch((err: Error) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // Quando a pontuação da pessoa ficou fora da primeira página, busca a
  // vizinhança dela. Sem isso, quem está em 137º não vê nada de si.
  useEffect(() => {
    if (!highlightRank || highlightRank <= PAGE) return;
    let cancelled = false;
    const offset = Math.max(0, highlightRank - 1 - NEIGHBOURS);
    fetchLeaderboard(NEIGHBOURS * 2 + 1, offset)
      .then((page) => !cancelled && setNeighbours(page.entries))
      .catch(() => {
        /* a lista principal já apareceu; sem vizinhos o ranking ainda serve */
      });
    return () => {
      cancelled = true;
    };
  }, [highlightRank]);

  const loadMore = useCallback(() => {
    setLoadingMore(true);
    fetchLeaderboard(PAGE, entries.length)
      .then((page) => {
        setEntries((current) => [...current, ...page.entries]);
        setTotal(page.total);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoadingMore(false));
  }, [entries.length]);

  const shownRanks = new Set(entries.map((e) => e.rank));
  const showNeighbours = neighbours.length > 0 && !shownRanks.has(highlightRank ?? -1);
  const remaining = total - entries.length;

  return (
    <Screen className="screen--leaderboard">
      <h2 className="question">Ranking global</h2>
      {total > 0 && (
        <p className="muted ranking__count">
          {entries.length} de {total} {total === 1 ? 'jogador' : 'jogadores'}
        </p>
      )}

      {loading && <p className="muted">Carregando…</p>}
      {error && !loading && <p className="muted">Sem conexão com o ranking agora. {error}</p>}
      {!loading && !error && entries.length === 0 && (
        <p className="muted">Ninguém pontuou ainda. Seja a primeira pessoa.</p>
      )}

      {entries.length > 0 && (
        <ol className="ranking">
          {entries.map((e) => (
            <Row key={e.id} entry={e} highlighted={e.id === highlightId} />
          ))}
        </ol>
      )}

      {remaining > 0 && (
        <button type="button" className="btn btn--ghost" onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? 'Carregando…' : `Mostrar mais ${Math.min(PAGE, remaining)}`}
        </button>
      )}

      {showNeighbours && (
        <section className="ranking__window">
          <h3 className="ranking__window-title">Sua posição</h3>
          <ol className="ranking">
            {neighbours.map((e) => (
              <Row key={e.id} entry={e} highlighted={e.id === highlightId} />
            ))}
          </ol>
        </section>
      )}

      <button type="button" className="btn btn--ghost" onClick={onBack}>Voltar</button>
    </Screen>
  );
}

function Row({ entry, highlighted }: { entry: LeaderboardEntry; highlighted: boolean }) {
  const [attempts, setAttempts] = useState<PlayerAttempt[] | null>(null);
  const [open, setOpen] = useState(false);
  const expandable = entry.attempts > 1;

  const toggle = () => {
    if (!expandable) return;
    setOpen((was) => !was);
    if (!attempts) {
      fetchPlayerAttempts(entry.name)
        .then(setAttempts)
        .catch(() => setAttempts([]));
    }
  };

  return (
    <li className={`ranking__row${highlighted ? ' ranking__row--me' : ''}`}>
      <div className="ranking__main">
        <span className="ranking__pos">{entry.rank}</span>
        <span className="ranking__player">
          <span className="ranking__name">{entry.name}</span>
          <span className="ranking__meta">
            {/* o texto visível é relativo; o dateTime e o title guardam o instante exato */}
            <time dateTime={new Date(entry.createdAt).toISOString()} title={formatExactDate(entry.createdAt)}>
              {formatPlayedAt(entry.createdAt)}
            </time>
            {' · em '}
            {formatDuration(entry.durationMs)}
          </span>
        </span>
        <span className="ranking__score">{entry.score}</span>
      </div>

      {expandable && (
        <button type="button" className="ranking__more" onClick={toggle} aria-expanded={open}>
          {open ? 'ocultar' : `${entry.attempts} partidas`}
        </button>
      )}

      {open && (
        <ol className="attempts">
          {attempts === null && <li className="attempts__row muted">carregando…</li>}
          {attempts?.map((a) => (
            <li key={a.id} className={`attempts__row${a.id === entry.id ? ' attempts__row--best' : ''}`}>
              <span>{formatPlayedAt(a.createdAt)}</span>
              <span className="attempts__duration">em {formatDuration(a.durationMs)}</span>
              <span className="attempts__score">{a.score}</span>
            </li>
          ))}
        </ol>
      )}
    </li>
  );
}
