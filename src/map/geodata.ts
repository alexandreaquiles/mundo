import * as topojson from 'topojson-client';
import type { Feature, FeatureCollection, MultiLineString } from 'geojson';

export type Quality = 'low' | 'high';

export interface WorldGeometry {
  land: FeatureCollection;
  borders: Feature<MultiLineString>;
  /** ccn3 (id do TopoJSON) dos países presentes nesta resolução. */
  ids: Set<string>;
}

const URLS: Record<Quality, string> = {
  low: '/data/world-110m.json',
  high: '/data/world-50m.json',
};

const cache = new Map<Quality, Promise<WorldGeometry>>();

/**
 * Carrega e converte uma resolução do mapa. O resultado fica em memória:
 * o `mesh` das fronteiras é caro e não muda.
 */
export function loadWorld(quality: Quality): Promise<WorldGeometry> {
  const hit = cache.get(quality);
  if (hit) return hit;

  const promise = fetch(URLS[quality])
    .then((r) => {
      if (!r.ok) throw new Error(`Falha ao carregar o mapa (${r.status})`);
      return r.json();
    })
    .then((topo: any) => {
      const countries = topo.objects.countries;
      return {
        land: topojson.feature(topo, countries) as unknown as FeatureCollection,
        // `mesh` com o filtro a !== b desenha cada fronteira uma vez só
        borders: {
          type: 'Feature',
          properties: {},
          geometry: topojson.mesh(topo, countries, (a: any, b: any) => a !== b) as MultiLineString,
        } as Feature<MultiLineString>,
        ids: new Set<string>(countries.geometries.map((g: any) => String(g.id))),
      };
    })
    .catch((err) => {
      cache.delete(quality); // permite tentar de novo
      throw err;
    });

  cache.set(quality, promise);
  return promise;
}
