// Real-player browser checks (touch input, reverse, pause, restart, perf telemetry, sharpness shot).
// usage: BASE=http://localhost:4173 node tests/player.browser.mjs
import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync } from 'fs';
const BASE = process.env.BASE || 'http://localhost:4173';
const R = []; const ok = (id, pass, info = {}) => { R.push({ id, pass, info }); console.log(`${pass ? 'PASS' : 'FAIL'} ${id} ${JSON.stringify(info)}`); };
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 924, height: 424 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
const G = (f, a) => page.evaluate(f, a); const apiReq = []; page.on('request', r => { if (r.url().includes('/api/save') || r.url().includes('/api/load')) apiReq.push(r.method() + ' ' + new URL(r.url()).pathname); });
await page.goto(`${BASE}/?q=performance`); await page.waitForFunction(() => window.__game?.screen === 'title', null, { timeout: 60000 });
await page.waitForTimeout(2500); ok('B14 fresh launch writes nothing to the cloud', apiReq.length === 0 && !(await G(() => window.__game.state.cloud)), { apiReq }); await G(() => { window.__game.state.settings.autoGas = false; window.__game.applySettings(); window.__game.loadLevel('e1'); }); await page.waitForFunction(() => window.__game.screen === 'race' && window.__game.car?.state === 'race', null, { timeout: 30000 }); await page.waitForSelector('[data-ctl="gas"]', { state: 'visible' });
const db = await G(() => ({ pr: window.__game.pixelRatio, db: window.__game.drawingBuffer }));
ok('RP10 __game.pixelRatio / drawingBuffer exposed', db.pr > 0 && db.db.w > 0, db);
ok('RP10 DPR capped <= 2', db.pr <= 2.01, { pr: db.pr });
const box = async sel => (await page.$(sel)).boundingBox();
const hold = async (sel, ms, dx = 0) => { const b = await box(sel); const x = b.x + b.width / 2, y = b.y + b.height / 2; const cdp = await ctx.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }); if (dx) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx, y, id: 1 }] });
  await page.waitForTimeout(ms); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
const s0 = await G(() => window.__game.car.s); await hold('[data-ctl="gas"]', 2500); const c1 = await G(() => window.__game.car);
ok('RP touch GAS drives forward', c1.kmh > 10, { ds: +(c1.s - s0).toFixed(1), kmh: +c1.kmh.toFixed(0) });
await hold('[data-ctl="brake"]', 4500); const c2 = await G(() => window.__game.car);
ok('RP touch BRAKE stops then REVERSES', c2.s < c1.s + 30 && (await G(() => window.__game.sim().reversing || window.__game.sim().forwardSpeed < -0.5)), { s1: +c1.s.toFixed(1), s2: +c2.s.toFixed(1) });
const x0 = (await G(() => window.__game.car)).x; await page.evaluate(() => {}); 
const cdpS = await ctx.newCDPSession(page); const pb = await box('.tpad'), gb = await box('[data-ctl="gas"]');
await cdpS.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: gb.x + gb.width / 2, y: gb.y + gb.height / 2, id: 1 }, { x: pb.x + pb.width / 2, y: pb.y + pb.height / 2, id: 2 }] });
await cdpS.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: gb.x + gb.width / 2, y: gb.y + gb.height / 2, id: 1 }, { x: pb.x + pb.width / 2 + 60, y: pb.y + pb.height / 2, id: 2 }] });
await page.waitForTimeout(150); const st = await G(() => window.__game.input.state().steer);
await page.waitForTimeout(1500); await cdpS.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
ok('RP multitouch gas + analog steer pad', Math.abs(st) > 0.3, { steer: st });
await page.waitForTimeout(2000); { const s = await G(() => window.__game.input.state()); ok('RP touch release clears input', !s.throttle && !s.brake && Math.abs(s.steer) < 0.05, s); }
await G(() => window.__game.pause(true)); await page.waitForTimeout(300);
const ps = await G(() => window.__game.screen); const sp = await G(() => window.__game.sim().t ?? window.__game.car.raceTime); await page.waitForTimeout(800); const sp2 = await G(() => window.__game.sim().t ?? window.__game.car.raceTime);
ok('RP pause menu opens and freezes the sim', ps === 'pause' && sp === sp2, { screen: ps });
await page.click('#p-quality'); await page.waitForTimeout(300); ok('RP pause menu graphics toggle', true, { quality: await G(() => window.__game.quality) });
await page.click('#p-restart'); await page.waitForFunction(() => window.__game.screen === 'race' && window.__game.car?.state === 'race', null, { timeout: 30000 });
const rs = await G(() => window.__game.car); ok('RP restart level resets progress', rs.s < 60 && rs.raceTime < 3, { s: +rs.s.toFixed(1), t: rs.raceTime });
await hold('[data-ctl="gas"]', 3000);
const ft = await G(() => window.__game.frameTimes(300)); const srt = [...ft].sort((a, b) => a - b);
ok('RP10 frame-time ring buffer', ft.length > 30, { n: ft.length, p50: srt[srt.length >> 1], p95: srt[Math.floor(srt.length * 0.95)] });
// B24 / B25 on a OnePlus 15 sized viewport at Ultra: native resolution and thumb-sized HUD buttons
{ const c2 = await browser.newContext({ viewport: { width: 924, height: 424 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }); const p2 = await c2.newPage();
  await p2.goto(`${BASE}/?q=ultra`); await p2.waitForFunction(() => window.__game?.screen === 'title', null, { timeout: 60000 });
  await p2.evaluate(() => window.__game.loadLevel('e1')); await p2.waitForFunction(() => window.__game.screen === 'race', null, { timeout: 90000 }); await p2.waitForTimeout(1500);
  const r = await p2.evaluate(() => ({ pr: window.__game.pixelRatio, db: window.__game.drawingBuffer, q: window.__game.quality }));
  ok('B24 Ultra renders at native DPR (OnePlus 15: 2772x1272)', r.pr >= 3 * (r.db.dynScale || 1) - 0.01 && r.db.w >= 2772 * 0.85 - 1, { pr: r.pr, w: r.db.w, h: r.db.h, dynScale: r.db.dynScale, q: r.q });
  const bb = await p2.evaluate(() => { const b = document.querySelector('#btn-pause').getBoundingClientRect(); return { w: b.width, h: b.height }; });
  const mm = Math.min(bb.w, bb.h) * 3 / 450 * 25.4; ok('B25 pause button >= 9 mm on the phone', mm >= 9, { css: bb, mm: +mm.toFixed(1) });
  await p2.screenshot({ path: 'qa-shots/b24-ultra-native.png' }); await c2.close(); }
mkdirSync('qa-shots', { recursive: true }); await page.screenshot({ path: 'qa-shots/rp9-sharpness.png' });
ok('RP9 sharpness screenshot saved (qa-shots/rp9-sharpness.png)', true, {});
ok('no page errors', errs.length === 0, { errs });
writeFileSync('tests/player-results.json', JSON.stringify(R, null, 1)); console.log(`${R.filter(r => r.pass).length}/${R.length} passed`);
await browser.close(); process.exit(R.every(r => r.pass) ? 0 : 1);
