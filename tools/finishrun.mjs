// B36/B38/B39: full run-up from 500 m before EVERY jump in the last 2 km at upgrade levels 0/3/5, both vehicles, all levels; reports the post-finish outcome.
import { Sim } from '../src/sim.js'; import { LEVELS } from '../src/levels.js'; import * as PR from '../src/progress.js'; import { ROAD_W } from '../src/track.js'; import { Vector3 } from 'three';
export async function finishRuns({ levels = LEVELS, lv = [0, 3, 5], vehs = ['roadster', 'hauler'] } = {}) {
  const H = 1 / 120, out = [];
  for (const L of levels) for (const veh of vehs) for (const n of lv) {
    const up = Object.fromEntries(PR.UPGRADES.map(u => [u.id, Math.min(n, PR.maxTier(u.id))]));
    const probe = new Sim(L, { mode: 'race', vehicle: veh, upgrades: up }); await probe.init();
    const gaps = probe.tr.features.filter(f => f.type === 'gap' && f.s0 < probe.tr.finishS && f.s0 > probe.tr.finishS - 2000);
    const starts = gaps.length ? gaps.map(g => ({ s: Math.max(40, g.s0 - 500), gap: g.name })) : [{ s: Math.max(40, probe.tr.finishS - 1100), gap: '-' }];
    for (const st of starts) {
    const s = new Sim(L, { mode: 'race', vehicle: veh, upgrades: up }); await s.init(); s.state = 'race'; s.battery = 999;
    s.respawnAt(st.s, 30);
    let fin = false, airAtFin = false, peakG = 0, pv = null, maxH = 0, bad = [], t = 0, lastAB = -9, abT = 0;
    for (; t < 260; t += H) { const lf = new Vector3(1, 0, 0).applyQuaternion(s.pose.q), tg = s.tr.samples[Math.min(s.tr.samples.length - 1, s.prog.i + 25)].p;
      s.fixed(H, { throttle: 1, boost: true, steer: Math.max(-1, Math.min(1, -tg.clone().sub(s.pose.p).dot(lf) * 0.15 + 0.25 * Math.sin(t * 3))) });
      if (s.abK > 0) { lastAB = t; abT += H; }
      for (const e of s.events) { if (fin && (e.type === 'crash' || e.type === 'killplane')) bad.push(e.type + ':' + (e.reason || ''));
        if (!fin && t - lastAB < 1 && ['crash', 'killplane', 'wallHit', 'hit'].includes(e.type)) bad.push('airbrake-' + e.type + ':' + (e.reason || '')); } s.events.length = 0;
      if (s.state === 'finished' && !fin) { fin = true; airAtFin = !s.grounded && s.prog.h > 2; /* a wheel skipping over a crest (<2 m) is not a flight */ }
      const v = s.body.linvel(), cv = new Vector3(v.x, v.y, v.z); if (fin && pv) { const g = cv.clone().sub(pv).length() / H / 9.81; if (g > peakG) { peakG = g; if (process.env.DBG) console.log("peak", g.toFixed(1), "t", t.toFixed(2), "v", s.speed.toFixed(1), "x", s.prog.x.toFixed(1), "h", s.prog.h.toFixed(1), "gr", s.grounded, "left", (s.tr.roadEnd - s.prog.s).toFixed(0)); } } pv = cv;
      if (fin) maxH = Math.max(maxH, s.prog.h); if (fin && s.speed < 0.3 && s.grounded) break; }
    const r = { lvl: L.id, veh, lv: n, from: st.gap, airBrake: +abT.toFixed(2), fin, airAtFin, maxH: +maxH.toFixed(0), peakG: +peakG.toFixed(1), x: +s.prog.x.toFixed(1), left: +(s.tr.roadEnd - s.prog.s).toFixed(0), v: +s.speed.toFixed(1), bad };
    r.ok = fin && !bad.length && s.speed < 0.5 && Math.abs(s.prog.x) < ROAD_W / 2 - 1 && r.left > 3 && r.peakG <= 4; out.push(r); } }
  return out;
}
if (import.meta.url === `file://${process.argv[1]}`) { const r = await finishRuns(process.env.LV ? { levels: LEVELS.filter(l => process.env.LV.split(',').includes(l.id)) } : {}); for (const x of r) if (!x.ok || x.airAtFin) console.log(JSON.stringify(x)); console.log(r.filter(x => x.ok).length + '/' + r.length + ' ok'); }
