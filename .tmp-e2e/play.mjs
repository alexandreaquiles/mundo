import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = '.tmp-e2e';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.fill('#player-name', 'Alexandre');
await page.screenshot({ path: `${OUT}/01-home.png` });
await page.click('button:has-text("Jogar")');
await page.waitForSelector('.flag');
await page.screenshot({ path: `${OUT}/02-bandeira.png` });

// O DOM não sabe a resposta; extraímos do estado do jogo via os dados embarcados.
const countries = JSON.parse(fs.readFileSync('src/data/countries.json', 'utf8'));
const byName = new Map(countries.map((c) => [c.name, c]));
const byCapital = new Map(countries.map((c) => [c.capital, c]));

/** Descobre o país pela URL da bandeira mostrada. */
async function currentCountry() {
  const src = await page.getAttribute('.flag', 'src');
  const cca2 = src.split('/').pop().replace('.svg', '').toUpperCase();
  return countries.find((c) => c.cca2 === cca2);
}

let shots = 0;
for (let round = 1; round <= 15; round++) {
  await page.waitForSelector('.flag, .card--failed', { timeout: 10000 });
  const country = await currentCountry();
  if (!country) throw new Error('não identifiquei o país da rodada ' + round);

  // acerta a bandeira
  await page.click(`.option:text-is("${country.name}")`);
  await page.waitForTimeout(120);

  // acerta a capital
  await page.waitForSelector(`.option:text-is("${country.capital}")`, { timeout: 5000 });
  if (round === 1) await page.screenshot({ path: `${OUT}/03-capital.png` });
  await page.click(`.option:text-is("${country.capital}")`);

  // mapa
  await page.waitForSelector('.map__canvas', { timeout: 10000 });
  await page.waitForTimeout(round === 1 ? 1500 : 400);
  const box = await page.locator('.map__canvas').boundingBox();
  if (round === 1) {
    await page.screenshot({ path: `${OUT}/04-mapa.png` });
    // testa o zoom pelos botões
    await page.click('button[aria-label="Aproximar"]');
    await page.click('button[aria-label="Aproximar"]');
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/05-mapa-zoom.png` });
    await page.click('button[aria-label="Recentralizar"]');
    await page.waitForTimeout(300);
  }

  // clica num ponto do mapa; na primeira rodada, exatamente na capital
  let target = { x: box.x + box.width * 0.5, y: box.y + box.height * 0.5 };
  if (round === 1) {
    const p = await page.evaluate(() => {
      const c = document.querySelector('.map__canvas');
      return { w: c.clientWidth, h: c.clientHeight };
    });
    // reproduz a projeção do app para cravar o pino na capital
    const { geoEqualEarth } = await import('d3-geo');
    const proj = geoEqualEarth().fitExtent([[0, 0], [p.w, p.h]], { type: 'Sphere' });
    const s = proj([country.capitalLng, country.capitalLat]);
    target = { x: box.x + s[0], y: box.y + s[1] };
  }
  await page.mouse.click(target.x, target.y);
  await page.waitForTimeout(200);
  if (round === 1) await page.screenshot({ path: `${OUT}/06-pino.png` });

  await page.click('button:has-text("Confirmar palpite")');
  await page.waitForSelector('.card--reveal', { timeout: 10000 });
  await page.waitForTimeout(round === 1 ? 1200 : 300);
  if (round === 1) {
    await page.screenshot({ path: `${OUT}/07-revelacao.png` });
    const txt = await page.textContent('.card--reveal');
    console.log('rodada 1 (pino exato):', txt.replace(/\s+/g, ' ').trim());
  }
  if (round === 8 && shots++ === 0) await page.screenshot({ path: `${OUT}/08-revelacao-longe.png` });
  await page.click('.card--reveal button:has-text("Continuar")');
  await page.waitForTimeout(150);
}

await page.waitForSelector('.screen--over', { timeout: 10000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/09-fim.png`, fullPage: true });
console.log('placar final:', (await page.textContent('.final-score')).replace(/\s+/g, ' ').trim());
console.log('ranking:', (await page.textContent('.rank-note').catch(() => '(sem posição)')).replace(/\s+/g, ' ').trim());

await page.click('button:has-text("Ver o ranking")');
await page.waitForSelector('.ranking, .muted', { timeout: 8000 });
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/10-ranking.png`, fullPage: true });

console.log('ERROS DE CONSOLE:', errors.length ? errors.slice(0, 10) : 'nenhum');
await browser.close();
