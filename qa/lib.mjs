// QA harness helpers (Volt Roadster). Browser launch, OnePlus 15 landscape emulation, error capture, CDP multi-touch.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
export const SHOTS = '/workspace/volt-roadster/qa-shots';
fs.mkdirSync(SHOTS, { recursive: true });
export const UA = 'Mozilla/5.0 (Linux; Android 16; CPH2749) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';
export const OP15 = { viewport: { width: 2772, height: 1272 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, userAgent: UA };
export const OP15_DPR3 = { viewport: { width: 924, height: 424 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: UA };
export async function launch() {
  return chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true,
    args: ['--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'] });
}
// opts.prodGuard: block ALL /api/save writes and sendBeacon unless allowSave() armed (one-shot).
export async function newPage(browser, devOpts = OP15, opts = {}) {
  const ctx = await browser.newContext({ ...devOpts, serviceWorkers: opts.sw ? 'allow' : 'block', ...(opts.ctx || {}) });
  const page = await ctx.newPage();
  const log = { errors: [], console: [], bad: [], rejections: [], requests: [], saves: [] };
  page.on('pageerror', e => log.errors.push(e.message));
  page.on('console', m => { const t = m.type(); if (t === 'error' || t === 'warning') log.console.push(`${t}: ${m.text()}`); });
  page.on('response', r => { if (r.status() >= 400) log.bad.push(`${r.status()} ${r.url()}`); });
  page.on('request', r => log.requests.push(`${r.method()} ${r.url()}`));
  await page.addInitScript(() => { addEventListener('unhandledrejection', e => { (window.__qaRej ||= []).push(String(e.reason && (e.reason.stack || e.reason.message) || e.reason)); }); });
  let armed = 0;
  if (opts.prodGuard) {
    await page.addInitScript(() => { const orig = navigator.sendBeacon?.bind(navigator); navigator.sendBeacon = (url, data) => { (window.__qaBeacons ||= []).push(String(url)); if (String(url).includes('/api/')) return true; return orig ? orig(url, data) : true; }; });
    await page.route('**/api/save**', async route => {
      if (armed > 0) { armed--; log.saves.push('ALLOWED ' + route.request().method()); return route.continue(); }
      log.saves.push('BLOCKED ' + route.request().method());
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'qa-blocked' }) });
    });
  }
  if (opts.mockCloud) { // in-memory fake of /api/save + /api/load for repeatable local restore tests
    const store = opts.mockCloud; // Map
    await page.route('**/api/save', async route => { const b = JSON.parse(route.request().postData() || '{}'); store.set('code:' + b.code, { id: b.id, secret: b.secret, code: b.code }); store.set(`rec:${b.id}:${b.secret}`, { data: b.data }); log.saves.push('MOCK'); route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, backend: 'mock' }) }); });
    await page.route('**/api/load**', async route => { const u = new URL(route.request().url()); const code = u.searchParams.get('code'); const id = u.searchParams.get('id'), sec = u.searchParams.get('secret');
      if (code) { const c = store.get('code:' + code.toUpperCase()); if (!c) return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"Code not found"}' }); const r = store.get(`rec:${c.id}:${c.secret}`); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...c, data: r.data }) }); }
      const r = store.get(`rec:${id}:${sec}`); route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, found: !!r, data: r ? r.data : null }) }); });
  }
  const cdp = await ctx.newCDPSession(page);
  return { ctx, page, log, cdp, allowSave: () => { armed = 1; } };
}
export const G = (page, fn, arg) => page.evaluate(fn, arg);
export async function bootToTitle(page, url, timeout = 90000) {
  const t0 = Date.now(); await page.goto(url, { waitUntil: 'load', timeout });
  await page.waitForFunction(() => window.__game && window.__game.screen === 'title', null, { timeout });
  return Date.now() - t0;
}
export async function shot(page, name) { const p = `${SHOTS}/${name}.png`; await page.screenshot({ path: p }); return p; }
export async function center(page, sel) { const b = await page.locator(sel).first().boundingBox(); if (!b) return null; return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }
// Multi-touch via CDP. points: array of {x,y,id}
export async function touch(cdp, type, points) { await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(p => ({ x: p.x, y: p.y, id: p.id, radiusX: 8, radiusY: 8, force: 1 })) }); }
export async function tapSel(page, cdp, sel) { const c = await center(page, sel); if (!c) throw new Error('no element ' + sel); await touch(cdp, 'touchStart', [{ ...c, id: 1 }]); await page.waitForTimeout(40); await touch(cdp, 'touchEnd', []); await page.waitForTimeout(120); return c; }
export async function startLevel(page, id, mode = 'race', timeout = 180000) {
  await G(page, ([i, m]) => { window.__game.loadLevel(i, m); }, [id, mode]);
  await page.waitForFunction(() => window.__game.screen === 'race' && window.__game.car && window.__game.car.state === 'race', null, { timeout });
}
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export function writeJSON(name, obj) { fs.writeFileSync(`/workspace/volt-roadster/qa/${name}`, JSON.stringify(obj, null, 2)); }
