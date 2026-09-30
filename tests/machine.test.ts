import { describe, expect, it } from 'vitest';
import { COUNTRIES } from '../src/data/countries';
import { type Event, type GameState, type PlayingState, initialState, reducer } from '../src/domain/machine';
import { GAME_TIME_MS, MAX_GAME_SCORE, ROUND_TIME_MS, ROUNDS_PER_GAME } from '../src/domain/scoring';
import type { LngLat } from '../src/domain/types';

const run = (state: GameState, ...events: Event[]) =>
  events.reduce((s, e) => reducer(s, e, COUNTRIES), state);

const start = (seed = 'teste') =>
  run(initialState('Ana'), { type: 'START', seed, now: 1_000, pool: COUNTRIES });

const playing = (s: GameState): PlayingState => {
  if (s.screen !== 'playing') throw new Error(`esperava 'playing', veio '${s.screen}'`);
  return s;
};

describe('início da partida', () => {
  it('sorteia 15 países e começa na bandeira', () => {
    const s = playing(start());
    expect(s.countries).toHaveLength(ROUNDS_PER_GAME);
    expect(s.phase).toBe('flag');
    expect(s.total).toBe(0);
    expect(s.flagOptions).toHaveLength(4);
  });

  it('guarda o nome da pessoa', () => {
    const s = run(initialState(), { type: 'SET_NAME', name: 'Ana' });
    expect(s.screen === 'home' && s.name).toBe('Ana');
  });
});

describe('fluxo da rodada', () => {
  it('acerto na bandeira vale 10 e leva para a capital', () => {
    const s0 = playing(start());
    const s1 = playing(run(s0, { type: 'ANSWER_FLAG', value: s0.countries[0]!.cca3, now: 3_000 }));
    expect(s1.phase).toBe('capital');
    expect(s1.roundPoints).toBe(10);
  });

  it('erro na bandeira encerra a rodada sem pontos', () => {
    const s0 = playing(start());
    const wrong = s0.flagOptions.find((o) => !o.correct)!.value;
    const s1 = playing(run(s0, { type: 'ANSWER_FLAG', value: wrong, now: 3_000 }));
    expect(s1.phase).toBe('failed');
    expect(s1.failedAt).toBe('flag');
    expect(s1.roundPoints).toBe(0);

    const s2 = playing(run(s1, { type: 'NEXT', now: 2_000 }));
    expect(s2.index).toBe(1);
    expect(s2.phase).toBe('flag');
    expect(s2.total).toBe(0);
    expect(s2.results[0]).toMatchObject({ flagCorrect: false, capitalCorrect: false, points: 0 });
  });

  it('erro na capital mantém só os 10 da bandeira', () => {
    const s0 = playing(start());
    const s1 = playing(run(s0, { type: 'ANSWER_FLAG', value: s0.countries[0]!.cca3, now: 3_000 }));
    const wrong = s1.capitalOptions.find((o) => !o.correct)!.value;
    const s2 = playing(run(s1, { type: 'ANSWER_CAPITAL', value: wrong, now: 3_000 }));
    expect(s2.failedAt).toBe('capital');
    const s3 = playing(run(s2, { type: 'NEXT', now: 3_000 }));
    expect(s3.total).toBe(10);
    expect(s3.results[0]).toMatchObject({ flagCorrect: true, capitalCorrect: false, points: 10 });
  });

  it('pino em cima da capital vale os 100 pontos', () => {
    const s0 = playing(start());
    const country = s0.countries[0]!;
    const s2 = playing(
      run(
        s0,
        { type: 'ANSWER_FLAG', value: country.cca3, now: 3_000 },
        { type: 'ANSWER_CAPITAL', value: country.capital, now: 3_000 },
      ),
    );
    expect(s2.phase).toBe('pin');

    const exact: LngLat = [country.capitalLng, country.capitalLat];
    const s3 = playing(run(s2, { type: 'DROP_PIN', at: exact }, { type: 'CONFIRM_PIN', now: 3_000 }));
    expect(s3.phase).toBe('reveal');
    expect(s3.distanceKm).toBeCloseTo(0, 6);
    expect(s3.roundPoints).toBe(120);
  });
});

describe('eventos fora de hora são ignorados', () => {
  it('não confirma um pino que não existe', () => {
    const s0 = playing(start());
    const country = s0.countries[0]!;
    const s2 = run(s0, { type: 'ANSWER_FLAG', value: country.cca3, now: 3_000 }, { type: 'ANSWER_CAPITAL', value: country.capital, now: 3_000 });
    expect(run(s2, { type: 'CONFIRM_PIN', now: 3_000 })).toBe(s2);
  });

  it('não aceita resposta de capital durante a bandeira', () => {
    const s0 = start();
    expect(run(s0, { type: 'ANSWER_CAPITAL', value: 'Brasília', now: 3_000 })).toBe(s0);
  });

  it('não deixa responder duas vezes a mesma bandeira', () => {
    const s0 = playing(start());
    const s1 = run(s0, { type: 'ANSWER_FLAG', value: s0.countries[0]!.cca3, now: 3_000 });
    const s2 = run(s1, { type: 'ANSWER_FLAG', value: s0.countries[1]!.cca3, now: 3_000 });
    expect(s2).toBe(s1);
  });
});

describe('partida completa', () => {
  /** Joga as 15 rodadas acertando tudo e cravando o pino na capital. */
  /** Quatro segundos respondendo e dois lendo a revelação, por rodada. */
  const RESPONDENDO_MS = 4_000;
  const LENDO_MS = 2_000;

  function perfectGame(seed: string): GameState {
    let s: GameState = start(seed);
    let clock = 1_000; // o `now` do START
    for (let i = 0; i < ROUNDS_PER_GAME; i++) {
      const p = playing(s);
      const country = p.countries[p.index]!;
      clock += RESPONDENDO_MS;
      s = run(
        p,
        { type: 'ANSWER_FLAG', value: country.cca3, now: clock },
        { type: 'ANSWER_CAPITAL', value: country.capital, now: clock },
        { type: 'DROP_PIN', at: [country.capitalLng, country.capitalLat] },
        { type: 'CONFIRM_PIN', now: clock },
        { type: 'NEXT', now: clock + LENDO_MS },
      );
      clock += LENDO_MS;
    }
    return s;
  }

  it('fecha em 1800 pontos quando tudo é perfeito', () => {
    const s = perfectGame('perfeito');
    expect(s.screen).toBe('gameover');
    if (s.screen !== 'gameover') return;
    expect(s.total).toBe(MAX_GAME_SCORE);
    expect(s.results).toHaveLength(ROUNDS_PER_GAME);
    // só o tempo respondendo entra: os 2 s por rodada lendo a revelação, não
    expect(s.durationMs).toBe(ROUNDS_PER_GAME * RESPONDENDO_MS);
  });

  it('fecha em zero quando todas as bandeiras são erradas', () => {
    let s: GameState = start('zero');
    for (let i = 0; i < ROUNDS_PER_GAME; i++) {
      const p = playing(s);
      const wrong = p.flagOptions.find((o) => !o.correct)!.value;
      s = run(p, { type: 'ANSWER_FLAG', value: wrong, now: p.roundStartedAt + 1_500 }, { type: 'NEXT', now: p.roundStartedAt + 3_000 });
    }
    expect(s.screen).toBe('gameover');
    if (s.screen !== 'gameover') return;
    expect(s.total).toBe(0);
    expect(s.results.every((r) => !r.flagCorrect)).toBe(true);
  });

  it('nunca passa do teto em 200 partidas perfeitas', () => {
    for (let i = 0; i < 200; i++) {
      const s = perfectGame(`s${i}`);
      if (s.screen !== 'gameover') throw new Error('não terminou');
      expect(s.total).toBeLessThanOrEqual(MAX_GAME_SCORE);
      expect(s.total).toBe(MAX_GAME_SCORE);
    }
  });
});

describe('envio da pontuação', () => {
  /** Chega ao fim da partida errando tudo, que é o caminho mais curto. */
  function reachGameOver(seed = 'envio'): GameState {
    let s: GameState = start(seed);
    for (let i = 0; i < ROUNDS_PER_GAME; i++) {
      const p = playing(s);
      s = run(p, { type: 'ANSWER_FLAG', value: p.flagOptions.find((o) => !o.correct)!.value, now: 3_000 }, { type: 'NEXT', now: i });
    }
    return s;
  }

  it('guarda posição, total e a linha a destacar', () => {
    const over = run(reachGameOver(), {
      type: 'SUBMIT_DONE',
      state: 'ok',
      rank: 137,
      playersInRanking: 312,
      highlightId: 'linha-abc',
      personalBest: true,
    });
    expect(over).toMatchObject({
      submit: 'ok',
      rank: 137,
      playersInRanking: 312,
      highlightId: 'linha-abc',
      personalBest: true,
    });
  });

  it('marca quando a jogada de agora não foi a melhor do nome', () => {
    const over = run(reachGameOver(), {
      type: 'SUBMIT_DONE',
      state: 'ok',
      rank: 12,
      playersInRanking: 90,
      highlightId: 'partida-antiga',
      personalBest: false,
    });
    expect(over.screen === 'gameover' && over.personalBest).toBe(false);
  });

  it('não destaca nada quando o envio falha', () => {
    const over = run(reachGameOver(), {
      type: 'SUBMIT_DONE',
      state: 'offline',
      rank: null,
      playersInRanking: null,
      highlightId: null,
      personalBest: false,
    });
    expect(over).toMatchObject({ submit: 'offline', rank: null, highlightId: null });
  });
});

describe('navegação', () => {
  it('volta para a home mantendo o nome', () => {
    const over = run(initialState('Ana'), { type: 'START', seed: 'x', now: 0, pool: COUNTRIES });
    const s = run(over, { type: 'PLAY_AGAIN' });
    expect(s).toBe(over); // PLAY_AGAIN só vale no fim da partida
  });
});

describe('relógio da rodada', () => {
  /** Leva a rodada 1 até a etapa pedida, sem gastar tempo. */
  const até = (etapa: 'flag' | 'capital' | 'pin') => {
    const s0 = playing(start());
    const c = s0.countries[0]!;
    if (etapa === 'flag') return s0;
    const s1 = playing(run(s0, { type: 'ANSWER_FLAG', value: c.cca3, now: 1_000 }));
    if (etapa === 'capital') return s1;
    return playing(run(s1, { type: 'ANSWER_CAPITAL', value: c.capital, now: 1_000 }));
  };

  it('estourar na bandeira encerra a rodada sem pontos', () => {
    const s = playing(run(até('flag'), { type: 'TIMEOUT' }));
    expect(s.phase).toBe('failed');
    expect(s.failedAt).toBe('flag');
    expect(s.timedOut).toBe(true);
    expect(s.roundPoints).toBe(0);
    // ninguém escolheu nada: não há botão a marcar como erro da pessoa
    expect(s.chosen).toBeNull();
  });

  it('estourar na capital mantém os 10 da bandeira', () => {
    const s = playing(run(até('capital'), { type: 'TIMEOUT' }));
    expect(s.failedAt).toBe('capital');
    expect(s.roundPoints).toBe(10);
  });

  it('estourar sem pino no mapa perde a rodada no pino, guardando os 20', () => {
    const s = playing(run(até('pin'), { type: 'TIMEOUT' }));
    expect(s.phase).toBe('failed');
    expect(s.failedAt).toBe('pin');
    expect(s.roundPoints).toBe(20);
  });

  it('estourar com o pino já posto conta o palpite', () => {
    const p = até('pin');
    const c = p.countries[0]!;
    const exact: LngLat = [c.capitalLng, c.capitalLat];
    const s = playing(run(p, { type: 'DROP_PIN', at: exact }, { type: 'TIMEOUT' }));
    // quem marcou o palpite fez a sua parte; o relógio não o tira
    expect(s.phase).toBe('reveal');
    expect(s.roundPoints).toBe(120);
    expect(s.timedOut).toBe(true);
  });

  it('a rodada estourada consome o orçamento inteiro', () => {
    const s = playing(run(até('flag'), { type: 'TIMEOUT' }, { type: 'NEXT', now: 99_999 }));
    expect(s.results[0]!.ms).toBe(ROUND_TIME_MS);
    expect(s.results[0]!.timedOut).toBe(true);
  });

  it('acertar a bandeira não reinicia o relógio: a rodada é um orçamento só', () => {
    const s0 = playing(start());
    const s1 = playing(run(s0, { type: 'ANSWER_FLAG', value: s0.countries[0]!.cca3, now: 9_000 }));
    expect(s1.roundStartedAt).toBe(s0.roundStartedAt);
    expect(s1.roundMs).toBeNull();
  });

  it('o relógio reinicia na rodada seguinte', () => {
    const s = playing(run(até('flag'), { type: 'TIMEOUT' }, { type: 'NEXT', now: 50_000 }));
    expect(s.roundStartedAt).toBe(50_000);
    expect(s.timedOut).toBe(false);
    expect(s.roundMs).toBeNull();
  });

  it('nenhuma rodada passa do orçamento, mesmo com o evento atrasado', () => {
    const s0 = playing(start());
    // a aba ficou em segundo plano e o evento só chegou muito depois
    const s1 = playing(run(s0, { type: 'ANSWER_FLAG', value: 'XXX', now: 5_000_000 }));
    expect(s1.roundMs).toBe(ROUND_TIME_MS);
  });

  it('ignora o relógio fora das etapas que respondem', () => {
    const falhou = run(até('flag'), { type: 'TIMEOUT' });
    expect(run(falhou, { type: 'TIMEOUT' })).toBe(falhou);

    const p = até('pin');
    const c = p.countries[0]!;
    const revelando = run(p, { type: 'DROP_PIN', at: [c.capitalLng, c.capitalLat] }, { type: 'CONFIRM_PIN', now: 2_000 });
    expect(run(revelando, { type: 'TIMEOUT' })).toBe(revelando);
  });

  it('uma partida inteira cabe no orçamento de 5 minutos', () => {
    let s: GameState = start('lenta');
    for (let i = 0; i < ROUNDS_PER_GAME; i++) {
      s = run(playing(s), { type: 'TIMEOUT' }, { type: 'NEXT', now: 1_000 + (i + 1) * 99_999 });
    }
    if (s.screen !== 'gameover') throw new Error('esperava gameover');
    expect(s.durationMs).toBe(GAME_TIME_MS);
  });
});
