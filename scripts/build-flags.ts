/**
 * Copia os SVGs das 195 bandeiras do pacote `flag-icons` para `public/flags/`,
 * com uma limpeza leve para reduzir o que o service worker vai precacheamento.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const countries: { cca2: string; cca3: string }[] = JSON.parse(
  readFileSync(resolve(root, 'src/data/countries.json'), 'utf8'),
);
const srcDir = resolve(root, 'node_modules/flag-icons/flags/4x3');
const outDir = resolve(root, 'public/flags');
mkdirSync(outDir, { recursive: true });

/** Remoções seguras: comentários XML, declaração e espaços entre tags. */
function slim(svg: string): string {
  return svg
    .replace(/<\?xml[^>]*\?>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/>\s+</g, '><')
    .trim();
}

let totalRaw = 0;
let totalGz = 0;
const heavy: [string, number][] = [];

for (const c of countries) {
  const key = c.cca2.toLowerCase();
  const src = resolve(srcDir, `${key}.svg`);
  if (!existsSync(src)) throw new Error(`Bandeira ausente para ${c.cca3} (${key}.svg)`);
  const out = resolve(outDir, `${key}.svg`);
  const slimmed = slim(readFileSync(src, 'utf8'));
  writeFileSync(out, slimmed);
  const size = statSync(out).size;
  totalRaw += size;
  totalGz += gzipSync(Buffer.from(slimmed), { level: 9 }).length;
  if (size > 60_000) heavy.push([key, size]);
}

console.log(`✓ ${countries.length} bandeiras → public/flags/ (${(totalRaw / 1024).toFixed(0)} KB cru / ${(totalGz / 1024).toFixed(0)} KB gzip)`);
if (heavy.length) {
  console.log('  pesadas (brasões detalhados):', heavy.sort((a, b) => b[1] - a[1]).map(([k, s]) => `${k}=${(s / 1024).toFixed(0)}KB`).join(' '));
}
