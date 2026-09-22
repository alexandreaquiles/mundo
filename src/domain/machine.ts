import type { Country, LngLat, Option, RoundResult, RoundStage } from './types';
import { rngFromSeed } from './rng';
import { buildCapitalOptions, buildFlagOptions, pickCountries } from './sampling';
import { haversineKm } from './geo';
import { CAPITAL_POINTS, FLAG_POINTS, ROUNDS_PER_GAME, pinPoints } from './scoring';

export type Screen = 'home' | 'playing' | 'gameover' | 'leaderboard';
export type Phase = RoundStage | 'reveal' | 'failed';
export type SubmitState = 'idle' | 'pending' | 'ok' | 'error' | 'offline';

export interface PlayingState {
  screen: 'playing';
  name: string;
  seed: string;
  startedAt: number;
  countries: Country[];
  index: number;
  phase: Phase;
  flagOptions: Option[];
  capitalOptions: Option[];
  /** Escolha da pessoa, para destacar o botão errado na tela. */
  chosen: string | null;
  /** Em que etapa a rodada foi perdida; `null` enquanto ela segue viva. */
  failedAt: RoundStage | null;
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
  rank: number | null;
}

export type GameState =
  | { screen: 'home'; name: string }
  | PlayingState
  | GameOverState
  | { screen: 'leaderboard'; from: Exclude<Screen, 'leaderboard'>; previous: GameState };

export type Event =
  | { type: 'SET_NAME'; name: string }
  | { type: 'START'; seed: string; now: number; pool: readonly Country[] }
  | { type: 'ANSWER_FLAG'; value: string }
  | { type: 'ANSWER_CAPITAL'; value: string }
  | { type: 'DROP_PIN'; at: LngLat }
  | { type: 'CONFIRM_PIN' }
  | { type: 'NEXT'; now: number }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_DONE'; state: SubmitState; rank: number | null }
  | { type: 'OPEN_LEADERBOARD' }
  | { type: 'BACK' }
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
      durationMs: now - s.startedAt,
      results,
      submit: 'idle',
      rank: null,
    };
  }

  const index = s.index + 1;
  const country = s.countries[index]!;
  return {
    ...s,
    index,
    phase: 'flag',
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
    capitalCorrect: s.failedAt === null,
    guess: s.pin,
    distanceKm: s.distanceKm,
    points: s.roundPoints,
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
        startedAt: event.now,
        countries,
        index: 0,
        phase: 'flag',
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
      return correct
        ? { ...state, phase: 'capital', chosen: event.value, roundPoints: state.roundPoints + FLAG_POINTS }
        : { ...state, phase: 'failed', failedAt: 'flag', chosen: event.value };
    }

    case 'ANSWER_CAPITAL': {
      if (state.screen !== 'playing' || state.phase !== 'capital') return state;
      const correct = currentCountry(state).capital === event.value;
      return correct
        ? { ...state, phase: 'pin', chosen: null, roundPoints: state.roundPoints + CAPITAL_POINTS }
        : { ...state, phase: 'failed', failedAt: 'capital', chosen: event.value };
    }

    case 'DROP_PIN':
      if (state.screen !== 'playing' || state.phase !== 'pin') return state;
      return { ...state, pin: event.at };

    case 'CONFIRM_PIN': {
      if (state.screen !== 'playing' || state.phase !== 'pin' || !state.pin) return state;
      const country = currentCountry(state);
      const truth: LngLat = [country.capitalLng, country.capitalLat];
      const distanceKm = haversineKm(state.pin, truth);
      return {
        ...state,
        phase: 'reveal',
        distanceKm,
        roundPoints: state.roundPoints + pinPoints(distanceKm),
      };
    }

    case 'NEXT': {
      if (state.screen !== 'playing') return state;
      if (state.phase !== 'failed' && state.phase !== 'reveal') return state;
      return advance(state, closeRound(state), event.now, pool);
    }

    case 'SUBMIT_START':
      return state.screen === 'gameover' ? { ...state, submit: 'pending' } : state;

    case 'SUBMIT_DONE':
      return state.screen === 'gameover' ? { ...state, submit: event.state, rank: event.rank } : state;

    case 'OPEN_LEADERBOARD':
      if (state.screen === 'leaderboard') return state;
      return { screen: 'leaderboard', from: state.screen, previous: state };

    case 'BACK':
      return state.screen === 'leaderboard' ? state.previous : state;

    case 'PLAY_AGAIN':
      return state.screen === 'gameover' ? { screen: 'home', name: state.name } : state;

    default:
      return state;
  }
}
