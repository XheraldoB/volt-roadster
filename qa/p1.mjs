// Phase 1 technical (local preview). BASE env, default http://localhost:4173
import fs from 'node:fs';
import { launch, newPage, bootToTitle, shot, G, touch, tapSel, center, startLevel, writeJSON, OP15, OP15_DPR3 } from './lib.mjs';
const BASE = process.env.BASE || 'http://localhost:4173'; const TAG = process.env.TAG || 'p1';
const R = {}; const rec = (k, v) => { R[k] = v; console.log(k, JSON.stringify(v)); };
const autoSrc = fs.readFileSync(new URL('./auto.js', import.meta.url), 'utf8');
const b = await launch();
const VIEW = process.env.VIEW === 'full' ? OP15 : { ...OP15, viewport: { width: 924, height: 424 } };
const { page, log, cdp } = await newPage(b, VIEW);
await page.addInitScript(autoSrc);
await page.addInitScript(() => { window.__vib = []; const o = navigator.vibrate?.bind(navigator); navigator.vibrate = p => { window.__vib.push(p); return true; }; });
rec('boot_ms', await bootToTitle(page, `${BASE}/?q=low`));
rec('env', await G(page, () => ({ gl2: __game.gfx.renderer.capabilities.isWebGL2, gpu: __game.gpu, maxTex: __game.gfx.renderer.capabilities.maxTextureSize, scroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight, innerWidth, innerHeight], canvas: [__game.gfx.renderer.domElement.width, __game.gfx.renderer.domElement.height] })));
// ---- touch navigation: title -> map -> level card -> race
await tapSel(page, cdp, '#btn-play'); await page.waitForTimeout(1200);
rec('nav_after_play', await G(page, () => __game.screen));
await shot(page, `${TAG}-map`);
await tapSel(page, cdp, '#nodes .node'); await page.waitForTimeout(500);
rec('levelcard_open', await G(page, () => !!document.querySelector('#m-levelcard.on')));
await shot(page, `${TAG}-levelcard`);
await tapSel(page, cdp, '#lc-race');
await page.waitForFunction(() => __game.screen === 'race', null, { timeout: 120000 });
await page.waitForTimeout(800); await shot(page, `${TAG}-countdown`);
await page.waitForFunction(() => __game.car && __game.car.state === 'race', null, { timeout: 120000 });
rec('touch_layout', await G(page, () => ({ bodyTouch: document.body.classList.contains('touch'), gasVisible: getComputedStyle(document.querySelector('#t-gas')).display, autoGas: __game.state.settings.autoGas, ctls: [...document.querySelectorAll('[data-ctl]')].map(e => { const r = e.getBoundingClientRect(); return [e.dataset.ctl, Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height), getComputedStyle(e).display]; }) })));
// ---- multi-touch: steer right + boost + (later) jump simultaneously
const cR = await center(page, '[data-ctl="right"]'), cB = await center(page, '[data-ctl="boost"]'), cJ = await center(page, '[data-ctl="jump"]'), cL = await center(page, '[data-ctl="left"]');
await page.waitForTimeout(2500);
await touch(cdp, 'touchStart', [{ ...cR, id: 1 }]); await touch(cdp, 'touchStart', [{ ...cR, id: 1 }, { ...cB, id: 2 }]);
await page.waitForTimeout(700);
const mt1 = await G(page, () => ({ t: { ...__game.input.touch }, steerCur: __game.sim().steerCur, boosting: __game.sim().boosting, kmh: __game.car.kmh }));
await touch(cdp, 'touchStart', [{ ...cR, id: 1 }, { ...cB, id: 2 }, { ...cJ, id: 3 }]); await page.waitForTimeout(150);
const mt2 = await G(page, () => ({ ...__game.input.touch }));
await touch(cdp, 'touchEnd', [{ ...cR, id: 1 }, { ...cJ, id: 3 }]); await page.waitForTimeout(150); // lift boost finger only
const mt3 = await G(page, () => ({ ...__game.input.touch }));
// slide finger 1 from right to left button without lifting
await touch(cdp, 'touchMove', [{ ...cL, id: 1 }, { ...cJ, id: 3 }]); await page.waitForTimeout(150);
const mt4 = await G(page, () => ({ ...__game.input.touch }));
await touch(cdp, 'touchCancel', []); await page.waitForTimeout(150);
const mt5 = await G(page, () => ({ ...__game.input.touch }));
rec('multitouch', { steerBoost: mt1, threeFingers: mt2, afterLiftBoost: mt3, slideToLeft: mt4, afterCancel: mt5 });
await shot(page, `${TAG}-race-hud`);
// ---- sustained drive with autopilot, fps + heap per world (low preset; software GL)
async function heap() { const m = await cdp.send('Performance.getMetrics'); const o = Object.fromEntries(m.metrics.map(x => [x.name, x.value])); return Math.round(o.JSHeapUsedSize / 1048576); }
await cdp.send('Performance.enable');
const perf = {};
for (const lvl of ['e1', 'm1', 'r1']) {
  await startLevel(page, lvl); await G(page, () => window.__qaAuto(true));
  await G(page, () => { const s = __game.sim(), gf = __game.gfx; window.__cpu = { sim: [], render: [] }; const u = s.update.bind(s); s.update = (dt, i) => { const t = performance.now(); u(dt, i); window.__cpu.sim.push(performance.now() - t); }; if (!gf.__wrapped) { const r = gf.render.bind(gf); gf.render = (a, c) => { const t = performance.now(); r(a, c); window.__cpu.render.push(performance.now() - t); }; gf.__wrapped = true; } });
  const fps = [], ft = []; const h0 = await heap();
  for (let i = 0; i < 30; i++) { await page.waitForTimeout(1000); fps.push(await G(page, () => __game.fps)); }
  // frame-time distribution over 3 s via rAF
  const dist = await G(page, () => new Promise(res => { const a = []; let l = performance.now(); const f = n => { a.push(n - l); l = n; if (a.length < 180) requestAnimationFrame(f); else res(a); }; requestAnimationFrame(f); }));
  dist.sort((a, b) => a - b); const h1 = await heap();
  const cpu = await G(page, () => { const m = a => a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2) : 0; const r = { simMs: m(window.__cpu.sim), renderSubmitMs: m(window.__cpu.render) }; window.__cpu = { sim: [], render: [] }; return r; });
  const car = await G(page, () => __game.car); const ri = await G(page, () => __game.gfx.renderer.info);
  perf[lvl] = { ...cpu, avgFps: +(fps.reduce((a, b) => a + b, 0) / fps.length).toFixed(1), minFps: +Math.min(...fps).toFixed(1), p50ms: +dist[90].toFixed(1), p99ms: +dist[178].toFixed(1), heapMB: [h0, h1], s: Math.round(car.s), crashes: car.crashes, kmh: Math.round(car.kmh), state: car.state, calls: ri.render.calls, tris: ri.render.triangles, geo: ri.memory.geometries, tex: ri.memory.textures };
  console.log(lvl, perf[lvl]);
  await shot(page, `${TAG}-drive-${lvl}`);
  await G(page, () => window.__qaAuto(false));
}
rec('perf_low', perf);
// ---- leak check: 8 level load/unload cycles
const leak = [];
for (let i = 0; i < 8; i++) { await startLevel(page, ['e3', 'm3', 'r3', 'e6'][i % 4]); await page.waitForTimeout(500); const ri = await G(page, () => __game.gfx.renderer.info.memory); await G(page, () => { if (window.gc) gc(); }); leak.push({ heap: await heap(), geo: ri.geometries, tex: ri.textures }); }
rec('leak_cycles', leak);
// ---- gravity per world: free-fall acceleration measured from linvel.y
const grav = {};
for (const lvl of ['e1', 'm1', 'r1']) {
  await startLevel(page, lvl);
  await G(page, () => { __game.pause(true); });
  const g = await G(page, () => { const s = __game.sim(); const p = s.body.translation(); s.body.setTranslation({ x: p.x, y: p.y + 60, z: p.z }, true); s.body.setLinvel({ x: 0, y: 0, z: 0 }, true); s.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    const v0 = s.body.linvel().y; const inp = { steer: 0, throttle: 0, brake: 0, boost: false, jump: false, pitch: 0 }; for (let i = 0; i < 60; i++) s.fixed(1 / 120, inp); const v1 = s.body.linvel().y; return { planetG: s.g, measured: +(-(v1 - v0) / 0.5).toFixed(2) }; });
  grav[lvl] = g; await G(page, () => __game.pause(false));
}
rec('gravity', grav);
// ---- lifecycle: visibility -> pause
await startLevel(page, 'e2'); await page.waitForTimeout(1500);
await G(page, () => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
await page.waitForTimeout(300);
const vis = await G(page, () => ({ screen: __game.screen, paused: __game.screen === 'pause' }));
await G(page, () => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
rec('visibility_pause', vis);
await tapSel(page, cdp, '#p-resume'); await page.waitForTimeout(500);
// ---- orientation: rotate to portrait mid race
const before = await G(page, () => ({ t: __game.car.raceTime, bat: __game.car.battery }));
await page.setViewportSize({ width: VIEW.viewport.height, height: VIEW.viewport.width }); await page.waitForTimeout(3000);
const port = await G(page, () => ({ rotateShown: getComputedStyle(document.querySelector('#rotate')).display, screen: __game.screen, t: __game.car.raceTime, bat: __game.car.battery, canvas: [__game.gfx.renderer.domElement.width, __game.gfx.renderer.domElement.height] }));
await shot(page, `${TAG}-portrait-midrace`);
await page.setViewportSize(VIEW.viewport); await page.waitForTimeout(1000);
const back = await G(page, () => ({ canvas: [__game.gfx.renderer.domElement.width, __game.gfx.renderer.domElement.height], screen: __game.screen, cam: __game.gfx.camera.aspect }));
rec('orientation', { before, portrait: port, backToLandscape: back });
// ---- WebGL context loss / restore in race
const cl = await G(page, async () => { const gl = __game.gfx.renderer.getContext(); const ext = gl.getExtension('WEBGL_lose_context'); if (!ext) return 'no-ext'; const f0 = __game.gfx.renderer.info.render.frame; ext.loseContext(); await new Promise(r => setTimeout(r, 1000)); ext.restoreContext(); await new Promise(r => setTimeout(r, 2500)); return { lost: gl.isContextLost(), screen: __game.screen, frameAdvance: __game.gfx.renderer.info.render.frame - f0 }; });
await page.waitForTimeout(500); await shot(page, `${TAG}-after-context-restore`);
rec('context_loss', cl);
// ---- haptics
rec('vibrate_calls', await G(page, () => ({ n: window.__vib.length, sample: window.__vib.slice(0, 8) })));
// ---- errors
rec('errors', { pageerrors: log.errors, console: log.console.slice(0, 30), bad: log.bad, rejections: await G(page, () => window.__qaRej || []) });
writeJSON(`${TAG}-results.json`, R);
// ---- DPR3 spot check
const p3 = await newPage(b, OP15_DPR3);
await bootToTitle(p3.page, `${BASE}/?q=low`); await shot(p3.page, `${TAG}-dpr3-title`);
await startLevel(p3.page, 'e1'); await p3.page.waitForTimeout(2000); await shot(p3.page, `${TAG}-dpr3-race`);
rec('dpr3', await G(p3.page, () => ({ canvas: [__game.gfx.renderer.domElement.width, __game.gfx.renderer.domElement.height], css: [innerWidth, innerHeight], hudOverlap: (() => { const els = ['.hud-tl', '.hud-tc', '.hud-tr', '.hud-bc', '.tc-left', '.tc-right'].map(s => [s, document.querySelector(s).getBoundingClientRect()]); const o = []; for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) { const a = els[i][1], c = els[j][1]; if (a.x < c.right && c.x < a.right && a.y < c.bottom && c.y < a.bottom) o.push(els[i][0] + '×' + els[j][0]); } return o; })() })));
writeJSON(`${TAG}-results.json`, R);
await b.close();
