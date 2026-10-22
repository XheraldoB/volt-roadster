import { Sim } from '../src/sim.js';
import { levelById } from '../src/levels.js';
import { Vector3 } from 'three';
const base = { steer: 0, throttle: 0, brake: 0, boost: false, jump: false, pitch: 0, assist: true };
const lvl = process.argv[2] || 'e1', veh = process.env.VEH || 'hauler', gi = +(process.argv[3] || 0);
const s = new Sim(levelById(lvl), { mode: 'trial', vehicle: veh, upgrades: {} }); await s.init(); while (s.state !== 'race') { s.update(1 / 120, base); s.events.length = 0; }
const f = s.tr.features.filter(f => f.type === 'gap')[gi]; s.respawnAt(f.s0 - 150, 30);
const inp = { ...base, throttle: 1 };
for (let i = 0; i < 120 * 14; i++) {
  const tgt = s.tr.samples[Math.min(s.tr.samples.length - 1, s.prog.i + 14)]; const rel = tgt.p.clone().sub(s.pose.p); const left = new Vector3(1, 0, 0).applyQuaternion(s.pose.q); inp.steer = s.grounded ? Math.max(-1, Math.min(1, -rel.dot(left) * 0.18)) : 0;
  inp.jump = process.env.MODE === 'hold' ? (!s.grounded && s.air > 0.15) : process.env.MODE === 'press' ? (s.prog.s > f.s0 - 8) : false;
  s.update(1 / 120, inp);
  if (s.prog.s > f.s0 - 20 && i % 12 === 0) console.log((i / 120).toFixed(2), 's', s.prog.s.toFixed(0), 'h', s.prog.h.toFixed(1), 'vy', s.body.linvel().y.toFixed(1), 'kmh', (s.speed * 3.6).toFixed(0), 'gr', s.grounded, 'air', s.air.toFixed(2), 'gas', s.gas.toFixed(2), 'lift', s.rcs.lift, 'state', s.state);
  for (const e of s.events) if (['crash', 'score', 'land', 'jump'].includes(e.type)) console.log('  EV', e.type, e.reason || e.text || '', e.air ? e.air.toFixed(2) : ''); s.events.length = 0;
  if (s.prog.s > f.s1 + 400) break;
}
