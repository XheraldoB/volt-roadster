// Volt Roadster - app shell: screens, HUD, main loop, persistence, photo mode, bullet time, cutscenes.
import './style.css';
import * as THREE from 'three';
import { Gfx, PRESETS } from './render/gfx.js';
import { Showroom } from './render/showroom.js';
import { LevelView } from './render/levelview.js';
import { Sim, initPhysics, carStats } from './sim.js';
import { LEVELS, PLANETS, levelById, levelsOf } from './levels.js';
import { Input, haptic } from './input.js';
import { Audio } from './audio.js';
import { CATS, catOf, owns, buyItem, priceLabel, itemOf } from './shop.js';
import { VEHICLES, vehicleOf } from './vehicles.js';
import { PAYMENTS } from './config.js';
import * as P from './progress.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtT = t => { if (!t && t !== 0) return '--'; const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`; };
const nf = n => Math.round(n).toLocaleString('en-US');

// ---------------- state ----------------
let save = P.loadLocal(); P.ensureCloudIdentity(save);
const canvas = $('#game');
const gfx = new Gfx(canvas);
const QS = new URLSearchParams(location.search);
const tierName = () => QS.get('q') && PRESETS[QS.get('q')] ? QS.get('q') : save.settings.quality === 'auto' ? gfx.info.tier : save.settings.quality;
gfx.setQuality(tierName());
const show = new Showroom(gfx);
const audio = new Audio();
const input = new Input($('#touch'));
const G = { screen: 'loading', sim: null, view: null, level: null, mode: 'race', paused: false, timeScale: 1, slowT: 0, slowCd: 0, photo: null, fps: 0, lastCloud: 0, planet: save.planet || 'earth', basePlanet: null, rocket: false };
applySettings();

function applySettings() {
  const st = save.settings;
  input.settings = { autoGas: st.autoGas, steer: st.steer, airRoll: st.airRoll, assist: st.assist, esc: st.esc !== false, sens: st.sens || 1 }; gfx.extraAO = !!st.extraAO;
  audio.setVolumes(st.music, st.sfx);
  document.body.classList.toggle('lefty', !!st.left);
  $('#fps').style.display = st.showFps ? 'block' : 'none';
}
const persist = (immediate) => P.saveLocal(save, immediate);
async function cloudSync(beacon = false) {
  if (beacon) { P.cloudSave(save, true); return; }
  G.lastCloud = Date.now();
  const r = await P.cloudSave(save); renderCloud(); return r;
}

// ---------------- screens ----------------
// HUD artificial horizon: shown while airborne; the bar tilts with roll and slides with pitch, the dot shows the landing verdict
const HZ = { el: null, bar: null, dot: null, on: false, f: new THREE.Vector3(), r: new THREE.Vector3(), u: new THREE.Vector3() };
function updateHorizon(s) {
  if (!HZ.el) { HZ.el = $('#horizon'); HZ.bar = HZ.el && HZ.el.querySelector('.hz-bar'); HZ.dot = HZ.el && HZ.el.querySelector('.hz-dot'); if (!HZ.el) return; }
  const show = !s.grounded && s.air > 0.25 && s.state === 'race';
  if (show !== HZ.on) { HZ.on = show; HZ.el.classList.toggle('on', show); }
  if (!show) return;
  const q = s.pose.q; HZ.f.set(0, 0, 1).applyQuaternion(q); HZ.r.set(1, 0, 0).applyQuaternion(q); HZ.u.set(0, 1, 0).applyQuaternion(q);
  const roll = Math.atan2(HZ.r.y, HZ.u.y), pitch = Math.asin(Math.max(-1, Math.min(1, HZ.f.y)));
  HZ.bar.style.transform = `translateY(${(pitch * 40).toFixed(1)}px) rotate(${(roll * 57.3).toFixed(1)}deg)`;
  const L = s.landing; HZ.el.dataset.v = !L ? 'none' : (L.vImp > 14 * Math.sqrt(s.veh.tough || 1) ? 'bad' : (L.onPad ? 'pad' : 'ok'));
}
function go(name) {
  G.screen = name;
  $$('.scr').forEach(e => e.classList.toggle('on', e.id === 'scr-' + name));
  document.body.dataset.screen = name;
}
function toast(html, ms = 2200, cls = '') { const t = document.createElement('div'); t.className = 'toast ' + cls; t.innerHTML = html; $('#toasts').appendChild(t); setTimeout(() => t.classList.add('out'), ms); setTimeout(() => t.remove(), ms + 500); }
function coinsBar() { $$('.coinval').forEach(e => e.textContent = nf(save.coins)); $$('.gemval').forEach(e => e.textContent = nf(save.gems || 0)); }
const curCustom = () => save.vehicle === 'hauler' ? save.truckCustom : save.custom;

// ---------- title ----------
function toTitle() { stopRace(); show.menu(curCustom(), G.planet, save.vehicle); go('title'); coinsBar(); }
$('#btn-play').onclick = () => { audio.unlock(); click(); toMap(); };
function click() { audio.play('click'); haptic(save.settings.haptics, 8); }
document.addEventListener('pointerdown', () => audio.unlock(), { once: true });

// ---------- world map ----------
function toMap(planet = G.planet) {
  stopRace(); G.planet = planet; save.planet = planet; persist();
  show.base(save.bases[planet], planet); show.camState.dist = 90; show.camState.pitch = 0.5;
  go('map'); renderMap(); coinsBar();
}
function renderMap() {
  $$('#planets button').forEach(b => b.classList.toggle('on', b.dataset.p === G.planet));
  const lv = levelsOf(G.planet); const pl = PLANETS[G.planet];
  $('#planet-desc').innerHTML = `<b>${pl.icon} ${pl.name}</b> · gravity ${pl.gravity} m/s² · ${esc(pl.desc)}`;
  const box = $('#nodes'); box.innerHTML = '';
  const W = box.clientWidth || 800, H = box.clientHeight || 260;
  const pts = lv.map((l, i) => [0.07 + 0.86 * (lv.length > 1 ? i / (lv.length - 1) : 0.5), i % 2 ? 0.78 : 0.24]);
  const svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><path d="${pts.map((p, i) => (i ? 'L' : 'M') + p[0] * W + ' ' + p[1] * H).join(' ')}" /></svg>`;
  box.insertAdjacentHTML('beforeend', svg);
  lv.forEach((l, i) => {
    const rec = save.levels[l.id] || {}; const open = P.isUnlocked(save, l);
    const n = document.createElement('button'); n.className = 'node' + (open ? '' : ' locked') + (rec.stars ? ' done' : '');
    n.style.left = pts[i][0] * 100 + '%'; n.style.top = pts[i][1] * 100 + '%';
    n.innerHTML = `<span class="num">${open ? i + 1 : '🔒'}</span><span class="nm">${esc(l.name)}</span><span class="st">${'★'.repeat(rec.stars || 0)}<i>${'★'.repeat(3 - (rec.stars || 0))}</i></span>${rec.questDone ? '<span class="q">✓ quest</span>' : ''}`;
    n.onclick = () => { click(); if (!open) return toast('Finish the previous level to unlock'); levelCard(l); };
    box.appendChild(n);
  });
  const dl = P.dailyChallenges(); const done = (save.daily.date === P.today() ? save.daily.done : []).length;
  $('#btn-daily .badge').textContent = `${done}/3`;
  const pend = P.pendingRefinery(save, G.planet); $('#btn-base .badge').textContent = pend > 0 ? '+' + pend : '';
}
$$('#planets button').forEach(b => b.onclick = () => {
  click(); const to = b.dataset.p; if (to === G.planet) return;
  rocketCutscene(G.planet, to, () => toMap(to));
});
function levelCard(l) {
  const rec = save.levels[l.id] || {}; const q = l.quest;
  $('#lc-body').innerHTML = `<h2>${esc(l.name)}</h2><div class="diff">${'●'.repeat(l.diff)}${'○'.repeat(Math.max(0, 5 - l.diff))} · ${PLANETS[l.planet].name}</div>
    <p>${esc(l.blurb)}</p><div class="objline">${objLabel(l)}</div><div class="quest">🎯 <b>${esc(q.name)}</b>: ${esc(q.text)} <span class="rw">+${q.reward}</span>${rec.questDone ? ' ✓' : ''}</div>${l.bonus ? `<div class="quest bonus">⭐ <b>${esc(l.bonus.name)}</b>${l.bonus.giver ? ` <small>(${esc(l.bonus.giver)})</small>` : ''}: ${P.bonusUnlocked(save, l) ? esc(l.bonus.text) + ` <span class="rw">+${l.bonus.reward}</span>${rec.bonusDone ? ' ✓' : ' <small>(active this run)</small>'}` : '<i>Unlocks after you clear the side quest above</i>'}</div>` : ''}
    <div class="recs"><span>Best score <b>${nf(rec.best || 0)}</b></span><span>Best race <b>${fmtT(rec.bestTime)}</b></span><span>Best trial <b>${fmtT(rec.bestTrial)}</b></span><span>${'★'.repeat(rec.stars || 0)}${'☆'.repeat(3 - (rec.stars || 0))}</span></div>`;
  $('#lc-race').onclick = () => { click(); hideModal(); startLevel(l, 'race'); };
  $('#lc-trial').onclick = () => { click(); hideModal(); startLevel(l, 'trial'); };
  showModal('levelcard');
}
const OBJ = { race: '🏁 Race: win for 3 stars', time_trial: '⏱ Time trial: beat the gold time', precision_landing: '🎯 Precision landing: stick the target pads', stunt_score: '🤸 Stunt score: chain tricks for points', collect: '📦 Collect: grab every item' };
function objLabel(l) { const o = (l.objective || {}).type || 'race'; let t = OBJ[o] || ''; const S = l.stars || {}; if (o === 'time_trial' && typeof S.threeStar === 'number') t += ` (${fmtT(S.threeStar)})`; if (o === 'stunt_score' && S.threeStar) t += ` (3★ ${nf(S.threeStar)})`; if (o === 'precision_landing' && l.objective.pads) t += ` (${l.objective.pads.length} pads)`; return t + (o !== 'race' ? ' · objective scored in Time Trial' : ''); }
function showModal(id) { $$('.modal').forEach(m => m.classList.toggle('on', m.id === 'm-' + id)); }
function hideModal() { $$('.modal').forEach(m => m.classList.remove('on')); }
$$('[data-close]').forEach(b => b.onclick = () => { click(); hideModal(); });

// ---------- rocket cutscene ----------
function rocketCutscene(from, to, done) {
  go('cut'); $('#cut-title').textContent = `${PLANETS[from].icon} ${PLANETS[from].name}  →  ${PLANETS[to].icon} ${PLANETS[to].name}`;
  $('#cut-count').textContent = '3';
  let finished = false; const fin = () => { if (finished) return; finished = true; clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); $('#fade').classList.add('on'); setTimeout(() => { done(); setTimeout(() => $('#fade').classList.remove('on'), 120); toast(`Welcome to <b>${PLANETS[to].name}</b>! Gravity ${PLANETS[to].gravity} m/s²`, 2800); }, 450); };
  const t1 = setTimeout(() => { $('#cut-count').textContent = '2'; audio.play('count'); }, 1000);
  const t2 = setTimeout(() => { $('#cut-count').textContent = '1'; audio.play('count'); }, 2000);
  const t3 = setTimeout(() => { $('#cut-count').textContent = 'LIFTOFF!'; audio.play('rocket'); haptic(save.settings.haptics, [200, 60, 400]); }, 3100);
  const t4 = setTimeout(() => $('#cut-count').textContent = '', 5200);
  audio.play('count');
  show.rocket(from, to, fin);
  $('#cut-skip').onclick = () => { click(); fin(); };
}

// ---------- garage + customization shop ----------
let garageTab = 'vehicle', shopCat = 'paints';
let vehConfirm = null;
function vehBtn(V) {
  if (save.vehicle === V.id) return `<button class="buy" data-veh="${V.id}" disabled>SELECTED</button>`;
  if (P.ownsVehicle(save, V.id)) return `<button class="buy" data-veh="${V.id}">SELECT</button>`;
  const cost = V.price?.coins || 0, gems = V.price?.gems || 0, can = save.coins >= cost && (save.gems || 0) >= gems;
  const lbl = (cost ? '🪙 ' + nf(cost) : '') + (gems ? ' 💎 ' + nf(gems) : '');
  if (!can) return `<button class="buy" data-veh="${V.id}" disabled title="Not enough coins">🔒 ${lbl}</button>`;
  return `<button class="buy${vehConfirm === V.id ? ' confirm' : ''}" data-veh="${V.id}">${vehConfirm === V.id ? 'CONFIRM ' + lbl : 'BUY ' + lbl}</button>`;
}
function toGarage() { show.garage(curCustom(), undefined, undefined, save.vehicle); go('garage'); renderGarage(); coinsBar(); }
$$('#garage-tabs button').forEach(b => b.onclick = () => { click(); garageTab = b.dataset.t; renderGarage(); });
function statBars(id) {
  const st = carStats(save.upgrades, P.runBonus(save, G.planet), vehicleOf(id)), V = vehicleOf(id);
  const bar = (n, v, max, txt) => `<div class="sbar"><span>${n}</span><i><b style="width:${Math.min(100, v / max * 100)}%"></b></i><em>${txt}</em></div>`;
  return bar('Top speed', st.vmax, 120, (st.vmax * 3.6).toFixed(0) + ' km/h') + bar('Acceleration', st.accel, Math.max(st.accel, 1) * 0 + 40, '') + bar('Grip', st.grip, 6, '') + bar('Weight', V.mass, 3200, V.mass + ' kg') + bar('Toughness', V.tough, 2, V.tough > 1 ? 'shrugs off crashes' : 'fragile')
    + (V.rcs ? bar('Cold-gas RCS', st.gasCap, 7, st.gasCap.toFixed(1) + ' s') : bar('Thruster', st.thrustCap, 3.5, st.thrustCap.toFixed(1) + ' s'));
}
function renderGarage() {
  $$('#garage-tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === garageTab));
  const box = $('#garage-body'); const c = curCustom(); let html = '';
  if (garageTab === 'vehicle') {
    html = Object.values(VEHICLES).map(V => `<div class="vcard ${save.vehicle === V.id ? 'on' : ''}"><div class="vhead"><span class="vic">${V.icon}</span><div class="grow"><b>${esc(V.name)}</b><small>${esc(V.blurb)}</small></div>
      ${vehBtn(V)}</div>${statBars(V.id)}
      ${V.rcs ? '<div class="note">In the air: hold JUMP to hover / soft-land, steer + gas/brake to fire attitude jets. Gas refills on the ground and from battery pickups.</div>' : '<div class="note">In the air: hold JUMP for the battery thruster, gas/brake to flip.</div>'}</div>`).join('')
      + '<p class="note">Both vehicles drive on Earth, the Moon and Mars. Upgrades are shared; each vehicle keeps its own look.</p>';
  } else if (garageTab === 'upgrades') {
    const V = vehicleOf(save.vehicle);
    html = `<div class="statline">${esc(V.name)}</div>`;
    for (const u of P.UPGRADES) {
      if (u.id === 'thruster' && V.rcs) continue; if (u.vehicle && u.vehicle !== V.id) continue;
      const lvl = save.upgrades[u.id] || 0; const mt = P.maxTier(u.id); const max = lvl >= mt; const cost = P.upgradeCost(save, u.id, lvl);
      html += `<div class="row"><span class="ic">${u.icon}</span><div class="grow"><b>${u.name}</b><small>${u.desc}</small><div class="pips">${Array.from({ length: mt }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div></div>
        <button class="buy" data-up="${u.id}" ${max || save.coins < cost ? 'disabled' : ''}>${max ? 'MAX' : '🪙 ' + nf(cost)}</button></div>`;
    }
  } else if (garageTab === 'shop') {
    const cat = catOf(shopCat);
    html = `<div class="cats">${CATS.map(k => `<button class="cat ${k.id === shopCat ? 'on' : ''}" data-cat="${k.id}">${k.icon}<small>${k.name}</small></button>`).join('')}</div><div class="items">`;
    for (const it of cat.list) {
      const own = owns(save, cat.id, it.id), on = (c[cat.key] || 'none') === it.id || (cat.key === 'underglow' && it.id === 'none' && !c.underglow);
      const sw = cat.id === 'paints' ? `<i class="swc" style="--c:${it.color}"></i>` : cat.id === 'underglow' ? `<i class="swc" style="--c:${it.id === 'none' ? '#222' : it.id === 'rainbow' || it.id === 'pulse' ? 'conic-gradient(red,yellow,lime,cyan,blue,magenta,red)' : it.id}"></i>` : cat.id === 'flames' ? `<i class="swc" style="--c:${it.rainbow ? 'conic-gradient(red,yellow,lime,cyan,blue,magenta,red)' : `linear-gradient(135deg, rgb(${it.c1.map(v => v * 255 | 0)}), rgb(${it.c2.map(v => v * 255 | 0)}))`}"></i>` : '';
      const prem = it.price?.gems ? ' prem' : '';
      html += `<button class="item${on ? ' on' : ''}${own ? ' own' : ''}${prem}" data-item="${it.id}">${sw}<b>${esc(it.name)}</b><small>${own ? (on ? 'EQUIPPED' : (cat.id === 'horns' ? 'OWNED · tap to preview' : 'OWNED')) : priceLabel(it)}</small></button>`;
    }
    html += '</div>';
    if (shopCat === 'wraps') html += `<h4>Wrap colour</h4><div class="sw">${['#111111', '#f2f2f0', '#ffb000', '#00d0ff', '#ff2f92', '#39ff6a', '#7a2cff'].map(col => `<button class="chip ${c.wrapColor === col ? 'on' : ''}" data-wcol="${col}" style="--c:${col}"></button>`).join('')}</div>`;
    if (shopCat === 'rims') html += `<h4>Rim colour</h4><div class="sw">${['#c8ccd2', '#1a1a1e', '#d4a017', '#00e5ff', '#ff2f92', '#f2f2f0'].map(col => `<button class="chip ${c.rimColor === col ? 'on' : ''}" data-rcol="${col}" style="--c:${col}"></button>`).join('')}</div>
      <h4>Brake calipers</h4><div class="sw">${['#d01818', '#ffb000', '#00d0ff', '#39ff6a', '#ff2f92', '#f2f2f0', '#111111'].map(col => `<button class="chip ${c.caliper === col ? 'on' : ''}" data-cal="${col}" style="--c:${col}"></button>`).join('')}</div>`;
    html += `<p class="note">💎 Gems are earned slowly: +1 per new star, +2 for 3 stars, +2 per first quest clear, +3 per achievement, +1 per daily challenge (+1 on a 3-day streak).</p>`;
  } else if (garageTab === 'gems') {
    html = `<div class="gemhead"><div class="gembig">💎 ${nf(save.gems || 0)}</div><small>Lifetime earned: ${nf(save.totalGems || 0)}</small></div>
      <h4>Earn gems by playing</h4><ul class="earn"><li>⭐ New level star: <b>+1</b> (3 stars: <b>+2</b> bonus)</li><li>🎯 First side-quest clear: <b>+2</b></li><li>🏆 Achievement: <b>+3</b></li><li>📅 Daily challenge: <b>+1</b>, <b>+2</b> on a 3+ day streak</li></ul>
      <h4>Gem packs ${PAYMENTS.enabled ? '' : '<span class="soon">COMING SOON</span>'}</h4><div class="packs">${PAYMENTS.packs.map(p => `<div class="pack ${PAYMENTS.enabled ? '' : 'off'}"><div class="pg">💎 ${nf(p.gems)}</div>${p.tag ? `<div class="ptag">${esc(p.tag)}</div>` : ''}<button class="buy" data-pack="${p.id}" ${PAYMENTS.enabled ? '' : 'disabled'}>${PAYMENTS.enabled ? esc(p.price) : 'Coming soon'}</button><small>${esc(p.price)}</small></div>`).join('')}</div>
      <p class="note">${PAYMENTS.enabled ? 'Secure checkout by Stripe. Gems are credited after payment is confirmed.' : 'Real-money purchases are not available yet: no payment provider is connected, so nothing can be bought or charged. Everything in the shop can be earned by playing.'}</p>`;
  }
  box.innerHTML = html;
  $$('[data-veh]', box).forEach(b => b.onclick = () => {
    const V = VEHICLES[b.dataset.veh]; if (!V) return;
    if (!P.ownsVehicle(save, V.id)) { // two-tap purchase: first tap arms, second tap buys (only if affordable)
      if (vehConfirm !== V.id) { vehConfirm = V.id; click(); renderGarage(); return; }
      const r = P.buyVehicle(save, V); vehConfirm = null;
      if (!r.ok) { toast(`Not enough ${r.why === 'gems' ? 'gems' : 'coins'}: need ${nf(r.need)} more`); renderGarage(); return; }
      audio.play('buy'); haptic(save.settings.haptics, 20); toast(`${V.icon} <b>${esc(V.name)}</b> unlocked!`);
    } else click();
    if (!P.selectVehicle(save, V.id)) return;
    persist(true); show.setCar(curCustom(), save.vehicle); coinsBar(); toast(`${V.icon} <b>${esc(V.name)}</b> selected`); renderGarage();
  });
  $$('[data-up]', box).forEach(b => b.onclick = () => { const id = b.dataset.up, lvl = save.upgrades[id] || 0, cost = P.upgradeCost(save, id, lvl); if (save.coins < cost || lvl >= P.maxTier(id)) return; save.coins -= cost; save.upgrades[id] = lvl + 1; audio.play('buy'); haptic(save.settings.haptics, 20); afterBuy(); });
  $$('[data-cat]', box).forEach(b => b.onclick = () => { click(); shopCat = b.dataset.cat; renderGarage(); });
  const setC = (k, v) => { curCustom()[k] = v; show.setCar(curCustom(), save.vehicle); persist(); renderGarage(); };
  $$('[data-item]', box).forEach(b => b.onclick = () => {
    const cat = catOf(shopCat), id = b.dataset.item, it = itemOf(cat.id, id);
    if (!owns(save, cat.id, id)) {
      const r = buyItem(save, cat.id, id); if (!r.ok) { audio.play('fail'); return toast(r.reason); }
      audio.play('buy'); haptic(save.settings.haptics, [20, 40, 20]); toast(`Unlocked <b>${esc(it.name)}</b>`); coinsBar(); cloudSync();
    } else click();
    if (cat.id === 'horns') audio.horn(id);
    setC(cat.key, id);
  });
  $$('[data-wcol]', box).forEach(b => b.onclick = () => { click(); setC('wrapColor', b.dataset.wcol); });
  $$('[data-rcol]', box).forEach(b => b.onclick = () => { click(); setC('rimColor', b.dataset.rcol); });
  $$('[data-cal]', box).forEach(b => b.onclick = () => { click(); setC('caliper', b.dataset.cal); });
  $$('[data-pack]', box).forEach(b => b.onclick = () => buyGemPack(b.dataset.pack));
}
// Real-money gems: only when PAYMENTS.enabled and the server has Stripe configured. Gems are credited by the server webhook, never client-side.
async function buyGemPack(id) {
  if (!PAYMENTS.enabled) return toast('Gem packs are coming soon');
  try {
    const r = await fetch(PAYMENTS.checkoutEndpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pack: id, playerId: save.cloud?.id }) });
    const j = await r.json().catch(() => ({})); if (r.ok && j.url) location.href = j.url; else toast('Store unavailable: ' + esc(j.error || r.status));
  } catch (e) { toast('Store unavailable (offline)'); }
}
function afterBuy() { const got = P.checkAchievements(save, null, null); got.forEach(a => achToast(a)); persist(); coinsBar(); renderGarage(); }
// drag to rotate in garage / base
{ let drag = null; canvas.addEventListener('pointerdown', e => { if (!['garage', 'base', 'title', 'map'].includes(G.screen) || !show.camState) return; drag = { x: e.clientX, y: e.clientY, moved: 0 }; show.camState.auto = false; });
  addEventListener('pointermove', e => { if (!drag || !show.camState) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy); show.camState.yaw += dx * 0.008; show.camState.pitch = Math.max(0.05, Math.min(1.3, show.camState.pitch + dy * 0.004)); });
  addEventListener('pointerup', e => { if (!drag) return; const moved = drag.moved; drag = null; setTimeout(() => show.camState && (show.camState.auto = true), 4000);
    if (G.screen === 'base' && moved < 8) { const r = canvas.getBoundingClientRect(); const i = show.pick((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); if (i != null) plotPanel(i); } });
  canvas.addEventListener('wheel', e => { if (show.camState) show.camState.dist = Math.max(5, Math.min(140, show.camState.dist * (1 + Math.sign(e.deltaY) * 0.08))); }, { passive: true }); }

// ---------- base ----------
function toBase(planet = G.planet) { G.basePlanet = planet; show.base(save.bases[planet], planet); go('base'); renderBase(); coinsBar(); }
function renderBase() {
  const pl = G.basePlanet, b = save.bases[pl]; const pend = P.pendingRefinery(save, pl);
  $('#base-info').innerHTML = `<b>${PLANETS[pl].icon} ${PLANETS[pl].name} Base</b><span>🤖 Volt-Bots: ${P.robotCount(save)}</span><span>🏭 ${P.refineryRate(save, pl).toFixed(0)}/h</span><span>Tap a hex pad to build</span>`;
  $('#base-collect').disabled = pend <= 0; $('#base-collect').textContent = pend > 0 ? `Collect 🪙 ${pend}` : 'Refinery idle';
  const hasHall = Object.values(save.bases).some(x => x.plots.some(p => p && p.type === 'trophy'));
  $('#base-trophy').textContent = hasHall ? '🏆 Trophy Room' : '🏆 Build a Trophy Hall';
  $('#base-trophy').classList.toggle('dim', !hasHall);
}
$('#base-collect').onclick = () => { const pl = G.basePlanet; const pend = P.pendingRefinery(save, pl); if (pend <= 0) return; save.coins += pend; save.totalCoins += pend; save.bases[pl].last = Date.now(); audio.play('buy'); haptic(save.settings.haptics, 25); toast(`+🪙 ${pend} from the refinery`); afterBase(); };
$('#base-trophy').onclick = () => { click(); const hasHall = Object.values(save.bases).some(x => x.plots.some(p => p && p.type === 'trophy')); if (!hasHall) return toast('Build a Trophy Hall on any base pad first'); show.trophies(save); go('trophy'); const n = Object.keys(save.achievements).length; $('#trophy-info').innerHTML = `<b>Trophy Room</b> · ${n}/${P.ACHIEVEMENTS.length} trophies lit`; };
$$('#base-planets button').forEach(b => b.onclick = () => { click(); toBase(b.dataset.p); });
function plotPanel(i) {
  const pl = G.basePlanet, plot = save.bases[pl].plots[i]; let html;
  if (!plot) {
    html = `<h3>Build on pad ${i + 1}</h3>` + P.BUILDINGS.map(B => { const cost = B.cost[0]; return `<div class="row"><span class="ic">${B.icon}</span><div class="grow"><b>${B.name}</b><small>${B.desc}</small></div><button class="buy" data-build="${B.id}" ${save.coins < cost ? 'disabled' : ''}>🪙 ${nf(cost)}</button></div>`; }).join('');
  } else {
    const B = P.BUILDINGS.find(x => x.id === plot.type); const max = plot.lvl >= B.max; const cost = B.cost[plot.lvl];
    html = `<h3>${B.icon} ${B.name} · L${plot.lvl}</h3><p>${B.desc}</p><button class="buy big" data-upg="1" ${max || save.coins < cost ? 'disabled' : ''}>${max ? 'MAX LEVEL' : `Upgrade · 🪙 ${nf(cost)}`}</button>`;
  }
  $('#plot-body').innerHTML = html; showModal('plot');
  $$('[data-build]').forEach(b => b.onclick = () => { const B = P.BUILDINGS.find(x => x.id === b.dataset.build); if (save.coins < B.cost[0]) return; save.coins -= B.cost[0]; save.bases[pl].plots[i] = { type: B.id, lvl: 1 }; if (B.id === 'refinery' && !save.bases[pl].last) save.bases[pl].last = Date.now(); audio.play('buy'); hideModal(); afterBase(true); toast(`${B.icon} ${B.name} built! Volt-Bots are on it.`); });
  $$('[data-upg]').forEach(b => b.onclick = () => { const B = P.BUILDINGS.find(x => x.id === plot.type); const cost = B.cost[plot.lvl]; if (save.coins < cost || plot.lvl >= B.max) return; save.coins -= cost; plot.lvl++; audio.play('buy'); hideModal(); afterBase(true); });
}
function afterBase(rebuild) { P.checkAchievements(save, null, null).forEach(achToast); persist(); coinsBar(); if (rebuild) show.base(save.bases[G.basePlanet], G.basePlanet); renderBase(); cloudSync(); }

// ---------- achievements / daily ----------
function toAch() {
  const n = Object.keys(save.achievements).length;
  $('#ach-body').innerHTML = `<div class="statline">${n}/${P.ACHIEVEMENTS.length} unlocked · Races ${save.stats.races} · Loops ${save.stats.loops} · Flips ${save.stats.flips} · Car jumps ${save.stats.carJumps} · Perfect landings ${save.stats.perfect}</div><div class="grid">` +
    P.ACHIEVEMENTS.map(a => `<div class="ach ${save.achievements[a.id] ? 'got' : ''}"><span>${save.achievements[a.id] ? '🏆' : '🔒'}</span><b>${esc(a.name)}</b><small>${esc(a.desc)}</small></div>`).join('') + '</div>';
  showModal('ach');
}
function toDaily() {
  const t = P.today(); const done = save.daily.date === t ? save.daily.done : [];
  $('#daily-body').innerHTML = `<div class="statline">🔥 Streak: <b>${save.daily.streak || 0}</b> day(s) · rewards grow +25% per streak day</div>` +
    P.dailyChallenges(t).map(c => `<div class="row ${done.includes(c.id) ? 'got' : ''}"><span class="ic">${done.includes(c.id) ? '✅' : '🎯'}</span><div class="grow"><b>${esc(c.text)}</b><small>Any level, any mode</small></div><span class="rw">🪙 ${c.reward}</span></div>`).join('') + '<small class="muted">New challenges every day at midnight.</small>';
  showModal('daily');
}
function achToast(a) { if (!a) return; toast(`🏆 <b>${esc(a.name)}</b><br><small>${esc(a.desc)}</small>`, 3200, 'ach'); audio.play('perfect'); }

// ---------- settings ----------
function toSettings() { renderSettings(); showModal('settings'); }
function renderSettings() {
  const st = save.settings;
  const sel = (k, opts) => `<div class="seg" data-k="${k}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(st[k]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const tog = (k, l) => `<label class="tog"><input type="checkbox" data-t="${k}" ${st[k] ? 'checked' : ''}><span></span>${l}</label>`;
  $('#set-body').innerHTML = `
    <h4>Graphics <small>(detected: ${esc(gfx.info.tier)} · ${esc((gfx.info.gpu || '').slice(0, 40))})</small></h4>${sel('quality', [['auto', 'Auto'], ['performance', 'Perf'], ['low', 'Low'], ['medium', 'Med'], ['high', 'High'], ['ultra', 'Ultra']])}<small class="muted">Performance = smoothest frame rate. Ultra = native resolution, light post. Resolution adapts automatically to hold a steady frame time.</small>${tog('extraAO', 'Extra: ambient occlusion (costly)')}
    <h4>Frame rate</h4>${sel('fpsCap', [[60, '60'], [120, '120'], [0, 'Unlimited']])}${tog('showFps', 'Show FPS counter')}
    <h4>Controls</h4>${sel('steer', [['drag', 'Analog pad'], ['buttons', '◀ ▶ buttons'], ['tilt', 'Tilt phone']])}<label class="sl">Steering sensitivity <input type="range" min="0.5" max="1.6" step="0.05" data-r="sens" value="${st.sens ?? 1}"><b id="sens-v">${Math.round((st.sens ?? 1) * 100)}%</b></label>${tog('esc', 'Stability control / traction assist')}${tog('autoGas', 'Auto-accelerate (touch)')}${tog('left', 'Left-handed layout')}${tog('assist', 'Air auto-level + landing assist')}${tog('airRoll', 'Steer = barrel roll in air')}${tog('haptics', 'Haptics (vibration)')}
    <h4>Camera & effects</h4>${sel('camMode', [['chase', 'Chase'], ['close', 'Close'], ['hood', 'Hood'], ['drone', 'Drone']])}${tog('shake', 'Camera shake')}${tog('bulletTime', 'Bullet-time on big jumps / near misses')}${tog('ghosts', 'Ghost replays')}
    <h4>Audio</h4><label class="sl">Music <input type="range" min="0" max="1" step="0.05" data-r="music" value="${st.music}"></label><label class="sl">SFX <input type="range" min="0" max="1" step="0.05" data-r="sfx" value="${st.sfx}"></label>
    <h4>Cloud save</h4><div id="cloud-box"></div>
    <h4>Data</h4><button class="btn small danger" id="btn-reset">Reset progress</button>`;
  $$('#set-body .seg').forEach(seg => $$('button', seg).forEach(b => b.onclick = () => { click(); let v = b.dataset.v; if (seg.dataset.k === 'fpsCap') v = +v; st[seg.dataset.k] = v; if (seg.dataset.k === 'quality') { gfx.setQuality(tierName()); if (G.view) toast('Quality changes fully apply on the next level'); else refreshShow(); } persist(); applySettings(); renderSettings(); }));
  $$('#set-body [data-t]').forEach(c => c.onchange = () => { st[c.dataset.t] = c.checked; if (c.dataset.t === 'extraAO') { gfx.extraAO = c.checked; gfx.setQuality(tierName()); } persist(); applySettings(); if (G.view) G.view.opts.shake = st.shake; layoutTouch(); });
  $$('#set-body [data-r]').forEach(r => r.oninput = () => { st[r.dataset.r] = +r.value; if (r.dataset.r === 'sens') $('#sens-v').textContent = Math.round(st.sens * 100) + '%'; applySettings(); persist(); });
  $('#btn-reset').onclick = () => { if (!confirm('Erase all local progress? (Cloud copy stays restorable with your code)')) return; const cloud = save.cloud; save = P.defaultSave(); save.cloud = cloud; persist(true); hideModal(); toTitle(); };
  renderCloud();
}
function renderCloud() {
  const box = $('#cloud-box'); if (!box) return; const c = save.cloud || {};
  box.innerHTML = `<div class="cloud"><div>Recovery code <b class="code">${c.code ? esc(c.code) : '— (created after your first race)'}</b> ${c.code ? '<button class="btn small" id="cl-copy">Copy</button>' : ''}</div>
    <div class="muted">Status: ${esc(c.status || 'new')}${c.lastSync ? ' · last sync ' + new Date(c.lastSync).toLocaleTimeString() : ''}. Saves to the cloud once you have progress: at checkpoints, after races and when you leave.</div>
    <div class="row2"><button class="btn small" id="cl-sync">Sync now</button><input id="cl-code" placeholder="VOLT-XXXX-XXXX-XXXX" maxlength="40" autocapitalize="characters" autocomplete="off" spellcheck="false"><button class="btn small" id="cl-restore">Restore</button></div></div>`;
  if ($('#cl-copy')) $('#cl-copy').onclick = () => { navigator.clipboard?.writeText(c.code).then(() => toast('Code copied')).catch(() => toast(c.code)); };
  $('#cl-sync').onclick = async () => { const r = await cloudSync(); toast(r && r.ok ? '☁️ Synced' : '☁️ Sync failed: ' + esc(r?.error || 'offline')); };
  $('#cl-restore').onclick = async () => { const code = P.normCode($('#cl-code').value); $('#cl-code').value = code; try { const j = await P.cloudRestore(code); const old = save.cloud && save.cloud.id !== j.id && save.cloud.lastSync ? save.cloud : null; const cloud = { id: j.id, secret: j.secret, code: j.code, lastSync: Date.now(), status: 'synced' }; save = P.mergeCloud({ ...P.defaultSave(), updatedAt: 0 }, j.data); save.cloud = cloud; persist(true); applySettings(); P.cloudForget(old); toast('☁️ Progress restored!'); hideModal(); toMap(); } catch (e) { toast('Restore failed: ' + esc(e.message)); } };
}
function refreshShow() { if (G.screen === 'garage') toGarage(); else if (G.screen === 'map') toMap(); else if (G.screen === 'base') toBase(G.basePlanet); else if (G.screen === 'title') toTitle(); }

// nav buttons
$$('[data-go]').forEach(b => b.onclick = () => { click(); const g = b.dataset.go; ({ title: toTitle, map: () => toMap(), garage: toGarage, base: () => toBase(G.planet), ach: toAch, daily: toDaily, settings: toSettings, fullscreen: toggleFS })[g](); });
function toggleFS() { const d = document; if (!d.fullscreenElement) { (d.documentElement.requestFullscreen?.({ navigationUI: 'hide' }) || Promise.resolve()).then(() => window.screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {}); } else d.exitFullscreen?.(); }

// ---------------- racing ----------------
async function startLevel(level, mode) {
  stopRace(); G.level = level; G.mode = mode;
  $('#loading-text').textContent = `Building ${level.name}…`; go('loading');
  await new Promise(r => requestAnimationFrame(() => setTimeout(r, 30)));
  try {
    const sim = new Sim(level, { quest: P.activeQuest(save, level), mode, vehicle: P.ownsVehicle(save, save.vehicle) ? save.vehicle : 'roadster', upgrades: save.upgrades, bonus: P.runBonus(save, level.planet), robots: P.robotCount(save) });
    await sim.init();
    G.ghostPrev = save.settings.ghosts ? P.loadGhost(level.id, mode) : null; if (G.ghostPrev) sim.setGhost(G.ghostPrev);
    const view = new LevelView(gfx, sim, { custom: curCustom(), camMode: save.settings.camMode, shake: save.settings.shake });
    G.sim = sim; G.view = view; G.paused = false; G.timeScale = 1; G.slowT = 0; G.photo = null; G.finishShown = false; G.lastHud = 0; G.gapSlow = new Set(); G.cpSync = 0;
    gfx.setScene(view.scene);
    $('#hud-level').textContent = `${level.name} · ${mode === 'race' ? 'Race' : 'Time Trial'}`; $('#thr-lbl').textContent = sim.veh.rcs ? 'GAS' : 'THRUST'; $('#hud').classList.toggle('rcs', !!sim.veh.rcs);
    $('#hud-pos').style.display = mode === 'race' ? '' : 'none';
    { const aq = P.activeQuest(save, level); $('#quest-line').innerHTML = `${aq.bonus ? '⭐' : '🎯'} ${esc(aq.name)}: ${esc(aq.text)}`; }
    buildMinimap(view);
    go('race'); layoutTouch();
    if (save.settings.music > 0) { audio.startRadio(); }
    if (!save.seenIntro) { save.seenIntro = true; persist(); toast(input.isTouch || matchMedia('(pointer:coarse)').matches ? 'Hold ◀ ▶ to steer · 🔥 boost · ⬆ jump/thrust<br>In the air: gas/brake = flip, steer = spin' : 'WASD / arrows · Shift boost · Space jump/thrust · C camera · P pause<br>In the air: W/S flip, A/D spin', 5200); }
  } catch (e) { console.error(e); toast('Failed to load level: ' + esc(e.message), 4000); toMap(); }
}
function stopRace() {
  if (G.view) { G.view.dispose(); G.view = null; }
  if (G.sim) { G.sim.dispose(); G.sim = null; }
  audio.engine(0, 0, false, 0, false, false); audio.rcs(0); audio.stopRadio(); audio.setSlowmo(false);
  G.paused = false; G.photo = null; document.body.classList.remove('photo');
}
function pause(on = true) {
  if (!G.sim || G.sim.state === 'finished') return; if (!on && blockedReason()) return; G.paused = on; go(on ? 'pause' : 'race'); last = performance.now(); if (!on) input.releaseAll(); if (on) $('#p-quality').textContent = qualityLabel();
  audio.engine(0, 0, false, 0, false, !on); audio.rcs(0);
  if (on) { const s = G.sim; $('#pause-stats').innerHTML = `Score <b>${nf(s.score)}</b> · Coins <b>${s.coins}</b> · Time <b>${fmtT(s.raceTime)}</b>`; persist(true); }
}
$('#btn-pause').onclick = () => { click(); pause(true); };
$('#p-resume').onclick = () => { click(); pause(false); };
$('#p-restart').onclick = () => { click(); startLevel(G.level, G.mode); };
$('#p-map').onclick = () => { click(); toMap(G.level.planet); };
$('#p-settings').onclick = () => { click(); toSettings(); };
$('#p-photo').onclick = () => { click(); photoMode(true); };
$('#btn-cam').onclick = () => { click(); cycleCam(); };
const QCYCLE = ['performance', 'high', 'ultra'];
function qualityLabel() { return `⚙ Graphics: ${PRESETS[tierName()]?.name || tierName()}${save.settings.quality === 'auto' ? ' (auto)' : ''}`; }
$('#p-quality').onclick = () => { click(); const cur = tierName(); save.settings.quality = QCYCLE[(QCYCLE.indexOf(cur) + 1) % QCYCLE.length]; gfx.setQuality(tierName()); persist(); $('#p-quality').textContent = qualityLabel(); toast(`Graphics: <b>${PRESETS[tierName()].name}</b> (scene detail applies on restart)`); };
$('#btn-respawn').onclick = () => { click(); manualRespawn(); };
$('#btn-radio').onclick = () => { click(); if (!audio.radio) audio.startRadio(); else audio.nextTrack(); };
function honk() {
  const s = G.sim; if (!s || G.honkCd > performance.now()) return; G.honkCd = performance.now() + 700;
  audio.horn(curCustom().horn || 'beep'); haptic(save.settings.haptics, 15);
  // funny bonus: honking right next to traffic or a cow scores a little
  const near = s.traffic.some(t => t.p.distanceTo(s.pose.p) < 14) || s.questItems.some(o => o.kind === 'cow' && o.p && o.p.distanceTo(s.pose.p) < 16);
  if (near && s.state === 'race') { s.addScore(50, 'HONK!', 'trick'); }
}
$('#btn-horn').onclick = () => { honk(); };
function cycleCam() { if (!G.view) return; const modes = ['chase', 'close', 'hood', 'drone']; const c = G.view.cam; c.mode = modes[(modes.indexOf(c.mode) + 1) % modes.length]; c.init = false; save.settings.camMode = c.mode; persist(); toast('Camera: ' + c.mode, 900); }
function manualRespawn() { const s = G.sim; if (!s) return; s.softReset('button'); }
input.onKey = code => {
  if (code === 'KeyP' || code === 'Escape') { if (G.photo) photoMode(false); else if (G.screen === 'race') pause(true); else if (G.screen === 'pause') pause(false); else if ($('.modal.on')) hideModal(); }
  if (G.screen !== 'race') return;
  if (code === 'KeyH') honk(); if (code === 'KeyC') cycleCam(); if (code === 'KeyR') manualRespawn(); if (code === 'KeyM') audio.nextTrack(); if (code === 'KeyF') toggleFS();
};
audio.onTrack = info => { $('#radio').textContent = `📻 ${info.station} — ${info.name}`; $('#radio').classList.add('show'); clearTimeout(G.radioT); G.radioT = setTimeout(() => $('#radio').classList.remove('show'), 4000); };

// popups
function popup(text, pts, kind) { const el = document.createElement('div'); el.className = 'pop ' + (kind || ''); el.innerHTML = `${esc(text)}${pts ? `<small>+${nf(pts)}</small>` : ''}`; $('#pops').appendChild(el); setTimeout(() => el.remove(), 1500); while ($('#pops').children.length > 4) $('#pops').firstChild.remove(); }
function bigText(t, ms = 900, cls = '') { const el = $('#big'); el.className = 'show ' + cls; el.textContent = t; clearTimeout(G.bigT); G.bigT = setTimeout(() => el.className = '', ms); }
function slowmo(sec) { if (!save.settings.bulletTime || G.slowCd > 0) return; G.slowT = sec; G.slowCd = sec + 3.5; audio.setSlowmo(true); }

function handleEvents(evs) {
  const hp = save.settings.haptics; const s = G.sim;
  for (const e of evs) switch (e.type) {
    case 'count': if (e.n > 0) { bigText(String(e.n), 800, 'count'); audio.play('count'); } break;
    case 'go': bigText('GO!', 700, 'go'); audio.play('go'); haptic(hp, 40); break;
    case 'coin': audio.play('coin'); haptic(hp, 6); break;
    case 'battery': audio.play('battery'); haptic(hp, 20); popup('BATTERY +12s'); break;
    case 'nitro': audio.play('nitro'); haptic(hp, 20); popup('NITRO FULL'); break;
    case 'score': popup(e.text, e.pts, e.kind); if (['flip', 'pad', 'loop', 'gap', 'egg'].includes(e.kind)) audio.play(e.kind === 'pad' ? 'perfect' : 'trick'); break;
    case 'land': audio.play('land', e.strength); haptic(hp, Math.round(15 + e.strength * 60)); break;
    case 'popup': popup(e.text, 0, e.kind); break;
    case 'wallHit': audio.play('crash'); haptic(hp, [40, 30, 40]); break;
    case 'hardLanding': haptic(hp, [60, 30, 60]); break;
    case 'crash': audio.play('crash'); haptic(hp, [70, 40, 140]); bigText({ flip: 'FLIPPED!', fall: 'WIPEOUT!', off: 'OFF TRACK!', stuck: 'STUCK!', traffic: 'CRASH!', landing: 'BAD LANDING!', meteor: 'METEOR HIT!' }[e.reason] || 'CRASH!', 1300, 'bad'); break;
    case 'hit': audio.play('hit', e.strength); haptic(hp, Math.round(10 + e.strength * 40)); break;
    case 'checkpoint': audio.play('checkpoint'); haptic(hp, 15); popup(`CHECKPOINT +${e.bonus}s`, 0, 'cp'); persist(); if (Date.now() - G.lastCloud > 20000) cloudSync(); break;
    case 'nearMiss': audio.play('near'); haptic(hp, 12); slowmo(0.9); break;
    case 'carJump': slowmo(1.1); break;
    case 'questStart': toast('🎯 ' + esc(e.text)); audio.play('quest'); break;
    case 'questItem': popup(`${e.n}/${e.of}`, 0, 'quest'); audio.play('quest'); break;
    case 'questDone': toast(`🎯 <b>${esc(e.name)}</b> complete! +🪙 ${e.reward}`, 2600, 'ach'); audio.play('quest'); haptic(hp, [30, 30, 60]); break;
    case 'questFail': toast('😢 ' + esc(e.text)); audio.play('fail'); break;
    case 'mailbox': audio.play('hit', 0.6); break;
    case 'moo': audio.play('moo'); break; case 'beep': audio.play('beep'); break;
    case 'meteorSpawn': audio.play('whoosh'); break;
    case 'meteorImpact': audio.play('boom', Math.max(0.2, 1 - e.d / 80)); haptic(hp, e.d < 30 ? 50 : 0); break;
    case 'devil': audio.play('whoosh'); haptic(hp, [40, 30, 80]); slowmo(1); break;
    case 'easterEgg': toast('👀 <b>You found the Orbit Roadster!</b> Its robot driver waves back.', 4000, 'ach'); slowmo(1.5); break;
    case 'comboEnd': popup(`COMBO x${e.chain}`, e.pts, 'combo'); break;
    case 'batteryOut': bigText('BATTERY EMPTY!', 1800, 'bad'); audio.play('fail'); break;
    case 'boost': audio.play('boost'); haptic(hp, 25); break;
    case 'jump': audio.play('jump'); haptic(hp, 15); break;
    case 'respawn': haptic(hp, 10); break;
    case 'finish': setTimeout(() => showResults(e), 1100); break;
  }
}

// results
function showResults(r) {
  if (G.finishShown || !G.sim) return; G.finishShown = true; const s = G.sim, level = G.level;
  r.mode = G.mode; r.egg = !!(s.egg && s.egg.found); r.rocket = !!(level.spaceport && r.ok);
  if (r.ok && r.ghost) { const prev = G.ghostPrev; if (prev && r.time < prev.time) r.ghostBeaten = true; if (!prev || r.time < prev.time) P.saveGhost(level.id, G.mode, r.ghost); }
  const { earn, unlocked } = P.applyResult(save, level, r);
  audio.play(r.ok ? 'perfect' : 'fail'); audio.engine(0, 0, false, 0, false, false);
  const title = !r.ok ? (r.reason === 'battery' ? 'OUT OF BATTERY' : 'DNF') : G.mode === 'race' ? ['', '1ST PLACE!', '2ND PLACE', '3RD PLACE', '4TH PLACE'][r.position] : 'FINISHED!';
  const lv = levelsOf(level.planet); const next = lv[lv.indexOf(level) + 1];
  $('#res-body').innerHTML = `<h1 class="${r.ok ? '' : 'bad'}">${title}</h1>
    ${r.objText ? `<div class="objline">${esc(r.objText)}</div>` : ''}<div class="stars">${[0, 1, 2].map(i => `<span class="${i < r.stars ? 'on' : ''}" style="animation-delay:${0.25 + i * 0.25}s">★</span>`).join('')}</div>
    <div class="cols"><div><div class="kv"><span>Time</span><b>${fmtT(r.time)}</b></div><div class="kv"><span>Tricks</span><b>${nf(r.trickScore)}</b></div><div class="kv"><span>Time bonus</span><b>${nf(r.timeBonus)}</b></div>${G.mode === 'race' ? `<div class="kv"><span>Position bonus</span><b>${nf(r.posBonus)}</b></div>` : `<div class="kv"><span>Gold / Silver</span><b>${fmtT(r.gold)} / ${fmtT(r.silver)}</b></div>`}<div class="kv big"><span>SCORE</span><b>${nf(r.score)}</b></div>${r.newBest ? '<div class="new">NEW BEST!</div>' : ''}${r.ghostBeaten ? '<div class="new">👻 Ghost beaten!</div>' : ''}</div>
    <div><div class="kv"><span>Coins collected</span><b>🪙 ${earn.coins}</b></div><div class="kv"><span>Score payout</span><b>🪙 ${earn.score}</b></div><div class="kv"><span>Side quest</span><b>${r.quest.done ? '🪙 ' + earn.quest : '✗'}</b></div><div class="kv"><span>New stars</span><b>🪙 ${earn.stars}</b></div>${earn.daily ? `<div class="kv"><span>Daily challenges</span><b>🪙 ${earn.daily}</b></div>` : ''}<div class="kv big"><span>EARNED</span><b>🪙 ${nf(earn.total)}</b></div>
    <div class="mini">Flips ${r.stat.flips} · Loops ${r.stat.loops} · Car jumps ${r.stat.carJumps} · Perfect ${r.stat.perfect} · Max air ${r.stat.maxAir.toFixed(1)}s · Crashes ${r.stat.crashes}</div></div></div>`;
  $('#res-next').style.display = next && r.ok ? '' : 'none'; $('#res-next').onclick = () => { click(); startLevel(next, G.mode); };
  $('#res-retry').onclick = () => { click(); startLevel(level, G.mode); };
  $('#res-map').onclick = () => { click(); toMap(level.planet); };
  $('#res-garage').onclick = () => { click(); stopRace(); toGarage(); };
  $('#res-photo').onclick = () => { click(); photoMode(true, true); };
  go('results'); coinsBar();
  unlocked.forEach((a, i) => setTimeout(() => achToast(a), 900 + i * 700));
  earn.dailyDone.forEach((c, i) => setTimeout(() => toast(`📅 Daily done: ${esc(c.text)} +🪙 ${c.reward}`, 2800, 'ach'), 600 + i * 600));
  if (r.rocket) setTimeout(() => toast('🚀 You drove onto the rocket! Tap a planet on the map to launch.', 3500), 400);
  cloudSync();
}

// ---------------- photo mode ----------------
const FILTERS = { none: 'none', vivid: 'saturate(1.5) contrast(1.1)', noir: 'grayscale(1) contrast(1.3)', vintage: 'sepia(0.6) contrast(1.05) saturate(1.2)', synthwave: 'hue-rotate(-25deg) saturate(1.8) contrast(1.15)', dream: 'blur(0.6px) brightness(1.1) saturate(1.3)' };
function photoMode(on, fromResults) {
  if (on) {
    if (!G.view) return; G.photo = { yaw: 2.4, pitch: 0.25, dist: 9, fov: 50, filter: 'none', back: fromResults ? 'results' : 'pause' };
    document.body.classList.add('photo'); go('photo'); renderPhotoUI();
  } else { const back = G.photo?.back; G.photo = null; document.body.classList.remove('photo'); canvas.style.filter = ''; go(back || 'pause'); }
}
function renderPhotoUI() { const p = G.photo; $('#ph-filters').innerHTML = Object.keys(FILTERS).map(f => `<button class="${p.filter === f ? 'on' : ''}" data-f="${f}">${f}</button>`).join(''); $$('#ph-filters button').forEach(b => b.onclick = () => { p.filter = b.dataset.f; canvas.style.filter = FILTERS[p.filter]; renderPhotoUI(); }); }
$('#ph-fov').oninput = e => G.photo && (G.photo.fov = +e.target.value);
$('#ph-zoom').oninput = e => G.photo && (G.photo.dist = +e.target.value);
$('#ph-close').onclick = () => { click(); photoMode(false); };
$('#ph-shot').onclick = () => { if (G.photo) G.photo.capture = true; };
{ const pts = new Map(); let pinch0 = 0;
  $('#scr-photo').addEventListener('pointerdown', e => { if (e.target.closest('button,input')) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); } });
  $('#scr-photo').addEventListener('pointermove', e => { const p0 = pts.get(e.pointerId); if (!p0 || !G.photo) return; if (pts.size === 1) { G.photo.yaw += (e.clientX - p0.x) * 0.008; G.photo.pitch = Math.max(-0.2, Math.min(1.4, G.photo.pitch + (e.clientY - p0.y) * 0.005)); } p0.x = e.clientX; p0.y = e.clientY; if (pts.size === 2) { const [a, b] = [...pts.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); G.photo.dist = Math.max(3, Math.min(40, G.photo.dist * pinch0 / d)); pinch0 = d; $('#ph-zoom').value = G.photo.dist; } });
  const up = e => pts.delete(e.pointerId); $('#scr-photo').addEventListener('pointerup', up); $('#scr-photo').addEventListener('pointercancel', up); }
function capturePhoto() {
  const src = gfx.renderer.domElement; const c = document.createElement('canvas'); c.width = src.width; c.height = src.height; const x = c.getContext('2d');
  x.filter = FILTERS[G.photo.filter]; x.drawImage(src, 0, 0); x.filter = 'none';
  const fs = Math.round(c.height * 0.035); x.font = `italic 800 ${fs}px system-ui, sans-serif`; x.fillStyle = 'rgba(255,255,255,0.85)'; x.textAlign = 'right'; x.fillText('VOLT ROADSTER', c.width - fs, c.height - fs);
  $('#flash').classList.add('on'); setTimeout(() => $('#flash').classList.remove('on'), 160); audio.play('click'); haptic(save.settings.haptics, 30);
  save.stats.photos = (save.stats.photos || 0) + 1; P.checkAchievements(save, null, null).forEach(achToast); persist();
  c.toBlob(async blob => {
    if (!blob) return; const file = new File([blob], `volt-roadster-${Date.now()}.png`, { type: 'image/png' });
    try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Volt Roadster', text: 'Check out my Volt Roadster!' }); return; } } catch (e) { if (e.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast('📸 Photo saved');
  }, 'image/png');
}

// ---------------- touch layout ----------------
function layoutTouch() { const touch = matchMedia('(pointer:coarse)').matches || input.isTouch || navigator.maxTouchPoints > 0; document.body.classList.toggle('touch', touch); $('#t-gas').style.display = save.settings.autoGas ? 'none' : ''; }

// ---------------- HUD ----------------
let mm = null;
function buildMinimap(view) {
  const pts = view.minimapPath(); let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (const [x, z] of pts) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
  mm = { pts, minX, maxX, minZ, maxZ, ctx: $('#minimap').getContext('2d') };
}
function drawMinimap() {
  const s = G.sim, c = mm.ctx, cv = c.canvas; const W = cv.width, H = cv.height; const p = s.pose.p;
  c.clearRect(0, 0, W, H);
  const big = G.mapBig; const span = big ? Math.max(mm.maxX - mm.minX, mm.maxZ - mm.minZ) * 1.1 : 700; const sc = W / span;
  const cx = big ? (mm.minX + mm.maxX) / 2 : p.x, cz = big ? (mm.minZ + mm.maxZ) / 2 : p.z;
  // heading-up for small map
  const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(s.pose.q); const ang = big ? 0 : Math.atan2(fwd.x, fwd.z);
  c.save(); c.beginPath(); c.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2); c.clip(); c.fillStyle = 'rgba(6,10,18,0.6)'; c.fillRect(0, 0, W, H);
  c.translate(W / 2, H / 2); c.rotate(ang + Math.PI); c.scale(sc, sc); c.translate(-cx, -cz);
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 5 / sc * (big ? 0.7 : 1);
  c.beginPath(); let pen = false; for (const [x, z, gap] of mm.pts) { if (gap) { pen = false; continue; } if (!pen) { c.moveTo(x, z); pen = true; } else c.lineTo(x, z); } c.stroke();
  c.strokeStyle = 'rgba(255,80,80,0.8)'; c.setLineDash([6 / sc, 6 / sc]); c.beginPath(); pen = false; let last = null; for (const [x, z, gap] of mm.pts) { if (gap) { if (!pen && last) { c.moveTo(last[0], last[1]); pen = true; } c.lineTo(x, z); } else { if (pen) c.lineTo(x, z); pen = false; } last = [x, z]; } c.stroke(); c.setLineDash([]);
  const dot = (x, z, col, r) => { c.fillStyle = col; c.beginPath(); c.arc(x, z, r / sc, 0, Math.PI * 2); c.fill(); };
  const fin = s.tr.samples[Math.min(s.tr.samples.length - 1, Math.round(s.tr.finishS))]; if (fin) dot(fin.p.x, fin.p.z, '#ffd23f', 6);
  for (const o of s.questItems) if (!o.taken && !o.smashed && (!s.quest.done)) dot(o.p.x, o.p.z, '#ff4fd8', 4);
  if (s.cow && !s.cow.caught) dot(s.cow.p.x, s.cow.p.z, '#ff4fd8', 5);
  for (const a of s.ai) dot(a.p.x, a.p.z, ['#ff8a00', '#39ff6a', '#b47cff'][a.color % 3], 5);
  c.restore();
  // player arrow
  c.save(); c.translate(W / 2 + (big ? (p.x - cx) * sc * -1 : 0), H / 2 + (big ? (p.z - cz) * sc * -1 : 0)); if (big) c.rotate(-Math.atan2(fwd.x, fwd.z) + Math.PI); c.fillStyle = '#00e5ff'; c.shadowColor = '#00e5ff'; c.shadowBlur = 8; c.beginPath(); c.moveTo(0, -9); c.lineTo(6, 7); c.lineTo(0, 3); c.lineTo(-6, 7); c.closePath(); c.fill(); c.restore();
  c.strokeStyle = 'rgba(0,229,255,0.6)'; c.lineWidth = 2; c.beginPath(); c.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2); c.stroke();
}
$('#minimap').onclick = () => { G.mapBig = !G.mapBig; $('#minimap').classList.toggle('big', G.mapBig); };
function updateHud() {
  const s = G.sim, st = s.stats;
  $('#spd').textContent = Math.round(s.speed * 3.6);
  updateHorizon(s);
  const bat = s.battery / st.tank; $('#bat-fill').style.width = (bat * 100).toFixed(1) + '%'; $('#bat-val').textContent = Math.ceil(s.battery) + 's'; $('#bat').classList.toggle('low', bat < 0.2);
  $('#boost-fill').style.width = (s.boost / st.boostCap * 100).toFixed(1) + '%'; $('#thr-fill').style.width = (s.veh.rcs ? s.gas / st.gasCap : s.thrust / st.thrustCap) * 100 + '%';
  $('#hud-coins').textContent = s.coins; $('#hud-score').textContent = nf(s.score);
  const cb = s.combo; $('#hud-mult').textContent = cb.mult > 1 ? `x${cb.mult}` : ''; $('#hud-mult').style.setProperty('--t', cb.chain ? cb.timer / 4 : 0);
  $('#hud-time').textContent = fmtT(s.raceTime);
  if (G.mode === 'race') $('#hud-pos').innerHTML = `<b>${s.position()}</b>/4`;
  $('#prog-fill').style.width = Math.min(100, s.prog.s / s.tr.finishS * 100) + '%';
  const q = s.quest; let ql = `${q.bonus ? '⭐' : '🎯'} ${q.name}`; if (q.done) ql += ' ✓'; else if (q.failed) ql += ' ✗'; else if (q.type === 'fragile') ql += ' · cargo intact'; else if (q.type === 'speedtrap') ql += ` · ${Math.round(q.speed * 3.6)} km/h at the camera`; else if (q.type === 'statGoal' && q.stat === 'maxAir') ql += ` ${q.progress.toFixed(1)}/${q.value}s`; else if (q.count) ql += ` ${q.progress}/${q.count}`; else if (q.active) ql += ` ⏱ ${Math.max(0, q.timer).toFixed(0)}s`;
  $('#quest-line').textContent = ql;
  if (G.ghostPrev) $('#hud-ghost').textContent = `👻 ${fmtT(G.ghostPrev.time)}`; else $('#hud-ghost').textContent = '';
}

// ---------------- main loop ----------------
let last = performance.now(), acc = 0, fpsAcc = 0, fpsN = 0, lastFrame = 0;
const FT = { buf: new Float32Array(1200), i: 0, count: 0 }; // per-frame time ring buffer (ms) for QA / RP10
const portraitMQ = matchMedia('(orientation: portrait) and (pointer: coarse)');
// B10/B18: anything that makes the game unplayable freezes the race clock, battery and physics (and opens the pause menu)
function blockedReason() { return document.hidden ? 'hidden' : G.ctxLost ? 'context' : portraitMQ.matches ? 'portrait' : null; }
function checkBlocked() { const r = blockedReason(); if (r && G.screen === 'race' && G.sim && G.sim.state !== 'finished') pause(true); return r; }
portraitMQ.addEventListener?.('change', checkBlocked);
function frame(now) {
  requestAnimationFrame(frame);
  const cap = save.settings.fpsCap; if (cap && now - lastFrame < 1000 / cap - 1.5) return; lastFrame = now;
  const rawDt = Math.max(0, (now - last) / 1000); let dt = Math.min(0.1, rawDt); last = now;
  FT.buf[FT.i] = rawDt * 1000; FT.i = (FT.i + 1) % FT.buf.length; FT.count = Math.min(FT.buf.length, FT.count + 1);
  const blocked = checkBlocked(); if (G.ctxLost) return;
  fpsAcc += rawDt; fpsN++; if (fpsAcc > 0.5) { G.fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; if (save.settings.showFps) $('#fps').textContent = `${G.fps.toFixed(0)} fps · ${gfx.qName}${gfx.dynScale < 1 ? ' ' + Math.round(gfx.dynScale * 100) + '%' : ''}`; }
  const cam = gfx.camera;
  if (G.sim && G.view && ['race', 'pause', 'photo', 'results'].includes(G.screen)) {
    const s = G.sim, v = G.view;
    if (G.slowT > 0) { G.slowT -= dt; G.timeScale += (0.3 - G.timeScale) * Math.min(1, dt * 10); if (G.slowT <= 0) audio.setSlowmo(false); } else G.timeScale += (1 - G.timeScale) * Math.min(1, dt * 6);
    G.slowCd -= dt;
    // big-jump bullet time: airborne over a gap with real height
    if (s.overGap && !s.grounded && s.air > 0.35 && !G.gapSlow.has(s.overGap)) { G.gapSlow.add(s.overGap); slowmo(1.3); }
    v.slowmo = G.slowT > 0 && save.settings.bulletTime;
    const inp = input.state(!s.grounded, dt);
    const running = G.screen === 'race' && !G.paused && !blocked;
    const sdt = running ? dt * G.timeScale : 0;
    if (running) s.update(sdt, inp); else if (G.screen === 'results') s.update(dt * 0.5, { steer: 0, throttle: 0, brake: 1, boost: false, jump: false, pitch: 0 });
    const evs = s.events.splice(0); handleEvents(evs);
    if (G.photo) { v.update(0, s.alpha || 0, inp, []); v.photoCamera(G.photo); }
    else v.update(running || G.screen === 'results' ? sdt || dt * 0.5 : 0, s.alpha || 0, inp, evs);
    if (running) { audio.coldGas = !!s.veh.rcs; audio.engine(s.speed * (s.veh.rcs ? 0.8 : 1), inp.throttle, s.boosting, s.drifting ? 1 : 0, s.thrusting, true); if (s.veh.rcs) { const k = (s.rcs.lift ? 1 : 0) + (Math.abs(s.rcs.px) > 0.05 ? 0.6 : 0) + (Math.abs(s.rcs.py) > 0.05 ? 0.6 : 0); audio.rcs(Math.min(1, k)); if (k && !G.rcsWas) { audio.rcsPuff(); haptic(save.settings.haptics, 6); } G.rcsWas = k > 0; } if (now - G.lastHud > 33) { G.lastHud = now; updateHud(); drawMinimap(); } }
    gfx.render(v.scene, cam);
    if (G.photo && G.photo.capture) { G.photo.capture = false; capturePhoto(); }
  } else if (show.scene) {
    show.update(dt, cam); gfx.render(show.scene, cam); gfx.sampleRefresh(dt);
  }
  gfx.fpsCap = save.settings.fpsCap; const a = G.view ? gfx.adapt(dt, save.settings.quality === 'auto') : null;
  if (a === 'downgrade') { const order = ['low', 'medium', 'high', 'ultra']; const i = order.indexOf(gfx.qName); if (i > 0) { gfx.setQuality(order[i - 1]); gfx.dynScale = 0.8; gfx.resize(); console.info('auto quality ->', gfx.qName); } }
}

// ---------------- lifecycle ----------------
addEventListener('resize', () => { gfx.resize(); if (G.screen === 'map') renderMap(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { if (G.screen === 'race') pause(true); persist(true); cloudSync(true); } });
addEventListener('pagehide', () => { persist(true); cloudSync(true); });
canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); G.ctxLost = true; if (G.screen === 'race') pause(true); audio.engine(0, 0, false, 0, false, false); toast('Graphics context lost: game paused while it recovers…'); });
canvas.addEventListener('webglcontextrestored', () => { G.ctxLost = false; gfx.contextRestored(); if (!G.view) refreshShow(); last = performance.now(); toast('Graphics restored. Tap Resume to continue.'); });

// ---------------- debug / QA hook ----------------
window.__game = {
  get fps() { return G.fps; }, get screen() { return G.screen; }, get quality() { return gfx.qName; }, get gpu() { return gfx.info; },
  get world() { return G.level ? G.level.planet : G.planet; }, get level() { return G.level ? G.level.id : null; },
  get car() { const s = G.sim; if (!s) return null; return { speed: s.speed, kmh: s.speed * 3.6, s: s.prog.s, x: s.prog.x, battery: s.battery, boost: s.boost, grounded: s.grounded, state: s.state, score: s.score, coins: s.coins, pos: s.pose.p.toArray(), raceTime: s.raceTime, crashes: s.stat.crashes, vehicle: s.veh.id, gas: s.gas, rcs: { ...s.rcs }, thrust: s.thrust }; },
  get vehicle() { return save.vehicle; }, setVehicle: id => { if (!VEHICLES[id]) throw new Error('no vehicle ' + id); if (!P.selectVehicle(save, id)) throw new Error('vehicle not owned: ' + id); persist(true); return id; }, ownsVehicle: id => P.ownsVehicle(save, id),
  grantVehicle: id => { if (!VEHICLES[id]) throw new Error('no vehicle ' + id); if (!save.owned.vehicles.includes(id)) save.owned.vehicles.push(id); persist(true); return id; }, /* QA/dev helper */ get gems() { return save.gems; },
  get pixelRatio() { return gfx.renderer.getPixelRatio(); }, get drawingBuffer() { const v = gfx.renderer.getDrawingBufferSize(new THREE.Vector2()); return { w: v.x, h: v.y, css: { w: innerWidth, h: innerHeight }, dpr: devicePixelRatio, dynScale: gfx.dynScale }; },
  frameTimes: (n = 600) => { const out = []; const N = Math.min(n, FT.count); for (let i = N; i > 0; i--) out.push(+FT.buf[(FT.i - i + FT.buf.length) % FT.buf.length].toFixed(2)); return out; }, // ms, most recent last
  get blocked() { return blockedReason(); },
  levels: () => LEVELS.map(l => ({ id: l.id, planet: l.planet, name: l.name, diff: l.diff })),
  loadLevel: (id, mode = 'race') => { const l = levelById(id); if (!l) throw new Error('no level ' + id); return startLevel(l, mode); },
  save: () => { persist(true); return JSON.parse(JSON.stringify(save)); }, load: () => { save = P.loadLocal(); applySettings(); return save; },
  get state() { return save; }, input, show, view: () => G.view, sim: () => G.sim, gfx, goto: name => ({ title: toTitle, map: toMap, garage: toGarage, base: toBase })[name]?.(), cloudSync, pause, applySettings: () => { applySettings(); layoutTouch(); },
};

// ---------------- boot ----------------
(async function boot() {
  $('#loading-text').textContent = 'Starting physics…';
  try { await initPhysics(); } catch (e) { console.error(e); }
  layoutTouch();
  requestAnimationFrame(frame);
  // refinery idle collection, cloud load/merge
  toTitle();
  try { const r = await P.cloudLoad(save); if (r.ok && r.data) { const merged = P.mergeCloud(save, r.data); if (merged !== save) { save = merged; persist(true); applySettings(); toast('☁️ Cloud progress loaded'); coinsBar(); } } if (save.cloud) save.cloud.status = r.ok ? 'synced' : (r.status === 404 ? 'new' : 'offline'); await cloudSync(); } catch (e) {}
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('/sw.js').catch(() => {});
})();
