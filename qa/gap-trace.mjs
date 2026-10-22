// For each gap: takeoff speed vs design speed, and outcome (cleared / fall). Autopilot full throttle, optional boost.
import { Sim } from '../src/sim.js';
import { LEVELS } from '../src/levels.js';
import { Vector3 } from 'three';
const VEH = process.env.VEH || 'roadster', BOOST = process.env.BOOST !== '0', FPS = +(process.env.FPS || 60);
const rows = [];
for (const L of LEVELS) {
  if (process.argv[2] && !process.argv[2].split(',').includes(L.id)) continue;
  const sim = new Sim(L, { mode: 'trial', vehicle: VEH, upgrades: {} }); await sim.init();
  const gaps = sim.tr.features.filter(f => f.type === 'gap').map(f => ({ f, def: sim.tr.def.segments.find(s => s.t === 'gap' && s.name === f.name) }));
  const inp = { throttle: 1, brake: 0, steer: 0, boost: false, jump: false, pitch: 0, assist: true };
  let t = 0; const seen = new Map();
  while (t < 240 && sim.state !== 'finished') {
    const P = sim.pose.p, q = sim.pose.q; const tgt = sim.tr.samples[Math.min(sim.tr.samples.length - 1, sim.prog.i + 14)];
    const rel = tgt.p.clone().sub(P); const left = new Vector3(1, 0, 0).applyQuaternion(q);
    inp.steer = sim.grounded ? Math.max(-1, Math.min(1, -rel.dot(left) * 0.18)) : 0; inp.boost = BOOST && sim.speed < 44;
    sim.update(1 / FPS, inp);
    for (const g of gaps) { if (!seen.has(g) && sim.prog.s > g.f.s0 && sim.prog.s < g.f.s0 + 3) seen.set(g, { take: +(sim.speed).toFixed(1), design: g.def?.speed, name: g.f.name, s0: Math.round(g.f.s0), len: Math.round(g.f.s1 - g.f.s0), res: '?' }); }
    for (const e of sim.events) { if (e.type === 'crash') { for (const [g, r] of seen) if (r.res === '?' && sim.prog.s < g.f.s1 + 30) r.res = 'CRASH:' + e.reason; } if (e.type === 'score' && /CLEARED/.test(e.text)) { for (const [g, r] of seen) if (r.res === '?') r.res = 'cleared'; } }
    sim.events.length = 0; t += 1 / FPS;
  }
  for (const r of seen.values()) { rows.push({ lvl: L.id, ...r }); }
  sim.dispose();
}
for (const r of rows) console.log(JSON.stringify(r));
console.log('fails', rows.filter(r => r.res !== 'cleared').length, '/', rows.length);
