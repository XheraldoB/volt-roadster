// Extras: photo mode, ghosts, daily/achievements modals, camera cycle, horn, settings, restore-code input maxlength.
import fs from 'node:fs';
import { launch, newPage, bootToTitle, shot, G, touch, tapSel, center, startLevel, writeJSON, OP15 } from './lib.mjs';
const BASE = process.env.BASE || 'http://localhost:4173';
const VIEW = { ...OP15, viewport: { width: 924, height: 424 } };
const R = {}; const rec = (k, v) => { R[k] = v; console.log(k, JSON.stringify(v)); writeJSON('p2b-results.json', R); };
const b = await launch(); const { page, log, cdp, ctx } = await newPage(b, VIEW, { ctx: { acceptDownloads: true } });
await page.addInitScript(fs.readFileSync(new URL('./auto.js', import.meta.url), 'utf8'));
const safe = async (n, f) => { try { await f(); } catch (e) { rec(n + '_ERROR', String(e.message).slice(0, 200)); } };
await bootToTitle(page, `${BASE}/?q=low`);
await safe('modals', async () => {
  await G(page, () => __game.goto('map')); await page.waitForTimeout(500);
  await tapSel(page, cdp, '#btn-daily'); await page.waitForTimeout(400); const daily = await G(page, () => document.querySelector('#daily-body').innerText.replace(/\n+/g, ' | ').slice(0, 300)); await shot(page, 'p2-daily');
  await tapSel(page, cdp, '#m-daily [data-close]');
  await tapSel(page, cdp, '#scr-map [data-go="ach"]'); await page.waitForTimeout(400); const ach = await G(page, () => document.querySelectorAll('#ach-body .ach').length); await tapSel(page, cdp, '#m-ach [data-close]');
  await tapSel(page, cdp, '#scr-map [data-go="settings"]'); await page.waitForTimeout(400);
  const set = await G(page, () => ({ segs: [...document.querySelectorAll('#set-body .seg')].map(s => s.dataset.k + ':' + [...s.querySelectorAll('button')].map(b => b.textContent + (b.classList.contains('on') ? '*' : '')).join('/')), maxlen: document.querySelector('#cl-code').maxLength }));
  await shot(page, 'p2-settings');
  await page.fill('#cl-code', ' VOLT-ABCD-EFGH-JKLM'); const typed = await page.inputValue('#cl-code');
  await tapSel(page, cdp, '#m-settings [data-close]');
  rec('modals', { daily, achievements: ach, settings: set, restoreInputWithLeadingSpace: typed });
});
await safe('race_extras', async () => {
  await startLevel(page, 'e1', 'trial'); await G(page, () => window.__qaAuto(true));
  await page.waitForTimeout(2000);
  const cams = []; for (let i = 0; i < 4; i++) { await tapSel(page, cdp, '#btn-cam'); await page.waitForTimeout(1200); cams.push(await G(page, () => __game.state.settings.camMode)); await shot(page, `p2-cam-${cams[i]}`); }
  await tapSel(page, cdp, '#btn-horn');
  await tapSel(page, cdp, '#btn-respawn'); await page.waitForTimeout(500); const resp = await G(page, () => __game.car.s);
  await tapSel(page, cdp, '#btn-pause'); await tapSel(page, cdp, '#p-photo'); await page.waitForTimeout(800);
  const ph = await G(page, () => ({ screen: __game.screen, filters: document.querySelectorAll('#ph-filters button').length }));
  await tapSel(page, cdp, '#ph-filters [data-f="synthwave"]');
  const dl = page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
  await tapSel(page, cdp, '#ph-shot'); const d = await dl; await page.waitForTimeout(800); await shot(page, 'p2-photo-mode');
  const photos = await G(page, () => __game.state.stats.photos);
  await tapSel(page, cdp, '#ph-close'); await page.waitForTimeout(300); const back = await G(page, () => __game.screen);
  await tapSel(page, cdp, '#p-resume');
  rec('race_extras', { camModes: cams, manualRespawnS: resp, photo: { ...ph, download: d ? d.suggestedFilename() : null, photos, backTo: back } });
  // ghost: finish trial twice, second race should show ghost
  await G(page, () => { const s = __game.sim(); s.respawnAt(s.tr.finishS - 150, 40); });
  await page.waitForFunction(() => __game.screen === 'results', null, { timeout: 90000 });
  await tapSel(page, cdp, '#res-retry'); await page.waitForFunction(() => __game.screen === 'race' && __game.car, null, { timeout: 90000 }); await page.waitForTimeout(2500);
  rec('ghost', await G(page, () => ({ hud: document.querySelector('#hud-ghost').textContent, simGhost: !!__game.sim().ghost, frames: __game.sim().ghost?.frames?.length })));
  await G(page, () => window.__qaAuto(false));
});
rec('errors', { pageerrors: log.errors, console: log.console.filter(x => !/does not belong/.test(x)), bad: log.bad });
await b.close();
