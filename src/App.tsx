import { useCallback, useEffect, useReducer, useState } from 'react';
import { COUNTRIES } from './data/countries';
import { type Event, type GameState, initialState, reducer } from './domain/machine';
import { randomSeed } from './domain/rng';
import { ROUNDS_PER_GAME } from './domain/scoring';
import { RULESET } from './domain/ruleset';
import { useSettings } from './hooks/useSettings';
import { haptics, sfx, unlockAudio } from './audio/sfx';
import {
  NameTakenError,
  cachedSummary,
  fetchMe,
  queueScore,
  submitScore,
  takeQueuedScore,
  type PlayerSummary,
} from './api/client';
import { Pips, Screen, ScoreBar } from './components/Chrome';
import { TimerBar } from './components/TimerBar';
import { HomeScreen } from './screens/HomeScreen';
import { CapitalQuestion, FlagQuestion } from './screens/QuestionScreen';
import { FailedCard, RevealCard } from './screens/RoundResultScreen';
import { GameOverScreen } from './screens/GameOverScreen';
import { LeaderboardScreen } from './screens/LeaderboardScreen';
import { WorldMap } from './map/WorldMap';
import { useRoute } from './hooks/useRoute';
import { useAutoUpdate } from './pwa/useAutoUpdate';
import { getPlayerId } from './hooks/usePlayerId';
import { suggestName } from './domain/suggest-name';
import { buildShareText } from './domain/share';
import { BY_CCA3 } from './data/countries';
import { mulberry32 } from './domain/rng';
import type { LngLat } from './domain/types';

/** Quanto tempo o cartão de erro fica na tela antes de seguir sozinho. */
const FAILED_AUTO_MS = 3200;

export default function App() {
  const settings = useSettings();
  const { route, navigate, back } = useRoute();
  const [playerId] = useState(getPlayerId);
  // sorteado uma vez por montagem: não pode trocar enquanto a pessoa digita
  const [suggestedName] = useState(() => suggestName(mulberry32(Date.now() & 0xffffffff)));
  const [shareState, setShareState] = useState<'idle' | 'copiado' | 'erro'>('idle');
  // começa com o que está em cache, para a home não piscar esperando a rede
  const [summary, setSummary] = useState<PlayerSummary | null>(cachedSummary);
  const [state, rawDispatch] = useReducer(
    (s: GameState, e: Event) => reducer(s, e, COUNTRIES),
    undefined,
    () => initialState(settings.rememberedName),
  );
  const dispatch = useCallback((e: Event) => rawDispatch(e), []);
  // A versão nova entra sozinha e recarrega a página, a qualquer momento.
  useAutoUpdate();
  const [pendingFlush, setPendingFlush] = useState(0);

  // Reenvia uma pontuação que ficou na fila offline.
  useEffect(() => {
    const flush = () => setPendingFlush((n) => n + 1);
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, []);

  useEffect(() => {
    const queued = takeQueuedScore();
    if (!queued) return;
    submitScore(queued).catch((err: Error) => {
      // Nome tomado por outra pessoa nesse meio-tempo é definitivo: guardar
      // de novo faria a fila tentar para sempre. Só erro de rede volta.
      if (!(err instanceof NameTakenError)) queueScore(queued);
    });
  }, [pendingFlush]);

  const enviar = useCallback(
    (name: string, partida: { total: number; durationMs: number; seed: string }) => {
      const submission = {
        playerId,
        name,
        score: partida.total,
        rounds: ROUNDS_PER_GAME,
        durationMs: partida.durationMs,
        seed: partida.seed,
        ruleset: RULESET,
      };
      dispatch({ type: 'SUBMIT_START', name });
      settings.rememberName(name);
      submitScore(submission)
        .then((r) =>
          dispatch({
            type: 'SUBMIT_DONE',
            state: 'ok',
            rank: r.rank,
            playersInRanking: r.total,
            highlightId: r.bestId,
            // bestId diferente de id significa que uma partida anterior deste
            // jogador continua sendo a melhor
            personalBest: r.bestId === r.id,
          }),
        )
        .catch((err: Error) => {
          // Nome tomado é o único erro que a pessoa resolve sozinha; os
          // outros viram fila offline.
          if (err instanceof NameTakenError) {
            dispatch({ type: 'SUBMIT_STATE', state: 'nameTaken' });
            return;
          }
          queueScore(submission);
          dispatch({
            type: 'SUBMIT_DONE',
            state: navigator.onLine ? 'error' : 'offline',
            rank: null,
            playersInRanking: null,
            highlightId: null,
            personalBest: false,
          });
        });
    },
    [dispatch, playerId, settings],
  );

  // O resumo da home envelhece a cada partida enviada; recarrega ao voltar
  // para ela. Falha de rede mantém o que estava em cache.
  useEffect(() => {
    if (route !== 'jogo' || state.screen !== 'home') return;
    fetchMe(playerId)
      .then(setSummary)
      .catch(() => {});
  }, [route, state.screen, playerId]);

  // Fim de partida: quem já tem nome sobe direto; quem não tem, escolhe um.
  useEffect(() => {
    if (state.screen !== 'gameover' || state.submit !== 'idle') return;
    sfx.finish();
    const lembrado = settings.rememberedName.trim();
    if (lembrado) {
      enviar(lembrado, state);
    } else {
      dispatch({ type: 'SUBMIT_STATE', state: 'needsName' });
    }
  }, [state, dispatch, enviar, settings.rememberedName]);

  // Som do resultado do pino, com a frequência subindo junto com os pontos.
  // Quando foi o relógio que fechou a rodada, o zumbido do `timeout` já tocou
  // e este fica de fora: os dois juntos viram barulho.
  useEffect(() => {
    if (state.screen === 'playing' && state.phase === 'reveal' && state.distanceKm !== null && !state.timedOut) {
      sfx.reveal(state.roundPoints - 20);
      state.roundPoints > 20 ? haptics.correct() : haptics.wrong();
    }
    // só dispara na entrada da fase
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.screen === 'playing' ? state.phase : null, state.screen === 'playing' ? state.index : null]);

  // Depois de errar, o cartão explica a resposta e a rodada segue sozinha.
  useEffect(() => {
    if (state.screen !== 'playing' || state.phase !== 'failed') return;
    const id = window.setTimeout(() => dispatch({ type: 'NEXT', now: Date.now() }), FAILED_AUTO_MS);
    return () => window.clearTimeout(id);
  }, [state, dispatch]);

  const start = () => {
    unlockAudio();
    dispatch({ type: 'START', seed: randomSeed(), now: Date.now(), pool: COUNTRIES });
  };

  /**
   * O relógio da rodada chegou a zero.
   *
   * Estável de propósito: a `TimerBar` tem isto nas dependências do efeito que
   * roda o `requestAnimationFrame`, e um callback novo a cada render reiniciaria
   * o laço — junto com o andamento do tique-taque.
   */
  const estourarTempo = useCallback(() => {
    sfx.timeout();
    haptics.timeout();
    dispatch({ type: 'TIMEOUT' });
  }, [dispatch]);

  /** Web Share no celular, área de transferência no desktop. */
  const compartilhar = useCallback(async () => {
    if (state.screen !== 'gameover') return;
    const text = buildShareText({
      score: state.total,
      results: state.results,
      durationMs: state.durationMs,
      countryOf: (cca3) => BY_CCA3.get(cca3),
      url: location.origin,
    });
    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
        setShareState('copiado');
        setTimeout(() => setShareState('idle'), 2500);
      }
    } catch (err) {
      // cancelar o menu de compartilhar não é erro
      if ((err as Error)?.name !== 'AbortError') setShareState('erro');
    }
  }, [state]);

  if (route === 'ranking') {
    return (
      <LeaderboardScreen
        onBack={back}
        highlightId={state.screen === 'gameover' ? state.highlightId ?? undefined : undefined}
        highlightRank={state.screen === 'gameover' ? state.rank ?? undefined : undefined}
      />
    );
  }

  if (state.screen === 'home') {
    return (
      <HomeScreen
        summary={summary}
        onStart={start}
        onLeaderboard={() => navigate('ranking')}
      />
    );
  }

  if (state.screen === 'gameover') {
    return (
      <GameOverScreen
        state={state}
        suggestedName={suggestedName}
        onSubmitName={(name) => enviar(name, state)}
        onSkip={() => dispatch({ type: 'SUBMIT_STATE', state: 'skipped' })}
        onShare={compartilhar}
        shareState={shareState}
        onPlayAgain={() => dispatch({ type: 'PLAY_AGAIN' })}
        onLeaderboard={() => navigate('ranking')}
      />
    );
  }

  const country = state.countries[state.index]!;
  const truth: LngLat = [country.capitalLng, country.capitalLat];
  const onMap = state.phase === 'pin' || state.phase === 'reveal';
  /** O relógio corre só onde há o que responder. */
  const noRelogio = state.phase === 'flag' || state.phase === 'capital' || state.phase === 'pin';

  const answerFlag = (value: string) => {
    unlockAudio();
    const right = value === country.cca3;
    right ? sfx.correct() : sfx.wrong();
    right ? haptics.correct() : haptics.wrong();
    dispatch({ type: 'ANSWER_FLAG', value, now: Date.now() });
  };

  const answerCapital = (value: string) => {
    const right = value === country.capital;
    right ? sfx.correct() : sfx.wrong();
    right ? haptics.correct() : haptics.wrong();
    dispatch({ type: 'ANSWER_CAPITAL', value, now: Date.now() });
  };

  const confirmPin = () => {
    if (!state.pin) return;
    dispatch({ type: 'CONFIRM_PIN', now: Date.now() });
  };

  return (
    <Screen className={onMap ? 'screen--map' : 'screen--question'}>
      <TimerBar startedAt={state.roundStartedAt} running={noRelogio} onExpire={estourarTempo} />
      <ScoreBar
        round={state.index}
        // soma a rodada em curso: os 10 da bandeira têm de aparecer na hora
        total={state.total + state.roundPoints}
        sound={settings.sound}
        onToggleSound={settings.toggleSound}
      />
      <Pips results={state.results} />

      {state.phase === 'flag' && (
        <FlagQuestion country={country} options={state.flagOptions} chosen={null} onPick={answerFlag} />
      )}
      {state.phase === 'capital' && (
        <CapitalQuestion country={country} options={state.capitalOptions} chosen={null} onPick={answerCapital} />
      )}
      {state.phase === 'failed' && state.failedAt && (
        <FailedCard
          country={country}
          failedAt={state.failedAt}
          timedOut={state.timedOut}
          onNext={() => dispatch({ type: 'NEXT', now: Date.now() })}
        />
      )}

      {onMap && (
        <>
          <h2 className="question question--map">
            Onde fica <strong>{country.capital}</strong>?
          </h2>
          <WorldMap
            guess={state.pin}
            truth={truth}
            truthLabel={country.capital}
            revealing={state.phase === 'reveal'}
            reducedMotion={settings.reducedMotion}
            onPick={
              state.phase === 'pin'
                ? (at) => {
                    sfx.drop();
                    haptics.drop();
                    dispatch({ type: 'DROP_PIN', at });
                  }
                : null
            }
          />
          {state.phase === 'pin' && (
            <div className="map__footer">
              <p className="muted">{state.pin ? 'Pode ajustar tocando de novo.' : 'Toque no mapa para marcar.'}</p>
              <button type="button" className="btn btn--primary" disabled={!state.pin} onClick={confirmPin}>
                Confirmar palpite
              </button>
            </div>
          )}
          {state.phase === 'reveal' && state.distanceKm !== null && (
            <RevealCard
              country={country}
              distanceKm={state.distanceKm}
              points={state.roundPoints}
              onNext={() => dispatch({ type: 'NEXT', now: Date.now() })}
            />
          )}
        </>
      )}
    </Screen>
  );
}
