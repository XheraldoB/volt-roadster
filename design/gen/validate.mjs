// Validates every design/*.json parses and re-checks physics numerically (independent of the closed forms).
import { readFileSync, readdirSync } from 'fs';
const DIR = new URL('../', import.meta.url).pathname;
let bad = 0;
for (const f of readdirSync(DIR).filter(f => f.endsWith('.json'))) { try { JSON.parse(readFileSync(DIR + f, 'utf8')); console.log('OK  ', f); } catch (e) { bad++; console.log('FAIL', f, e.message); } }
// numeric projectile: does a car at minTakeoffSpeed land at (gapLength, -drop)? and does 0.97*v fall short?
let worst = 0, worstLoop = 0, n = 0;
for (const p of ['earth', 'moon', 'mars']) {
  const doc = JSON.parse(readFileSync(DIR + `levels.${p}.json`, 'utf8'));
  for (const l of doc.levels) {
    if (l.gravity !== doc.gravity) { bad++; console.log('gravity mismatch', l.id); }
    for (const j of l.jumps) {
      const fly = v => { const a = j.ramp.angleDeg * Math.PI / 180; let x = 0, y = 0, vx = v * Math.cos(a), vy = v * Math.sin(a); const dt = 1e-4; while (y > -j.drop || vy > 0) { vy -= l.gravity * dt; x += vx * dt; y += vy * dt; } return x; };
      const x = fly(j.minTakeoffSpeed), err = Math.abs(x - j.gapLength) / j.gapLength; worst = Math.max(worst, err); n++;
      if (err > 0.01) { bad++; console.log('GAP MISMATCH', l.id, j.name, x.toFixed(1), j.gapLength); }
      if (fly(j.minTakeoffSpeed * 0.97) >= j.gapLength) { bad++; console.log('97% speed still clears?', l.id, j.name); }
      if (!(j.minTakeoffSpeed < j.padSpeed && j.padSpeed < j.overshootSpeed)) { bad++; console.log('speed window order', l.id, j.name); }
    }
    for (const lp of l.loops) {
      const e = Math.abs(lp.minEntrySpeed - Math.sqrt(5 * l.gravity * lp.radius)), t = Math.abs(lp.minTopSpeed - Math.sqrt(l.gravity * lp.radius));
      // energy check: v_top^2 = v_entry^2 - 2 g (2r)
      const vt = Math.sqrt(lp.minEntrySpeed ** 2 - 4 * l.gravity * lp.radius);
      worstLoop = Math.max(worstLoop, e, t, Math.abs(vt - lp.minTopSpeed));
      if (worstLoop > 0.15) { bad++; console.log('LOOP', l.id, lp.name); }
    }
  }
}
console.log(`gaps checked: ${n}, worst relative range error ${(worst * 100).toFixed(2)}%, worst loop error ${worstLoop.toFixed(3)} m/s`);
const lv = ['earth', 'moon', 'mars'].map(p => JSON.parse(readFileSync(DIR + `levels.${p}.json`, 'utf8')).levels.length);
console.log('levels per planet', lv, 'side quests', JSON.parse(readFileSync(DIR + 'side_quests.json')).quests.length, 'dailies', JSON.parse(readFileSync(DIR + 'daily_challenges.json')).pool.length);
process.exit(bad ? 1 : 0);
