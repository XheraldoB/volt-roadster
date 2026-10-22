// B36: full run-up through the last pre-finish jumps at upgrade levels 0/3/5, both vehicles, all levels; reports the post-finish outcome.
import { Sim } from '../src/sim.js'; import { LEVELS } from '../src/levels.js'; import * as PR from '../src/progress.js'; import { ROAD_W } from '../src/track.js'; import { Vector3 } from 'three';
export async function finishRuns({ levels = LEVELS, lv = [0, 3, 5], vehs = ['roadster', 'hauler'] } = {}) {
  const H = 1 / 120, out = [];
  for (const L of levels) for (const veh of vehs) for (const n of lv) {
    const up = Object.fromEntries(PR.UPGRADES.map(u => [u.id, Math.min(n, PR.maxTier(u.id))]));
    const s = new Sim(L, { mode: 'race', vehicle: veh, upgrades: up }); await s.init(); s.state = 'race'; s.battery = 999;
    const gaps = s.tr.features.filter(f => f.type === 'gap' && f.s0 < s.tr.finishS); const lastGap = gaps[gaps.length - 1];
    s.respawnAt(Math.max(40, Math.min(s.tr.finishS - 1100, lastGap ? lastGap.s0 - 500 : 1e9)), 30);
    let fin = false, airAtFin = false, peakG = 0, pv = null, maxH = 0, bad = [], t = 0;
    for (; t < 260; t += H) { const lf = new Vector3(1, 0, 0).applyQuaternion(s.pose.q), tg = s.tr.samples[Math.min(s.tr.samples.length - 1, s.prog.i + 25)].p;
      s.fixed(H, { throttle: 1, boost: true, steer: Math.max(-1, Math.min(1, -tg.clone().sub(s.pose.p).dot(lf) * 0.15 + 0.25 * Math.sin(t * 3))) });
      for (const e of s.events) if (fin && (e.type === 'crash' || e.type === 'killplane')) bad.push(e.type + ':' + (e.reason || '')); s.events.length = 0;
      if (s.state === 'finished' && !fin) { fin = true; airAtFin = !s.grounded; }
      const v = s.body.linvel(), cv = new Vector3(v.x, v.y, v.z); if (fin && pv) { const g = cv.clone().sub(pv).length() / H / 9.81; if (g > peakG) { peakG = g; if (process.env.DBG) console.log("peak", g.toFixed(1), "t", t.toFixed(2), "v", s.speed.toFixed(1), "x", s.prog.x.toFixed(1), "h", s.prog.h.toFixed(1), "gr", s.grounded, "left", (s.tr.roadEnd - s.prog.s).toFixed(0)); } } pv = cv;
      if (fin) maxH = Math.max(maxH, s.prog.h); if (fin && s.speed < 0.3 && s.grounded) break; }
    const r = { lvl: L.id, veh, lv: n, fin, airAtFin, maxH: +maxH.toFixed(0), peakG: +peakG.toFixed(1), x: +s.prog.x.toFixed(1), left: +(s.tr.roadEnd - s.prog.s).toFixed(0), v: +s.speed.toFixed(1), bad };
    r.ok = fin && !bad.length && s.speed < 0.5 && Math.abs(s.prog.x) < ROAD_W / 2 - 1 && r.left > 3 && r.peakG <= 4; out.push(r); }
  return out;
}
if (import.meta.url === `file://${process.argv[1]}`) { const r = await finishRuns(process.env.LV ? { levels: LEVELS.filter(l => process.env.LV.split(',').includes(l.id)) } : {}); for (const x of r) if (!x.ok || x.airAtFin) console.log(JSON.stringify(x)); console.log(r.filter(x => x.ok).length + '/' + r.length + ' ok'); }
