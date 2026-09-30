import type { Country } from '../domain/types';
import type { FailableStage } from '../domain/machine';
import { flagUrl } from '../data/countries';
import { formatKm } from '../domain/geo';
import { pinFeedback } from '../domain/scoring';

/**
 * Cartão mostrado quando a rodada se perde: ensina a resposta antes de seguir.
 *
 * Perder por tempo e errar a resposta levam ao mesmo cartão, mas não à mesma
 * frase — "a bandeira era de…" depois de a pessoa não ter escolhido nada soa
 * como se ela tivesse errado. E dá para perder no pino agora, o que antes do
 * cronômetro era impossível.
 */
export function FailedCard({
  country,
  failedAt,
  timedOut,
  onNext,
}: {
  country: Country;
  failedAt: FailableStage;
  timedOut: boolean;
  onNext: () => void;
}) {
  const resposta = failedAt === 'flag' ? country.name : country.capital;
  const oQueFaltou =
    failedAt === 'flag' ? 'A bandeira era de…' : failedAt === 'capital' ? 'A capital é…' : '';
  const rotulo = [timedOut ? 'Tempo esgotado.' : '', oQueFaltou].filter(Boolean).join(' ');

  return (
    <div className="card card--failed">
      <p className="card__label">{rotulo}</p>
      <img className="flag flag--card" src={flagUrl(country)} alt="" width={200} height={150} />
      <p className="card__answer">{resposta}</p>
      {failedAt !== 'flag' && <p className="card__sub">{country.name}</p>}
      {failedAt === 'pin' && <p className="card__sub">Você não chegou a marcar o mapa.</p>}
      <button type="button" className="btn btn--primary" onClick={onNext} autoFocus>
        Próxima bandeira
      </button>
    </div>
  );
}

/** Resultado do pino, sobreposto ao mapa já reenquadrado. */
export function RevealCard({
  country,
  distanceKm,
  points,
  onNext,
}: {
  country: Country;
  distanceKm: number;
  points: number;
  onNext: () => void;
}) {
  return (
    <div className="card card--reveal">
      <p className="card__label">{pinFeedback(distanceKm)}</p>
      <p className="card__distance">
        Você ficou a <strong>{formatKm(distanceKm)}</strong> de {country.capital}.
      </p>
      <p className="card__points" aria-live="polite">
        +{points} pontos nesta rodada
      </p>
      <button type="button" className="btn btn--primary" onClick={onNext} autoFocus>
        Continuar
      </button>
    </div>
  );
}
