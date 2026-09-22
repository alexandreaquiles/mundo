export type Region = 'Africa' | 'Americas' | 'Asia' | 'Europe' | 'Oceania';

/** Um país do jogo, como sai de `scripts/build-data.ts`. */
export interface Country {
  cca2: string;
  cca3: string;
  /** Código numérico ISO 3166-1; é o `id` das features do TopoJSON. */
  ccn3: string;
  /** Nome em pt-BR, ex. "Brasil" */
  name: string;
  /** Capital em pt-BR, ex. "Brasília" */
  capital: string;
  capitalLat: number;
  capitalLng: number;
  /** Centroide aproximado do país; usado para posicionar microestados no mapa. */
  centroidLat: number;
  centroidLng: number;
  region: Region;
  subregion: string;
  /** 0,35–1,0 — países maiores caem com mais frequência no sorteio. */
  weight: number;
  /** cca3 de países com bandeira parecida, para gerar distratores difíceis. */
  confusables?: string[];
}

/** [longitude, latitude] — a ordem do GeoJSON e do d3-geo. */
export type LngLat = [number, number];

export interface Option {
  /** Texto mostrado no botão. */
  label: string;
  /** Chave de comparação: cca3 na rodada da bandeira, a capital na rodada da capital. */
  value: string;
  correct: boolean;
}

export type RoundStage = 'flag' | 'capital' | 'pin';

export interface RoundResult {
  cca3: string;
  /** Até onde a pessoa chegou nesta rodada. */
  reached: RoundStage | 'done';
  flagCorrect: boolean;
  capitalCorrect: boolean;
  guess: LngLat | null;
  distanceKm: number | null;
  points: number;
}
