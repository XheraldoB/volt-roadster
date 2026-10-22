import { Sim } from '../src/sim.js';
import { levelById } from '../src/levels.js';
import { Vector3 } from 'three';
const L = levelById(process.argv[2] || 'e1');
const sim = new Sim(L, { mode: 'race', vehicle: 'roadster', upgrades: {} }); await sim.init();
const inp = { throttle: 1, brake: 0, steer: 0, boost: false, jump: false, pitch: 0, assist: true };
let t = 0, prevH = 0;
while (t < 200 && sim.state !== 'finished') {
  const P = sim.pose.p, q = sim.pose.q; const tgt = sim.tr.samples[Math.min(sim.tr.samples.length - 1, sim.prog.i + 14)];
  const rel = tgt.p.clone().sub(P); const left = new Vector3(1, 0, 0).applyQuaternion(q);
  inp.steer = sim.grounded ? Math.max(-1, Math.min(1, -rel.dot(left) * 0.18)) : 0; inp.boost = sim.speed < 44;
  sim.update(1 / 60, inp);
  const sm = sim.tr.samples[sim.prog.i];
  if (sim.state === 'race' && sm.solid && !sm.gap && Math.abs(sim.prog.x) < 6 && sim.prog.h < -1.5 && sim.prog.h > -8 && sim.crashT <= 0)
    console.log(t.toFixed(2), 's', sim.prog.s.toFixed(1), 'h', sim.prog.h.toFixed(2), 'prevH', prevH.toFixed(2), 'x', sim.prog.x.toFixed(1), 'v', sim.speed.toFixed(1), 'gr', sim.grounded, 'seg', sm.seg, sim.tr.def.segments[sm.seg]?.t, 'loop', !!sm.loop, 'magnet', !!sm.magnet, 'U.y', sm.U.y.toFixed(2));
  for (const e of sim.events) if (e.type === 'crash') console.log('CRASH', e.reason, t.toFixed(2)); sim.events.length = 0;
  prevH = sim.prog.h; t += 1 / 60;
}
