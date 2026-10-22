// Phase 2 gameplay checks in the real browser build (local preview), touch-driven where it matters.
import fs from 'node:fs';
import { launch, newPage, bootToTitle, shot, G, touch, tapSel, center, startLevel, writeJSON, OP15 } from './lib.mjs';
const BASE = process.env.BASE || 'http://localhost:4173'; const TAG = process.env.TAG || 'p2';
const VIEW = { ...OP15, viewport: { width: 924, height: 424 } };
const R = {}; const rec = (k, v) => { R[k] = v; console.log(k, JSON.stringify(v)); writeJSON(`${TAG}-results.json`, R); };
const autoSrc = fs.readFileSync(new URL('./auto.js', import.meta.url), 'utf8');
const b = await launch();
const { page, log, cdp } = await newPage(b, VIEW);
await page.addInitScript(autoSrc);
const safe = async (name, fn) => { try { await fn(); } catch (e) { rec(name + '_ERROR', String(e.message || e).slice(0, 300)); } };
await bootToTitle(page, `${BASE}/?q=low`);
rec('fresh', await G(page, () => ({ coins: __game.state.coins, gems: __game.state.gems, vehicle: __game.vehicle, fpsCap: __game.state.settings.fpsCap, quality: __game.state.settings.quality, haptics: __game.state.settings.haptics })));
// 1. planets unlocked + rocket cutscene
await safe('planets', async () => {
  await tapSel(page, cdp, '#btn-play'); await page.waitForTimeout(800);
  await tapSel(page, cdp, '#planets [data-p="moon"]'); await page.waitForTimeout(1500);
  const cut = await G(page, () => ({ screen: __game.screen, title: document.querySelector('#cut-title').textContent })); await shot(page, `${TAG}-rocket-cutscene`);
  await tapSel(page, cdp, '#cut-skip'); await page.waitForTimeout(1500);
  const moon = await G(page, () => ({ screen: __game.screen, world: __game.world, nodes: [...document.querySelectorAll('#nodes .node')].map(n => n.classList.contains('locked') ? 'L' : 'O').join('') }));
  await shot(page, `${TAG}-map-moon`);
  await tapSel(page, cdp, '#planets [data-p="mars"]'); await page.waitForTimeout(600); await tapSel(page, cdp, '#cut-skip'); await page.waitForTimeout(1500);
  const mars = await G(page, () => ({ world: __game.world, nodes: [...document.querySelectorAll('#nodes .node')].map(n => n.classList.contains('locked') ? 'L' : 'O').join('') }));
  await tapSel(page, cdp, '#planets [data-p="earth"]'); await page.waitForTimeout(600); await tapSel(page, cdp, '#cut-skip'); await page.waitForTimeout(1500);
  const earth = await G(page, () => ({ world: __game.world, nodes: [...document.querySelectorAll('#nodes .node')].map(n => n.classList.contains('locked') ? 'L' : 'O').join('') }));
  rec('planets_unlocked', { cut, moon, mars, earth });
});
// 2. vehicle price bypass
await safe('vehicle', async () => {
  await G(page, () => __game.goto('garage')); await page.waitForTimeout(800);
  const before = await G(page, () => ({ coins: __game.state.coins, veh: __game.vehicle, haulerBtn: document.querySelector('[data-veh="hauler"]').textContent }));
  await tapSel(page, cdp, '[data-veh="hauler"]'); await page.waitForTimeout(500);
  const after = await G(page, () => ({ coins: __game.state.coins, veh: __game.vehicle }));
  await shot(page, `${TAG}-garage-hauler-selected`);
  rec('hauler_price_check', { before, after, vehiclePrice: 6000 });
  await tapSel(page, cdp, '[data-veh="roadster"]'); await page.waitForTimeout(300);
});
// 3. can't afford
await safe('afford', async () => {
  await G(page, () => { __game.state.coins = 0; __game.state.gems = 0; __game.goto('garage'); }); await page.waitForTimeout(500);
  await tapSel(page, cdp, '#garage-tabs [data-t="upgrades"]');
  const ups = await G(page, () => [...document.querySelectorAll('[data-up]')].map(b => [b.dataset.up, b.disabled, b.textContent]));
  await tapSel(page, cdp, '[data-up="speed"]'); const afterTap = await G(page, () => ({ coins: __game.state.coins, up: { ...__game.state.upgrades } }));
  await tapSel(page, cdp, '#garage-tabs [data-t="shop"]'); await tapSel(page, cdp, '[data-cat="paints"]'); await tapSel(page, cdp, '[data-item="gold"]'); await page.waitForTimeout(300);
  const paint = await G(page, () => ({ owned: __game.state.owned.paints, paint: __game.state.custom.paint, coins: __game.state.coins, toast: [...document.querySelectorAll('.toast')].map(t => t.textContent).slice(-2) }));
  await tapSel(page, cdp, '[data-item="mint"]'); await page.waitForTimeout(300);
  const gem = await G(page, () => ({ owned: __game.state.owned.paints, gems: __game.state.gems, toast: [...document.querySelectorAll('.toast')].map(t => t.textContent).slice(-2) }));
  rec('cant_afford', { ups, afterTap, paint, gem });
});
// 4. upgrades change stats + persist; rapid taps
await safe('upgrades', async () => {
  await G(page, () => { __game.state.coins = 20000; __game.goto('garage'); }); await page.waitForTimeout(400);
  const statTxt = () => G(page, () => [...document.querySelectorAll('.vcard.on .sbar')].map(e => e.textContent.trim()));
  await tapSel(page, cdp, '#garage-tabs [data-t="vehicle"]'); const s0 = await statTxt();
  await tapSel(page, cdp, '#garage-tabs [data-t="upgrades"]');
  const costs = await G(page, () => Object.fromEntries([...document.querySelectorAll('[data-up]')].map(b => [b.dataset.up, b.textContent])));
  for (const u of ['speed', 'speed', 'tank', 'handling', 'accel']) await tapSel(page, cdp, `[data-up="${u}"]`);
  const st1 = await G(page, () => ({ coins: __game.state.coins, up: { ...__game.state.upgrades } }));
  await tapSel(page, cdp, '#garage-tabs [data-t="vehicle"]'); const s1 = await statTxt();
  // rapid taps: coins for exactly one more tier
  await tapSel(page, cdp, '#garage-tabs [data-t="upgrades"]');
  const nextCost = await G(page, () => +document.querySelector('[data-up="boost"]').textContent.replace(/[^0-9]/g, ''));
  await G(page, c => { __game.state.coins = c + 10; __game.goto('garage'); }, nextCost); await page.waitForTimeout(300); await tapSel(page, cdp, '#garage-tabs [data-t="upgrades"]');
  const c = await center(page, '[data-up="boost"]'); for (let i = 0; i < 8; i++) { await touch(cdp, 'touchStart', [{ ...c, id: 1 }]); await touch(cdp, 'touchEnd', []); }
  await page.waitForTimeout(400); const rapid = await G(page, () => ({ coins: __game.state.coins, boost: __game.state.upgrades.boost }));
  await page.waitForTimeout(800);
  await page.reload(); await page.waitForFunction(() => window.__game && __game.screen === 'title', null, { timeout: 90000 });
  const persisted = await G(page, () => ({ coins: __game.state.coins, up: { ...__game.state.upgrades } }));
  await startLevel(page, 'e1', 'trial');
  const sim = await G(page, () => { const s = __game.sim(); return { vmaxKmh: Math.round(s.stats.vmax * 3.6), tank: s.stats.tank, grip: +s.stats.grip.toFixed(2), accel: s.stats.accel, battery: Math.round(s.battery) }; });
  rec('upgrades', { statsBefore: s0, costs, afterBuys: st1, statsAfter: s1, rapidTaps: { nextCost, ...rapid }, persistedAfterReload: persisted, simStats: sim });
});
// 5. customizer: buy + equip paint, persists, visible
await safe('custom', async () => {
  await G(page, () => { __game.state.coins = 5000; __game.goto('garage'); }); await page.waitForTimeout(600);
  await tapSel(page, cdp, '#garage-tabs [data-t="shop"]'); await tapSel(page, cdp, '[data-cat="paints"]'); await tapSel(page, cdp, '[data-item="green"]');
  await tapSel(page, cdp, '[data-cat="rims"]'); await tapSel(page, cdp, '[data-item="neon"]');
  await tapSel(page, cdp, '[data-cat="spoilers"]'); await tapSel(page, cdp, '[data-item="wing"]');
  await page.waitForTimeout(1500); await shot(page, `${TAG}-garage-custom`);
  const st = await G(page, () => ({ custom: { paint: __game.state.custom.paint, rims: __game.state.custom.rims, spoiler: __game.state.custom.spoiler }, coins: __game.state.coins, owned: { p: __game.state.owned.paints, r: __game.state.owned.rims, s: __game.state.owned.spoilers } }));
  await page.waitForTimeout(800); await page.reload(); await page.waitForFunction(() => window.__game && __game.screen === 'title', null, { timeout: 90000 });
  const after = await G(page, () => ({ paint: __game.state.custom.paint, rims: __game.state.custom.rims, spoiler: __game.state.custom.spoiler }));
  rec('customizer', { st, afterReload: after });
});
// 6. race HUD: minimap toggle, pause/restart, flip/oob recovery
await safe('race', async () => {
  await startLevel(page, 'e1', 'race'); await page.waitForTimeout(3000);
  await tapSel(page, cdp, '#minimap'); await page.waitForTimeout(800); const big = await G(page, () => document.querySelector('#minimap').classList.contains('big')); await shot(page, `${TAG}-minimap-big`); await tapSel(page, cdp, '#minimap');
  const pre = await G(page, () => ({ t: __game.car.raceTime, coins: __game.car.coins, s: __game.car.s }));
  await tapSel(page, cdp, '#btn-pause'); await page.waitForTimeout(800); const p1 = await G(page, () => ({ screen: __game.screen, t: __game.car.raceTime })); await page.waitForTimeout(1500); const p2 = await G(page, () => __game.car.raceTime);
  await shot(page, `${TAG}-pause`);
  await tapSel(page, cdp, '#p-restart'); await page.waitForFunction(() => __game.screen === 'race' && __game.car, null, { timeout: 90000 });
  const rs = await G(page, () => ({ state: __game.car.state, t: __game.car.raceTime, coins: __game.car.coins, s: Math.round(__game.car.s) }));
  rec('pause_restart', { minimapBig: big, pre, pausedScreen: p1, timeFrozen: p1.t === p2, afterRestart: rs });
  // pause during countdown then resume
  await tapSel(page, cdp, '#btn-pause'); await page.waitForTimeout(500); const pc = await G(page, () => ({ screen: __game.screen, cd: __game.sim().countdown })); await tapSel(page, cdp, '#p-resume');
  await page.waitForFunction(() => __game.car.state === 'race', null, { timeout: 60000 });
  rec('pause_in_countdown', pc);
  // flipped (upside down) on road, autoGas on
  await page.waitForTimeout(2000);
  const flip = async (axisAngle) => { await G(page, a => { const s = __game.sim(); const q = s.pose.q.clone(); const fwd = { x: 0, y: 0, z: 1 }; const t = s.body.translation(); const h = Math.sin(a / 2); const qr = { x: 0, y: 0, z: h, w: Math.cos(a / 2) }; // local roll
      const m = q.clone().multiply(new q.constructor(qr.x, qr.y, qr.z, qr.w)); s.body.setTranslation({ x: t.x, y: t.y + 1.5, z: t.z }, true); s.body.setRotation({ x: m.x, y: m.y, z: m.z, w: m.w }, true); s.body.setLinvel({ x: 0, y: 0, z: 0 }, true); s.body.setAngvel({ x: 0, y: 0, z: 0 }, true); window.__ev = []; const o = s.emit.bind(s); s.emit = (ty, d) => { window.__ev.push(ty + (d && d.reason ? ':' + d.reason : '')); o(ty, d); }; }, axisAngle);
    const t0 = Date.now(); let res = null; for (let i = 0; i < 40; i++) { await page.waitForTimeout(500); const ev = await G(page, () => window.__ev); if (ev.includes('respawn')) { res = { events: ev, secs: (Date.now() - t0) / 1000 }; break; } } return res || { events: await G(page, () => window.__ev), secs: 'no respawn in 20s', car: await G(page, () => __game.car) }; };
  const upside = await flip(Math.PI); await page.waitForTimeout(2500); await shot(page, `${TAG}-after-flip-respawn`);
  const side = await flip(Math.PI / 2);
  rec('flipped_recovery', { upsideDown: upside, onSide_autoGas: side });
  // on side with autoGas OFF and no input -> does anything recover without the respawn button?
  await G(page, () => { __game.input.settings.autoGas = false; }); await page.waitForTimeout(1000);
  const side2 = await flip(Math.PI / 2); await G(page, () => { __game.input.settings.autoGas = true; });
  rec('onSide_noInput', side2);
  // out of bounds teleport
  await G(page, () => { const s = __game.sim(); const t = s.body.translation(); const X = s.tr.samples[s.prog.i].X; s.body.setTranslation({ x: t.x + X.x * 150, y: t.y + 5, z: t.z + X.z * 150 }, true); window.__ev = []; });
  let oob = null; for (let i = 0; i < 30 && !oob; i++) { await page.waitForTimeout(500); const ev = await G(page, () => window.__ev); if (ev.includes('respawn')) oob = { ev, after: await G(page, () => ({ x: __game.car.x, s: __game.car.s })) }; }
  rec('out_of_bounds', oob || { ev: await G(page, () => window.__ev), car: await G(page, () => __game.car) });
});
// 7. battery hits 0 mid-air
await safe('battery_air', async () => {
  await startLevel(page, 'e1', 'trial');
  await G(page, () => { window.__qaAuto(true); const s = __game.sim(); const f = s.tr.features.find(f => f.type === 'gap'); s.respawnAt(f.s0 - 120, 40); window.__gap = f.s0; });
  await page.waitForFunction(() => { const s = __game.sim(); return s && !s.grounded && s.prog.s > window.__gap - 5; }, null, { timeout: 60000, polling: 50 });
  await G(page, () => { __game.sim().battery = 0.05; });
  const t0 = Date.now(); let st = null; for (let i = 0; i < 60; i++) { await page.waitForTimeout(500); st = await G(page, () => ({ screen: __game.screen, state: __game.car && __game.car.state, h: __game.sim() && +__game.sim().prog.h.toFixed(1), grounded: __game.sim()?.grounded, title: document.querySelector('#res-body h1')?.textContent })); if (st.screen === 'results') break; }
  await shot(page, `${TAG}-battery-out-results`); await G(page, () => window.__qaAuto(false));
  rec('battery_zero_midair', { ...st, secs: (Date.now() - t0) / 1000 });
});
// 8. finish -> results -> unlock -> next; double-tap retry
await safe('finish', async () => {
  await G(page, () => { const st = __game.state; st.levels = {}; });
  await startLevel(page, 'e1', 'race'); await G(page, () => { window.__qaAuto(true); const s = __game.sim(); s.respawnAt(s.tr.finishS - 120, 40); });
  await page.waitForFunction(() => __game.screen === 'results', null, { timeout: 90000 });
  await page.waitForTimeout(1500); await shot(page, `${TAG}-results`);
  const res = await G(page, () => ({ title: document.querySelector('#res-body h1').textContent, body: document.querySelector('#res-body').innerText.replace(/\n+/g, ' | ').slice(0, 600), coins: __game.state.coins, lv: __game.state.levels.e1, nextVisible: getComputedStyle(document.querySelector('#res-next')).display }));
  await G(page, () => window.__qaAuto(false));
  // double tap Retry
  const c = await center(page, '#res-retry'); const before = await G(page, () => __game.gfx.renderer.info.memory);
  await touch(cdp, 'touchStart', [{ ...c, id: 1 }]); await touch(cdp, 'touchEnd', []); await page.waitForTimeout(60); await touch(cdp, 'touchStart', [{ ...c, id: 1 }]); await touch(cdp, 'touchEnd', []);
  await page.waitForFunction(() => __game.screen === 'race' && __game.car, null, { timeout: 90000 }); await page.waitForTimeout(3000);
  const after = await G(page, () => ({ mem: __game.gfx.renderer.info.memory, sceneChildren: __game.sim() && __game.gfx.scene?.children?.length }));
  rec('finish_results', { res, doubleTapRetry: { before, after } });
  // unlocked level 2 card
  await G(page, () => __game.goto('map')); await page.waitForTimeout(800);
  rec('progression', await G(page, () => [...document.querySelectorAll('#nodes .node')].map(n => (n.classList.contains('locked') ? 'L' : 'O') + (n.classList.contains('done') ? '*' : '')).join('')));
});
// 9. base building + robots + trophy
await safe('base', async () => {
  await G(page, () => { __game.state.coins = 10000; __game.goto('base'); }); await page.waitForTimeout(2000); await shot(page, `${TAG}-base-empty`);
  // scan for a pad
  let found = null; const vp = VIEW.viewport;
  for (let y = 0.35; y < 0.85 && !found; y += 0.07) for (let x = 0.2; x < 0.8 && !found; x += 0.06) { const p = { x: vp.width * x, y: vp.height * y }; await touch(cdp, 'touchStart', [{ ...p, id: 1 }]); await touch(cdp, 'touchEnd', []); await page.waitForTimeout(120); if (await G(page, () => !!document.querySelector('#m-plot.on'))) found = p; }
  let built = null;
  if (found) { await tapSel(page, cdp, '[data-build="robotbay"]'); await page.waitForTimeout(1500); built = await G(page, () => ({ coins: __game.state.coins, plots: __game.state.bases.earth.plots, info: document.querySelector('#base-info').textContent })); }
  // build trophy + refinery via second pad scan
  let found2 = null; for (let y = 0.35; y < 0.85 && !found2; y += 0.07) for (let x = 0.2; x < 0.8 && !found2; x += 0.06) { const p = { x: vp.width * x, y: vp.height * y }; await touch(cdp, 'touchStart', [{ ...p, id: 1 }]); await touch(cdp, 'touchEnd', []); await page.waitForTimeout(120); if (await G(page, () => !!document.querySelector('#m-plot.on') && !!document.querySelector('[data-build]'))) found2 = p; else await G(page, () => document.querySelectorAll('.modal').forEach(m => m.classList.remove('on'))); }
  if (found2) { await tapSel(page, cdp, '[data-build="trophy"]'); await page.waitForTimeout(1500); }
  await shot(page, `${TAG}-base-built`);
  await tapSel(page, cdp, '#base-trophy'); await page.waitForTimeout(2000); const troph = await G(page, () => ({ screen: __game.screen, info: document.querySelector('#trophy-info').textContent })); await shot(page, `${TAG}-trophy-room`);
  await startLevel(page, 'e1', 'trial'); const robots = await G(page, () => __game.sim().robots);
  rec('base_building', { padTap: found, built, trophy: troph, simRobots: robots });
});
// 10. ultra tier detection with spoofed Adreno 840
const sp = await newPage(b, VIEW);
await sp.page.addInitScript(() => { for (const C of [WebGLRenderingContext, WebGL2RenderingContext]) { const o = C.prototype.getParameter; C.prototype.getParameter = function (p) { if (p === 0x9246) return 'ANGLE (Qualcomm, Adreno (TM) 840, OpenGL ES 3.2)'; return o.call(this, p); }; } });
await bootToTitle(sp.page, `${BASE}/`); rec('tier_spoof_adreno840', await G(sp.page, () => ({ tier: __game.gpu.tier, quality: __game.quality, fpsCap: __game.state.settings.fpsCap })));
rec('errors', { pageerrors: log.errors, console: log.console.filter(x => !/object does not belong/.test(x)).slice(0, 20), bad: log.bad, rejections: await G(page, () => window.__qaRej || []) });
await b.close();
