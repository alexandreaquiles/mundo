import type { Country } from '../domain/types';
import { flagUrl } from '../data/countries';
import { formatKm } from '../domain/geo';
import { pinFeedback } from '../domain/scoring';

/** Cartão mostrado quando a pessoa erra: ensina a resposta antes de seguir. */
export function FailedCard({
  country,
  failedAt,
  onNext,
}: {
  country: Country;
  failedAt: 'flag' | 'capital';
  onNext: () => void;
}) {
  return (
    <div className="card card--failed">
      <p className="card__label">{failedAt === 'flag' ? 'A bandeira era de…' : 'A capital é…'}</p>
      <img className="flag flag--card" src={flagUrl(country)} alt="" width={200} height={150} />
      <p className="card__answer">{failedAt === 'flag' ? country.name : country.capital}</p>
      {failedAt === 'capital' && <p className="card__sub">{country.name}</p>}
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
