// R28 screenshots: classic HUD, reverse gear, and each camera (OnePlus 15 viewport). usage: BASE=http://localhost:4174 node tools/r28shots.mjs
import { chromium } from 'playwright-core'; import { mkdirSync } from 'fs';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const c = await b.newContext({ viewport: { width: 924, height: 424 }, deviceScaleFactor: +(process.env.DSF || 1), isMobile: true, hasTouch: true }); const p = await c.newPage(); mkdirSync('qa-shots', { recursive: true });
p.on('console', m => m.type() === 'error' && console.log('console', m.text()));
await p.goto(process.env.BASE + '/?q=' + (process.env.Q || 'low') + '&tut=1'); await p.waitForFunction(() => window.__game?.screen === 'title', null, { timeout: 60000 }); await p.waitForTimeout(1500); await p.screenshot({ path: 'qa-shots/r28-title.png' });
await p.evaluate(() => window.__game.loadLevel('e1')); await p.waitForFunction(() => window.__game.screen === 'race', null, { timeout: 60000 }); await p.waitForTimeout(1500);
await p.screenshot({ path: 'qa-shots/r28-tutorial.png' }); await p.tap('#tut-ok');
const cdp = await c.newCDPSession(p); const press = async (sel, id) => { const r = await (await p.$(sel)).boundingBox(); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r.x + r.width / 2, y: r.y + r.height / 2, id }] }); };
await p.waitForFunction(() => window.__game.car?.state === 'race', null, { timeout: 30000 }); await press('[data-ctl="gas"]', 1); await p.waitForTimeout(5000);
for (const m of ['close', 'chase', 'hood']) { await p.evaluate(m => { const v = window.__game.view(); v.cam.mode = m; v.cam.init = false; }, m); await p.waitForTimeout(1200); await p.screenshot({ path: `qa-shots/r28-cam-${m}.png` }); }
await p.evaluate(() => { const v = window.__game.view(); v.cam.mode = 'chase'; v.cam.init = false; }); await p.screenshot({ path: 'qa-shots/r28-hud-classic.png' });
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await press('[data-ctl="rev"]', 2); await p.waitForTimeout(5000); await p.screenshot({ path: 'qa-shots/r28-hud-reverse.png' });
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await b.close(); console.log('ok');
