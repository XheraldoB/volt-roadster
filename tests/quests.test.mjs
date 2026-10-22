// Bonus quest types (fragile, speedtrap, statGoal): engine rules + selection. usage: node tests/quests.test.mjs
import { Sim, initPhysics } from '../src/sim.js';
import { LEVELS, levelById } from '../src/levels.js';
import * as P from '../src/progress.js';
import { writeFileSync } from 'fs';
await initPhysics();
const R = []; const ok = (id, pass, info = {}) => { R.push({ id, pass, info }); console.log(`${pass ? 'PASS' : 'FAIL'} ${id} ${JSON.stringify(info)}`); };
const step = (s, n, inp) => { for (let i = 0; i < n; i++) s.update(1 / 60, inp); };
const mk = async (id, quest) => { const s = new Sim(levelById(id), { mode: 'race', quest }); await s.init(); s.state = 'race'; return s; };
const inp0 = { throttle: 0, brake: 0, steer: 0, boost: false, jump: false, handbrake: false, pitch: 0 };
// selection
const sv = P.defaultSave(); const e2 = levelById('e2');
ok('bonus quests attached to 6 levels', LEVELS.filter(l => l.bonus).length === 6, { ids: LEVELS.filter(l => l.bonus).map(l => l.id + ':' + l.bonus.type) });
ok('main quest first', !P.activeQuest(sv, e2).bonus);
sv.levels.e2 = { stars: 1, questDone: true }; ok('bonus quest once main quest done', P.activeQuest(sv, e2).type === 'fragile');
sv.levels.e2.bonusDone = true; ok('back to main quest after bonus cleared', !P.activeQuest(sv, e2).bonus);
// fragile
{ const s = await mk('e2', { ...e2.bonus, bonus: true }); step(s, 30, inp0); ok('fragile: active from start', s.quest.active && !s.quest.failed);
  s.stat.hardLandings = 1; step(s, 2, inp0); ok('fragile: a hard landing fails it', s.quest.failed); }
{ const s = await mk('e2', { ...e2.bonus, bonus: true }); step(s, 2, inp0); s.prog.s = s.tr.finishS - 10; s.questRules(1 / 60, null); ok('fragile: intact at the finish completes', s.quest.done); }
// speedtrap
const e6 = levelById('e6');
{ const s = await mk('e6', { ...e6.bonus, bonus: true }); const cam = s.questItems[0]; ok('speedtrap: camera placed', cam && cam.kind === 'camera', { s: cam && Math.round(cam.s) });
  s.prog.s = cam.s + 1; s.speed = 20; s.questRules(1 / 60, null); ok('speedtrap: slow pass fails', s.quest.failed); }
{ const s = await mk('e6', { ...e6.bonus, bonus: true }); const cam = s.questItems[0]; s.prog.s = cam.s + 1; s.speed = e6.bonus.speed + 1; s.questRules(1 / 60, null); ok('speedtrap: fast pass completes', s.quest.done); }
// statGoal
{ const s = await mk('e5', { ...levelById('e5').bonus, bonus: true }); s.stat.carJumps = 2; s.questRules(1 / 60, null); ok('statGoal: progress counts', s.quest.progress === 2 && !s.quest.done); s.stat.carJumps = 3; s.questRules(1 / 60, null); ok('statGoal: completes at value', s.quest.done); }
{ const b = levelById('r4').bonus; const s = await mk('r4', { ...b, bonus: true }); s.raceTime = 1; s.stat.flips = 1; s.questRules(1 / 60, null); s.raceTime = 50; s.stat.rolls = 1; s.questRules(1 / 60, null);
  ok('statGoal window: tricks 49 s apart do not count together', !s.quest.done && s.quest.progress === 1); s.raceTime = 60; s.stat.flips = 2; s.questRules(1 / 60, null); ok('statGoal window: 2 within 40 s completes', s.quest.done); }
{ const b = levelById('m1').bonus; const s = await mk('m1', { ...b, bonus: true }); s.stat.maxAir = b.value + 0.1; s.questRules(1 / 60, null); ok('statGoal maxAir completes', s.quest.done); }
// feasibility: the autopilot reaches the speedtrap speed on e6 (camera spot) and the airtime on m1
writeFileSync('tests/quests-results.json', JSON.stringify(R, null, 1)); console.log(`${R.filter(r => r.pass).length}/${R.length} passed`); process.exit(R.every(r => r.pass) ? 0 : 1);
