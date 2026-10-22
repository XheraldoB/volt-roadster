// Driving-feel metrics + cold-gas hover physics, headless (same Sim as the game).
import { Sim, carStats } from '../src/sim.js';
import { levelById } from '../src/levels.js';
import { Vector3, Quaternion } from 'three';
const base = { steer: 0, throttle: 0, brake: 0, boost: false, jump: false, pitch: 0, assist: true };
async function mk(id, veh, ups = {}) { const s = new Sim(levelById(id), { mode: 'trial', vehicle: veh, upgrades: ups }); await s.init(); while (s.state !== 'race') { s.update(1 / 120, base); s.events.length = 0; } return s; }
const run = (s, inp, secs, cb) => { const n = Math.round(secs * 120); for (let i = 0; i < n; i++) { s.update(1 / 120, inp); if (cb && cb(i / 120) === false) break; s.events.length = 0; } };
const out = {};
for (const veh of ['roadster', 'hauler']) {
  const r = {};
  // 0-100 km/h and top speed (e1 start straight) with and without boost
  let s = await mk('e1', veh); let t100 = null; run(s, { ...base, throttle: 1 }, 12, t => { if (!t100 && s.speed * 3.6 >= 100) t100 = t; });
  r.t0_100 = t100 && +t100.toFixed(2); r.kmhAfter12s = Math.round(s.speed * 3.6);
  // braking from current speed to 0
  { const v0 = s.speed; const p0 = s.pose.p.clone(); let tt = 0; run(s, { ...base, brake: 1 }, 8, t => { tt = t; if (s.speed < 0.5) return false; }); r.brake = { fromKmh: Math.round(v0 * 3.6), meters: +s.pose.p.distanceTo(p0).toFixed(1), secs: +tt.toFixed(2) }; }
  // cornering: 80 km/h then full steer for 0.8 s
  s = await mk('e1', veh); s.respawnAt(30, 22.2); run(s, { ...base, throttle: 0.4 }, 0.5);
  { const yaw = []; let maxLat = 0, maxSlip = 0; run(s, { ...base, throttle: 0.4, steer: 1 }, 0.9, () => { const av = s.body.angvel(); yaw.push(av.y); const v = s.body.linvel(); const left = new Vector3(1, 0, 0).applyQuaternion(s.pose.q), fwd = new Vector3(0, 0, 1).applyQuaternion(s.pose.q); const vv = new Vector3(v.x, v.y, v.z); const slip = Math.atan2(Math.abs(vv.dot(left)), Math.max(1, vv.dot(fwd))); maxSlip = Math.max(maxSlip, slip); maxLat = Math.max(maxLat, Math.abs(av.y) * vv.length() / 9.81); });
    r.corner80 = { maxYawRate: +Math.max(...yaw.map(Math.abs)).toFixed(2), approxLatG: +maxLat.toFixed(2), maxSlipDeg: +(maxSlip * 57.3).toFixed(1), steerCur: +s.steerCur.toFixed(3) }; }
  // drift: 120 km/h full steer + brake tap
  s = await mk('e1', veh); s.respawnAt(30, 33); { let maxSlip = 0, drift = false; run(s, { ...base, throttle: 1, steer: 1, brake: 0 }, 1.0, () => { const v = s.body.linvel(); const vv = new Vector3(v.x, v.y, v.z); const left = new Vector3(1, 0, 0).applyQuaternion(s.pose.q), fwd = new Vector3(0, 0, 1).applyQuaternion(s.pose.q); maxSlip = Math.max(maxSlip, Math.atan2(Math.abs(vv.dot(left)), Math.max(1, vv.dot(fwd)))); if (s.drifting) drift = true; }); r.drift120 = { maxSlipDeg: +(maxSlip * 57.3).toFixed(1), driftFlag: drift, crashes: s.stat.crashes }; }
  // suspension: settle bounce after 1 m drop
  s = await mk('e1', veh); { const p = s.body.translation(); s.body.setTranslation({ x: p.x, y: p.y + 1, z: p.z }, true); const hs = []; run(s, base, 2.5, () => hs.push(s.pose.p.y)); const settle = hs[hs.length - 1]; let osc = 0; for (let i = 1; i < hs.length - 1; i++) if ((hs[i] - hs[i - 1]) * (hs[i + 1] - hs[i]) < 0) osc++; r.suspension1mDrop = { oscillations: osc, settleY: +settle.toFixed(2), minY: +Math.min(...hs).toFixed(2) }; }
  out[veh] = r;
}
// ---- cold-gas hover (pickup) on Earth, Moon, Mars: 20 m above the road, zero velocity
const hover = {};
for (const lvl of ['e1', 'm1', 'r1']) {
  for (const hold of [false, true]) {
    const s = await mk(lvl, 'hauler'); s.respawnAt(400, 0);
    const p = s.body.translation(); s.body.setTranslation({ x: p.x, y: p.y + 20, z: p.z }, true); s.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    const tr = []; let landT = null, gasEmptyT = null, maxH = -1e9, landV = null; let prevVy = 0;
    run(s, { ...base, jump: hold }, 30, t => { const vy = s.body.linvel().y; if (gasEmptyT === null && s.gas <= 0) gasEmptyT = t; maxH = Math.max(maxH, s.prog.h); if (s.grounded && t > 0.3 && landT === null) { landT = t; landV = prevVy; return false; } prevVy = vy; if (Math.round(t * 120) % 60 === 0) tr.push([+t.toFixed(1), +s.prog.h.toFixed(1), +vy.toFixed(2), +s.gas.toFixed(2)]); });
    hover[`${lvl}_${hold ? 'jumpHeld' : 'noInput'}`] = { landT: landT && +landT.toFixed(2), touchdownVy: landV && +landV.toFixed(2), gasEmptyAt: gasEmptyT && +gasEmptyT.toFixed(2), maxH: +maxH.toFixed(1), trace: tr.slice(0, 12), crashed: s.stat.crashes };
  }
}
// gas refill on ground
{ const s = await mk('e1', 'hauler'); s.gas = 0; run(s, base, 5); hover.refill5s = +s.gas.toFixed(2); hover.gasCap = s.stats.gasCap; }
// hover on a real jump: e1 Baby Canyon with jump held after takeoff vs not
for (const hold of [false, true]) {
  const s = await mk('e1', 'hauler'); const f = s.tr.features.find(f => f.type === 'gap'); s.respawnAt(f.s0 - 250, 30);
  let air = 0, maxAir = 0, landS = null; const inp = { ...base, throttle: 1 };
  run(s, inp, 25, () => { inp.jump = hold && !s.grounded && s.air > 0.2; if (!s.grounded) air += 1 / 120; else { if (air > 0.5 && landS === null && s.prog.s > f.s0) landS = Math.round(s.prog.s); maxAir = Math.max(maxAir, air); air = 0; } if (s.prog.s > f.s1 + 80) return false; });
  hover[`e1_gap_${hold ? 'hover' : 'plain'}`] = { maxAir: +maxAir.toFixed(2), landS, gapEnd: Math.round(f.s1), padS: Math.round(f.padS), crashes: s.stat.crashes };
}
console.log(JSON.stringify({ feel: out, hover }, null, 1));
