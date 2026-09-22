/**
 * Pontuação do jogo. Este arquivo é importado tanto pelo cliente quanto
 * pelo Worker, então os limites do ranking nunca saem de sincronia.
 */
export const FLAG_POINTS = 10;
export const CAPITAL_POINTS = 10;
export const PIN_MAX_POINTS = 100;

/** Até esta distância o palpite vale a pontuação cheia. */
export const PERFECT_KM = 25;
/** A partir daqui o palpite não vale nada. */
export const ZERO_KM = 5000;
/** Quanto menor, mais severa é a queda. */
const LAMBDA = 0.28;

export const ROUNDS_PER_GAME = 15;
export const MAX_ROUND_SCORE = FLAG_POINTS + CAPITAL_POINTS + PIN_MAX_POINTS;
export const MAX_GAME_SCORE = ROUNDS_PER_GAME * MAX_ROUND_SCORE;

const E_END = Math.exp(-1 / LAMBDA);

/**
 * Pontos do pino: 100 até 25 km, caindo exponencialmente até zerar em 5.000 km.
 * A curva é contínua nas duas pontas e estritamente decrescente entre elas.
 */
export function pinPoints(distanceKm: number): number {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) return 0;
  if (distanceKm <= PERFECT_KM) return PIN_MAX_POINTS;
  if (distanceKm >= ZERO_KM) return 0;
  const t = (distanceKm - PERFECT_KM) / (ZERO_KM - PERFECT_KM);
  const raw = (Math.exp(-t / LAMBDA) - E_END) / (1 - E_END);
  return Math.round(PIN_MAX_POINTS * raw);
}

/** Mensagem curta de feedback para o resultado do pino. */
export function pinFeedback(distanceKm: number): string {
  if (distanceKm <= PERFECT_KM) return 'Na mosca!';
  if (distanceKm < 250) return 'Quase lá!';
  if (distanceKm < 1000) return 'Perto.';
  if (distanceKm < 3000) return 'Longe.';
  return 'Bem longe…';
}
