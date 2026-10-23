// B44: meteor strikes are a random level hazard, counted separately (meteorHits) and not held against the finish fix.
// B36/B38/B39: full run-up from 500 m before EVERY jump in the last 2 km at upgrade levels 0/3/5, both vehicles, all levels; reports the post-finish outcome.
import { Sim } from '../src/sim.js'; import { LEVELS } from '../src/levels.js'; import * as PR from '../src/progress.js'; import { ROAD_W } from '../src/track.js'; import { Vector3 } from 'three';
export async function finishRuns({ levels = LEVELS, lv = [0, 3, 5], vehs = ['roadster', 'hauler'], weave = 0.25, phase = 0, boost = true, startV = 30 } = {}) {
  const H = 1 / 120, out = [];
  for (const L of levels) for (const veh of vehs) for (const n of lv) {
    const up = Object.fromEntries(PR.UPGRADES.map(u => [u.id, Math.min(n, PR.maxTier(u.id))]));
    const probe = new Sim(L, { mode: 'race', vehicle: veh, upgrades: up }); await probe.init();
    const gaps = probe.tr.features.filter(f => f.type === 'gap' && f.s0 < probe.tr.finishS && f.s0 > probe.tr.finishS - 2000);
    const starts = gaps.length ? gaps.map(g => ({ s: Math.max(40, g.s0 - 500), gap: g.name })) : [{ s: Math.max(40, probe.tr.finishS - 1100), gap: '-' }];
    try { probe.world.free(); } catch {}
    for (const st of starts) {
    const s = new Sim(L, { mode: 'race', vehicle: veh, upgrades: up }); await s.init(); s.state = 'race'; s.battery = 999;
    /* the bot can't dodge: rivals are parked out of the world so rear-ending an AI car (a legit hit) isn't scored against the finish fix */
    if (!process.env.WITH_AI) { for (const a of s.ai) a.rb.setNextKinematicTranslation({ x: 0, y: -5000, z: 0 }); s.ai.length = 0; }
    s.respawnAt(st.s, startV);
    let fin = false, airAtFin = false, hAtFin = 0, peakG = 0, pv = null, maxH = 0, bad = [], t = 0, lands = [], locked = 0, crashes = 0, meteorT = -99, hazards = 0;
    for (; t < 260; t += H) { const lf = new Vector3(1, 0, 0).applyQuaternion(s.pose.q), tg = s.tr.samples[Math.min(s.tr.samples.length - 1, s.prog.i + 25)].p;
      s.fixed(H, { throttle: 1, boost, steer: Math.max(-1, Math.min(1, -tg.clone().sub(s.pose.p).dot(lf) * 0.15 + weave * Math.sin(t * 3 + phase))) });
      if (s.boostLocked) locked += H;
      for (const e of s.events) { if (fin && (e.type === 'crash' || e.type === 'killplane')) bad.push(e.type + ':' + (e.reason || ''));
        if (e.type === 'crash') crashes++;
        /* B44: anything nasty in the last 300 m before the line */
        if (e.type === 'crash' && e.reason === 'meteor') { meteorT = t; hazards++; }
        if (!fin && s.prog.s > s.tr.finishS - 300 && t - meteorT > 4 && ['crash', 'killplane', 'wallHit', 'hardLanding', 'respawn'].includes(e.type)) bad.push('pre-line-' + e.type + ':' + (e.reason || '') + '@' + Math.round(s.tr.finishS - s.prog.s));
        /* B44: real jump landings (>0.8 s air) must be on the road within 3 m of the centreline */
        if (!fin && e.type === 'land' && e.air > 0.8 && s.tr.features.some(g => g.type === 'gap' && s.prog.s > g.land0 - 30 && s.prog.s < g.land1 + 30)) { lands.push(+s.prog.x.toFixed(1)); if (Math.abs(s.prog.x) > 3) bad.push('land-off-centre:' + s.prog.x.toFixed(1) + '@' + Math.round(s.prog.s)); } }
      s.events.length = 0;
      if (s.state === 'finished' && !fin) { fin = true; airAtFin = !s.grounded; hAtFin = s.prog.h; }
      const v = s.body.linvel(), cv = new Vector3(v.x, v.y, v.z); if (fin && pv) { const g = cv.clone().sub(pv).length() / H / 9.81; if (g > peakG) { peakG = g; if (process.env.DBG) console.log("peak", g.toFixed(1), "t", t.toFixed(2), "v", s.speed.toFixed(1), "x", s.prog.x.toFixed(1), "h", s.prog.h.toFixed(1), "gr", s.grounded, "left", (s.tr.roadEnd - s.prog.s).toFixed(0)); } } pv = cv;
      if (fin) maxH = Math.max(maxH, s.prog.h); if (fin && s.speed < 0.3 && s.grounded) break; }
    const r = { lvl: L.id, veh, lv: n, weave, phase, boost, from: st.gap, locked: +locked.toFixed(1), crashes, meteorHits: hazards, lands, hAtFin: +hAtFin.toFixed(1), fin, airAtFin, maxH: +maxH.toFixed(0), peakG: +peakG.toFixed(1), x: +s.prog.x.toFixed(1), left: +(s.tr.roadEnd - s.prog.s).toFixed(0), v: +s.speed.toFixed(1), bad };
    r.ok = fin && !bad.length && s.speed < 0.5 && Math.abs(s.prog.x) < ROAD_W / 2 - 1 && r.left > 3 && r.peakG <= 4; out.push(r); try { s.world.free(); } catch {} } }
  return out;
}
if (!process.env.STRESS && import.meta.url === `file://${process.argv[1]}`) { const r = await finishRuns(process.env.LV ? { levels: LEVELS.filter(l => process.env.LV.split(',').includes(l.id)) } : {}); for (const x of r) if (!x.ok || x.airAtFin) console.log(JSON.stringify(x)); console.log(r.filter(x => x.ok).length + '/' + r.length + ' ok'); }

/* STRESS=1: QA-style sweep: bot variants (weave 0 / 0.25 / 0.45 with different phases, boost on/off, slow and fast run-up) */
export async function stress(levels = LEVELS) { const V = [{}, { weave: 0, boost: true }, { weave: 0.45, phase: 1.3 }, { weave: 0.25, phase: 2.1, boost: false }, { weave: 0.25, phase: 0.7, startV: 60 }]; let out = [];
  for (const v of V) out = out.concat(await finishRuns({ levels, lv: [0, 5], ...v })); return out; }
if (process.env.STRESS && import.meta.url === `file://${process.argv[1]}`) { const r = await stress(process.env.LV ? LEVELS.filter(l => process.env.LV.split(',').includes(l.id)) : LEVELS); for (const x of r) if (!x.ok) console.log(JSON.stringify(x)); console.log('STRESS ' + r.filter(x => x.ok).length + '/' + r.length + ' ok'); }
