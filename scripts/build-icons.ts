/** Gera os PNGs do manifest a partir do SVG de origem. */
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

const root = resolve(import.meta.dirname, '..');
const src = resolve(root, 'public/favicon.svg');
const out = resolve(root, 'public/icons');
mkdirSync(out, { recursive: true });

const jobs: { name: string; size: number; padding: number }[] = [
  { name: 'pwa-192.png', size: 192, padding: 0 },
  { name: 'pwa-512.png', size: 512, padding: 0 },
  // maskable precisa de margem: o sistema recorta as bordas
  { name: 'maskable-512.png', size: 512, padding: 0.18 },
  { name: 'apple-touch-icon.png', size: 180, padding: 0.06 },
];

for (const job of jobs) {
  const inner = Math.round(job.size * (1 - job.padding * 2));
  const offset = Math.round((job.size - inner) / 2);
  const art = await sharp(src, { density: 512 }).resize(inner, inner).png().toBuffer();
  await sharp({
    create: { width: job.size, height: job.size, channels: 4, background: '#0b1020' },
  })
    .composite([{ input: art, top: offset, left: offset }])
    .png()
    .toFile(resolve(out, job.name));
  console.log(`✓ ${job.name} (${job.size}px)`);
}
