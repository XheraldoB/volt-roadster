// node tools/shot.mjs <level> <quality> <out> [waitMs]
import { chromium } from 'playwright-core';
const [lvl = 'e1', q = 'high', out = 'shots/x.png', wait = '7000', veh = 'roadster', tab = ''] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 915, height: 412 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && errs.push(m.text()));
await page.goto(`http://localhost:4173/?q=${q}`); await page.waitForFunction(() => window.__game?.screen === 'title', null, { timeout: 30000 });
await page.evaluate(v => window.__game.setVehicle(v), veh);
if (lvl === 'title' || lvl === 'garage' || lvl === 'base' || lvl === 'map') { if (lvl !== 'title') await page.evaluate(l => window.__game.goto(l), lvl); else await page.evaluate(() => window.__game.goto('title'));
  if (tab) for (const sel of tab.split(',')) { await page.click(sel); await page.waitForTimeout(400); }
  await page.waitForTimeout(+wait); }
else { await page.evaluate(id => window.__game.loadLevel(id, 'race'), lvl); await page.waitForFunction(() => window.__game.screen === 'race', null, { timeout: 90000 }); await page.evaluate(() => window.__game.input.touch.boost = 1); await page.waitForTimeout(+wait); }
await page.screenshot({ path: out }); console.log(out, 'errors:', errs.length, errs.slice(0, 5).join(' | '), JSON.stringify(await page.evaluate(() => window.__game.car)));
await browser.close();
