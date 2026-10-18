import { Sim } from '../src/sim.js';
import { levelById } from '../src/levels.js';
import { Vector3 } from 'three';
const L = levelById(process.argv[2] || 'e1'); const T = +(process.argv[3] || 40), every = +(process.argv[4] || 0.5);
const sim = new Sim(L, { mode: 'race' }); await sim.init();
const inp = { throttle: 1, brake: 0, steer: 0, boost: false, jump: false };
let t = 0, nextLog = 0;
while (t < T) {
  const P = sim.pose.p, q = sim.pose.q;
  const tgt = sim.tr.samples[Math.min(sim.tr.samples.length - 1, sim.prog.i + 14)];
  const left = new Vector3(1, 0, 0).applyQuaternion(q);
  inp.steer = sim.grounded ? Math.max(-1, Math.min(1, -tgt.p.clone().sub(P).dot(left) * 0.18)) : 0;
  inp.boost = sim.speed < 44;
  sim.update(1 / 60, inp); t += 1 / 60;
  const ev = sim.events.map(e => e.type + (e.text ? ':' + e.text : e.reason ? ':' + e.reason : '')).filter(x => !x.startsWith('coin')); sim.events.length = 0;
  if (t >= nextLog || ev.length) { if (t >= nextLog) nextLog += every;
    const sm = sim.tr.samples[sim.prog.i]; const up = new Vector3(0, 1, 0).applyQuaternion(q);
    console.log(t.toFixed(2), 's', sim.prog.s.toFixed(0), 'seg', sm.seg, (sm.loop?'L':'')+(sm.magnet?'M':'')+(sm.gap?'G':'')+(sm.ramp?'R':''), 'x', sim.prog.x.toFixed(1), 'h', sim.prog.h.toFixed(2), 'v', sim.speed.toFixed(1), 'c', sim.contacts, 'upDot', up.dot(sm.U).toFixed(2), 'air', sim.air.toFixed(1), ev.join(' ')); }
}
