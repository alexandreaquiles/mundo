import type { Country, Option, Region } from './types';
import { pickOne, shuffle, weightedSample, type Rng } from './rng';
import { ROUNDS_PER_GAME } from './scoring';

const REGIONS: Region[] = ['Africa', 'Americas', 'Asia', 'Europe', 'Oceania'];
/** Cada região aparece pelo menos este tanto de vezes, para a partida não virar só ilhas. */
const MIN_PER_REGION = 2;

/**
 * Escolhe os países da partida: sem repetição, com todas as regiões
 * representadas e com países maiores caindo mais vezes.
 */
export function pickCountries(pool: readonly Country[], rng: Rng, count = ROUNDS_PER_GAME): Country[] {
  const chosen: Country[] = [];
  const taken = new Set<string>();

  for (const region of REGIONS) {
    const inRegion = pool.filter((c) => c.region === region && !taken.has(c.cca3));
    for (const c of weightedSample(inRegion, (x) => x.weight, MIN_PER_REGION, rng)) {
      chosen.push(c);
      taken.add(c.cca3);
    }
  }

  const rest = pool.filter((c) => !taken.has(c.cca3));
  for (const c of weightedSample(rest, (x) => x.weight, count - chosen.length, rng)) {
    chosen.push(c);
    taken.add(c.cca3);
  }

  return shuffle(chosen, rng).slice(0, count);
}

/** Pega `n` candidatos preferindo a mesma sub-região, depois a região, depois o mundo todo. */
function nearbyCandidates(
  answer: Country,
  pool: readonly Country[],
  n: number,
  rng: Rng,
  exclude: (c: Country) => boolean,
): Country[] {
  const out: Country[] = [];
  const used = new Set<string>([answer.cca3]);

  const tiers = [
    pool.filter((c) => c.subregion === answer.subregion),
    pool.filter((c) => c.region === answer.region),
    pool,
  ];

  for (const tier of tiers) {
    const available = shuffle(tier.filter((c) => !used.has(c.cca3) && !exclude(c)), rng);
    for (const c of available) {
      if (out.length >= n) break;
      out.push(c);
      used.add(c.cca3);
    }
    if (out.length >= n) break;
  }
  return out;
}

const OPTIONS_PER_QUESTION = 4;

/**
 * Alternativas da rodada da bandeira. Metade das vezes puxa um país de
 * bandeira parecida, o que torna a pergunta bem mais interessante.
 */
export function buildFlagOptions(answer: Country, pool: readonly Country[], rng: Rng): Option[] {
  const picked: Country[] = [];
  const used = new Set<string>([answer.cca3]);

  const confusable = (answer.confusables ?? [])
    .map((code) => pool.find((c) => c.cca3 === code))
    .filter((c): c is Country => Boolean(c));

  if (confusable.length > 0 && rng() < 0.6) {
    const c = pickOne(confusable, rng);
    picked.push(c);
    used.add(c.cca3);
  }

  const needed = OPTIONS_PER_QUESTION - 1 - picked.length;
  picked.push(...nearbyCandidates(answer, pool, needed, rng, (c) => used.has(c.cca3)));

  return shuffle(
    [answer, ...picked].map((c) => ({ label: c.name, value: c.cca3, correct: c.cca3 === answer.cca3 })),
    rng,
  );
}

/** Alternativas da rodada da capital, preferindo capitais da mesma sub-região. */
export function buildCapitalOptions(answer: Country, pool: readonly Country[], rng: Rng): Option[] {
  const distractors = nearbyCandidates(
    answer,
    pool,
    OPTIONS_PER_QUESTION - 1,
    rng,
    (c) => c.capital === answer.capital,
  );

  return shuffle(
    [answer, ...distractors].map((c) => ({
      label: c.capital,
      value: c.capital,
      correct: c.cca3 === answer.cca3,
    })),
    rng,
  );
}
