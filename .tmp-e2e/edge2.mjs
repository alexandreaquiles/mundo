import { chromium } from 'playwright';
import fs from 'node:fs';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const countries = JSON.parse(fs.readFileSync('src/data/countries.json', 'utf8'));
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const countryOf = async () => {
  const src = await page.getAttribute('.options ~ * .flag, .screen > .flag', 'src').catch(() => null)
    ?? await page.getAttribute('.flag', 'src');
  return countries.find((c) => c.cca2 === src.split('/').pop().replace('.svg', '').toUpperCase());
};
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.fill('#player-name', 'Teste');
await page.click('button:has-text("Jogar")');
await page.waitForSelector('.flag');

// acerta a bandeira, erra a capital: o placar tem de marcar 10 na hora
const c = await countryOf();
await page.click(`.option:text-is("${c.name}")`);
await page.waitForSelector(`.option:text-is("${c.capital}")`);
console.log('placar após acertar a bandeira:', (await page.textContent('.bar__score')).trim());
const wrongCap = await page.locator('.option').filter({ hasNotText: c.capital }).first().textContent();
await page.click(`.option:text-is("${wrongCap}")`);
await page.waitForSelector('.card--failed');
console.log('placar no cartão de erro da capital:', (await page.textContent('.bar__score')).trim());
await page.screenshot({ path: '.tmp-e2e/e2-errou-capital.png' });

// avanço automático: o cartão some sozinho
const t0 = Date.now();
await page.waitForSelector('.card--failed', { state: 'detached', timeout: 8000 });
console.log('cartão sumiu sozinho depois de', ((Date.now() - t0) / 1000).toFixed(1), 's');
console.log('placar na rodada seguinte:', (await page.textContent('.bar__score')).trim());
console.log('ERROS:', errors.length ? errors : 'nenhum');
await browser.close();
