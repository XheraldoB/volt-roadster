import { Sim } from '../src/sim.js';
import { LEVELS } from '../src/levels.js';
import { Vector3 } from 'three';
const only = process.argv[2];
const ups = process.argv[3] ? JSON.parse(process.argv[3]) : {};
for (const L of LEVELS) {
  if (only && only !== 'all' && L.id !== only) continue;
  const t0 = Date.now();
  const sim = new Sim(L, { mode: 'race', upgrades: ups, vehicle: process.env.VEH || 'roadster' }); await sim.init();
  const crashes = []; let fin = null; const tricks = {};
  const inp = { throttle: 1, brake: 0, steer: 0, boost: false, jump: false };
  let t = 0;
  while (t < 200 && sim.state !== 'finished') {
    // autopilot
    const P = sim.pose.p, q = sim.pose.q;
    const tgt = sim.tr.samples[Math.min(sim.tr.samples.length - 1, sim.prog.i + 14)];
    const rel = tgt.p.clone().sub(P);
    const left = new Vector3(1, 0, 0).applyQuaternion(q);
    const lat = rel.dot(left) ; inp.steer = Math.max(-1, Math.min(1, -lat * 0.18 + sim.prog.x * 0.0));
    if (!sim.grounded) inp.steer = 0;
    inp.boost = sim.speed < 44;
    { const sm = sim.sm || null; inp.jump = sim.veh.rcs && !sim.grounded && sim.air > 0.3 && sim.prog.h < 1.2; }
    sim.update(1 / 60, inp);
    if (process.env.TRACE && sim.prog.s > +process.env.TRACE - 150 && sim.prog.s < +process.env.TRACE + 300 && (Math.round(t * 60) % 10 === 0)) console.log('tr', t.toFixed(1), sim.prog.s.toFixed(0), 'h', sim.prog.h.toFixed(1), 'x', sim.prog.x.toFixed(1), 'v', sim.speed.toFixed(1), 'fv', sim.fspeed.toFixed(1), 'g', sim.grounded, 'gas', sim.gas.toFixed(2), 'j', inp.jump, sim.state);
    for (const e of sim.events) { if (e.type === 'crash') crashes.push(`${e.reason}@${Math.round(sim.prog.s)}(seg ${sim.tr.samples[sim.prog.i].seg},v=${sim.speed.toFixed(0)})`); if (e.type === 'finish') fin = e; if (e.type === 'score') tricks[e.text] = (tricks[e.text] || 0) + 1; }
    sim.events.length = 0; t += 1 / 60;
  }
  console.log(L.id, fin ? `FINISH ok=${fin.ok} ${fin.reason||''} t=${fin.time.toFixed(1)} pos=${fin.position} score=${fin.score} stars=${fin.stars} coins=${fin.coins} q=${fin.quest.done}` : `NOFINISH s=${Math.round(sim.prog.s)}/${Math.round(sim.tr.finishS)}`, 'crashes', crashes.length, crashes.slice(0, 6).join(' '), 'bat', sim.battery.toFixed(0), `(${Date.now() - t0}ms)`);
  console.log('   ', Object.entries(tricks).map(([k, v]) => k + 'x' + v).join(', '));
  sim.dispose();
}
