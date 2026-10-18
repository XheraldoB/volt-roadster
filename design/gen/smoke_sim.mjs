// Loads every spec level into the engine's Sim (read-only import of src/) and drives 20 s at full throttle.
import { readFileSync } from 'fs';
import { Sim } from '../../src/sim.js';
const DIR = new URL('../', import.meta.url).pathname;
for (const p of ['earth', 'moon', 'mars']) for (const l of JSON.parse(readFileSync(DIR + `levels.${p}.json`, 'utf8')).levels) {
  const def = { id: l.id, planet: l.planet, name: l.name, env: l.env, diff: l.diff, storm: l.storm, startY: l.startY, quest: l.quest, segments: JSON.parse(JSON.stringify(l.segments)) };
  try {
    const s = await new Sim(def, { mode: l.objective.simMode }).init();
    let maxS = 0; for (let i = 0; i < 20 * 60; i++) { s.update(1 / 60, { throttle: 1 }); maxS = Math.max(maxS, s.prog.s); }
    console.log(l.id.padEnd(3), 'ok  len', s.tr.length.toFixed(0), 'cps', s.tr.checkpoints.length, 'reached s', maxS.toFixed(0), 'crashes', s.stat.crashes, 'state', s.state, 'ai', s.ai.length);
    s.dispose();
  } catch (e) { console.log(l.id, 'FAIL', e.message); }
}
