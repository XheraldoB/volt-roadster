// Headless physics QA: autopilot through every level at different frame rates; detect tunneling, explosions, crashes.
import { Sim, STEP } from '../src/sim.js';
import { LEVELS, PLANETS } from '../src/levels.js';
import { Vector3 } from 'three';
const VEH = process.env.VEH || 'roadster'; const FPS = +(process.env.FPS || 60); const only = process.argv[2];
const out = [];
for (const L of LEVELS) {
  if (only && only !== 'all' && !only.split(',').includes(L.id)) continue;
  const sim = new Sim(L, { mode: 'race', vehicle: VEH, upgrades: {} }); await sim.init();
  const inp = { throttle: 1, brake: 0, steer: 0, boost: false, jump: false, pitch: 0, assist: true };
  let t = 0, fin = null; const crashes = []; let tunnel = 0, maxV = 0, explode = 0, minH = 99; const dt = 1 / FPS;
  while (t < 240 && sim.state !== 'finished') {
    const P = sim.pose.p, q = sim.pose.q;
    const tgt = sim.tr.samples[Math.min(sim.tr.samples.length - 1, sim.prog.i + 14)];
    const rel = tgt.p.clone().sub(P); const left = new Vector3(1, 0, 0).applyQuaternion(q);
    inp.steer = sim.grounded ? Math.max(-1, Math.min(1, -rel.dot(left) * 0.18)) : 0;
    inp.boost = sim.speed < 44;
    inp.jump = sim.veh.rcs && !sim.grounded && sim.air > 0.3 && sim.prog.h < 1.2;
    sim.update(dt, inp);
    const sm = sim.tr.samples[sim.prog.i];
    if (sim.state === 'race' && sm.solid && !sm.gap && Math.abs(sim.prog.x) < 6 && sim.prog.h < -1.5 && sim.prog.h > -8 && sim.crashT <= 0) tunnel++;
    maxV = Math.max(maxV, sim.speed); if (sim.speed > 150) explode++;
    for (const e of sim.events) { if (e.type === 'crash') crashes.push(`${e.reason}@${Math.round(sim.prog.s)}`); if (e.type === 'finish') fin = e; }
    sim.events.length = 0; t += dt;
  }
  const r = { id: L.id, planet: L.planet, fin: fin ? { ok: fin.ok, reason: fin.reason, t: +fin.time.toFixed(1), pos: fin.position, stars: fin.stars, loops: fin.stat.loops, gaps: fin.stat.gaps, pads: fin.stat.pads, perfect: fin.stat.perfect, carJumps: fin.stat.carJumps, nearMiss: fin.stat.nearMiss, flips: fin.stat.flips, quest: fin.quest.done, score: fin.score } : { nofinish: Math.round(sim.prog.s) + '/' + Math.round(sim.tr.finishS) },
    crashes, tunnelFrames: tunnel, maxKmh: Math.round(maxV * 3.6), explode };
  out.push(r); console.log(JSON.stringify(r));
  sim.dispose();
}
