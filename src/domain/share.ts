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

/** Quantas rodadas cabem numa linha da grade. */
const POR_LINHA = 5;

/**
 * O texto que a pessoa cola no WhatsApp: as 15 rodadas numa grade de 3 por 5,
 * cada uma com a bandeira do país e a cor do desfecho.
 *
 * A distância de cada pino não cabe aqui — cinco "🇸🇦🟢 8 km" numa linha
 * quebram em qualquer tela de celular. Ela vira uma linha de resumo com a
 * melhor cravada, que é a parte de que se tem orgulho.
 */
export function buildShareText({ score, results, countryOf, url }: ShareInput): string {
  const celulas = results.map((r) => {
    const country = countryOf(r.cca3);
    return `${country ? flagEmoji(country.cca2) : '🏳️'}${roundEmoji(r)}`;
  });

  const grade: string[] = [];
  for (let i = 0; i < celulas.length; i += POR_LINHA) {
    grade.push(celulas.slice(i, i + POR_LINHA).join(' '));
  }

  const linhas = [`Mundo — ${score}/${MAX_GAME_SCORE}`, '', ...grade];

  const melhorPino = results
    .filter((r) => r.points === MAX_ROUND_SCORE && r.distanceKm !== null)
    .map((r) => r.distanceKm!)
    .sort((a, b) => a - b)[0];
  if (melhorPino !== undefined) linhas.push('', `🟢 melhor pino: ${formatKm(melhorPino)}`);

  return [...linhas, '', url].join('\n');
}
