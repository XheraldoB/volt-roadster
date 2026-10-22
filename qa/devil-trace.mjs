import { Sim } from '../src/sim.js';
import { levelById } from '../src/levels.js';
const [id, s0] = [process.argv[2] || 'r1', +(process.argv[3] || 274)];
const sim = new Sim(levelById(id), { mode: 'trial', vehicle: process.env.VEH || 'roadster', upgrades: {} }); await sim.init();
console.log('devils', sim.devils.map(d => Math.round(d.s)));
sim.respawnAt(s0, 30);
const inp = { throttle: 1, brake: 0, steer: 0, boost: false, jump: false, pitch: 0, assist: true }; let t = 0, minH = 0;
while (t < 16) {
  sim.update(1 / 60, inp); t += 1 / 60;
  const sm = sim.tr.samples[sim.prog.i];
  if (Math.round(t * 60) % 6 === 0) console.log(t.toFixed(1), 's', sim.prog.s.toFixed(0), 'x', sim.prog.x.toFixed(1), 'h', sim.prog.h.toFixed(2), 'vy', sim.body.linvel().y.toFixed(1), 'v', sim.speed.toFixed(1), 'gr', sim.grounded, 'terrainOn', sim.terrainCollider.isEnabled(), sm.gap ? 'GAP' : '', sm.ramp ? 'RAMP' : '');
  for (const e of sim.events) if (['crash', 'score', 'land', 'devil'].includes(e.type)) console.log('  EV', e.type, e.reason || e.text || '', e.air || ''); sim.events.length = 0;
}
