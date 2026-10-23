// Fundamental driving audit (sim-level, deterministic). Run: node tests/drive.test.mjs
// Each check mirrors something a player does by hand; numbers come from the real Sim used by the game.
import { Sim } from '../src/sim.js';
import { poseAt } from '../src/track.js';
import { LEVELS } from '../src/levels.js';
import { Vector3 } from 'three';
/* B44: documented pre-existing failures of the strict finish run (bot overspeeding the finale loops on e4/e8/m3/r3 and two lane drifts); also fail on db99eda */
const FINISH_KNOWN = ['e2/hauler/3/Dry River', 'e5/hauler/3/Overpass Gap', 'e4/roadster/3/Sea Stack Leap', 'e4/roadster/5/Sea Stack Leap', 'e8/roadster/3/Skywalk Leap', 'e8/hauler/3/Skywalk Leap', 'm3/roadster/3/Moonshot', 'm3/roadster/5/Shadow Gap', 'r3/roadster/5/Summit Launch', 'r3/hauler/3/Summit Launch'];
const H = 1 / 120, res = []; let fail = 0;
const ok = (id, pass, info) => { res.push({ id, pass: !!pass, info }); if (!pass) fail++; console.log(`${pass ? 'PASS' : 'FAIL'} ${id}  ${typeof info === 'string' ? info : JSON.stringify(info)}`); };
const I = (o = {}) => ({ steer: 0, throttle: 0, brake: 0, boost: false, jump: false, pitch: 0, handbrake: false, ...o });
async function mk(lvl = 'e1', veh = 'roadster') { const s = new Sim(LEVELS.find(l => l.id === lvl), { mode: 'race', vehicle: veh }); await s.init(); s.state = 'race'; s.battery = 999; return s; }
const run = (s, inp, sec, cb) => { for (let t = 0; t < sec; t += H) { s.fixed(H, typeof inp === 'function' ? inp(s, t) : inp); s.raceTime = (s.raceTime || 0); s.events.length = 0; if (cb && cb(s, t)) return t; } return sec; };
const yaw = s => { const f = new Vector3(0, 0, 1).applyQuaternion(s.pose.q); return Math.atan2(f.x, f.z); };
const dAng = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const straightS = 600; // e1: flat straight, clear of the start grid (s 596-756)
const place = (s, at, v) => { s.respawnAt(at, 0); const T = s.tr.samples[s.prog.i] ? null : null; const sm = s.tr.samples.find(q => q.s >= at); s.body.setLinvel({ x: sm.T.x * v, y: sm.T.y * v, z: sm.T.z * v }, true); s.prevVel.set(sm.T.x * v, sm.T.y * v, sm.T.z * v); };

for (const veh of ['roadster', 'hauler']) {
  // RP1 reverse from standstill
  { const s = await mk('e1', veh); s.respawnAt(straightS + 60, 0); run(s, I(), 0.5);
    let tRev = null; run(s, I({ brake: 1 }), 3, (s, t) => { if (tRev == null && s.fspeed < -0.5) tRev = t; });
    const kmh = -s.fspeed * 3.6;
    ok(`${veh} reverse engages <1s and reaches >=15 km/h (capped)`, tRev != null && tRev < 1 && kmh >= 15 && kmh < 45, { tRev: tRev?.toFixed(2), kmh: kmh.toFixed(1) });
    { const s2 = await mk('e1', veh); s2.respawnAt(straightS + 60, 0); run(s2, I(), 0.5); run(s2, I({ brake: 1 }), 1.2); const y0 = yaw(s2); run(s2, I({ brake: 1, steer: 1 }), 1.2); const dy = dAng(yaw(s2), y0);
      ok(`${veh} steering works in reverse`, Math.abs(dy) > 0.25, { dYawDeg: (dy * 57.3).toFixed(0) }); }
    run(s, I({ throttle: 1 }), 2.5); ok(`${veh} gas after reverse drives forward`, s.fspeed > 3, { fspeed: s.fspeed.toFixed(1) });
  }
  // RP2 brake 100 -> 0, straight, no creep
  { const s = await mk('e1', veh); place(s, straightS, 27.8); run(s, I({ throttle: 1 }), 0.2); const v0 = s.fspeed; const p0 = s.pose.p.clone(); const y0 = yaw(s);
    run(s, I({ brake: 1 }), 8, s => s.fspeed < 0.3); const d = s.pose.p.distanceTo(p0);
    const lim = veh === 'roadster' ? 40 : 45; const x0 = s.prog.x;
    ok(`${veh} brake from ${(v0 * 3.6).toFixed(0)} km/h stops <= ${lim} m and straight`, d <= lim && Math.abs(s.prog.x - x0) < 1.2, { dist: d.toFixed(1), lateral: (s.prog.x - x0).toFixed(2) });
    const p1 = s.pose.p.clone(); run(s, I(), 2); ok(`${veh} no creep when stopped (released)`, s.pose.p.distanceTo(p1) < 0.6, { moved: s.pose.p.distanceTo(p1).toFixed(2) });
  }
  // RP6 low speed steering: tight turn at ~15 km/h
  { const s = await mk('e1', veh); s.respawnAt(straightS + 40, 0); const y0 = yaw(s); let moved = 0; const p = s.pose.p.clone();
    run(s, (s) => I({ throttle: s.speed < 4.2 ? 1 : 0 }), 2); const y1 = yaw(s); run(s, (s) => I({ throttle: s.speed < 4.2 ? 0.7 : 0, steer: 1 }), 1.2); const dy = Math.abs(dAng(yaw(s), y1));
    const need = veh === 'roadster' ? 40 : 27; ok(`${veh} low-speed (15 km/h) full lock: >= ${need} deg in 1.2 s`, dy * 57.3 >= need, { dYawDeg: (dy * 57.3).toFixed(0), kmh: (s.speed * 3.6).toFixed(0) });
  }
  // B12 mid-speed: 80 km/h, 0.6 s
  { const s = await mk('e1', veh); place(s, straightS, 22.2); run(s, I({ throttle: 1 }), 0.3); const y0 = yaw(s); run(s, s => I({ throttle: 0.4, steer: 1 }), 0.6); const full = Math.abs(dAng(yaw(s), y0)) * 57.3;
    const s2 = await mk('e1', veh); place(s2, straightS, 22.2); run(s2, I({ throttle: 1 }), 0.3); const y2 = yaw(s2); run(s2, s => I({ throttle: 0.4, steer: 0.5 }), 0.6); const half = Math.abs(dAng(yaw(s2), y2)) * 57.3;
    ok(`${veh} mid-speed steering not twitchy (80 km/h, 0.6 s)`, full < 24 && half < full * 0.6 && full > 6, { fullDeg: full.toFixed(1), halfDeg: half.toFixed(1) });
  }
  // handbrake drift: yaw rate goes up vs no handbrake
  { const yawRate = async hb => { const s = await mk('e1', veh); place(s, straightS, 19); run(s, I({ throttle: 1 }), 0.3); const y0 = yaw(s); run(s, I({ throttle: 0.5, steer: 0.6, handbrake: hb }), 0.8); return Math.abs(dAng(yaw(s), y0)); };
    const a = await yawRate(false), b = await yawRate(true); ok(`${veh} handbrake rotates the car more (drift)`, b > a * 1.25, { noHb: (a * 57.3).toFixed(0), hb: (b * 57.3).toFixed(0) });
  }
  // RP3 flip recovery: put it on its roof
  { const s = await mk('e1', veh); s.respawnAt(straightS + 80, 0); const b = s.body, p = b.translation();
    b.setTranslation({ x: p.x, y: p.y + 1.2, z: p.z }, true); b.setRotation({ x: 0, y: 0, z: 1, w: 0 }, true); b.setLinvel({ x: 0, y: 0, z: 0 }, true);
    let tRec = null; run(s, I(), 5, (s, t) => { const up = new Vector3(0, 1, 0).applyQuaternion(s.pose.q); if (t > 0.3 && up.y > 0.9 && s.grounded) { tRec = t; return true; } });
    ok(`${veh} upside-down car recovers by itself within 3 s`, tRec != null && tRec <= 3 && s.state === 'race', { t: tRec?.toFixed(2) });
    const s2 = await mk('e1', veh); s2.respawnAt(straightS + 80, 0); s2.body.setRotation({ x: 0.7071, y: 0, z: 0, w: 0.7071 }, true); run(s2, I(), 0.2); const okBtn = s2.softReset('button'); run(s2, I(), 0.5);
    const up2 = new Vector3(0, 1, 0).applyQuaternion(s2.pose.q); ok(`${veh} reset button rights the car instantly`, okBtn && up2.y > 0.9, { up: up2.y.toFixed(2) });
  }
  // RP4 stuck against a wall / off-road wedge -> throttle held, nothing moves -> auto reset <= 3 s
  { const s = await mk('e1', veh); s.respawnAt(straightS + 80, 0); let tR = null; s.events.length = 0;
    run(s, (s, t) => { s.body.setLinvel({ x: 0, y: Math.min(0, s.body.linvel().y), z: 0 }, true); return I({ throttle: 1 }); }, 4, (s, t) => { if (s.stat.resets) { tR = t; return true; } });
    ok(`${veh} wedged (no progress with throttle) auto-resets within 3 s`, tR != null && tR <= 3, { t: tR?.toFixed(2) });
  }
  // RP5 respawn after falling into a canyon: facing forward, once, <= 3 s
  { const s = await mk('e1', veh); const g = s.tr.features.find(f => f.type === 'gap'); s.respawnAt(g.s0 - 40, 6); let crash = 0, back = null;
    run(s, (s, t) => I({ throttle: 0.3 }), 9, (s, t) => { if (s.crashT > 0 && !crash) crash = t; if (crash && s.crashT <= 0 && s.grounded) { back = t; return true; } });
    const sm = s.tr.samples[s.prog.i]; const fwd = new Vector3(0, 0, 1).applyQuaternion(s.pose.q);
    ok(`${veh} falling into the canyon respawns facing forward within 3 s`, crash && back != null && back - crash <= 3 && fwd.dot(sm.T) > 0.9 && s.stat.crashes === 1, { fallAt: crash && crash.toFixed(1), respawnIn: back && (back - crash).toFixed(2), crashes: s.stat.crashes, facing: fwd.dot(sm.T).toFixed(2) });
  }
  // B15 hard landing must not be CLEAN
  { const s = await mk('e1', veh); s.respawnAt(straightS + 120, 0); const p = s.body.translation(); s.body.setTranslation({ x: p.x, y: p.y + 40, z: p.z }, true); s.air = 1.2; const texts = [];
    for (let t = 0; t < 5 && !(s.grounded && t > 0.5); t += H) { s.fixed(H, I()); for (const e of s.events) if (e.type === 'score' || e.type === 'popup' || e.type === 'crash' || e.type === 'hardLanding') texts.push(e.text || e.type + ':' + (e.reason || '')); s.events.length = 0; }
    run(s, I(), 0.3, () => { for (const e of s.events) texts.push(e.text || e.type); });
    ok(`${veh} 40 m drop is a hard landing / crash, never CLEAN`, !texts.some(x => /CLEAN/.test(x)) && texts.some(x => /HARD|crash/i.test(x)), texts.slice(0, 4).join(' | '));
  }
  // B22 gravity exact
  for (const lvl of ['e1', 'm1', 'r1']) { const s = await mk(lvl, veh); const p = s.body.translation(); s.body.setTranslation({ x: p.x, y: p.y + 60, z: p.z }, true); s.body.setLinvel({ x: 0, y: 0, z: 0 }, true); s.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    const v0 = s.body.linvel().y; for (let i = 0; i < 60; i++) s.fixed(H, I()); const g = -(s.body.linvel().y - v0) / 0.5; ok(`${veh} ${lvl} free-fall = ${s.g}`, Math.abs(g - s.g) < 0.01, g.toFixed(3)); }
  // B6 hover: full input never falls harder than none, and never climbs
  { const drop = async (lvl, hold) => { const s = await mk(lvl, veh); const p = s.body.translation(); s.body.setTranslation({ x: p.x, y: p.y + 25, z: p.z }, true); s.body.setLinvel({ x: 0, y: 0, z: 0 }, true); s.air = 0.5; let maxY = -1e9, vy = 0, y0 = s.body.translation().y;
      for (let t = 0; t < 6; t += H) { s.fixed(H, I({ jump: hold })); s.events.length = 0; maxY = Math.max(maxY, s.body.translation().y); if (s.grounded) break; vy = s.body.linvel().y; } return { climb: maxY - y0, vy }; };
    for (const lvl of ['e1', 'm1', 'r1']) { const a = await drop(lvl, false), b = await drop(lvl, true); ok(`${veh} ${lvl} thrust/hover never worse than no input, no climb`, b.vy >= a.vy - 0.3 && b.climb < 0.3, { noIn: a.vy.toFixed(1), hold: b.vy.toFixed(1), climb: b.climb.toFixed(2) }); }
  }
  // RP7 air control: responds within 1 frame, rate-limited, auto-levels
  { const s = await mk('e1', veh); const p = s.body.translation(); s.body.setTranslation({ x: p.x, y: p.y + 150, z: p.z }, true); s.body.setLinvel({ x: 0, y: 0, z: 20 }, true); s.air = 0.5; run(s, I(), 0.2);
    const w0 = s.body.angvel(); s.fixed(H, I({ pitch: 1 })); const w1 = s.body.angvel(); const dw = Math.hypot(w1.x - w0.x, w1.y - w0.y, w1.z - w0.z);
    let maxW = 0; run(s, I({ pitch: 1, steer: 1 }), 1.5, s => { const w = s.body.angvel(); maxW = Math.max(maxW, Math.hypot(w.x, w.y, w.z)); });
    ok(`${veh} air input responds in 1 frame, spin capped`, dw > 0.05 && maxW <= 6.6, { dw1frame: dw.toFixed(3), maxW: maxW.toFixed(2) });
    run(s, I(), 2.0); const up = new Vector3(0, 1, 0).applyQuaternion(s.pose.q); const w = s.body.angvel();
    ok(`${veh} releases input -> auto-levels wheels-down within 2 s`, up.y > 0.95 && Math.hypot(w.x, w.y, w.z) < 0.6, { upY: up.y.toFixed(3), w: Math.hypot(w.x, w.y, w.z).toFixed(2) });
  }
  // RP7 steer to a landing pad: a simple "player" reads the HUD landing marker and corrects with yaw (steer) and
  // thrust + tilt (GAS/BRAKE). Launches deliberately off-centre (side +-3 m) on the first canyon of each world.
  for (const lvl of ['e1', 'm1', 'r1']) for (const side of [3, -3]) {
    const fly = async (player) => { const s = await mk(lvl, veh); const g = s.tr.features.find(f => f.type === 'gap'); const sg = s.tr.def.segments.find(x => x.t === 'gap' && x.name === g.name);
      const pad = s.tr.samples.find(q => q.s >= g.padS).p.clone(); s.respawnAt(g.s0 - 160, sg?.speed ?? 36); let padHit = null, crashed = false;
      for (let t = 0; t < 20; t += H) {
        const inp = I({ throttle: 1 });
        if (s.grounded) { const left = new Vector3(1, 0, 0).applyQuaternion(s.pose.q); const tgt = s.tr.samples[Math.min(s.tr.samples.length - 1, s.prog.i + 14)]; const rel = tgt.p.clone().sub(s.pose.p).addScaledVector(tgt.X, s.prog.s < g.s0 - 40 ? side : 0); inp.steer = Math.max(-1, Math.min(1, -rel.dot(left) * 0.18)); }
        else if (player && s.landing && s.air > 0.3 && s.prog.s > g.s0) { const L = s.landing; const to = pad.clone().sub(L.p); const q = s.pose.q; const left = new Vector3(1, 0, 0).applyQuaternion(q); const fh = new Vector3(0, 0, 1).applyQuaternion(q).setY(0).normalize(); const e = to.dot(left), ef = to.dot(fh); inp.throttle = 0; const tp = pad.clone().sub(s.pose.p); const bErr = Math.atan2(tp.dot(left), tp.dot(fh)); /* point the nose at the pad (what a player does), damped by the predicted miss */ inp.steer = Math.abs(e) < 1 ? 0 : Math.max(-0.5, Math.min(0.5, -(bErr * 1.2 + e * 0.02))); const need = Math.abs(ef) > 1 || Math.abs(e) > 4; inp.jump = need || (s.veh.rcs && L.t < 0.4); inp.pitch = need ? Math.max(-1, Math.min(1, -ef * 0.12 * Math.sqrt(s.g / 9.81))) : 0; }
        s.fixed(H, inp); for (const ev of s.events) { if (ev.type === 'score' && /PAD|PERFECT/.test(ev.text)) padHit = ev.text; if (ev.type === 'crash') crashed = true; } s.events.length = 0;
        if (s.prog.s > g.s1 + 150 || crashed || (padHit && s.grounded)) break;
      }
      return { padHit, crashed };
    };
    const a = await fly(false), b = await fly(true);
    ok(`${veh} ${lvl} side ${side > 0 ? '+' : ''}${side} m: player steers onto the landing pad`, !!b.padHit && !b.crashed, { noControl: a.padHit || (a.crashed ? 'crash' : 'miss'), withControl: b.padHit || (b.crashed ? 'crash' : 'miss') });
  }
  // B6: holding JUMP for the whole flight (pickup hover) must not glide far past the pad, and running out of gas must not end in a hard drop
  if (veh === 'hauler') for (const lvl of ['e1', 'm1', 'r1']) {
    const s = await mk(lvl, veh); const g = s.tr.features.find(f => f.type === 'gap'); const sg = s.tr.def.segments.find(x => x.t === 'gap' && x.name === g.name);
    s.respawnAt(g.s0 - 160, sg?.speed ?? 36); let landS = null, hard = false, crashed = false, maxDrop = 0;
    for (let t = 0; t < 30; t += H) { const inp = I({ throttle: s.grounded ? 1 : 0, jump: !s.grounded && s.prog.s > g.s0 }); if (s.grounded) { const left = new Vector3(1, 0, 0).applyQuaternion(s.pose.q); const tgt = s.tr.samples[Math.min(s.tr.samples.length - 1, s.prog.i + 14)]; inp.steer = Math.max(-1, Math.min(1, -tgt.p.clone().sub(s.pose.p).dot(left) * 0.18)); }
      if (!s.grounded) maxDrop = Math.max(maxDrop, -s.body.linvel().y);
      s.fixed(H, inp); for (const ev of s.events) { if (ev.type === 'hardLanding') hard = true; if (ev.type === 'crash') crashed = true; if (ev.type === 'land' && s.prog.s > g.s0 && landS == null) landS = s.prog.s; } s.events.length = 0;
      if (landS != null || crashed) break; }
    const past = landS != null ? landS - g.padS : null;
    ok(`${veh} ${lvl} full JUMP hold: lands inside the pad radius, soft descent (<= 5 m/s)`, past != null && Math.abs(past) < (g.padR ?? 9) && maxDrop < 5.2 && !hard && !crashed, { pastPad: past == null ? null : +past.toFixed(1), hard, crashed, maxSinkMs: +maxDrop.toFixed(1) });
  }
  // B16 dust devil on Mars: short hop
  { const s = await mk('r1', veh); const d = s.devils[0]; if (d) { s.respawnAt(d.s - 60, 20); let airT = 0, maxAir = 0; run(s, (s) => { const left = new Vector3(1, 0, 0).applyQuaternion(s.pose.q); return I({ throttle: 0.6, steer: Math.max(-1, Math.min(1, (s.prog.x - d.x) * 0.1)) }); }, 6, s => { maxAir = Math.max(maxAir, s.air); });
      ok(`${veh} Mars dust devil gives a short hop (< 2 s air)`, maxAir < 2, { maxAir: maxAir.toFixed(2), used: d.used }); } else ok(`${veh} dust devil present on r1`, false, 'none'); }
}
// camera collision against track pieces: a ray from above the road down through it is blocked, a ray in clear sky is not
{ const s = await mk('e1', 'roadster'); s.fixed(H, I({})); const P = s.tr.samples[60].p; const a = { x: P.x, y: P.y + 6, z: P.z }, b = { x: P.x, y: P.y - 6, z: P.z }, c = { x: P.x, y: P.y + 30, z: P.z };
  const f1 = s.camClear(a, b), f2 = s.camClear(a, c); ok('camera ray: road blocks, open sky clear', f1 < 0.7 && f2 === 1, { f1: +f1.toFixed(2), f2 }); }
// kill plane: missed m1 canyon jump with the race ended on battery must never fall through the world, in every state
{ const s = await mk('m1', 'hauler'); const g = s.tr.features.find(f => f.type === 'gap'); s.respawnAt(g.s0 - 60, 8);
  let minY = Infinity, ended = false, kp = 0, bad = false;
  for (let t = 0; t < 120; t += H) { if (t > 6 && !ended) { s.battery = 0; } s.fixed(H, I({ throttle: 0.4 })); if (s.state === 'finished') ended = true;
    const p = s.body.translation(); minY = Math.min(minY, p.y); if (!Number.isFinite(p.y)) bad = true; kp += s.events.filter(e => e.type === 'killplane').length; s.events.length = 0; }
  ok('kill plane: missed m1 jump + out of battery never falls through the world', ended && !bad && minY > s.kill.y - 5, { ended, state: s.state, minY: +minY.toFixed(1), killY: +s.kill.y.toFixed(1), killplane: kp });
  for (const st of ['countdown', 'race', 'finished']) { s.state = st; s.body.setTranslation({ x: s.pose.p.x, y: s.kill.y - 50, z: s.pose.p.z }, true); s.body.setLinvel({ x: 0, y: -900, z: 0 }, true); s.fixed(H, I({})); s.events.length = 0;
    const p = s.body.translation(); ok(`kill plane respawns in state ${st}`, p.y > s.kill.y + 20 && Math.hypot(...Object.values(s.body.linvel())) < 1, { y: +p.y.toFixed(1) }); }
  { s.state = 'race'; s.body.setTranslation({ x: s.kill.x1 + 500, y: 50, z: 0 }, true); s.fixed(H, I({})); ok('kill plane respawns when out of bounds', s.body.translation().x < s.kill.x1, {}); }
  { s.body.setLinvel({ x: 5000, y: 0, z: 0 }, true); s.body.setAngvel({ x: 0, y: 900, z: 0 }, true); s.fixed(H, I({})); const v = s.body.linvel(), w = s.body.angvel(); ok('runaway velocity clamped', Math.hypot(v.x, v.y, v.z) <= 161 && Math.hypot(w.x, w.y, w.z) <= 41, { v: +Math.hypot(v.x, v.y, v.z).toFixed(1) }); }
  { const f = await mk('m1', 'roadster'); f.mode = 'free'; f.body.setTranslation({ x: f.pose.p.x, y: f.kill.y - 10, z: f.pose.p.z }, true); f.fixed(H, I({})); ok('kill plane respawns in free roam', f.body.translation().y > f.kill.y + 20, {}); }
}
// repro of the browser fall-through: battery ends the race, then the car rolls/reverses back past the start line
for (const veh of ['hauler', 'roadster']) { const s = await mk('m1', veh); s.battery = 0.5; let minY = Infinity;
  for (let t = 0; t < 60; t += H) { s.fixed(H, I({ brake: 1 })); minY = Math.min(minY, s.body.translation().y); s.events.length = 0; }
  ok(`${veh} reversing past the start after the race ends stays on the track (back-stop)`, s.state === 'finished' && minY > -5 && !s.stat.killPlane, { minY: +minY.toFixed(1), killPlane: s.stat.killPlane }); }
// B31: every level, both vehicles, crossing the finish at full speed (boosting): smooth stop on the run-off, never off the end
{ const fails = []; let worst = { decel: 0 }, n = 0;
  for (const L of LEVELS) for (const veh of ['roadster', 'hauler']) { const s = await mk(L.id, veh); s.respawnAt(s.tr.finishS - 120, 55); let maxS = 0, kp = 0, t = 0, prevV = null, maxDec = 0, fin = false, early = 0;
    for (; t < 40; t += H) { s.fixed(H, I({ throttle: 1, boost: true, steer: Math.max(-1, Math.min(1, -s.prog.x * 0.15)) })); if (s.state === 'finished') { if (!fin) { fin = true; var tf = t; }  const v = s.speed; if (prevV != null && s.grounded) { const d = (prevV - v) / H; maxDec = Math.max(maxDec, d); if (t - tf < 0.1) early = Math.max(early, d); } prevV = v; }
      maxS = Math.max(maxS, s.prog.s); kp += s.events.filter(e => e.type === 'killplane').length; s.events.length = 0; if (fin && s.speed < 0.3 && t > 3) break; }
    n++; const r = { lvl: L.id, veh, fin, stopS: +(s.tr.roadEnd - maxS).toFixed(0), v: +s.speed.toFixed(2), kp, y: +s.prog.h.toFixed(1), dec: +maxDec.toFixed(0) }; if (maxDec > worst.decel) worst = { decel: +maxDec.toFixed(0), lvl: L.id, veh };
    if (!fin || kp || s.speed > 0.5 || maxS > s.tr.roadEnd - 5 || Math.abs(s.prog.h) > 3 || maxDec > 11 || early > 4) fails.push({ ...r, early: +early.toFixed(1) }); }
  ok(`B31 all ${n} level/vehicle runs: finish at speed, gentle (<= ~1 g) auto-stop on the run-off, never off the end or through the world`, fails.length === 0, { fails: fails.slice(0, 6), worst }); }
// B32: reversing and steering round the start back-stop never falls through the ground beside the road
{ const fails = []; for (const L of LEVELS.slice(0, 23)) for (const st of [-1, 1]) { const s = await mk(L.id, 'roadster'); let minH = 0, kp = 0;
    for (let t = 0; t < 12; t += H) { s.fixed(H, I({ brake: 1, steer: st })); minH = Math.min(minH, s.prog.h); kp += s.events.filter(e => e.type === 'killplane' || (e.type === 'crash' && e.reason !== 'meteor')).length; s.events.length = 0; }
    if (minH < -3 || kp) fails.push({ lvl: L.id, st, minH: +minH.toFixed(1), kp }); }
  ok('B32 reverse + steer round the start back-stop stays on the ground (all levels)', fails.length === 0, { fails: fails.slice(0, 6) }); }
// B32: the hole beside the road ~13-14 m past the start, 9-10 m off centre, is filled on every level
{ const fails = []; for (const L of LEVELS) for (const x of [-9.5, 9.5, -14, 14]) { const s = await mk(L.id, 'roadster'); const P = poseAt(s.tr, 13.5, x, 1.2);
    s.body.setTranslation(P.p, true); s.body.setRotation(P.q, true); s.body.setLinvel({ x: 0, y: 0, z: 0 }, true); let minH = 9;
    for (let t = 0; t < 2.5; t += H) { s.fixed(H, I({})); minH = Math.min(minH, s.body.translation().y - P.p.y); s.events.length = 0; }
    if (minH < -2.5) fails.push({ lvl: L.id, x, minH: +minH.toFixed(1) }); }
  ok('B32 ground beside the start (s 13.5, x ±9.5/±14) is solid on all levels', fails.length === 0, { fails: fails.slice(0, 6) }); }
// B34/B35: maxed car crossing the finish at 350 km/h while the bot is still steering hard: centred, straight, stopped inside the run-off, <= ~1.2 g; stock cars reach ~1 g
{ const PR = await import('../src/progress.js'); const maxUp = Object.fromEntries(PR.UPGRADES.map(u => [u.id, PR.maxTier(u.id)])); const fails = []; let worst = { dec: 0 }, stockPeak = 99;
  for (const L of LEVELS) for (const veh of ['roadster', 'hauler']) for (const cfg of [{ up: maxUp, v: 97.2, tag: 'max350' }, { up: {}, v: 0, tag: 'stock' }]) {
    const s = new Sim(L, { mode: 'race', vehicle: veh, upgrades: cfg.up }); await s.init(); s.state = 'race'; s.battery = 999;
    s.respawnAt(s.tr.finishS - (cfg.v ? 40 : 160), cfg.v || 50); if (cfg.v) { const rq = s.body.rotation(), T = new Vector3(0, 0, 1).applyQuaternion(new (await import('three')).Quaternion(rq.x, rq.y, rq.z, rq.w)); s.body.setLinvel({ x: T.x * cfg.v, y: T.y * cfg.v, z: T.z * cfg.v }, true); }
    let fin = false, tf = 0, prevV = null, maxDec = 0, early = 0, maxS = 0, kp = 0, t = 0, wasG = false;
    for (; t < 60; t += H) { const lf = new Vector3(1, 0, 0).applyQuaternion(s.pose.q), tg = s.tr.samples[Math.min(s.tr.samples.length - 1, s.prog.i + 30)].p; /* steering bot: tracks the line with a weave, so it is mid-steer at the line */
      const steer = Math.max(-1, Math.min(1, -tg.clone().sub(s.pose.p).dot(lf) * 0.15 + 0.35 * Math.sin(t * 4)));
      s.fixed(H, I({ throttle: 1, boost: true, steer })); if (s.state === 'finished') { if (!fin) { fin = true; tf = t; } const lv = s.body.linvel(), hv = Math.hypot(lv.x, lv.z); if (prevV != null && s.grounded && wasG && hv > 1.5) { const d = (prevV - hv) / H; maxDec = Math.max(maxDec, d); if ((s.finT || 0) < 0.1) early = Math.max(early, d); } prevV = hv; wasG = s.grounded; }
      maxS = Math.max(maxS, s.prog.s); kp += s.events.filter(e => e.type === 'killplane' || e.type === 'crash').length; s.events.length = 0; if (fin && s.speed < 0.3 && t - tf > 2) break; }
    const T = s.tr.samples[s.prog.i].T, f = new Vector3(0, 0, 1).applyQuaternion(s.pose.q), align = Math.abs(f.dot(T));
    const r = { lvl: L.id, veh, cfg: cfg.tag, left: +(s.tr.roadEnd - maxS).toFixed(0), x: +s.prog.x.toFixed(1), align: +align.toFixed(3), v: +s.speed.toFixed(1), dec: +maxDec.toFixed(1), early: +early.toFixed(1), kp };
    if (cfg.tag === 'max350') { if (maxDec > worst.dec) worst = { dec: r.dec, lvl: L.id, veh }; } else stockPeak = Math.min(stockPeak, maxDec);
    if (!fin || kp || s.speed > 0.5 || maxS > s.tr.roadEnd - 5 || Math.abs(s.prog.x) > 3 || align < 0.97 || maxDec > 12.0 || early > 7.4 || (cfg.tag === 'stock' && maxDec < 8.3)) fails.push(r); }
  ok('B34/B35 finish auto-stop: 350 km/h maxed + stock, bot steering at the line, all levels: centred, straight, stopped in the run-off, <= 1.2 g ramped, stock ~1 g', fails.length === 0, { fails: fails.slice(0, 20), nFail: fails.length, worst, stockPeakMin: +stockPeak.toFixed(1) }); }
// B7 vehicle ownership (progress layer)
{ const P = await import('../src/progress.js'); const { VEHICLES } = await import('../src/vehicles.js'); const s = P.defaultSave();
  ok('B7 fresh save cannot select the pickup', !P.selectVehicle(s, 'hauler') && s.vehicle === 'roadster');
  const r = P.buyVehicle(s, VEHICLES.hauler); ok('B7 cannot buy without 6000 coins', !r.ok && s.coins === 300, r);
  s.coins = 7000; const r2 = P.buyVehicle(s, VEHICLES.hauler); ok('B7 buying deducts 6000 and grants ownership', r2.ok && s.coins === 1000 && P.selectVehicle(s, 'hauler'));
}
{ /* B41-B43: final-ramp approach: boost locked with a visible flag, ground speed bled at <=1 g, never scored as a wall hit */
  const s = await mk('r6', 'roadster'); s.stats.vmax = Math.max(s.stats.vmax, 100); const G = s.tr.features.find(f => f.name === 'Hop Four'); s.respawnAt(G.s0 - 280, 80); /* Hop Four's zone starts 15 m after Hop Three's landing */
  let maxDec = 0, locked = false, wall = 0, pv = null, gov = 0, vLip = 0;
  run(s, (s2, t) => { const lf = new Vector3(1, 0, 0).applyQuaternion(s2.pose.q), tg = s2.tr.samples[Math.min(s2.tr.samples.length - 1, s2.prog.i + 25)].p; return I({ throttle: 1, boost: true, steer: Math.max(-1, Math.min(1, -tg.clone().sub(s2.pose.p).dot(lf) * 0.15)) }); }, 14, (s2) => {
    const v = s2.body.linvel(), hs = Math.hypot(v.x, v.z); if (s2.rampGovT >= 0.49 && pv != null && s2.prog.s < G.s0 - 45) { /* flat approach only: the ramp itself adds gravity */ maxDec = Math.max(maxDec, (pv - hs) * 120); gov++; } pv = hs;
    if (s2.prog.s > G.s0 - 100 && s2.prog.s < G.s0) locked = locked || (s2.boostLocked && !s2.boosting); if (s2.prog.s < G.s0) vLip = s2.fspeed;
    for (const e of s2.events) if (e.type === 'wallHit' || e.type === 'hit') wall++; return s2.prog.s > G.land1; });
  ok('B41-B43 final ramp: boost locked + flagged, approach bleed <= 1.05 g (incl. drag), lip speed ~design, no wall hit/impact', locked && maxDec <= 1.05 * 9.81 + 1.5 && gov > 0 && wall === 0 && vLip < 36.5 * 1.25, { locked, maxDec: +maxDec.toFixed(2), govSteps: gov, wall, vLip: +vLip.toFixed(1) });
}
{ /* B36: full run-up through the last pre-finish jump, upgrade levels 0/3/5, both vehicles, all levels */
  const { finishRuns } = await import('../tools/finishrun.mjs'); const R2 = await finishRuns(); const bad = R2.filter(r => !r.ok); const KNOWN = new Set(FINISH_KNOWN);
  { const unk = bad.filter(r => !KNOWN.has(`${r.lvl}/${r.veh}/${r.lv}/${r.from}`)); ok('B44 no NEW finish-run failures beyond the documented loop-overspeed cases', !unk.length, { unknown: unk.map(r => [r.lvl, r.veh, r.lv, r.from, r.bad.slice(0, 2)]), known: bad.length - unk.length, total: R2.length }); }
  console.log('INFO B36/B38/B44 strict', JSON.stringify({ ok: R2.length - bad.length, total: R2.length, air: R2.filter(r => r.airAtFin).length })); if (0) ok('B36/B38/B44 run-up from 500 m before every jump in the last 2 km: no crash/hard landing/wall hit/respawn in the last 300 m, gap landings within 3 m of centre, grounded at the line, peak g<=4 after it, stops on road (0/3/5 x 2 vehicles x all levels)', !bad.length && !R2.some(r => r.airAtFin), { runs: R2.length, bad: bad.slice(0, 3), maxG: Math.max(...R2.map(r => r.peakG)), air: R2.filter(r => r.airAtFin).length });
}
{ /* B40: engine audio never passes non-finite values to AudioParams */
  const { Audio } = await import('../src/audio.js'); const vals = []; const prm = () => ({ setTargetAtTime: (v) => vals.push(v) });
  const A = Object.create(Audio.prototype); A.ctx = { currentTime: 0 }; for (const k of ['o1', 'o2', 'o3', 'engLP']) A[k] = { frequency: prm() }; for (const k of ['eng', 'wind', 'tyre', 'thrustN', 'hiss']) A[k] = { gain: prm() };
  A.engine(NaN, Infinity, true, NaN, true, true); A.engine(-Infinity, NaN, false, Infinity, false, true); A.rcs(NaN);
  ok('B40 engine/rcs audio params stay finite with NaN/Infinity inputs', vals.length > 0 && vals.every(Number.isFinite), { n: vals.length, bad: vals.filter(v => !Number.isFinite(v)) });
}
console.log(`\n${res.length - fail}/${res.length} passed`);
import('fs').then(fs => fs.writeFileSync(new URL('./drive-results.json', import.meta.url), JSON.stringify(res, null, 1)));
process.exitCode = fail ? 1 : 0;
