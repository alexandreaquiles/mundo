/**
 * Formatação de datas e durações para exibição, em pt-BR.
 * Funções puras: recebem `now` para poderem ser testadas sem mexer no relógio.
 */

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
/** A partir de uma semana, "há 9 dias" diz menos que a data em si. */
const RELATIVE_LIMIT = 7 * DAY;

const relative = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
const shortDate = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const fullDate = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'long',
  timeStyle: 'short',
});

/**
 * Quando a partida aconteceu: relativo enquanto é recente ("há 2 horas",
 * "ontem"), data absoluta a partir de uma semana.
 */
export function formatPlayedAt(timestamp: number, now = Date.now()): string {
  if (!Number.isFinite(timestamp)) return '';
  const elapsed = now - timestamp;

  // O relógio do aparelho pode estar atrasado em relação ao servidor, e aí
  // uma partida recém-enviada apareceria no futuro. Trata como agora.
  if (elapsed < MINUTE) return 'agora';
  if (elapsed >= RELATIVE_LIMIT) return shortDate.format(timestamp);
  if (elapsed < HOUR) return relative.format(-Math.floor(elapsed / MINUTE), 'minute');
  if (elapsed < DAY) return relative.format(-Math.floor(elapsed / HOUR), 'hour');
  return relative.format(-Math.floor(elapsed / DAY), 'day');
}

/** Data e hora por extenso, para o `title` e o `dateTime` da linha. */
export function formatExactDate(timestamp: number): string {
  return Number.isFinite(timestamp) ? fullDate.format(timestamp) : '';
}

/** Quanto durou a partida: "45s", "4min 12s", "1h 07min". */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '';
  const totalSeconds = Math.round(ms / SECOND);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);

  if (totalMinutes === 0) return `${seconds}s`;
  if (totalMinutes < 60) return seconds === 0 ? `${totalMinutes}min` : `${totalMinutes}min ${seconds}s`;

  const minutes = totalMinutes % 60;
  return `${Math.floor(totalMinutes / 60)}h ${String(minutes).padStart(2, '0')}min`;
}
