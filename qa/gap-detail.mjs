import { Sim } from '../src/sim.js';
import { levelById } from '../src/levels.js';
import { Vector3 } from 'three';
const [id, gs] = [process.argv[2], +process.argv[3]]; const THR = +(process.env.THR ?? 1);
const sim = new Sim(levelById(id), { mode: 'trial', vehicle: process.env.VEH || 'roadster', upgrades: {} }); await sim.init();
const f = sim.tr.features.find(f => f.type === 'gap' && Math.abs(f.s0 - gs) < 5); console.log('gap', f.name, f.s0, f.s1, 'padS', f.padS, 'padR', f.padR, 'cliff', f.cliff);
const sdef = sim.tr.def.segments.filter(s => s.t === 'gap' || s.t === 'ramp'); console.log(JSON.stringify(sdef.find(s => s.name === f.name)));
sim.respawnAt(f.s0 - 200, 30);
const inp = { throttle: THR, brake: 0, steer: 0, boost: false, jump: false, pitch: 0, assist: true }; let t = 0;
while (t < 25 && sim.state !== 'finished') {
  sim.update(1 / 60, inp); t += 1 / 60;
  const sm = sim.tr.samples[sim.prog.i];
  if (sim.prog.s > f.s0 - 40 && Math.round(t * 60) % 6 === 0) console.log(t.toFixed(1), 's', sim.prog.s.toFixed(0), 'h', sim.prog.h.toFixed(1), 'y', sim.pose.p.y.toFixed(1), 'roadY', sm.p.y.toFixed(1), 'v', sim.speed.toFixed(1), 'gr', sim.grounded, sm.gap ? 'GAP' : '', sm.solid ? '' : 'NOTSOLID', sm.ramp ? 'RAMP' : '', sm.land ? 'LAND' : '');
  for (const e of sim.events) if (['crash', 'score', 'land'].includes(e.type)) console.log('  EV', e.type, e.reason || e.text || '', e.air || ''); sim.events.length = 0;
  if (sim.prog.s > f.s1 + 60) break;
}
