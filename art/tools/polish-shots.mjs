// Headless game shots for the polish pass. Usage:
//   node art/tools/polish-shots.mjs <baseUrl> <outDir> <suffix> [shots,comma] [quality]
// /api is blocked (no cloud traffic). Prints console errors per shot.
import { chromium } from 'playwright-core';
const [base = 'http://localhost:4190', outDir = 'art/previews/polish', suffix = 'before', only = '', q = 'ultra'] = process.argv.slice(2);
const SHOTS = {
  'earth-day': { lvl: 'e1', veh: 'roadster', wait: 5000 },
  'earth-truck-rcs': { lvl: 'e1', veh: 'hauler', wait: 3000, rcs: true },
  'moon-truck': { lvl: 'm1', veh: 'hauler', wait: 2500 },
  'mars-truck': { lvl: 'r1', veh: 'hauler', wait: 2500 },
  'night': { lvl: 'e3', veh: 'roadster', wait: 4000 },
  'boost-car': { lvl: 'e3', veh: 'roadster', wait: 300, racing: true, q: 'high' },
  'boost-truck': { lvl: 'r1', veh: 'hauler', wait: 300, racing: true, q: 'high' },
  'garage-truck': { lvl: 'garage', veh: 'hauler', wait: 2500 },
  'garage-car': { lvl: 'garage', veh: 'roadster', wait: 2500 },
};
const names = only ? only.split(',') : Object.keys(SHOTS);
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
let total = 0;
for (const n of names) {
  const S = SHOTS[n];
  const ctx = await browser.newContext({ viewport: { width: 915, height: 412 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.route('**/api/**', r => r.abort());
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push('pageerror: ' + e.message)); page.on('console', m => m.type() === 'error' && !/net::ERR_FAILED|Failed to load resource/.test(m.text()) && errs.push(m.text()));
  try {
    await page.goto(`${base}/?q=${S.q || q}`); await page.waitForFunction(() => window.__game?.screen === 'title', null, { timeout: 60000 });
    await page.evaluate(v => window.__game.setVehicle(v), S.veh);
    if (S.lvl === 'garage') { await page.evaluate(() => window.__game.goto('garage')); await page.waitForTimeout(S.wait); }
    else {
      await page.evaluate(id => window.__game.loadLevel(id, 'race'), S.lvl);
      await page.waitForFunction(() => window.__game.screen === 'race', null, { timeout: 90000 });
      await page.evaluate(() => { window.__game.input.touch.gas = 1; window.__game.input.touch.boost = 1; });
      if (S.racing) await page.waitForFunction(() => (window.__game.car?.raceTime || 0) > 1.0, null, { timeout: 300000 });
      await page.waitForTimeout(S.wait);
      if (S.rcs) {
        await page.evaluate(() => { const s = window.__game.sim(); const p = s.body.translation(); s.body.setTranslation({ x: p.x, y: p.y + 14, z: p.z }, true); window.__game.input.touch.jump = 1; window.__game.input.touch.left = 1; });
        await page.waitForTimeout(900);
      }
    }
    const out = `${outDir}/${n}-${suffix}.png`;
    await page.screenshot({ path: out, timeout: 120000 });
    total += errs.length;
    console.log('OK', n, '->', out, 'errors:', errs.length, errs.slice(0, 4).join(' | '));
  } catch (e) { total++; console.log('FAIL', n, e.message.split('\n')[0], errs.slice(0, 4).join(' | ')); }
  await ctx.close();
}
await browser.close();
console.log('TOTAL console errors:', total);
