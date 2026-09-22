import raw from './countries.json';
import type { Country } from '../domain/types';

export const COUNTRIES = raw as Country[];

export const BY_CCA3 = new Map(COUNTRIES.map((c) => [c.cca3, c]));

export function flagUrl(country: Country): string {
  return `/flags/${country.cca2.toLowerCase()}.svg`;
}
