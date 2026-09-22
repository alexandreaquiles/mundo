/**
 * Prepara as duas resoluções de TopoJSON usadas pelo mapa.
 * 110m é desenhado durante gestos (zoom/pan); 50m no repouso.
 * Roda offline a partir do pacote `world-atlas`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { bbox, quantize, transform } from 'topojson-client';
import { presimplify, simplify, quantile } from 'topojson-simplify';

const root = resolve(import.meta.dirname, '..');
const atlas = (f: string) => resolve(root, 'node_modules/world-atlas', f);
const BUDGET_GZ_KB = 200;

interface Job {
  src: string;
  dest: string;
  /** quantil de detalhe mantido pela simplificação; 0 = não simplifica */
  keep: number;
  quantization: number;
}

/**
 * Desfaz a quantização delta do arquivo de origem, devolvendo coordenadas
 * absolutas em graus. `quantize` e `presimplify` exigem isso.
 */
function dequantize(topo: any): any {
  if (!topo.transform) return topo;
  const toPoint = transform(topo.transform);
  const arcs = topo.arcs.map((arc: number[][]) => arc.map((p, i) => toPoint(p.slice() as [number, number], i)));
  const out = { ...topo, arcs };
  delete out.transform;
  out.bbox = bbox(out);
  return out;
}

const jobs: Job[] = [
  { src: 'countries-110m.json', dest: 'world-110m.json', keep: 0, quantization: 1e4 },
  { src: 'countries-50m.json', dest: 'world-50m.json', keep: 0, quantization: 1e4 },
];

for (const job of jobs) {
  let topo = JSON.parse(readFileSync(atlas(job.src), 'utf8'));
  delete topo.objects.land; // preenchimento e fronteiras saem de `countries`
  topo = dequantize(topo);

  if (job.keep > 0) {
    // presimplify anota cada ponto com sua "importância" (Visvalingam);
    // simplify remove tudo abaixo do limiar escolhido pelo quantil.
    const pre = presimplify(topo);
    topo = simplify(pre, quantile(pre, job.keep));
  }
  topo = quantize(topo, job.quantization);

  const json = JSON.stringify(topo);
  const gzKb = gzipSync(Buffer.from(json), { level: 9 }).length / 1024;
  writeFileSync(resolve(root, 'public/data', job.dest), json);
  console.log(
    `✓ ${job.dest}: ${(json.length / 1024).toFixed(0)} KB cru / ${gzKb.toFixed(0)} KB gzip ` +
    `(${topo.objects.countries.geometries.length} países)`,
  );
  if (gzKb > BUDGET_GZ_KB) throw new Error(`${job.dest} passou do orçamento de ${BUDGET_GZ_KB} KB gzip`);
}
