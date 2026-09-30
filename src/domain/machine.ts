import type { Country, LngLat, Option, RoundResult, RoundStage } from './types';
import { rngFromSeed } from './rng';
import { buildCapitalOptions, buildFlagOptions, pickCountries } from './sampling';
import { haversineKm } from './geo';
import { CAPITAL_POINTS, FLAG_POINTS, ROUND_TIME_MS, ROUNDS_PER_GAME, pinPoints } from './scoring';

/**
 * Em que etapa a rodada pode se perder.
 *
 * Inclui `pin` desde o cronômetro: um palpite no mapa não pode ser *errado*,
 * porque vale de 0 a 100, mas pode nunca acontecer se o tempo acabar antes.
 */
export type FailableStage = RoundStage;

export type Screen = 'home' | 'playing' | 'gameover';
export type Phase = RoundStage | 'reveal' | 'failed';
export type SubmitState =
  | 'idle'
  /** Esperando a pessoa confirmar ou escolher um nome. */
  | 'needsName'
  /** O nome digitado já é de outra pessoa. */
  | 'nameTaken'
  | 'pending'
  | 'ok'
  | 'error'
  | 'offline'
  /** Escolheu não entrar no ranking. */
  | 'skipped';

export interface PlayingState {
  screen: 'playing';
  name: string;
  seed: string;
  countries: Country[];
  index: number;
  phase: Phase;
  /**
   * Quando o relógio desta rodada começou a correr. É a hora em que a bandeira
   * apareceu, não a do início da partida: o orçamento de 20 s é por rodada.
   */
  roundStartedAt: number;
  /**
   * Quanto a rodada consumiu do relógio, preenchido no instante em que ela
   * fecha. `null` enquanto ela segue viva.
   */
  roundMs: number | null;
  /** A rodada em curso fechou por tempo esgotado. */
  timedOut: boolean;
  flagOptions: Option[];
  capitalOptions: Option[];
  /** Escolha da pessoa, para destacar o botão errado na tela. */
  chosen: string | null;
  /** Em que etapa a rodada foi perdida; `null` enquanto ela segue viva. */
  failedAt: FailableStage | null;
  pin: LngLat | null;
  distanceKm: number | null;
  roundPoints: number;
  total: number;
  results: RoundResult[];
}

export interface GameOverState {
  screen: 'gameover';
  name: string;
  seed: string;
  total: number;
  durationMs: number;
  results: RoundResult[];
  submit: SubmitState;
  /** Posição da melhor partida deste nome; `null` enquanto não subiu. */
  rank: number | null;
  /** Quantos jogadores há no ranking. Não confundir com `total`, que é a pontuação. */
  playersInRanking: number | null;
  /** A linha a destacar no ranking — pode ser de uma partida anterior. */
  highlightId: string | null;
  /** A jogada de agora virou a melhor deste nome? */
  personalBest: boolean;
}

export type GameState =
  | { screen: 'home'; name: string }
  | PlayingState
  | GameOverState;

export type Event =
  | { type: 'SET_NAME'; name: string }
  | { type: 'START'; seed: string; now: number; pool: readonly Country[] }
  | { type: 'ANSWER_FLAG'; value: string; now: number }
  | { type: 'ANSWER_CAPITAL'; value: string; now: number }
  | { type: 'DROP_PIN'; at: LngLat }
  | { type: 'CONFIRM_PIN'; now: number }
  /** O relógio da rodada chegou a zero. */
  | { type: 'TIMEOUT' }
  | { type: 'NEXT'; now: number }
  | { type: 'SUBMIT_START'; name: string }
  | { type: 'SUBMIT_STATE'; state: SubmitState }
  | {
      type: 'SUBMIT_DONE';
      state: SubmitState;
      rank: number | null;
      playersInRanking: number | null;
      highlightId: string | null;
      personalBest: boolean;
    }
  | { type: 'PLAY_AGAIN' };

export const initialState = (name = ''): GameState => ({ screen: 'home', name });

function currentCountry(s: PlayingState): Country {
  return s.countries[s.index]!;
}

/** Monta as alternativas da rodada `index` a partir da semente da partida. */
function optionsForRound(seed: string, index: number, country: Country, pool: readonly Country[]) {
  const rng = rngFromSeed(`${seed}:${index}`);
  return {
    flagOptions: buildFlagOptions(country, pool, rng),
    capitalOptions: buildCapitalOptions(country, pool, rng),
  };
}

/** Fecha a rodada atual e avança — para a próxima bandeira ou para o fim do jogo. */
function advance(s: PlayingState, result: RoundResult, now: number, pool: readonly Country[]): GameState {
  const results = [...s.results, result];
  const total = s.total + result.points;

  if (s.index + 1 >= ROUNDS_PER_GAME) {
    return {
      screen: 'gameover',
      name: s.name,
      seed: s.seed,
      total,
      // a soma dos relógios, não o tempo de parede: ler a revelação com calma
      // não pode custar posição no ranking
      durationMs: results.reduce((acc, r) => acc + r.ms, 0),
      results,
      submit: 'idle',
      rank: null,
      playersInRanking: null,
      highlightId: null,
      personalBest: false,
    };
  }

  const index = s.index + 1;
  const country = s.countries[index]!;
  return {
    ...s,
    index,
    phase: 'flag',
    // o relógio da rodada nova começa agora, quando a bandeira aparece
    roundStartedAt: now,
    roundMs: null,
    timedOut: false,
    ...optionsForRound(s.seed, index, country, pool),
    chosen: null,
    failedAt: null,
    pin: null,
    distanceKm: null,
    roundPoints: 0,
    total,
    results,
  };
}

function closeRound(s: PlayingState): RoundResult {
  return {
    cca3: currentCountry(s).cca3,
    reached: s.failedAt ?? 'done',
    flagCorrect: s.failedAt !== 'flag',
    // perder no pino por tempo não desfaz a capital que já tinha sido acertada
    capitalCorrect: s.failedAt !== 'flag' && s.failedAt !== 'capital',
    guess: s.pin,
    distanceKm: s.distanceKm,
    points: s.roundPoints,
    // `roundMs` é preenchido por quem fecha a rodada; o fallback é defensivo
    ms: s.roundMs ?? ROUND_TIME_MS,
    timedOut: s.timedOut,
  };
}

/** Quanto do relógio a rodada gastou, sem passar do orçamento. */
const spent = (s: PlayingState, now: number) =>
  Math.min(Math.max(0, now - s.roundStartedAt), ROUND_TIME_MS);

/**
 * Pontua o pino e vai para a revelação. Serve aos dois caminhos que fecham a
 * rodada com um palpite no mapa: confirmar e o tempo acabar com o pino posto.
 */
function scorePin(s: PlayingState, pin: LngLat, roundMs: number, timedOut: boolean): PlayingState {
  const country = currentCountry(s);
  const distanceKm = haversineKm(pin, [country.capitalLng, country.capitalLat]);
  return {
    ...s,
    phase: 'reveal',
    distanceKm,
    roundPoints: s.roundPoints + pinPoints(distanceKm),
    roundMs,
    timedOut,
  };
}

export function reducer(state: GameState, event: Event, pool: readonly Country[]): GameState {
  switch (event.type) {
    case 'SET_NAME':
      return state.screen === 'home' ? { ...state, name: event.name } : state;

    case 'START': {
      if (state.screen !== 'home' && state.screen !== 'gameover') return state;
      const name = state.name;
      const countries = pickCountries(pool, rngFromSeed(event.seed));
      const first = countries[0]!;
      return {
        screen: 'playing',
        name,
        seed: event.seed,
        countries,
        index: 0,
        phase: 'flag',
        roundStartedAt: event.now,
        roundMs: null,
        timedOut: false,
        ...optionsForRound(event.seed, 0, first, pool),
        chosen: null,
        failedAt: null,
        pin: null,
        distanceKm: null,
        roundPoints: 0,
        total: 0,
        results: [],
      };
    }

    case 'ANSWER_FLAG': {
      if (state.screen !== 'playing' || state.phase !== 'flag') return state;
      const correct = currentCountry(state).cca3 === event.value;
      // acertar não fecha a rodada: o relógio segue correndo para a capital
      return correct
        ? { ...state, phase: 'capital', chosen: event.value, roundPoints: state.roundPoints + FLAG_POINTS }
        : {
            ...state,
            phase: 'failed',
            failedAt: 'flag',
            chosen: event.value,
            roundMs: spent(state, event.now),
          };
    }

    case 'ANSWER_CAPITAL': {
      if (state.screen !== 'playing' || state.phase !== 'capital') return state;
      const correct = currentCountry(state).capital === event.value;
      return correct
        ? { ...state, phase: 'pin', chosen: null, roundPoints: state.roundPoints + CAPITAL_POINTS }
        : {
            ...state,
            phase: 'failed',
            failedAt: 'capital',
            chosen: event.value,
            roundMs: spent(state, event.now),
          };
    }

    case 'DROP_PIN':
      if (state.screen !== 'playing' || state.phase !== 'pin') return state;
      return { ...state, pin: event.at };

    case 'CONFIRM_PIN': {
      if (state.screen !== 'playing' || state.phase !== 'pin' || !state.pin) return state;
      return scorePin(state, state.pin, spent(state, event.now), false);
    }

    /**
     * O tempo acabou. A rodada fecha onde estava, guardando o que já rendeu:
     * nada se foi na bandeira, os 10 da bandeira se foi na capital.
     *
     * A exceção é o pino já posto no mapa: ele conta. Quem marcou o palpite
     * fez a sua parte, e tirá-lo por causa do relógio puniria quem agiu.
     */
    case 'TIMEOUT': {
      if (state.screen !== 'playing') return state;
      if (state.phase !== 'flag' && state.phase !== 'capital' && state.phase !== 'pin') return state;

      if (state.phase === 'pin' && state.pin) return scorePin(state, state.pin, ROUND_TIME_MS, true);

      return {
        ...state,
        phase: 'failed',
        failedAt: state.phase,
        // ninguém escolheu nada: não há botão a destacar como erro da pessoa
        chosen: null,
        roundMs: ROUND_TIME_MS,
        timedOut: true,
      };
    }

    case 'NEXT': {
      if (state.screen !== 'playing') return state;
      if (state.phase !== 'failed' && state.phase !== 'reveal') return state;
      return advance(state, closeRound(state), event.now, pool);
    }

    case 'SUBMIT_START':
      return state.screen === 'gameover' ? { ...state, submit: 'pending', name: event.name } : state;

    case 'SUBMIT_STATE':
      return state.screen === 'gameover' ? { ...state, submit: event.state } : state;

    case 'SUBMIT_DONE':
      return state.screen === 'gameover'
        ? {
            ...state,
            submit: event.state,
            rank: event.rank,
            playersInRanking: event.playersInRanking,
            highlightId: event.highlightId,
            personalBest: event.personalBest,
          }
        : state;

    case 'PLAY_AGAIN':
      return state.screen === 'gameover' ? { screen: 'home', name: state.name } : state;

    default:
      return state;
  }
}
