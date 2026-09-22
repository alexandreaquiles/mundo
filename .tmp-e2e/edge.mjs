import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = '.tmp-e2e';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const countries = JSON.parse(fs.readFileSync('src/data/countries.json', 'utf8'));
const errors = [];

async function newPage(viewport) {
  const p = await browser.newPage({ viewport, deviceScaleFactor: 2 });
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  return p;
}
const countryOf = async (page) => {
  const src = await page.getAttribute('.flag', 'src');
  const cca2 = src.split('/').pop().replace('.svg', '').toUpperCase();
  return countries.find((c) => c.cca2 === cca2);
};

// ── 1. caminho do erro ────────────────────────────────────────────────────
{
  const page = await newPage({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
  await page.fill('#player-name', 'Teste');
  await page.click('button:has-text("Jogar")');
  await page.waitForSelector('.flag');
  const c1 = await countryOf(page);

  // erra a bandeira de propósito
  const wrong = await page.locator('.option').filter({ hasNotText: c1.name }).first().textContent();
  await page.click(`.option:text-is("${wrong}")`);
  await page.waitForSelector('.card--failed', { timeout: 5000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/e1-errou-bandeira.png` });
  const shown = (await page.textContent('.card--failed')).replace(/\s+/g, ' ');
  console.log('erro na bandeira → mostra:', shown.trim());
  console.log('  resposta correta era:', c1.name, '| contém?', shown.includes(c1.name));
  console.log('  placar segue em 0?', (await page.textContent('.bar__score')).trim());

  // avança e erra a capital
  await page.click('.card--failed button');
  await page.waitForSelector('.flag');
  const c2 = await countryOf(page);
  await page.click(`.option:text-is("${c2.name}")`);
  await page.waitForSelector(`.option:text-is("${c2.capital}")`);
  const wrongCap = await page.locator('.option').filter({ hasNotText: c2.capital }).first().textContent();
  await page.click(`.option:text-is("${wrongCap}")`);
  await page.waitForSelector('.card--failed');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/e2-errou-capital.png` });
  console.log('erro na capital → placar:', (await page.textContent('.bar__score')).trim(), '(esperado 10 pts)');

  // o cartão some sozinho depois de ~3,2 s
  const before = Date.now();
  await page.waitForSelector('.flag', { timeout: 6000 });
  console.log('avanço automático depois de', Math.round((Date.now() - before) / 100) / 10, 's');
  await page.close();
}

// ── 2. zoom por roda e teclado ────────────────────────────────────────────
{
  const page = await newPage({ width: 1280, height: 800 });
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
  await page.fill('#player-name', 'Desktop');
  await page.click('button:has-text("Jogar")');
  for (;;) {
    await page.waitForSelector('.flag, .map__canvas');
    if (await page.locator('.map__canvas').count()) break;
    const c = await countryOf(page);
    await page.click(`.option:text-is("${c.name}")`);
    await page.waitForSelector(`.option:text-is("${c.capital}")`);
    await page.click(`.option:text-is("${c.capital}")`);
  }
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/e3-desktop.png` });

  const box = await page.locator('.map__canvas').boundingBox();
  await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.45);
  for (let i = 0; i < 6; i++) await page.mouse.wheel(0, -240);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/e4-desktop-wheel.png` });

  // a roda sobre o mapa não pode rolar a página
  const scrollY = await page.evaluate(() => window.scrollY);
  console.log('scroll da página após a roda no mapa:', scrollY, '(esperado 0)');

  await page.locator('.map__canvas').focus();
  await page.keyboard.press('0');
  await page.keyboard.press('+');
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/e5-teclado.png` });
  await page.close();
}

console.log('ERROS DE CONSOLE:', errors.length ? errors.slice(0, 10) : 'nenhum');
await browser.close();
