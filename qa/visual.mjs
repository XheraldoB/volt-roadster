// Ultra-preset visual captures at OnePlus 15 landscape (2772x1272 DPR1). Software GL: stills only.
import fs from 'node:fs';
import { launch, newPage, bootToTitle, shot, G, startLevel, OP15 } from './lib.mjs';
const BASE = process.env.BASE || 'http://localhost:4173'; const TAG = process.env.TAG || 'vis';
const autoSrc = fs.readFileSync(new URL('./auto.js', import.meta.url), 'utf8');
const b = await launch(); const { page, log } = await newPage(b, OP15); await page.addInitScript(autoSrc);
const frames = async n => { const f0 = await G(page, () => window.__qaFrames || 0); await page.waitForFunction(([f, n]) => (window.__qaFrames || 0) >= f + n, [f0, n], { timeout: 300000, polling: 200 }); };
await page.addInitScript(() => { const loop = () => { window.__qaFrames = (window.__qaFrames || 0) + 1; requestAnimationFrame(loop); }; requestAnimationFrame(loop); });
await bootToTitle(page, `${BASE}/?q=ultra`, 180000);
await G(page, () => { __game.state.settings.showFps = true; });
await frames(4); await shot(page, `${TAG}-title-ultra`);
await G(page, () => __game.goto('garage')); await frames(6); await shot(page, `${TAG}-garage-ultra`);
await G(page, () => { __game.setVehicle('hauler'); __game.goto('garage'); }); await frames(6); await shot(page, `${TAG}-garage-hauler-ultra`);
await G(page, () => { __game.setVehicle('roadster'); });
await G(page, () => { const st = __game.state; st.bases.earth.plots = [{ type: 'robotbay', lvl: 3 }, { type: 'refinery', lvl: 2 }, { type: 'solar', lvl: 1 }, null, null, null]; __game.goto('base'); }); await frames(8); await shot(page, `${TAG}-base-ultra`);
const scenes = [['e1', 'loop', 'roadster'], ['e3', 'loop', 'roadster'], ['m3', 'gap', 'roadster'], ['r3', 'gap', 'roadster'], ['r5', 'start', 'roadster'], ['e2', 'gap', 'hauler']];
for (const [lvl, where, veh] of scenes) {
  await G(page, v => __game.setVehicle(v), veh);
  await startLevel(page, lvl, 'race', 300000);
  await G(page, w => { window.__qaAuto(true, { hover: true }); const s = __game.sim(); const f = s.tr.features.find(f => f.type === w); if (f) s.respawnAt(f.s0 - (w === 'gap' ? 70 : 40), 38); }, where);
  await frames(where === 'gap' ? 14 : 10); await shot(page, `${TAG}-${lvl}-${where}-ultra`);
  if (veh === 'hauler') { await G(page, () => { __game.input.touch.jump = 1; }); await frames(6); await shot(page, `${TAG}-${lvl}-hauler-rcs-ultra`); await G(page, () => { __game.input.touch.jump = 0; }); }
  await G(page, () => window.__qaAuto(false));
}
console.log(JSON.stringify({ errors: log.errors, console: log.console.filter(x => !/does not belong/.test(x)).slice(0, 10), quality: await G(page, () => __game.quality) }));
await b.close();
