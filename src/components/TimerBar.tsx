import { useEffect, useRef } from 'react';
import { ROUND_TIME_MS } from '../domain/scoring';
import { sfx } from '../audio/sfx';

/** Onde a barra troca de cor. Frações do tempo restante. */
const ATENCAO = 0.5;
const APERTO = 0.25;

/** Intervalo entre tiques, do mais lento ao mais rápido. */
const TIQUE_LENTO_MS = 1000;
const TIQUE_RAPIDO_MS = 140;

/**
 * Quanto esperar até o próximo tique. O expoente faz a aceleração ser sentida
 * no fim e não no começo: a metade inicial da rodada fica quase no mesmo
 * andamento, e os últimos segundos disparam.
 */
function proximoTique(restante: number): number {
  const f = Math.max(0, Math.min(1, restante));
  return TIQUE_RAPIDO_MS + (TIQUE_LENTO_MS - TIQUE_RAPIDO_MS) * f ** 1.6;
}

export interface TimerBarProps {
  /**
   * A mesma origem que o reducer usa para medir a rodada. Passar o instante em
   * vez de uma duração é o que impede a barra de divergir da pontuação: as
   * duas contam a partir do mesmo número.
   */
  startedAt: number;
  /** Falso nas telas de erro e de revelação, que ficam fora do relógio. */
  running: boolean;
  onExpire: () => void;
}

/**
 * A barra fininha do relógio da rodada.
 *
 * Não guarda o tempo em estado do React: um `setState` por quadro re-renderiza
 * a tela inteira do jogo 60 vezes por segundo. Ela escreve direto no `style` de
 * um ref, e o React só volta a participar quando a rodada troca.
 *
 * O relógio não é ela: quem decide o tempo gasto é o reducer, a partir de
 * `startedAt`. Se a aba for para segundo plano o `requestAnimationFrame` para,
 * mas o tempo continua correndo — ao voltar, a barra já está no fim e o
 * `onExpire` dispara na hora. Esconder a aba não pausa nada.
 */
export function TimerBar({ startedAt, running, onExpire }: TimerBarProps) {
  const fill = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const expired = useRef(false);

  useEffect(() => {
    expired.current = false;
  }, [startedAt]);

  useEffect(() => {
    if (!running) return;
    let frame = 0;
    let tique = proximoTique(1);
    let alto = true;

    const passo = () => {
      const elapsed = Date.now() - startedAt;
      const restante = Math.max(0, 1 - elapsed / ROUND_TIME_MS);

      if (fill.current) fill.current.style.transform = `scaleX(${restante})`;
      if (box.current) {
        const nivel = restante <= APERTO ? 'aperto' : restante <= ATENCAO ? 'atencao' : 'calmo';
        if (box.current.dataset.level !== nivel) box.current.dataset.level = nivel;
      }

      if (elapsed >= tique && restante > 0) {
        sfx.tick(alto, 1 - restante);
        alto = !alto;
        tique = elapsed + proximoTique(restante);
      }

      if (restante <= 0) {
        if (!expired.current) {
          expired.current = true;
          onExpire();
        }
        return;
      }
      frame = requestAnimationFrame(passo);
    };

    frame = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(frame);
  }, [startedAt, running, onExpire]);

  return (
    // O tique-taque é que carrega essa informação para quem não vê a tela, e
    // ele toca para todo mundo — por isso a barra em si não é anunciada.
    <div className="timer" ref={box} data-level="calmo" aria-hidden="true">
      <div className="timer__fill" ref={fill} />
    </div>
  );
}
