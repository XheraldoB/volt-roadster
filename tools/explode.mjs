import { Sim } from '../src/sim.js';
import { levelById } from '../src/levels.js';
import { Vector3 } from 'three';
const L = levelById(process.argv[2] || 'e5');
const sim = new Sim(L, { mode: 'race' }); await sim.init();
const inp = { throttle: 1, brake: 0, steer: 0, boost: false, jump: false };
let t = 0, prevV = 0, log = [];
while (t < 200 && sim.state !== 'finished') {
  const P = sim.pose.p, q = sim.pose.q;
  const tgt = sim.tr.samples[Math.min(sim.tr.samples.length - 1, sim.prog.i + 14)];
  const rel = tgt.p.clone().sub(P); const left = new Vector3(1, 0, 0).applyQuaternion(q);
  inp.steer = Math.max(-1, Math.min(1, -rel.dot(left) * 0.18)); if (!sim.grounded) inp.steer = 0; inp.boost = sim.speed < 44;
  sim.update(1 / 60, inp);
  log.push(`t=${t.toFixed(2)} s=${sim.prog.s.toFixed(0)} x=${sim.prog.x.toFixed(1)} h=${sim.prog.h.toFixed(1)} v=${sim.speed.toFixed(1)} gr=${sim.grounded} crashT=${(sim.crashT||0).toFixed(2)} rail=${!!sim.rail} ev=${sim.events.map(e => e.type + (e.reason ? ':' + e.reason : '')).join(',')}`);
  if (log.length > 40) log.shift();
  sim.events.length = 0;
  if (sim.speed > 130) { console.log(log.join('\n')); break; }
  t += 1 / 60;
}
