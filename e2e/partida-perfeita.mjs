/**
 * Joga uma partida perfeita — 1800 pontos, as 15 rodadas cravadas — o mais
 * rápido que o jogo permite, e envia o placar para o ranking.
 *
 * Serve para dois propósitos:
 *   1. pôr uma linha de referência no topo do ranking, de propósito;
 *   2. provar de ponta a ponta que a nota máxima é alcançável, o que nenhum
 *      teste unitário prova — a pontuação do pino depende da projeção real
 *      medida no canvas real.
 *
 * O pino não precisa de zoom: o ponto de tela vem da mesma projeção que o app
 * usa, então `projection.invert` devolve exatamente a coordenada da capital e
 * a distância dá 0 km. É o mesmo truque que o `play-through.mjs` usa na
 * primeira rodada; aqui ele vale para todas.
 *
 * Uso:  npm run dev   (noutro terminal)
 *       node e2e/partida-perfeita.mjs [url] [nome]
 *
 * Contra produção, de uma máquina que a alcance:
 *       node e2e/partida-perfeita.mjs https://mundo.alexandre-aquiles.workers.dev/ "Robô"
 */
import { chromium } from 'playwright';
import { geoEqualEarth } from 'd3-geo';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:5173/';
const NOME = process.argv[3] ?? 'Playwright';
const OUT = resolve(import.meta.dirname, 'screenshots');
mkdirSync(OUT, { recursive: true });

const countries = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../src/data/countries.json'), 'utf8'),
);

/**
 * O Worker recusa partida com menos de 5 s somados (`MIN_DURATION_MS`).
 *
 * Desde o cronômetro esse tempo é a soma dos relógios das 15 rodadas, e não o
 * tempo de parede: esperar no fim da partida não conta mais nada. Quem tem de
 * gastar o tempo é cada rodada, daí a pausa antes de responder.
 */
const PISO_MS = 5_000;
const PAUSA_POR_RODADA_MS = Math.ceil(PISO_MS / 15) + 50;

try {
  await fetch(BASE, { signal: AbortSignal.timeout(8000) });
} catch (e) {
  console.error(`Não consegui falar com ${BASE} — ${e.message}`);
  console.error('Local: suba o servidor noutro terminal com `npm run dev`.');
  process.exit(1);
}

const browser = await chromium.launch({
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
// "Jogar" na primeira vez, "Jogar de novo" para quem o aparelho já conhece
await page.click('.btn--primary');

const t0 = Date.now();
const distancias = [];

for (let round = 1; round <= 15; round++) {
  await page.waitForSelector('.flag', { timeout: 10_000 });
  const country = await currentCountry();

  // gasta um naco do relógio desta rodada, para a soma passar do piso
  await page.waitForTimeout(PAUSA_POR_RODADA_MS);
  await page.click(`.option:text-is("${country.name}")`);
  await page.waitForSelector(`.option:text-is("${country.capital}")`, { timeout: 5_000 });
  await page.click(`.option:text-is("${country.capital}")`);

  await page.waitForSelector('.map__canvas', { timeout: 10_000 });
  // o canvas precisa ter tamanho antes de a projeção ser reproduzível
  await page.waitForFunction(() => {
    const c = document.querySelector('.map__canvas');
    return c && c.clientWidth > 0 && c.clientHeight > 0;
  }, { timeout: 5_000 });

  const box = await page.locator('.map__canvas').boundingBox();
  const size = await page.evaluate(() => {
    const c = document.querySelector('.map__canvas');
    return { w: c.clientWidth, h: c.clientHeight };
  });

  // a mesma projeção do app: Equal Earth ajustada à esfera na caixa do canvas
  const projection = geoEqualEarth().fitExtent([[0, 0], [size.w, size.h]], { type: 'Sphere' });
  const [x, y] = projection([country.capitalLng, country.capitalLat]);
  await page.mouse.click(box.x + x, box.y + y);

  await page.click('button:has-text("Confirmar palpite")');
  await page.waitForSelector('.card--reveal', { timeout: 10_000 });

  const texto = (await page.textContent('.card--reveal')).replace(/\s+/g, ' ').trim();
  const km = texto.match(/([\d.,]+)\s*km/);
  distancias.push(km ? km[1] : '?');
  if (!/\b0 km\b/.test(texto)) {
    problems.push(`rodada ${round} (${country.name}) não cravou: ${texto}`);
  }
  if (round === 15) await page.screenshot({ path: `${OUT}/perfeita-revelacao.png` });
  await page.click('.card--reveal button');
}

await page.waitForSelector('.screen--over', { timeout: 10_000 });
const jogo = Date.now() - t0;
console.log(`15 rodadas em ${(jogo / 1000).toFixed(1)} s — pinos: ${distancias.join(', ')} km`);

const relogio = (await page.textContent('.stats')).match(/tempo:\s*(\d+:\d\d)/);
console.log('relógio somado:', relogio ? relogio[1] : '?');

await page.fill('#player-name', NOME);
await page.click('.screen--over button[type="submit"]');

// ou entra no ranking, ou o nome é de outro aparelho — os dois são desfecho
await page.waitForSelector('.screen--over #name-error, .screen--over .rank, .ranking', { timeout: 15_000 })
  .catch(() => {});
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/perfeita-fim.png`, fullPage: true });

const placar = (await page.textContent('.final-score')).replace(/\s+/g, ' ').trim();
const erro = await page.locator('#name-error').first().textContent().catch(() => null);
console.log('placar final:', placar);
if (erro) console.log('envio recusado:', erro.replace(/\s+/g, ' ').trim());

await browser.close();
console.log(problems.length ? `PROBLEMAS:\n - ${problems.join('\n - ')}` : 'sem erros de console, 15 pinos cravados');
process.exit(problems.length ? 1 : 0);
