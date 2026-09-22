import { pickOne, type Rng } from './rng';

/**
 * Nome sugerido para quem ainda não tem um. Existe para ninguém encarar um
 * campo vazio e ter que inventar algo — é só um ponto de partida editável.
 */
const PAPEIS = [
  'Explorador', 'Navegante', 'Cartógrafo', 'Viajante', 'Aventureiro',
  'Andarilho', 'Geógrafo', 'Piloto', 'Mochileiro', 'Desbravador',
];

export function suggestName(rng: Rng): string {
  return `${pickOne(PAPEIS, rng)} ${100 + Math.floor(rng() * 900)}`;
}
