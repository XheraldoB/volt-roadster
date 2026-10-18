// Headless Chrome smoke test at a phone landscape viewport. Usage: node tools/browser-test.mjs [url] [phase]
import { chromium } from 'playwright-core';
const url = process.argv[2] || 'http://localhost:4173/'; const phase = process.argv[3] || 'p1';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 915, height: 412 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 16; CPH2749) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36' });
const page = await ctx.newPage();
const errors = [], logs = [];
page.on('console', m => { const t = m.text(); if (m.type() === 'error') errors.push(t); else logs.push(m.type() + ': ' + t); });
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
page.on('requestfailed', r => { if (!r.url().includes('/api/')) errors.push('REQFAIL ' + r.url()); });
page.on('response', r => { if (r.status() >= 400 && !r.url().includes('/api/')) errors.push('HTTP ' + r.status() + ' ' + r.url()); });
const t0 = Date.now();
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.screen === 'title', null, { timeout: 30000 });
console.log('title in', Date.now() - t0, 'ms; quality', await page.evaluate(() => window.__game.quality));
await page.waitForTimeout(1500);
await page.screenshot({ path: `shots/${phase}-title.png` });
await page.tap('#btn-play'); await page.waitForTimeout(1500);
await page.screenshot({ path: `shots/${phase}-map.png` });
const lvl = process.argv[4] || 'e1';
await page.evaluate(id => window.__game.loadLevel(id, 'race'), lvl);
await page.waitForFunction(() => window.__game.screen === 'race', null, { timeout: 60000 });
// hold boost via touch control after countdown
await page.waitForTimeout(4500);
const box = await page.locator('[data-ctl=boost]').boundingBox();
if (box) { await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); }
await page.evaluate(() => { window.__game.input.touch.boost = 1; });
for (let i = 0; i < 6; i++) { await page.waitForTimeout(1500); const c = await page.evaluate(() => window.__game.car); console.log('car', JSON.stringify({ kmh: c.kmh.toFixed(0), s: c.s.toFixed(0), state: c.state, bat: c.battery.toFixed(1), score: c.score }), 'fps', (await page.evaluate(() => window.__game.fps)).toFixed(1)); }
await page.screenshot({ path: `shots/${phase}-race.png` });
await page.evaluate(() => { window.__game.input.touch.boost = 0; });
// pause + garage + base screens
await page.tap('#btn-pause'); await page.waitForTimeout(400); await page.screenshot({ path: `shots/${phase}-pause.png` });
await page.tap('#p-map'); await page.waitForTimeout(800);
await page.evaluate(() => window.__game.goto('garage')); await page.waitForTimeout(1200); await page.screenshot({ path: `shots/${phase}-garage.png` });
await page.evaluate(() => window.__game.goto('base')); await page.waitForTimeout(1200); await page.screenshot({ path: `shots/${phase}-base.png` });
console.log('ERRORS', errors.length); errors.slice(0, 20).forEach(e => console.log('  ', e));
console.log('LOGS', logs.slice(-15).join('\n  '));
await browser.close();
