// Automated QA (TESTING.md T/G/R). usage: BASE=http://localhost:4173 node tools/qa.mjs [phase-label]
import { chromium } from 'playwright-core';
const BASE = process.env.BASE || 'http://localhost:4173', LABEL = process.argv[2] || 'local';
const results = []; const ok = (id, pass, info = '') => { results.push({ id, pass, info }); console.log(`${pass ? 'PASS' : 'FAIL'} ${id} ${info}`); };
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 924, height: 424 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errs = [], bad = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !G_EXPECT.flag) errs.push('console: ' + m.text()); });
page.on('response', r => { if (r.status() >= 400 && !r.url().includes('create-checkout-session')) bad.push(r.status() + ' ' + r.url()); });
const G_EXPECT = { flag: false };
const G = (fn, arg) => page.evaluate(fn, arg);
const t0 = Date.now();
await page.goto(`${BASE}/?q=low`);
await page.waitForFunction(() => window.__game?.screen === 'title', null, { timeout: 60000 });
ok('T2 boot->title', true, `${((Date.now() - t0) / 1000).toFixed(1)} s`);
const webgl2 = await G(() => !!document.createElement('canvas').getContext('webgl2')); ok('T2 webgl2', webgl2);
const f1 = await G(() => window.__game.gfx.renderer.info.render.frame); await page.waitForTimeout(1500); const f2 = await G(() => window.__game.gfx.renderer.info.render.frame);
ok('T2 render loop running', f2 > f1, `frames ${f1}->${f2}`);
const noScroll = await G(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.documentElement.scrollHeight <= innerHeight + 1); ok('T3 no scrollbars', noScroll);
const api = await G(async () => { const r = await fetch('/api/health'); return { s: r.status, j: await r.json() }; }); ok('T7 /api/health', api.s === 200, JSON.stringify(api.j));
// G15 all worlds unlocked
const lv = await G(() => window.__game.levels()); ok('G3 level count', lv.length >= 5, `${lv.length} levels`);
await G(() => window.__game.goto('map')); await page.waitForTimeout(800);
const planets = await page.$$eval('#planets button', b => b.map(x => x.dataset.p + (x.disabled ? ':locked' : ''))); ok('G15 planets selectable', planets.length === 3 && planets.every(p => !p.includes('locked')), planets.join(','));
// garage + shop + vehicles
await G(() => window.__game.goto('garage')); await page.waitForTimeout(800);
const vehBtns = await page.$$eval('[data-veh]', b => b.map(x => x.dataset.veh)); ok('27 garage vehicle selector', vehBtns.includes('hauler') && vehBtns.includes('roadster'), vehBtns.join(','));
await page.click('#garage-tabs [data-t="shop"]'); await page.waitForTimeout(300);
const cats = await page.$$eval('[data-cat]', b => b.map(x => x.dataset.cat)); ok('26 shop categories', cats.length >= 9, cats.join(','));
const coins0 = await G(() => window.__game.state.coins);
await page.click('[data-cat="horns"]'); await page.waitForTimeout(200); await page.click('[data-item="goose"]'); await page.waitForTimeout(300);
const st1 = await G(() => ({ c: window.__game.state.coins, own: window.__game.state.owned.horns, horn: window.__game.state.custom.horn }));
ok('26 buy coin item (horn)', st1.own.includes('goose') && st1.c === coins0 - 200 && st1.horn === 'goose', JSON.stringify(st1));
const gems0 = await G(() => window.__game.gems);
await page.click('[data-cat="trails"]'); await page.waitForTimeout(200); await page.click('[data-item="rainbow"]'); await page.waitForTimeout(300);
const st2 = await G(() => ({ g: window.__game.gems, own: window.__game.state.owned.trails }));
ok('26 premium item blocked without gems (no fake purchase)', !st2.own.includes('rainbow') && st2.g === gems0, JSON.stringify(st2));
await page.click('#garage-tabs [data-t="gems"]'); await page.waitForTimeout(300);
const packs = await page.$$eval('[data-pack]', b => b.map(x => x.disabled)); ok('26 gem store disabled / coming soon', packs.length >= 3 && packs.every(Boolean), `${packs.length} packs disabled`);
G_EXPECT.flag = true; const checkout = await G(async () => (await fetch('/api/create-checkout-session', { method: 'POST', body: '{}' })).status); await page.waitForTimeout(200); G_EXPECT.flag = false; ok('26 checkout endpoint off', checkout === 501 || checkout === 404, 'status ' + checkout);
// save round trip
const saved = await G(() => { window.__game.state.coins += 1; const s = window.__game.save(); return s.coins; }); const loaded = await G(() => window.__game.load().coins); ok('T7 local save round trip', saved === loaded, `${saved}=${loaded}`);
// races with both vehicles
for (const veh of ['roadster', 'hauler']) {
  await G(v => (window.__game.grantVehicle(v), window.__game.setVehicle(v)), veh);
  await G(() => window.__game.loadLevel('e1', 'race'));
  await page.waitForFunction(() => window.__game.screen === 'race' && window.__game.car?.state === 'race', null, { timeout: 120000 });
  // touch controls: real pointer taps on GAS/boost
  const gasBox = await page.$('#t-gas'); if (gasBox && await gasBox.isVisible()) { const b = await gasBox.boundingBox(); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); }
  await G(() => { window.__game.input.touch.gas = 1; window.__game.input.touch.boost = 1; });
  const c0 = await G(() => window.__game.car); await page.waitForTimeout(9000); const c1 = await G(() => window.__game.car);
  ok(`G1 ${veh} drives`, c1.s > c0.s + 20 && c1.kmh > 20, `s ${c0.s.toFixed(0)}->${c1.s.toFixed(0)} ${c1.kmh.toFixed(0)} km/h`);
  ok(`G4 ${veh} battery drains`, c1.battery < c0.battery, `${c0.battery.toFixed(1)}->${c1.battery.toFixed(1)}`);
  ok(`${veh} vehicle in sim`, c1.vehicle === veh);
  if (veh === 'hauler') {
    // launch it into the air and fire the cold-gas jets
    await G(() => { const s = window.__game.sim(); const p = s.body.translation(); s.body.setTranslation({ x: p.x, y: p.y + 25, z: p.z }, true); window.__game.input.touch.jump = 1; window.__game.input.touch.left = 1; });
    let seen = null; for (let i = 0; i < 20 && !seen; i++) { await page.waitForTimeout(150); const c = await G(() => window.__game.car); if (c.rcs.lift || Math.abs(c.rcs.py) > 0.05) seen = c; }
    ok('27 RCS jets fire in air (hover + attitude)', !!seen, seen ? `gas ${seen.gas.toFixed(2)} lift ${seen.rcs.lift} roll ${seen.rcs.py}` : 'not seen');
    await G(() => { window.__game.input.touch.jump = 0; window.__game.input.touch.left = 0; });
    await page.screenshot({ path: `shots/${LABEL}-truck-rcs.png` });
    const gasLbl = await page.textContent('#thr-lbl'); ok('27 HUD gas gauge', gasLbl === 'GAS', gasLbl);
  } else await page.screenshot({ path: `shots/${LABEL}-race.png` });
  // pause / resume
  await page.click('#btn-pause'); await page.waitForTimeout(300); const ps = await G(() => window.__game.screen); ok(`G pause ${veh}`, ps === 'pause');
  await G(() => window.__game.pause(false)); await page.waitForTimeout(300);
  await G(() => { const t = window.__game.input.touch; for (const k in t) t[k] = 0; });
}
// moon / mars quick boot with hauler
for (const id of ['m1', 'r3']) { await G(i => window.__game.loadLevel(i, 'race'), id); await page.waitForFunction(() => window.__game.screen === 'race', null, { timeout: 120000 }); await page.waitForTimeout(1500); const w = await G(() => [window.__game.world, window.__game.sim().g]); ok(`G12/13 ${id} loads`, true, `world ${w[0]} g=${w[1]}`); }
await G(() => window.__game.goto('base')); await page.waitForTimeout(1500); ok('G14 base screen', (await G(() => window.__game.screen)) === 'base');
await G(() => window.__game.goto('garage')); await page.waitForTimeout(1500); await page.screenshot({ path: `shots/${LABEL}-garage.png` });
// portrait prompt
await page.setViewportSize({ width: 424, height: 924 }); await page.waitForTimeout(500); const rot = await G(() => getComputedStyle(document.getElementById('rotate')).display !== 'none'); ok('T3 portrait rotate prompt', rot); await page.setViewportSize({ width: 924, height: 424 });
const fps = await G(() => window.__game.fps); ok('T5 fps reported', fps > 0, `${fps} fps (software GL)`);
ok('T2 zero console errors', errs.length === 0, errs.slice(0, 5).join(' | '));
ok('T2 zero HTTP errors', bad.length === 0, bad.slice(0, 5).join(' | '));
const fails = results.filter(r => !r.pass); console.log(`\n${LABEL}: ${results.length - fails.length}/${results.length} passed`); await browser.close(); process.exit(fails.length ? 1 : 0);
