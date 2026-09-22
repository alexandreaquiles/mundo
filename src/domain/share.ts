import type { Country, RoundResult } from './types';
import { MAX_GAME_SCORE, MAX_ROUND_SCORE } from './scoring';
import { formatKm } from './geo';

/**
 * Converte um código ISO de duas letras no emoji da bandeira, somando o
 * deslocamento até os "indicadores regionais". Vale para os 195 países.
 *
 * Nem toda plataforma desenha bandeiras — o Windows, por exemplo, mostra as
 * duas letras ("BR") no lugar. Continua legível, e é por isso que não vale a
 * pena escrever o nome do país: quinze nomes deixariam a mensagem enorme.
 */
export function flagEmoji(cca2: string): string {
  return String.fromCodePoint(
    ...[...cca2.toUpperCase()].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65),
  );
}

/** Como a rodada foi, em uma cor. */
export function roundEmoji(result: RoundResult): string {
  if (!result.flagCorrect) return '🔴';
  if (!result.capitalCorrect) return '🟠';
  return result.points === MAX_ROUND_SCORE ? '🟢' : '🟡';
}

export interface ShareInput {
  score: number;
  results: RoundResult[];
  countryOf: (cca3: string) => Country | undefined;
  url: string;
}

/**
 * O texto que a pessoa cola no WhatsApp. Uma linha por rodada: bandeira, cor
 * e — nas rodadas perfeitas — a que distância o pino caiu, que é a parte de
 * que se tem orgulho.
 */
export function buildShareText({ score, results, countryOf, url }: ShareInput): string {
  const linhas = results.map((r) => {
    const country = countryOf(r.cca3);
    const bandeira = country ? flagEmoji(country.cca2) : '🏳️';
    const cor = roundEmoji(r);
    const perfeita = r.points === MAX_ROUND_SCORE && r.distanceKm !== null;
    return perfeita ? `${bandeira}${cor} ${formatKm(r.distanceKm!)}` : `${bandeira}${cor}`;
  });

  return [`Mundo — ${score}/${MAX_GAME_SCORE}`, '', ...linhas, '', url].join('\n');
}
