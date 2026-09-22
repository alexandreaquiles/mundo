/**
 * Gerador pseudoaleatório determinístico (mulberry32).
 * Toda partida carrega uma semente, então a mesma semente reproduz
 * exatamente os mesmos 15 países e a mesma ordem das alternativas.
 */
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Converte uma semente textual em inteiro de 32 bits (FNV-1a). */
export function hashSeed(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rngFromSeed(seed: string): Rng {
  return mulberry32(hashSeed(seed));
}

/** Semente nova, legível e curta. */
export function randomSeed(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Fisher–Yates; devolve uma cópia. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function pickOne<T>(items: readonly T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)]!;
}

/**
 * Sorteia `count` itens sem reposição, com probabilidade proporcional ao peso.
 * Se houver menos itens que `count`, devolve todos.
 */
export function weightedSample<T>(
  items: readonly T[],
  weightOf: (item: T) => number,
  count: number,
  rng: Rng,
): T[] {
  const pool = items.slice();
  const weights = pool.map(weightOf);
  const out: T[] = [];
  for (let n = 0; n < count && pool.length > 0; n++) {
    let total = 0;
    for (const w of weights) total += w;
    let target = rng() * total;
    let idx = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      target -= weights[i]!;
      if (target <= 0) { idx = i; break; }
    }
    out.push(pool[idx]!);
    pool.splice(idx, 1);
    weights.splice(idx, 1);
  }
  return out;
}
