/**
 * Combina o dataset `world-countries` com os arquivos curados em `data/`
 * e emite `src/data/countries.json`. Roda offline — não acessa a rede.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const readJson = <T>(p: string): T => JSON.parse(readFileSync(resolve(root, p), 'utf8')) as T;

interface CapitalRow { en: string; pt: string; lat: number; lng: number; source: string; reviewed: boolean }

const capitals = readJson<Record<string, CapitalRow>>('data/capitals.pt-BR.json');
const nameOverrides = readJson<Record<string, string>>('data/countries.pt-BR.json');
const confusableGroups = readJson<string[][]>('data/flag-confusables.json');

/** O `unMember` do world-countries marca o Vaticano errado, então listamos os observadores. */
const UN_OBSERVERS = new Set(['VAT', 'PSE']);
const EXPECTED_ROSTER_SIZE = 195;

const REGIONS = ['Africa', 'Americas', 'Asia', 'Europe', 'Oceania'] as const;

const rawCountries = JSON.parse(
  readFileSync(resolve(root, 'node_modules/world-countries/countries.json'), 'utf8'),
) as any[];

const roster = rawCountries
  .filter((c) => c.unMember || UN_OBSERVERS.has(c.cca3))
  .sort((a, b) => a.cca3.localeCompare(b.cca3));

if (roster.length !== EXPECTED_ROSTER_SIZE) {
  throw new Error(`Esperava ${EXPECTED_ROSTER_SIZE} países, encontrei ${roster.length}. O dataset mudou?`);
}

/** Países maiores aparecem com mais frequência, mas microestados nunca somem de vez. */
function samplingWeight(areaKm2: number): number {
  const t = (Math.log10(Math.max(areaKm2, 1)) - 2.5) / 4.5;
  return +(0.35 + 0.65 * Math.min(1, Math.max(0, t))).toFixed(3);
}

/** cca3 -> outros países cuja bandeira é facilmente confundida com a dele. */
const confusables = new Map<string, string[]>();
for (const group of confusableGroups) {
  for (const code of group) {
    const others = group.filter((o) => o !== code);
    confusables.set(code, [...new Set([...(confusables.get(code) ?? []), ...others])]);
  }
}

const countries = roster.map((c) => {
  const cap = capitals[c.cca3];
  if (!cap) throw new Error(`Sem capital curada para ${c.cca3} (${c.name.common})`);
  if (!cap.reviewed) throw new Error(`Capital de ${c.cca3} ainda não revisada`);
  if (!Number.isFinite(cap.lat) || !Number.isFinite(cap.lng)) {
    throw new Error(`Coordenada inválida para a capital de ${c.cca3}`);
  }
  if (!REGIONS.includes(c.region)) throw new Error(`Região desconhecida em ${c.cca3}: ${c.region}`);

  return {
    cca2: c.cca2,
    cca3: c.cca3,
    name: nameOverrides[c.cca3] ?? c.translations.por.common,
    capital: cap.pt,
    capitalLat: cap.lat,
    capitalLng: cap.lng,
    centroidLat: c.latlng[0],
    centroidLng: c.latlng[1],
    region: c.region,
    subregion: c.subregion,
    weight: samplingWeight(c.area),
    // só inclui o campo quando há grupo, para não inchar o JSON
    ...(confusables.has(c.cca3) ? { confusables: confusables.get(c.cca3)!.sort() } : {}),
  };
});

const rosterCodes = new Set(countries.map((c) => c.cca3));
const unknownConfusables = [...confusables.keys()].filter((c) => !rosterCodes.has(c));
if (unknownConfusables.length) {
  throw new Error(`flag-confusables.json cita códigos fora do roster: ${unknownConfusables.join(', ')}`);
}

const out = resolve(root, 'src/data/countries.json');
writeFileSync(out, JSON.stringify(countries, null, 2) + '\n');
console.log(`✓ ${countries.length} países → src/data/countries.json (${(JSON.stringify(countries).length / 1024).toFixed(1)} KB)`);
