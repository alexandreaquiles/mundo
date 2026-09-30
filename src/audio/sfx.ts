/**
 * Efeitos sonoros sintetizados na hora com WebAudio.
 * Zero bytes de áudio no bundle — e por isso funcionam offline por construção.
 */
let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(on: boolean) {
  enabled = on;
}

/** Precisa ser chamado dentro de um gesto da pessoa (política do iOS). */
export function unlockAudio() {
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

function blip(freq: number, at: number, dur: number, type: OscillatorType = 'sine', gain = 0.16) {
  if (!ctx || !enabled) return;
  const t = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  // rampas exponenciais evitam o "clique" no ataque e no corte
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(amp).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export const sfx = {
  correct() {
    blip(659.25, 0, 0.09);
    blip(987.77, 0.07, 0.16);
  },
  wrong() {
    blip(196, 0, 0.16, 'sawtooth', 0.13);
    blip(146.83, 0.09, 0.22, 'sawtooth', 0.11);
  },
  drop() {
    blip(1200, 0, 0.035, 'square', 0.07);
  },
  /** Agudo quando o palpite foi bom, grave quando foi ruim. */
  reveal(points: number) {
    const f = 330 + (points / 100) * 660;
    blip(f, 0, 0.12, 'triangle', 0.14);
    blip(f * 1.5, 0.1, 0.18, 'triangle', 0.1);
  },
  finish() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => blip(f, i * 0.11, 0.26));
  },
  /**
   * Meio tique-taque do relógio da rodada. `high` alterna o "tic" e o "tac";
   * `urgency` vai de 0 a 1 conforme o tempo se esgota, subindo o tom e o
   * volume — quem acelera o andamento é quem chama.
   *
   * Muito curto e seco de propósito: vai tocar centenas de vezes por partida,
   * e uma nota com cauda viraria tortura.
   */
  tick(high: boolean, urgency = 0) {
    const base = high ? 1180 : 860;
    blip(base * (1 + 0.18 * urgency), 0, 0.028, 'square', 0.035 + 0.05 * urgency);
  },
  /**
   * O tempo acabou. Duas serras desafinadas de propósito — 233 contra 220 Hz
   * batem a 13 Hz e dão o zumbido de campainha — e depois a queda.
   *
   * Tem de ser distinto do `wrong()`: errar a resposta e perder no relógio são
   * coisas diferentes, e a pessoa está olhando o mapa, não a barra.
   */
  timeout() {
    blip(233.08, 0, 0.3, 'sawtooth', 0.14);
    blip(220, 0, 0.3, 'sawtooth', 0.12);
    blip(155.56, 0.26, 0.34, 'sawtooth', 0.13);
  },
};

const canVibrate = typeof navigator !== 'undefined' && 'vibrate' in navigator;

/** iOS não implementa `navigator.vibrate`; aqui isso simplesmente não faz nada. */
export const haptics = {
  correct: () => enabled && canVibrate && navigator.vibrate(25),
  wrong: () => enabled && canVibrate && navigator.vibrate([35, 55, 35]),
  drop: () => enabled && canVibrate && navigator.vibrate(12),
  /** Mais longo que o de errar: o relógio estourando merece um susto próprio. */
  timeout: () => enabled && canVibrate && navigator.vibrate([90, 70, 90, 70, 160]),
};
