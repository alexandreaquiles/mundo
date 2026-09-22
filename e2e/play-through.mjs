/**
 * Joga uma partida inteira num Chromium de verdade e guarda as telas.
 * Não é um teste automatizado com asserções — é a verificação manual
 * roteirizada: ela prova que o fluxo completo funciona e deixa as
 * imagens para conferir o visual.
 *
 * Uso:  npm run dev   (noutro terminal)
 *       node e2e/play-through.mjs [url]
 */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.argv[2] ?? 'http://127.0.0.1:5173/';
const OUT = resolve(import.meta.dirname, 'screenshots');
mkdirSync(OUT, { recursive: true });

const countries = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../src/data/countries.json'), 'utf8'),
);

const browser = await chromium.launch({
  // o ambiente pode trazer o Chromium num caminho próprio
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

const problems = [];
page.on('console', (m) => m.type() === 'error' && problems.push(m.text()));
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));

/** Descobre o país da rodada pela bandeira que está na tela. */
async function currentCountry() {
  const src = await page.getAttribute('.flag', 'src');
  const cca2 = src.split('/').pop().replace('.svg', '').toUpperCase();
  const country = countries.find((c) => c.cca2 === cca2);
  if (!country) throw new Error(`bandeira desconhecida: ${src}`);
  return country;
}

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.fill('#player-name', 'Playwright');
await page.screenshot({ path: `${OUT}/01-home.png` });
await page.click('button:has-text("Jogar")');

for (let round = 1; round <= 15; round++) {
  await page.waitForSelector('.flag', { timeout: 10_000 });
  const country = await currentCountry();
  if (round === 1) await page.screenshot({ path: `${OUT}/02-bandeira.png` });

  await page.click(`.option:text-is("${country.name}")`);
  await page.waitForSelector(`.option:text-is("${country.capital}")`, { timeout: 5_000 });
  if (round === 1) await page.screenshot({ path: `${OUT}/03-capital.png` });
  await page.click(`.option:text-is("${country.capital}")`);

  await page.waitForSelector('.map__canvas', { timeout: 10_000 });
  await page.waitForTimeout(round === 1 ? 1200 : 400);
  const box = await page.locator('.map__canvas').boundingBox();
  if (round === 1) await page.screenshot({ path: `${OUT}/04-mapa.png` });

  // na primeira rodada crava o pino na capital, para conferir que a
  // inversão da projeção no app real dá exatamente 0 km
  let target = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  if (round === 1) {
    const { geoEqualEarth } = await import('d3-geo');
    const size = await page.evaluate(() => {
      const c = document.querySelector('.map__canvas');
      return { w: c.clientWidth, h: c.clientHeight };
    });
    const projection = geoEqualEarth().fitExtent([[0, 0], [size.w, size.h]], { type: 'Sphere' });
    const [x, y] = projection([country.capitalLng, country.capitalLat]);
    target = { x: box.x + x, y: box.y + y };
  }
  await page.mouse.click(target.x, target.y);
  if (round === 1) await page.screenshot({ path: `${OUT}/05-pino.png` });

  await page.click('button:has-text("Confirmar palpite")');
  await page.waitForSelector('.card--reveal', { timeout: 10_000 });
  await page.waitForTimeout(round === 1 ? 1200 : 300);
  if (round === 1) {
    await page.screenshot({ path: `${OUT}/06-revelacao.png` });
    const texto = (await page.textContent('.card--reveal')).replace(/\s+/g, ' ').trim();
    console.log('rodada 1, pino cravado na capital →', texto);
    if (!texto.includes('0 km')) problems.push(`pino exato não deu 0 km: ${texto}`);
  }
  await page.click('.card--reveal button');
}

await page.waitForSelector('.screen--over', { timeout: 10_000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/07-fim.png`, fullPage: true });
console.log('placar final:', (await page.textContent('.final-score')).replace(/\s+/g, ' ').trim());

await page.click('button:has-text("Ver o ranking")');
await page.waitForSelector('.ranking, .muted', { timeout: 8_000 });
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/08-ranking.png`, fullPage: true });

await browser.close();
console.log(problems.length ? `PROBLEMAS:\n - ${problems.join('\n - ')}` : 'sem erros de console');
process.exit(problems.length ? 1 : 0);
