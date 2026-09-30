/** Tempo de jogo como cronômetro: `m:ss`. Vai de `0:00` a `5:00`. */
export function formatDuration(ms: number): string {
  const safe = Number.isFinite(ms) && ms > 0 ? ms : 0;
  // para cima, nunca para baixo: menos tempo é melhor no ranking, então
  // arredondar para trás mostraria um número que lisonjeia quem jogou
  const total = Math.ceil(safe / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
