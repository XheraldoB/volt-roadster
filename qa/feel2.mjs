import { Sim } from '../src/sim.js';
import { levelById } from '../src/levels.js';
import { Vector3 } from 'three';
const base = { steer: 0, throttle: 0, brake: 0, boost: false, jump: false, pitch: 0, assist: true };
async function mk(id, veh) { const s = new Sim(levelById(id), { mode: 'trial', vehicle: veh, upgrades: {} }); await s.init(); while (s.state !== 'race') { s.update(1 / 120, base); s.events.length = 0; } return s; }
const run = (s, inp, secs, cb) => { const n = Math.round(secs * 120); for (let i = 0; i < n; i++) { if (cb && cb(i / 120) === false) break; s.update(1 / 120, inp); s.events.length = 0; } };
const auto = (s, inp) => { const tgt = s.tr.samples[Math.min(s.tr.samples.length - 1, s.prog.i + 14)]; const rel = tgt.p.clone().sub(s.pose.p); const left = new Vector3(1, 0, 0).applyQuaternion(s.pose.q); inp.steer = s.grounded ? Math.max(-1, Math.min(1, -rel.dot(left) * 0.18)) : 0; };
const O = {};
for (const veh of ['roadster', 'hauler']) {
  // brake 100->0
  let s = await mk('e1', veh); s.respawnAt(25, 27.8); run(s, base, 0.3); { const v0 = s.speed, p0 = s.pose.p.clone(); let tt = 0; run(s, { ...base, brake: 1 }, 8, t => { tt = t; if (s.speed < 0.3) return false; }); O[veh + '_brake'] = { fromKmh: Math.round(v0 * 3.6), m: +s.pose.p.distanceTo(p0).toFixed(1), s: +tt.toFixed(2) }; }
  // steering response at 80 km/h: heading change and slip over 1.2 s, for steer 1.0 and 0.5
  for (const st of [1, 0.5]) {
    s = await mk('e1', veh); s.respawnAt(25, 22.2); run(s, { ...base, throttle: 0.35 }, 0.3);
    const f0 = new Vector3(0, 0, 1).applyQuaternion(s.pose.q); const rows = [];
    run(s, { ...base, throttle: 0.35, steer: st }, 1.2, t => { if (Math.round(t * 120) % 24 === 0) { const f = new Vector3(0, 0, 1).applyQuaternion(s.pose.q); const v = s.body.linvel(); const vv = new Vector3(v.x, v.y, v.z); const left = new Vector3(1, 0, 0).applyQuaternion(s.pose.q); rows.push({ t: +t.toFixed(1), headDeg: +(Math.acos(Math.min(1, f.dot(f0))) * 57.3).toFixed(0), slipDeg: +(Math.atan2(vv.dot(left), Math.max(1, vv.dot(f))) * 57.3).toFixed(0), kmh: Math.round(vv.length() * 3.6), x: +s.prog.x.toFixed(1) }); } });
    O[`${veh}_steer${st}_80kmh`] = rows;
  }
}
// hover v2: airborne at rest 20 m up (one free step first so no ground jump)
for (const lvl of ['e1', 'm1']) for (const mode of ['none', 'holdAll', 'lateBurn']) {
  const s = await mk(lvl, 'hauler'); s.respawnAt(400, 0); const p = s.body.translation(); s.body.setTranslation({ x: p.x, y: p.y + 20, z: p.z }, true); s.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  run(s, base, 0.05); const inp = { ...base }; let maxH = -1e9, landV = null, landT = null, emptyT = null, prevVy = 0, minH = 1e9;
  run(s, inp, 40, t => { const vy = s.body.linvel().y; inp.jump = mode === 'holdAll' ? true : mode === 'lateBurn' ? (vy < -4 && s.prog.h < 12) : false; if (emptyT === null && s.gas <= 0.001) emptyT = +t.toFixed(2); maxH = Math.max(maxH, s.prog.h); if (s.grounded && t > 0.3) { landT = +t.toFixed(2); landV = +prevVy.toFixed(2); return false; } prevVy = vy; });
  O[`hover_${lvl}_${mode}`] = { landT, touchdownVy: landV, maxH: +maxH.toFixed(1), gasEmptyAt: emptyT, gasLeft: +s.gas.toFixed(2) };
}
// hover on Baby Canyon with autopilot (approach at speed), hold jump whole flight vs not
for (const mode of ['plain', 'holdAll']) {
  const s = await mk('e1', 'hauler'); const f = s.tr.features.find(f => f.type === 'gap'); s.respawnAt(f.s0 - 150, 30);
  const inp = { ...base, throttle: 1 }; let air = 0, maxAir = 0, landS = null, cleared = false, takeoffV = null;
  for (let i = 0; i < 120 * 20; i++) { auto(s, inp); inp.jump = mode === 'holdAll' && !s.grounded && s.air > 0.15; s.update(1 / 120, inp); for (const e of s.events) if (e.type === 'score' && /CLEARED|PAD|PERFECT/.test(e.text)) cleared = cleared ? cleared + ' / ' + e.text : e.text; s.events.length = 0; if (!s.grounded) { if (!air) takeoffV = Math.round(s.speed * 3.6); air += 1 / 120; } else { if (air > 0.5 && landS === null && s.prog.s > f.s0) landS = Math.round(s.prog.s); maxAir = Math.max(maxAir, air); air = 0; } if (s.prog.s > f.s1 + 100) break; }
  O[`gap_e1_${mode}`] = { takeoffKmh: takeoffV, maxAir: +maxAir.toFixed(2), landS, gapEnd: Math.round(f.s1), padS: Math.round(f.padS), padR: f.padR, scored: cleared, crashes: s.stat.crashes };
}
console.log(JSON.stringify(O, null, 0).replace(/\],"/g, '],\n"').replace(/\},"/g, '},\n"'));
