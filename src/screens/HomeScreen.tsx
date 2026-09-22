import { useState, type FormEvent } from 'react';
import { Screen } from '../components/Chrome';

export function HomeScreen({
  name,
  onNameChange,
  onStart,
  onLeaderboard,
}: {
  name: string;
  onNameChange: (name: string) => void;
  onStart: () => void;
  onLeaderboard: () => void;
}) {
  const [touched, setTouched] = useState(false);
  const trimmed = name.trim();
  const invalid = touched && trimmed.length === 0;

  function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (trimmed.length > 0) onStart();
  }

  return (
    <Screen className="screen--home">
      <h1 className="logo">Mundo</h1>
      <p className="tagline">
        Quinze bandeiras. Acerte o país, depois a capital,
        <br />e mostre no mapa onde ela fica.
      </p>

      <form className="home__form" onSubmit={submit}>
        <label htmlFor="player-name">Seu nome</label>
        <input
          id="player-name"
          name="name"
          value={name}
          onChange={(e) => onNameChange(e.target.value.slice(0, 20))}
          onBlur={() => setTouched(true)}
          placeholder="Como quer aparecer no ranking?"
          maxLength={20}
          autoComplete="nickname"
          aria-invalid={invalid}
          aria-describedby={invalid ? 'name-error' : undefined}
        />
        {invalid && (
          <p className="home__error" id="name-error">
            Digite um nome para começar.
          </p>
        )}
        <button type="submit" className="btn btn--primary">Jogar</button>
      </form>

      <button type="button" className="btn btn--ghost" onClick={onLeaderboard}>
        Ver o ranking
      </button>

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
