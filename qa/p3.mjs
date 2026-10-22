// Phase 3 release QA against production. HARD RULE: at most ONE /api/save write reaches production (allowSave() one-shot).
import fs from 'node:fs';
import { launch, newPage, bootToTitle, shot, G, touch, tapSel, center, startLevel, writeJSON, OP15 } from './lib.mjs';
const BASE = 'https://volt-roadster.vercel.app'; const TAG = 'p3';
const VIEW = { ...OP15, viewport: { width: 924, height: 424 } };
const R = {}; const rec = (k, v) => { R[k] = v; console.log(k, JSON.stringify(v)); writeJSON(`${TAG}-results.json`, R); };
const autoSrc = fs.readFileSync(new URL('./auto.js', import.meta.url), 'utf8');
const b = await launch();
const safe = async (name, fn) => { try { await fn(); } catch (e) { rec(name + '_ERROR', String(e.message || e).slice(0, 300)); } };
// ---------- A: smoke + the single cloud write
const A = await newPage(b, VIEW, { prodGuard: true }); const pa = A.page; await pa.addInitScript(autoSrc);
const apiResp = []; pa.on('response', async r => { if (r.url().includes('/api/')) { let body = ''; try { body = (await r.text()).slice(0, 200); } catch (e) {} apiResp.push(`${r.status()} ${r.request().method()} ${r.url().replace(/secret=[^&]+/, 'secret=***')} ${body.replace(/"secret":"[^"]+"/, '"secret":"***"')}`); } });
rec('A_boot_ms', await bootToTitle(pa, `${BASE}/`, 120000));
await pa.waitForTimeout(3000);
rec('A_env', await G(pa, () => ({ https: location.protocol, gl2: __game.gfx.renderer.capabilities.isWebGL2, tier: __game.gpu.tier, screen: __game.screen, cloud: { status: __game.state.cloud.status, code: __game.state.cloud.code } })));
await shot(pa, `${TAG}-live-title`);
await safe('A_smoke', async () => {
  await tapSel(pa, A.cdp, '#btn-play'); await pa.waitForTimeout(800); await tapSel(pa, A.cdp, '#nodes .node'); await pa.waitForTimeout(400); await tapSel(pa, A.cdp, '#lc-race');
  await pa.waitForFunction(() => __game.screen === 'race' && __game.car && __game.car.state === 'race', null, { timeout: 120000 });
  await G(pa, () => window.__qaAuto(true)); await pa.waitForTimeout(20000);
  const c = await G(pa, () => ({ ...__game.car, fps: __game.fps })); await shot(pa, `${TAG}-live-race`);
  await G(pa, () => window.__qaAuto(false));
  // hauler + moon + mars quick boots
  const worlds = {};
  for (const [lvl, veh] of [['m1', 'hauler'], ['r2', 'roadster']]) { await G(pa, v => __game.setVehicle(v), veh); await startLevel(pa, lvl); await G(pa, () => window.__qaAuto(true, { hover: true })); await pa.waitForTimeout(10000); worlds[lvl] = await G(pa, () => ({ s: Math.round(__game.car.s), kmh: Math.round(__game.car.kmh), veh: __game.car.vehicle, g: __game.sim().g })); await shot(pa, `${TAG}-live-${lvl}`); await G(pa, () => window.__qaAuto(false)); }
  await G(pa, () => __game.setVehicle('roadster'));
  rec('A_smoke', { e1: { s: Math.round(c.s), kmh: Math.round(c.kmh), state: c.state, coins: c.coins, fps: c.fps }, worlds });
});
// distinctive state, then the single real cloud save via Settings -> Sync now
let code = null;
await safe('A_cloud', async () => {
  await G(pa, () => __game.goto('title'));
  await G(pa, () => { const s = __game.state; s.coins = 4242; s.custom.paint = 'gold'; s.owned.paints = ['gold']; s.upgrades = { speed: 2, tank: 1 }; s.levels = { e1: { stars: 2, best: 6431, bestTime: 80.5, bestTrial: 0, questDone: true, plays: 3 } }; s.stats.loops = 7; __game.save(); });
  await tapSel(pa, A.cdp, '#scr-title [data-go="settings"]'); await pa.waitForTimeout(500);
  code = await G(pa, () => document.querySelector('#cloud-box .code').textContent);
  await shot(pa, `${TAG}-live-settings-cloud`);
  const before = A.log.saves.slice();
  A.allowSave(); // ONE write
  await tapSel(pa, A.cdp, '#cl-sync'); await pa.waitForTimeout(4000);
  const st = await G(pa, () => ({ status: __game.state.cloud.status, lastSync: __game.state.cloud.lastSync, toast: [...document.querySelectorAll('.toast')].map(t => t.textContent).slice(-2), box: document.querySelector('#cloud-box').innerText.replace(/VOLT-[A-Z0-9-]+/, 'VOLT-…') }));
  rec('A_single_cloud_save', { savesBefore: before, savesAfter: A.log.saves, status: st, code });
  await tapSel(pa, A.cdp, '#m-settings [data-close]');
});
// lifecycle hide -> should try beacon (stubbed) and be blocked
await G(pa, () => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
await pa.waitForTimeout(500);
rec('A_errors', { pageerrors: A.log.errors, console: A.log.console.filter(x => !/does not belong/.test(x)).slice(0, 20), bad: A.log.bad, rejections: await G(pa, () => window.__qaRej || []), beacons: await G(pa, () => window.__qaBeacons || []), saves: A.log.saves, api: apiResp });
// ---------- B: fresh device, restore by recovery code (reads only; all writes blocked)
await safe('B_restore', async () => {
  const B = await newPage(b, VIEW, { prodGuard: true }); const pb = B.page;
  await bootToTitle(pb, `${BASE}/`, 120000); await pb.waitForTimeout(2500);
  const fresh = await G(pb, () => ({ coins: __game.state.coins, paint: __game.state.custom.paint, code: __game.state.cloud.code }));
  await tapSel(pb, B.cdp, '#scr-title [data-go="settings"]'); await pb.waitForTimeout(500);
  // wrong code first
  await pb.fill('#cl-code', 'VOLT-ZZZZ-ZZZZ-ZZZZ'); await tapSel(pb, B.cdp, '#cl-restore'); await pb.waitForTimeout(2500);
  const wrong = await G(pb, () => [...document.querySelectorAll('.toast')].map(t => t.textContent).slice(-1)[0]);
  // real code typed lowercase with spaces
  await pb.fill('#cl-code', ' ' + code.toLowerCase() + ' '); await tapSel(pb, B.cdp, '#cl-restore'); await pb.waitForTimeout(4000);
  const restored = await G(pb, () => ({ screen: __game.screen, coins: __game.state.coins, paint: __game.state.custom.paint, upgrades: __game.state.upgrades, e1: __game.state.levels.e1, loops: __game.state.stats.loops, code: __game.state.cloud.code, toast: [...document.querySelectorAll('.toast')].map(t => t.textContent).slice(-2) }));
  await shot(pb, `${TAG}-live-restored-map`);
  await pb.reload(); await pb.waitForFunction(() => window.__game && __game.screen === 'title', null, { timeout: 120000 }); await pb.waitForTimeout(2500);
  const afterReload = await G(pb, () => ({ coins: __game.state.coins, paint: __game.state.custom.paint, code: __game.state.cloud.code }));
  rec('B_restore', { fresh: { ...fresh, code: fresh.code ? 'VOLT-…(new identity)' : null }, wrongCodeToast: wrong, restored: { ...restored, codeMatches: restored.code === code }, afterReload: { ...afterReload, codeMatches: afterReload.code === code }, savesB: B.log.saves, errors: B.log.errors, bad: B.log.bad });
  await B.ctx.close();
});
// ---------- C: portrait rotate prompt + fullscreen behaviour + SW registration (writes blocked)
await safe('C_orient', async () => {
  const C = await newPage(b, { ...OP15, viewport: { width: 424, height: 924 } }, { prodGuard: true, sw: true }); const pc = C.page;
  await bootToTitle(pc, `${BASE}/`, 120000); await pc.waitForTimeout(2000);
  const rot = await G(pc, () => getComputedStyle(document.querySelector('#rotate')).display); await shot(pc, `${TAG}-live-portrait`);
  await pc.setViewportSize({ width: 924, height: 424 }); await pc.waitForTimeout(1500);
  const rot2 = await G(pc, () => getComputedStyle(document.querySelector('#rotate')).display);
  // fullscreen via the ⛶ button (real tap = user gesture)
  await tapSel(pc, C.cdp, '#scr-title [data-go="fullscreen"]'); await pc.waitForTimeout(1500);
  const fs1 = await G(pc, () => ({ fs: !!document.fullscreenElement, orient: screen.orientation && screen.orientation.type }));
  await tapSel(pc, C.cdp, '#scr-title [data-go="fullscreen"]'); await pc.waitForTimeout(1000);
  const fs2 = await G(pc, () => !!document.fullscreenElement);
  const sw = await G(pc, async () => { const r = await navigator.serviceWorker.getRegistration(); return r ? (r.active || r.installing || r.waiting) ? 'registered' : 'reg-no-worker' : 'none'; });
  // fullscreen entry points in race HUD?
  const raceFs = await G(pc, () => [...document.querySelectorAll('#scr-race [data-go="fullscreen"], #scr-map [data-go="fullscreen"]')].length);
  rec('C_orientation_fullscreen', { portraitRotatePrompt: rot, landscapePrompt: rot2, fullscreenOn: fs1, fullscreenOffAfterSecondTap: !fs2, serviceWorker: sw, fsButtonsOutsideTitle: raceFs, saves: C.log.saves, errors: C.log.errors });
  await C.ctx.close();
});
await b.close();
