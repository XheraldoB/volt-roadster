// Save data, economy, achievements, daily challenges, local + cloud persistence.
import { LEVELS, levelsOf } from './levels.js';
import { UPGRADE_COSTS } from './economy.data.js';

const KEY = 'voltRoadster.save.v1';
export const UPGRADES = [
  { id: 'tank', name: 'Battery Tank', icon: '🔋', desc: '+12 s of battery', base: 150 },
  { id: 'speed', name: 'Top Speed', icon: '💨', desc: '+22 km/h top speed', base: 200 },
  { id: 'accel', name: 'Acceleration', icon: '⚡', desc: 'Tri-motor torque', base: 180 },
  { id: 'handling', name: 'Handling', icon: '🎯', desc: 'More grip, sharper steering', base: 160 },
  { id: 'boost', name: 'Boost / Nitro', icon: '🔥', desc: 'Stronger and longer boost', base: 170 },
  { id: 'thruster', name: 'Thruster Pack', icon: '🚀', desc: '+0.3 s thrust, higher jumps', base: 190 },
  { id: 'magnet', name: 'Coin Magnet', icon: '🧲', desc: '+0.9 m coin pickup radius', base: 130 },
  { id: 'gas', name: 'Cold-Gas Tank', icon: '💨', desc: 'Pickup RCS: +0.5 s of gas jets', base: 200, vehicle: 'hauler' },
];
export const MAX_UP = 10;
export const GAS_COSTS = [220, 420, 700, 1100, 1650, 2400, 3400, 4700];
export const maxTier = id => id === 'gas' ? GAS_COSTS.length : (UPGRADE_COSTS[id] || []).length || 5;
export const BUILDINGS = [
  { id: 'solar', name: 'Solar Farm', icon: '☀️', max: 3, cost: [300, 650, 1100], desc: '+4 s battery per level on this planet' },
  { id: 'refinery', name: 'Coin Refinery', icon: '🏭', max: 3, cost: [400, 800, 1400], desc: 'Makes coins while you are away (robots speed it up)' },
  { id: 'robotbay', name: 'Robot Bay', icon: '🤖', max: 3, cost: [500, 900, 1500], desc: '+1 Volt-Bot helper per level: pit crew and refinery workers' },
  { id: 'workshop', name: 'Workshop', icon: '🔧', max: 3, cost: [450, 900, 1600], desc: '-6% upgrade prices per level (all planets)' },
  { id: 'nitro', name: 'Nitro Plant', icon: '🧪', max: 2, cost: [550, 1200], desc: 'Start races with full boost (+15% boost size at L2)' },
  { id: 'trophy', name: 'Trophy Hall', icon: '🏆', max: 1, cost: [350], desc: 'Shows off your trophies (opens the Trophy Room)' },
];
export const ACHIEVEMENTS = [
  ['first_finish', 'First Finish', 'Finish any race'], ['loop_10', 'Loop Lover', 'Complete 10 loops'], ['flip_1', 'Flip Out', 'Land a flip'], ['flip_25', 'Gymnast', 'Land 25 flips'],
  ['carjump_10', 'Traffic Hopper', 'Jump over 10 cars'], ['perfect', 'Bullseye', 'Perfect landing on a target pad'], ['perfect_10', 'Sniper Pilot', '10 perfect landings'], ['quest_3', 'Side Hustle', 'Complete 3 side quests'],
  ['quest_all', 'Errand Legend', 'Complete every side quest'], ['three_stars', 'Superstar', 'Get 3 stars on a level'], ['moon_finish', 'One Small Drive', 'Finish a Moon level'], ['mars_finish', 'Red Rover', 'Finish a Mars level'],
  ['speed_300', '300 Club', 'Hit 300 km/h'], ['air_10', 'Frequent Flyer', 'Stay airborne 10 seconds'], ['meteor_20', 'Meteor Dodger', 'Dodge 20 meteors'], ['devil', 'Storm Chaser', 'Ride a Mars dust devil'],
  ['egg', 'Orbit Spotter', 'Find the hidden roadster in orbit'], ['robots_3', 'Robot Army', 'Own 3 Volt-Bots'], ['builder_5', 'Base Builder', 'Build 5 base structures'], ['rich', 'Coin Magnate', 'Earn 10,000 coins total'],
  ['streak_3', 'Daily Driver', '3-day daily challenge streak'], ['photo', 'Paparazzi', 'Take a photo in photo mode'], ['ghost', 'Ghost Buster', 'Beat your own ghost'], ['rocket', 'Rocket Rider', 'Drive onto the rocket at the Spaceport'],
  ['near_25', 'Close Shave', '25 near misses'], ['maxed', 'Fully Loaded', 'Max out any upgrade'],
].map(([id, name, desc]) => ({ id, name, desc }));


export function defaultSave() {
  const touch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  return {
    v: 2, coins: 300, gems: 5, totalGems: 5, totalCoins: 0, upgrades: {}, vehicle: 'roadster',
    custom: { paint: 'red', finish: 'metallic', wrap: 'none', wrapColor: '#111111', rims: 'aero', rimColor: '#c8ccd2', caliper: '#d01818', underglow: 'none', spoiler: 'none', flame: 'ion', trail: 'none', horn: 'beep' },
    truckCustom: { paint: 'steel', finish: 'brushed', wrap: 'none', wrapColor: '#111111', rims: 'aero', rimColor: '#c8ccd2', caliper: '#ff5a1f', underglow: 'none', spoiler: 'none', flame: 'ion', trail: 'none', horn: 'air' },
    owned: { paints: [], finishes: [], wraps: [], rims: [], spoilers: [], underglow: [], flames: [], trails: [], horns: ['air'], vehicles: ['roadster'] }, levels: {}, achievements: {},
    stats: { loops: 0, flips: 0, carJumps: 0, perfect: 0, quests: 0, dodges: 0, nearMiss: 0, races: 0, photos: 0 },
    bases: { earth: { plots: Array(6).fill(null), last: Date.now() }, moon: { plots: Array(6).fill(null), last: Date.now() }, mars: { plots: Array(6).fill(null), last: Date.now() } },
    settings: { quality: 'auto', fpsCap: 0, showFps: false, music: 0.45, sfx: 0.8, haptics: true, autoGas: touch, steer: 'drag', sens: 1, esc: true, extraAO: false, ctlV: 2, camMode: 'chase', shake: true, bulletTime: true, assist: true, ghosts: true, airRoll: false, left: false },
    daily: { date: '', done: [], streak: 0, lastDate: '' }, planet: 'earth', seenIntro: false,
    cloud: null, updatedAt: Date.now(),
  };
}

export function loadLocal() {
  try { const raw = localStorage.getItem(KEY); if (raw) return migrate(JSON.parse(raw)); } catch (e) {}
  return defaultSave();
}
function migrate(s) { const d = defaultSave(); const out = { ...d, ...s }; out.settings = { ...d.settings, ...(s.settings || {}) }; out.stats = { ...d.stats, ...(s.stats || {}) }; out.custom = { ...d.custom, ...(s.custom || {}) }; out.truckCustom = { ...d.truckCustom, ...(s.truckCustom || {}) }; out.owned = { ...d.owned, ...(s.owned || {}) }; for (const k of Object.keys(d.owned)) if (!Array.isArray(out.owned[k])) out.owned[k] = d.owned[k].slice(); if (s.owned && s.owned.underglow === true) out.owned.underglow = ['#00e5ff', '#ff2f92', '#39ff6a', '#7a2cff', '#ffb000']; if ((out.settings.ctlV || 0) < 2) { out.settings.ctlV = 2; if (out.settings.steer === 'buttons') out.settings.steer = 'drag'; out.settings.esc = true; out.settings.sens = out.settings.sens || 1; } if (out.settings.quality === 'ultra' && !out.settings.perfV) { out.settings.perfV = 1; } if (!out.custom.underglow) out.custom.underglow = 'none'; if (typeof out.gems !== 'number') out.gems = 5; if (!out.owned.vehicles.includes('roadster')) out.owned.vehicles.unshift('roadster'); if (!out.owned.vehicles.includes(out.vehicle)) out.vehicle = 'roadster'; out.bases = { ...d.bases, ...(s.bases || {}) }; out.daily = { ...d.daily, ...(s.daily || {}) }; return out; }
let saveTimer = null;
export function saveLocal(s, immediate = false) {
  s.updatedAt = Date.now();
  const doit = () => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} };
  if (immediate) { clearTimeout(saveTimer); doit(); } else { clearTimeout(saveTimer); saveTimer = setTimeout(doit, 300); }
}
export const ghostKey = (lvl, mode) => `voltRoadster.ghost.${lvl}.${mode}`;
export function loadGhost(lvl, mode) { try { return JSON.parse(localStorage.getItem(ghostKey(lvl, mode)) || 'null'); } catch (e) { return null; } }
export function saveGhost(lvl, mode, g) { try { localStorage.setItem(ghostKey(lvl, mode), JSON.stringify(g)); } catch (e) {} }

// ---------- economy ----------
export function workshopLevel(s) { return Object.values(s.bases).reduce((a, b) => a + b.plots.filter(p => p && p.type === 'workshop').reduce((x, p) => x + p.lvl, 0), 0); }
export function upgradeCost(s, id, lvl) { const u = UPGRADES.find(x => x.id === id); const disc = Math.max(0.7, 1 - 0.06 * workshopLevel(s)); const table = id === 'gas' ? GAS_COSTS : UPGRADE_COSTS[id]; const base = table ? table[Math.min(lvl, table.length - 1)] : u.base * (1 + lvl * 1.5); return Math.round(base * disc / 5) * 5; }
export function buildingLevel(s, planet, type) { return s.bases[planet].plots.filter(p => p && p.type === type).reduce((a, p) => a + p.lvl, 0); }
export function robotCount(s) { return Object.keys(s.bases).reduce((a, k) => a + buildingLevel(s, k, 'robotbay'), 0); }
export function runBonus(s, planet) { return { tank: 4 * buildingLevel(s, planet, 'solar'), nitroStart: buildingLevel(s, planet, 'nitro') > 0, nitroCap: buildingLevel(s, planet, 'nitro') > 1 ? 0.15 : 0 }; }
export function refineryRate(s, planet) { const lvl = buildingLevel(s, planet, 'refinery'); if (!lvl) return 0; return lvl * 40 * (1 + 0.25 * Math.min(3, buildingLevel(s, planet, 'robotbay'))); } // coins per hour
export function pendingRefinery(s, planet) { const b = s.bases[planet]; const hrs = Math.min(8, (Date.now() - (b.last || Date.now())) / 3.6e6); return Math.floor(refineryRate(s, planet) * hrs); }

// ---------- daily challenges ----------
const DAILY_T = [
  { type: 'flips', n: 3, text: n => `Land ${n} flips in one run` }, { type: 'coins', n: 100, text: n => `Collect ${n} coins in one run` }, { type: 'perfect', n: 1, text: () => 'Stick a PERFECT pad landing' },
  { type: 'loops', n: 4, text: n => `Complete ${n} loops in one run` }, { type: 'carJumps', n: 3, text: n => `Jump over ${n} cars in one run` }, { type: 'nearMiss', n: 4, text: n => `Get ${n} near misses in one run` },
  { type: 'air', n: 8, text: n => `Stay airborne ${n}s in one jump` }, { type: 'win', n: 1, text: () => 'Win a race in 1st place' }, { type: 'moon', n: 1, text: () => 'Finish any Moon level' },
  { type: 'mars', n: 1, text: () => 'Finish any Mars level' }, { type: 'quest', n: 1, text: () => 'Complete a side quest' }, { type: 'nocrash', n: 1, text: () => 'Finish a level without crashing' },
];
export function today() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
export function dailyChallenges(dateStr = today()) {
  let h = 0; for (const ch of dateStr) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const picks = []; const pool = [...DAILY_T];
  for (let k = 0; k < 3; k++) { h = (h * 1103515245 + 12345) >>> 0; const t = pool.splice(h % pool.length, 1)[0]; const n = Math.round(t.n * (1 + ((h >> 8) % 3) * 0.5)); picks.push({ id: `${dateStr}:${t.type}`, type: t.type, n, text: t.text(n), reward: 200 + k * 100 }); }
  return picks;
}
function dailyCheck(ch, r, level) {
  const st = r.stat;
  switch (ch.type) {
    case 'flips': return st.flips >= ch.n; case 'coins': return r.coins >= ch.n; case 'perfect': return st.perfect >= ch.n; case 'loops': return st.loops >= ch.n;
    case 'carJumps': return st.carJumps >= ch.n; case 'nearMiss': return st.nearMiss >= ch.n; case 'air': return st.maxAir >= ch.n; case 'win': return r.ok && r.position === 1 && r.mode === 'race';
    case 'moon': return r.ok && level.planet === 'moon'; case 'mars': return r.ok && level.planet === 'mars'; case 'quest': return r.quest.done; case 'nocrash': return r.ok && st.crashes === 0;
  }
  return false;
}

// ---------- applying a run ----------
export function applyResult(s, level, r) {
  const lv = s.levels[level.id] || (s.levels[level.id] = { stars: 0, best: 0, bestTime: 0, bestTrial: 0, questDone: false, plays: 0 });
  lv.plays++;
  const earn = { coins: r.coins, score: Math.floor(r.score / 120), quest: 0, stars: 0, daily: 0, dailyDone: [], gems: 0 };
  if (r.ok) {
    const newStars = Math.max(0, r.stars - lv.stars); earn.stars = newStars * 150; earn.gems += newStars + (r.stars >= 3 && lv.stars < 3 ? 2 : 0); lv.stars = Math.max(lv.stars, r.stars);
    if (r.score > lv.best) { lv.best = r.score; r.newBest = true; }
    if (r.mode === 'race' && (!lv.bestTime || r.time < lv.bestTime)) lv.bestTime = r.time;
    if (r.mode === 'trial' && (!lv.bestTrial || r.time < lv.bestTrial)) { lv.bestTrial = r.time; r.newRecord = true; }
  }
  if (r.quest.done && !lv.questDone) { lv.questDone = true; earn.quest = r.quest.reward; earn.gems += 2; s.stats.quests++; } else if (r.quest.done) earn.quest = Math.round(r.quest.reward * 0.25);
  // stats
  const st = r.stat; s.stats.loops += st.loops; s.stats.flips += st.flips; s.stats.carJumps += st.carJumps; s.stats.perfect += st.perfect; s.stats.dodges += st.dodges || 0; s.stats.nearMiss += st.nearMiss; s.stats.races++;
  s.stats.devils = (s.stats.devils || 0) + (st.devils || 0); s.stats.maxAir = Math.max(s.stats.maxAir || 0, st.maxAir); s.stats.maxSpeed = Math.max(s.stats.maxSpeed || 0, st.maxSpeed);
  if (r.egg) s.stats.egg = true; if (r.rocket) s.stats.rocket = true; if (r.ghostBeaten) s.stats.ghost = true;
  // daily
  const d = s.daily, t = today();
  if (d.date !== t) { d.date = t; d.done = []; }
  for (const ch of dailyChallenges(t)) if (!d.done.includes(ch.id) && dailyCheck(ch, r, level)) {
    d.done.push(ch.id);
    if (d.lastDate !== t) { const y = new Date(); y.setDate(y.getDate() - 1); const ys = `${y.getFullYear()}-${y.getMonth() + 1}-${y.getDate()}`; d.streak = d.lastDate === ys ? d.streak + 1 : 1; d.lastDate = t; }
    const rew = Math.round(ch.reward * (1 + Math.min(10, d.streak - 1) * 0.25)); earn.daily += rew; earn.dailyDone.push({ ...ch, reward: rew }); earn.gems += 1 + (d.streak >= 3 ? 1 : 0);
  }
  earn.total = earn.coins + earn.score + earn.quest + earn.stars + earn.daily;
  s.coins += earn.total; s.totalCoins += earn.total;
  const unlocked = checkAchievements(s, r, level);
  s.gems = (s.gems || 0) + earn.gems; s.totalGems = (s.totalGems || 0) + earn.gems; earn.gems += unlocked.length * 3; // achievement gems are granted inside checkAchievements
  saveLocal(s, true);
  return { earn, unlocked };
}

export function checkAchievements(s, r, level) {
  const has = id => !!s.achievements[id]; const got = [];
  const give = (id, cond) => { if (!has(id) && cond) { s.achievements[id] = Date.now(); s.gems = (s.gems || 0) + 3; s.totalGems = (s.totalGems || 0) + 3; got.push(ACHIEVEMENTS.find(a => a.id === id)); } };
  const st = s.stats;
  const allLv = Object.values(s.levels);
  give('first_finish', allLv.some(l => l.stars > 0)); give('loop_10', st.loops >= 10); give('flip_1', st.flips >= 1); give('flip_25', st.flips >= 25);
  give('carjump_10', st.carJumps >= 10); give('perfect', st.perfect >= 1); give('perfect_10', st.perfect >= 10); give('quest_3', st.quests >= 3);
  give('quest_all', LEVELS.every(l => s.levels[l.id]?.questDone)); give('three_stars', allLv.some(l => l.stars >= 3));
  give('moon_finish', levelsOf('moon').some(l => s.levels[l.id]?.stars > 0)); give('mars_finish', levelsOf('mars').some(l => s.levels[l.id]?.stars > 0));
  give('speed_300', (st.maxSpeed || 0) * 3.6 >= 300); give('air_10', (st.maxAir || 0) >= 10); give('meteor_20', st.dodges >= 20); give('devil', (st.devils || 0) >= 1);
  give('egg', !!st.egg); give('robots_3', robotCount(s) >= 3); give('builder_5', Object.values(s.bases).reduce((a, b) => a + b.plots.filter(Boolean).length, 0) >= 5);
  give('rich', s.totalCoins >= 10000); give('streak_3', s.daily.streak >= 3); give('photo', st.photos >= 1); give('ghost', !!st.ghost); give('rocket', !!st.rocket);
  give('near_25', st.nearMiss >= 25); give('maxed', Object.entries(s.upgrades).some(([k, v]) => v >= maxTier(k)));
  return got;
}

export function isUnlocked(s, level) {
  const list = levelsOf(level.planet); const i = list.indexOf(level);
  return i <= 0 || (s.levels[list[i - 1].id]?.stars || 0) > 0;
}

// ---------- cloud ----------
function rnd(n, alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789') { const a = new Uint32Array(n); crypto.getRandomValues(a); return Array.from(a, v => alphabet[v % alphabet.length]).join(''); }
export function ensureCloudIdentity(s) {
  if (!s.cloud) s.cloud = { id: (crypto.randomUUID ? crypto.randomUUID() : rnd(24, 'abcdef0123456789')), secret: rnd(32, 'abcdef0123456789'), code: `VOLT-${rnd(4)}-${rnd(4)}-${rnd(4)}`, lastSync: 0, status: 'new' };
  return s.cloud;
}
const strip = s => { const c = { ...s }; delete c.cloud; return c; };
// B14: nothing is written to the cloud until the player has real progress (a race, a purchase or a base build)
export const hasProgress = s => !!(s.stats && s.stats.races > 0) || Object.keys(s.levels || {}).length > 0 || (s.totalCoins || 0) > 0 || (s.owned?.vehicles || []).length > 1 || Object.entries(s.owned || {}).some(([k, a]) => k !== 'vehicles' && Array.isArray(a) && a.length > (k === 'horns' ? 1 : 0)) || Object.values(s.bases || {}).some(b => (b.plots || []).some(Boolean));
export const normCode = code => String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^VOLT/, '').slice(0, 12).replace(/(.{4})(?=.)/g, '$1-').replace(/^/, 'VOLT-');
export async function cloudSave(s, beacon = false) {
  if (!s.cloud && !hasProgress(s)) return { ok: false, error: 'nothing-to-sync', skipped: true };
  const c = ensureCloudIdentity(s); const body = JSON.stringify({ id: c.id, secret: c.secret, code: c.code, data: strip(s) });
  try {
    if (beacon && navigator.sendBeacon) { navigator.sendBeacon('/api/save', new Blob([body], { type: 'application/json' })); return { ok: true }; }
    const r = await fetch('/api/save', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: body.length < 60000 });
    const j = await r.json().catch(() => ({})); const good = r.ok && j.ok !== false; c.status = good ? 'synced' : (j.error || 'error'); if (good) c.lastSync = Date.now(); return { ...j, ok: good };
  } catch (e) { c.status = 'offline'; return { ok: false, error: 'offline' }; }
}
export async function cloudLoad(s) {
  if (!s.cloud) return { ok: false, status: 404, fresh: true }; // a fresh device has nothing in the cloud: no request, no identity yet
  const c = s.cloud;
  try { const r = await fetch(`/api/load?id=${encodeURIComponent(c.id)}&secret=${encodeURIComponent(c.secret)}`); if (!r.ok) return { ok: false, status: r.status }; const j = await r.json(); if (!j.data) return { ok: false, found: false, error: j.error }; return { ok: true, data: j.data }; }
  catch (e) { return { ok: false, error: 'offline' }; }
}
export async function cloudRestore(code) {
  const r = await fetch(`/api/load?code=${encodeURIComponent(normCode(code))}`); const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Code not found'); return j; // {id, secret, code, data}
}
// B14: after restoring onto this device, delete the record this device had created under its old identity
export async function cloudForget(old) { if (!old || !old.id || !old.secret) return; try { await fetch('/api/forget', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: old.id, secret: old.secret, code: old.code }) }); } catch (e) {} }
export function mergeCloud(local, remote) { // newest wins
  if (!remote || !remote.updatedAt) return local; if (remote.updatedAt > local.updatedAt) { const m = migrate(remote); m.cloud = local.cloud; return m; } return local;
}

// ---- vehicles: ownership is enforced here and again when a run starts (never trust save.vehicle alone)
export function ownsVehicle(s, id) { return Array.isArray(s.owned && s.owned.vehicles) && s.owned.vehicles.includes(id); }
export function buyVehicle(s, V) {
  if (!V) return { ok: false, why: 'unknown' };
  if (ownsVehicle(s, V.id)) return { ok: true, already: true };
  const coins = (V.price && V.price.coins) || 0, gems = (V.price && V.price.gems) || 0;
  if (s.coins < coins) return { ok: false, why: 'coins', need: coins - s.coins };
  if (s.gems < gems) return { ok: false, why: 'gems', need: gems - s.gems };
  s.coins -= coins; s.gems -= gems; s.owned.vehicles.push(V.id); return { ok: true };
}
export function selectVehicle(s, id) { if (!ownsVehicle(s, id)) return false; s.vehicle = id; return true; }
