import type { Country, Option } from '../domain/types';
import { flagUrl } from '../data/countries';

export function OptionList({
  options,
  chosen,
  disabled,
  onPick,
}: {
  options: Option[];
  chosen: string | null;
  disabled: boolean;
  onPick: (value: string) => void;
}) {
  return (
    <ul className="options">
      {options.map((o) => {
        const revealed = chosen !== null;
        const state = !revealed ? '' : o.correct ? ' option--correct' : o.value === chosen ? ' option--wrong' : '';
        return (
          <li key={o.value}>
            <button
              type="button"
              className={`option${state}`}
              onClick={() => onPick(o.value)}
              disabled={disabled}
            >
              {o.label}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function FlagQuestion({
  country,
  options,
  chosen,
  onPick,
}: {
  country: Country;
  options: Option[];
  chosen: string | null;
  onPick: (value: string) => void;
}) {
  return (
    <>
      <h2 className="question">De que país é esta bandeira?</h2>
      <img className="flag" src={flagUrl(country)} alt="" width={320} height={240} />
      <OptionList options={options} chosen={chosen} disabled={chosen !== null} onPick={onPick} />
    </>
  );
}

export function CapitalQuestion({
  country,
  options,
  chosen,
  onPick,
}: {
  country: Country;
  options: Option[];
  chosen: string | null;
  onPick: (value: string) => void;
}) {
  return (
    <>
      <h2 className="question">
        Qual é a capital <span className="question__country">
          <img className="flag flag--inline" src={flagUrl(country)} alt="" width={36} height={27} />
          {country.name}
        </span>?
      </h2>
      <OptionList options={options} chosen={chosen} disabled={chosen !== null} onPick={onPick} />
    </>
  );
}
