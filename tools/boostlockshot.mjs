// B41-B43: screenshot of the BOOST LOCKED cue on r6's final ramp. usage: BASE=http://localhost:4174 node tools/boostlockshot.mjs
import { chromium } from 'playwright-core'; import { mkdirSync } from 'fs';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const c = await b.newContext({ viewport: { width: 924, height: 424 }, isMobile: true, hasTouch: true }); const p = await c.newPage(); mkdirSync('qa-shots', { recursive: true });
const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.goto(process.env.BASE + '/?q=low'); await p.waitForFunction(() => window.__game?.screen === 'title', null, { timeout: 60000 });
await p.evaluate(() => window.__game.loadLevel('r6')); await p.waitForFunction(() => window.__game.car?.state === 'race', null, { timeout: 60000 });
const r = await p.evaluate(async () => { const s = window.__game.sim(); const G = s.tr.features.find(f => f.name === 'Hop Four'); s.respawnAt(G.s0 - 200, 60); await new Promise(r => setTimeout(r, 1200));
  return { locked: window.__game.car.boostLocked, cueVisible: !document.getElementById('boost-lock').hidden, btnLocked: !!document.querySelector('[data-ctl="boost"].locked') }; });
await p.screenshot({ path: 'qa-shots/b43-boost-locked.png' }); console.log(JSON.stringify({ ...r, errs })); await b.close();
