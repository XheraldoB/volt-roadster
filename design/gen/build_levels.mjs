// Volt Roadster level-spec generator (Level Designer). READ-ONLY use of src/: imports the
// engine's own buildTrack so every length / gap width / checkpoint below is what the game builds.
// Run: node design/gen/build_levels.mjs  -> writes design/levels.{earth,moon,mars}.json
import { writeFileSync } from 'fs';
import { buildTrack, poseAt, sampleAt, ROAD_W } from '../../src/track.js';
import { LEVELS as ENGINE_LEVELS, PLANETS } from '../../src/levels.js';

const OUT = new URL('../', import.meta.url).pathname;
const D2R = Math.PI / 180;
const r1 = x => Math.round(x * 10) / 10, r2 = x => Math.round(x * 100) / 100;
const clone = o => JSON.parse(JSON.stringify(o));

// ---- same segment helpers as src/levels.js (identical output objects) ----
const S = (len, o = {}) => ({ t: 'straight', len, ...o });
const T = (ang, len, bank = 0) => ({ t: 'turn', ang, len, bank });
const W = (ang, len) => ({ t: 'wall', ang, len });
const L = (r, name, shift) => (shift === undefined ? { t: 'loop', r, name } : { t: 'loop', r, name, shift });
const C = (len, turns = 1, dir = 1, h = 10) => ({ t: 'cork', len, turns, dir, h });
const H = (len, h) => ({ t: 'hill', len, h });
const B = (len, h) => ({ t: 'bump', len, h });
const J = (ang, speed, o = {}) => [{ t: 'straight', len: 50 }, { t: 'ramp', len: o.rampLen ?? 34, ang }, { t: 'gap', speed, ang, ...o }];

// Min takeoff speed to clear a horizontal gap x (m) leaving a lip at angle a, landing `drop` m lower:
//   y(x) = x tan a - g x^2 / (2 v^2 cos^2 a) = -drop  =>  v_min = sqrt( g x^2 / (2 cos^2 a (x tan a + drop)) )
export const vMinFor = (g, x, angDeg, drop = 3) => { const a = angDeg * D2R, c = Math.cos(a); return Math.sqrt(g * x * x / (2 * c * c * (x * Math.tan(a) + drop))); };
// Horizontal range at speed v (inverse of the above; this is exactly what track.js computes for sg.len)
export const rangeFor = (g, v, angDeg, drop = 3) => { const a = angDeg * D2R, ca = Math.cos(a), ta = Math.tan(a), k = g / (2 * v * v * ca * ca); return (ta + Math.sqrt(ta * ta + 4 * k * drop)) / (2 * k); };
// JW: design a jump by gap WIDTH; speed field = v_min rounded up to 0.1 m/s (track.js then rebuilds len from it).
const JW = g => (ang, width, o = {}) => {
  const drop = o.drop ?? 3; const v = Math.ceil(vMinFor(g, width, ang, drop) * 10) / 10;
  const land = o.land ?? Math.round(Math.min(240, Math.max(90, width * 0.8)));
  return J(ang, v, { ...o, land, designWidth: width });
};

// ---------------- level definitions ----------------
// Existing engine levels (e1-e4, m1-m3, r1-r3) keep their segments VERBATIM so Game Maker's tuning/tests hold.
const G = { earth: 9.81, moon: 1.62, mars: 3.71 };
const je = JW(G.earth), jm = JW(G.moon), jr = JW(G.mars);

const NEW = {
  // ---------- EARTH ----------
  e5: { planet: 'earth', name: 'Rush Hour Hop', env: 'afternoon', diff: 3,
    blurb: 'Six lanes of gridlock. Use the kickers and fly over the commuters.',
    quest: { type: 'collect', item: 'suitcase', name: 'Lost Luggage', text: 'Collect 6 suitcases that fell off a roof rack', count: 6, reward: 400 },
    segments: [S(140), S(380, { traffic: 8, kickers: 3 }), T(30, 220, 6), ...je(12, 70, { name: 'Overpass Gap', padR: 8 }), S(60),
      S(340, { traffic: 9, kickers: 4 }), L(24, 'Interchange Loop'), S(100), T(-35, 220, 6), B(120, 6), S(300, { traffic: 10, kickers: 4 }), T(25, 200), S(120)] },
  e6: { planet: 'earth', name: 'Gigaloop Gauntlet', env: 'night', diff: 4,
    blurb: 'Seven loops, a corkscrew and the 32 m Gigaloop. Keep your speed up.',
    quest: { type: 'ring', name: 'Hoop Dreams', text: 'Fly through the flaming hoop above the Loop Launcher', reward: 450 },
    segments: [S(150), L(22, 'Roadster Loop'), S(60), L(24, 'Twin Loop A'), S(30), L(24, 'Twin Loop B', -26), S(120), T(40, 240, 8), C(220, 1, 1, 0), S(80),
      ...je(15, 80, { name: 'Loop Launcher', ring: true, padR: 8 }), S(60), L(28, 'Tower Loop'), S(40), L(28, 'Tower Loop II', -30), S(100), W(-110, 240), S(80), L(32, 'Gigaloop'), S(160)] },
  e7: { planet: 'earth', name: 'Bridge Out', env: 'sunset', diff: 4,
    blurb: 'The coast bridge is in pieces. Four jumps, four shrinking landing pads.',
    quest: { type: 'pizza', name: 'Lighthouse Pizza', text: 'The lighthouse keeper ordered a large pepperoni. Deliver it hot', time: 40, reward: 450 },
    segments: [S(160), T(25, 220, 6), ...je(14, 60, { name: 'Pier One', padR: 8 }), S(60), H(160, 16), ...je(16, 80, { name: 'Pier Two', padR: 7 }), S(60), T(-40, 240, 8),
      S(200, { traffic: 5, kickers: 2 }), ...je(10, 70, { cliff: true, drop: 20, name: 'Seawall Drop', padR: 6 }), S(60), L(26, 'Lighthouse Loop'), S(80),
      ...je(18, 100, { name: 'Broken Span', padR: 5 }), S(160)] },
  e8: { planet: 'earth', name: 'Grand Canyon Finale', env: 'day', diff: 5,
    blurb: 'Rim drop, river crossing, skywalk leap and the Roadster Finale Loop. Win it.',
    quest: { type: 'cow', skin: 'robot', name: 'Runaway Robot', text: 'Catch B0LT, the delivery robot that ran off with your charger cable', reward: 550 },
    segments: [S(150), H(200, 24), ...je(12, 90, { cliff: true, drop: 30, name: 'Rim Drop' }), S(60), T(45, 260, 8), ...je(16, 110, { name: 'Colorado Crossing', padR: 7 }), S(60),
      S(320, { traffic: 7, kickers: 3 }), W(110, 250), S(80), L(30, 'Canyon Mega Loop'), S(80), C(440, 2, -1, 0), S(60), ...je(20, 120, { name: 'Skywalk Leap', padR: 6 }), S(80),
      T(-30, 220), L(22, 'Roadster Finale Loop'), S(180)] },
  // ---------- MOON ----------
  m4: { planet: 'moon', name: 'Shackleton Rim', env: 'moonnight', diff: 3,
    blurb: 'South pole crater rims, permanent shadow and pads the size of a parking space.',
    quest: { type: 'deliver', item: 'ice', name: 'Polar Ice Run', text: 'Haul a block of crater ice to the base before the sun melts it', time: 55, reward: 450 },
    segments: [S(160), T(30, 240, 6), ...jm(10, 180, { name: 'Rim Hop', padR: 8 }), S(80), B(160, 10), ...jm(8, 220, { name: 'Permanent Shadow', padR: 7 }), S(60),
      L(24, 'Polar Loop'), S(120), T(-40, 260, 6), ...jm(12, 260, { name: 'Peak of Eternal Light', padR: 6 }), S(160)] },
  m5: { planet: 'moon', name: 'Marius Pits', env: 'moon', diff: 4,
    blurb: 'Bottomless lava-tube skylights. Grab the core samples hovering over the holes.',
    quest: { type: 'collect', item: 'core', name: 'Core Sampler', text: 'Collect 6 glowing core samples (NOT for eating)', count: 6, reward: 500 },
    segments: [S(150), ...jm(6, 150, { name: 'Skylight #1' }), S(40), T(-40, 260, 8), ...jm(9, 200, { name: 'Skylight #2', padR: 7 }), S(60), C(220, 1, 1, 0), S(80),
      ...jm(7, 180, { name: 'Skylight #3', padR: 7 }), S(60), W(100, 240), S(60), L(26, 'Tube Loop'), S(60), ...jm(11, 240, { name: 'The Big Skylight', padR: 6 }), S(160)] },
  m6: { planet: 'moon', name: 'Hadley Rille Run', env: 'moon', diff: 4,
    blurb: 'Race down a winding lunar rille. Overtake the slow rover convoy.',
    quest: { type: 'rover', skin: 'moonbuggy', name: 'Buggy Selfie', text: 'Stop next to the abandoned moon buggy for a 2 second selfie', reward: 450 },
    segments: [S(150), H(200, 20), ...jm(5, 160, { cliff: true, drop: 30, name: 'Rille Drop' }), S(60), T(40, 260, 8), S(300, { traffic: 4, kickers: 2, skin: 'rover' }),
      W(-110, 240), S(80), L(26, 'Rille Loop'), S(80), ...jm(10, 240, { name: 'Rille Crossing', padR: 7 }), S(60), T(-35, 240, 6), C(220, 1, -1, 0), S(160)] },
  m7: { planet: 'moon', name: 'Earthrise Megajump', env: 'moonnight', diff: 5,
    blurb: 'The longest jump in the game: 11 seconds of air with Earth rising over the horizon.',
    quest: { type: 'ring', name: 'Earthrise Hoop', text: 'Thread the giant hoop at the apex of the Earthrise jump', reward: 550 },
    segments: [S(200), L(26, 'Gravity Well Loop'), S(60), ...jm(14, 380, { name: 'Earthrise', ring: true, padR: 7 }), S(80), C(440, 2, 1, 0), S(60),
      ...jm(10, 300, { name: 'Tycho Tumble', padR: 6 }), S(40), W(110, 240), S(80), L(30, 'Apollo Loop'), S(40), L(30, 'Apollo Loop II', -32), S(200)] },
  // ---------- MARS ----------
  r4: { planet: 'mars', name: 'Noctis Labyrinth', env: 'mars', diff: 3, storm: 0.3,
    blurb: 'A maze of collapsed canyons. Light dust, tight turns, two rim jumps.',
    quest: { type: 'collect', item: 'antenna', name: 'Antenna Bits', text: 'Collect 6 pieces of a lander antenna (some assembly required)', count: 6, reward: 400 },
    segments: [S(150), T(45, 220, 8), T(-50, 220, 8), ...jr(12, 120, { name: 'Labyrinth Gap', padR: 8 }), S(60), T(60, 260, 10), W(-100, 230), S(60), L(24, 'Maze Loop'), S(80),
      T(-40, 220, 6), ...jr(10, 140, { name: 'Noctis Notch', padR: 7 }), S(60), T(35, 200, 6), S(160)] },
  r5: { planet: 'mars', name: 'Dust Devil Derby', env: 'marsstorm', diff: 4, storm: 0.8,
    blurb: 'A race straight into a dust storm. Twisters cross the road; follow the beacons.',
    quest: { type: 'cow', skin: 'dustbot', name: 'Runaway Dust-Bot', text: 'Catch the panicking cleaning robot before it vacuums the whole planet', reward: 500 },
    segments: [S(150), S(320, { traffic: 4, kickers: 2, skin: 'crawler' }), T(-40, 240, 8), ...jr(14, 180, { name: "Devil's Gap", padR: 7 }), S(60), L(26, 'Twister Loop'), S(80),
      C(220, 1, 1, 0), S(60), T(45, 260, 8), ...jr(12, 160, { name: 'Haboob Hop', padR: 7 }), S(60), W(110, 240), S(80), T(-30, 220), S(180)] },
  r6: { planet: 'mars', name: 'Tharsis Hopscotch', env: 'mars', diff: 4,
    blurb: 'Four lava-plain jumps onto ever-smaller pads. Precision is everything.',
    quest: { type: 'pizza', noCrash: true, name: 'Canyon Pizza', text: 'Deliver a pizza across the canyon without spilling it (no crashes!)', time: 45, reward: 500 },
    segments: [S(160), ...jr(10, 120, { name: 'Hop One', padR: 8 }), S(60), T(30, 220, 6), ...jr(13, 150, { name: 'Hop Two', padR: 7 }), S(60), L(24, 'Tharsis Loop'), S(80),
      T(-35, 240, 6), ...jr(15, 180, { name: 'Hop Three', padR: 6 }), S(60), H(160, 14), ...jr(16, 200, { name: 'Hop Four', padR: 5 }), S(160)] },
  r7: { planet: 'mars', name: 'Olympus Mons Descent', env: 'marsstorm', diff: 5, storm: 0.5, terrain: { volcano: 'start' },
    blurb: 'Start at the summit of the tallest volcano in the solar system and fall off it in style.',
    quest: { type: 'rover', skin: 'marsrover', name: 'Rover Ride-Along', text: 'Stop by the lost rover for 2 seconds so it can hitch a lift home', reward: 550 },
    startY: 260,
    segments: [S(140), L(28, 'Caldera Loop'), S(60), H(260, -40), ...jr(8, 220, { cliff: true, drop: 60, name: 'Caldera Plunge', padR: 7 }), S(60), T(40, 260, 8), H(240, -40),
      C(440, 2, -1, 0), S(80), ...jr(16, 240, { name: 'Lava Tube Leap', padR: 6 }), S(60), W(-110, 240), S(80), L(30, 'Olympus Loop'), S(40), L(30, 'Olympus Loop II', -32), S(200)] },
};

// gameplay overlays per level (objective, hazards, ordering). Objective types:
// time_trial | race | precision_landing | collect | stunt_score
const META = {
  e1: { order: 1, objective: 'time_trial', hazards: [] },
  e2: { order: 2, objective: 'precision_landing', hazards: [{ type: 'rockfall', at: 'gap:Grand Gulch', density: 0.3 }] },
  e3: { order: 3, objective: 'stunt_score', hazards: [] },
  e5: { order: 4, objective: 'race', hazards: [{ type: 'laneChange', at: 'traffic', chance: 0.25 }] },
  e4: { order: 5, objective: 'race', hazards: [{ type: 'crosswind', at: 'gap:Cliff Drop', strength: 0.3 }, { type: 'laneChange', at: 'traffic', chance: 0.3 }] },
  e6: { order: 6, objective: 'time_trial', hazards: [] },
  e7: { order: 7, objective: 'precision_landing', hazards: [{ type: 'crosswind', at: 'gap:Broken Span', strength: 0.5 }, { type: 'seaSpray', at: 'gap:Seawall Drop', visibility: 0.7 }] },
  e8: { order: 8, objective: 'race', hazards: [{ type: 'rockfall', at: 'gap:Colorado Crossing', density: 0.5 }, { type: 'laneChange', at: 'traffic', chance: 0.35 }] },
  m1: { order: 1, objective: 'time_trial', hazards: [] },
  m2: { order: 3, objective: 'collect', hazards: [{ type: 'boulders', at: 'land:Hole #2', count: 4 }] },
  m3: { order: 5, objective: 'stunt_score', hazards: [{ type: 'darkness', visibility: 0.6 }] },
  m4: { order: 2, objective: 'precision_landing', hazards: [{ type: 'darkness', visibility: 0.75 }] },
  m5: { order: 4, objective: 'collect', hazards: [{ type: 'boulders', at: 'land:Skylight #2', count: 5 }, { type: 'regolithSlip', at: 'land:The Big Skylight', grip: 0.8 }] },
  m6: { order: 6, objective: 'race', hazards: [{ type: 'regolithSlip', at: 'land:Rille Drop', grip: 0.8 }] },
  m7: { order: 7, objective: 'stunt_score', hazards: [{ type: 'meteorShower', at: 'gap:Earthrise', density: 0.4, cosmeticOnly: true }] },
  r1: { order: 1, objective: 'time_trial', hazards: [{ type: 'dustStorm', intensity: 0.2 }] },
  r2: { order: 3, objective: 'race', hazards: [{ type: 'dustStorm', intensity: 0.6 }] },
  r4: { order: 2, objective: 'time_trial', hazards: [{ type: 'dustStorm', intensity: 0.3 }] },
  r5: { order: 4, objective: 'race', hazards: [{ type: 'dustStorm', intensity: 0.8 }, { type: 'dustDevil', count: 3, push: 6 }] },
  r6: { order: 5, objective: 'precision_landing', hazards: [{ type: 'dustDevil', count: 1, push: 4, at: 'gap:Hop Four' }] },
  r3: { order: 6, objective: 'race', hazards: [{ type: 'dustStorm', intensity: 1.0 }, { type: 'rockfall', at: 'gap:Summit Launch', density: 0.4 }] },
  r7: { order: 7, objective: 'stunt_score', hazards: [{ type: 'dustStorm', intensity: 0.5 }, { type: 'lavaVent', at: 'gap:Lava Tube Leap', cosmeticOnly: true }] },
};

// dust storm → visibility & grip (only Mars). intensity = level.storm (engine field, 0..1).
const stormFx = s => s ? { intensity: s, fogDensity: r2(0.002 + 0.018 * s), visibilityM: Math.round(900 - 760 * s), gripMul: r2(1 - 0.22 * s), gustN: r1(2 + 6 * s), minimapNoise: r2(0.5 * s) } : null;

const CP_SPACING = { earth: 220, moon: 300, mars: 260 };

function analyse(def) {
  const planet = PLANETS[def.planet]; const g = planet.gravity;
  const built = buildTrack(clone(def), g); // clone: buildTrack mutates gap.len
  const tr = built; const len = tr.length;
  const segsOut = clone(def.segments);
  // ---- jumps / landing zones ----
  const gaps = tr.features.filter(f => f.type === 'gap');
  const jumps = gaps.map(f => {
    const sg = def.segments.find(x => x.t === 'gap' && x.name === f.name);
    const drop = sg.drop ?? 3, ang = sg.ang, v = sg.speed;
    const lip = tr.samples.find(s => s.s >= f.s0 - 0.01); const lipP = tr.samples[Math.max(0, lip.i - 1)].p;
    const pad = poseAt(tr, f.padS, 0, 0).p.clone();
    const xPad = Math.hypot(pad.x - lipP.x, pad.z - lipP.z), dropPad = lipP.y - pad.y;
    const land1 = poseAt(tr, f.land1, 0, 0).p.clone();
    const xEnd = Math.hypot(land1.x - lipP.x, land1.z - lipP.z), dropEnd = lipP.y - land1.y;
    const a = ang * D2R; const t = f.len / (v * Math.cos(a)); const apex = (v * Math.sin(a)) ** 2 / (2 * g);
    const vPad = vMinFor(g, xPad, ang, Math.max(0.1, dropPad)), vMax = vMinFor(g, xEnd, ang, Math.max(0.1, dropEnd));
    const rampLen = sg.rampLen ?? 34;
    return {
      name: f.name, kind: sg.cliff ? 'cliff' : (def.planet === 'moon' && !sg.cliff ? 'crater_hole' : 'canyon'), s0: r1(f.s0),
      ramp: { angleDeg: ang, length: rampLen }, gapLength: r1(f.len), designWidth: sg.designWidth ?? null, drop,
      minTakeoffSpeed: r1(v), minTakeoffKmh: Math.round(v * 3.6),
      padSpeed: r1(vPad), overshootSpeed: r1(vMax),
      airtime: r1(t), apexHeight: r1(apex),
      math: `v_min = sqrt(g*x^2 / (2*cos^2(a)*(x*tan(a)+drop))) = sqrt(${g}*${r1(f.len)}^2 / (2*cos^2(${ang}deg)*(${r1(f.len)}*tan(${ang}deg)+${drop}))) = ${r1(vMinFor(g, f.len, ang, drop))} m/s; air t = x/(v cos a) = ${r1(t)} s; apex = (v sin a)^2/2g = ${r1(apex)} m`,
      aiTargetSpeed: r1(v * 1.06),
    };
  });
  const landingZones = gaps.map(f => ({
    gap: f.name, padS: r1(f.padS), land0: r1(f.land0), land1: r1(f.land1), targetRadius: f.padR,
    rings: [
      { name: 'PERFECT', radius: 2.5, multiplier: 3.0, basePts: 2500 },
      { name: 'BULLSEYE', radius: r1(f.padR * 0.5), multiplier: 2.0, basePts: 1500 },
      { name: 'PAD', radius: f.padR, multiplier: 1.25, basePts: 800 },
      { name: 'CLEARED', radius: null, multiplier: 1.0, basePts: f.cliff ? 900 : 700 },
    ],
  }));
  // ---- loops ----
  const loops = tr.features.filter(f => f.type === 'loop').map(f => ({
    name: f.name, s0: r1(f.s0), radius: f.r, trackLength: r1(f.s1 - f.s0),
    minEntrySpeed: r1(Math.sqrt(5 * g * f.r)), minTopSpeed: r1(Math.sqrt(g * f.r)),
    recommendedEntrySpeed: r1(Math.min(50, Math.sqrt(5 * g * f.r) * 1.15)),
    entryKmh: Math.round(Math.sqrt(5 * g * f.r) * 3.6),
    engineNote: 'sim.js magnet assist holds the car above fspeed 9 m/s; the physics numbers drive AI speed, HUD speed hint and "clean loop" bonus',
  }));
  // ---- coins (replicates sim.buildEntities placement for an estimate) ----
  let coins = 0, airCoins = 0;
  for (let s = 60; s < tr.finishS - 20; s += 12) { const sm = sampleAt(tr, s); if (sm.gap) { if (Math.floor(s / 12) % 2 === 0) { coins++; airCoins++; } continue; } const block = Math.floor(s / 120); if ((block % 3) === 2 && !sm.loop && !sm.cork) continue; coins++; }
  const bat = []; for (let s = 300; s < tr.finishS - 60; s += 340) { let sm = sampleAt(tr, s), k = 0; while ((sm.gap || sm.ramp) && k < 80) { s += 5; sm = sampleAt(tr, s); k++; } bat.push(Math.round(s)); }
  // ---- timing / stars (same formulas as sim.finish so nothing disagrees) ----
  const gold = len / 38, silver = len / 32, bronzeEst = len / 26;
  const goal = Math.round(len * 4 + def.diff * 2500);
  // ---- battery budget ----
  const tank0 = 60, cps = tr.checkpoints.length - 1;
  const supply = tank0 + cps * 3 + bat.length * 12;
  const airT = jumps.reduce((a, j) => a + j.airtime, 0);
  const drainAtBronze = (bronzeEst - airT) * 1 + airT * 0.3 + 4 * 0.7; // + ~4 s boost
  // difficulty-scaled optional drain multiplier so the battery matters (target supply/drain ratio 1.8 → 1.25)
  const targetRatio = 1.8 - (def.diff - 1) * 0.14;
  const drainMul = r2(Math.max(1, Math.min(1.6, supply / (drainAtBronze * targetRatio))));
  const meta = META[def.id];
  const obj = meta.objective;
  const nGap = jumps.length;
  const stars = {
    time_trial: { type: 'time', threeStar: r1(gold), twoStar: r1(silver), oneStar: 'finish', formula: 'sim.finish trial: gold=len/38, silver=len/32' },
    race: { type: 'position', threeStar: { position: 1, minScore: goal }, twoStar: { position: 2 }, oneStar: 'finish', formula: 'sim.finish race: 1 + (pos<=2) + (pos==1 && score>=goal); goal=len*4+diff*2500' },
    precision_landing: { type: 'pads', threeStar: { padsHit: nGap, perfects: 1 }, twoStar: { padsHit: Math.max(1, nGap - 1) }, oneStar: { padsHit: 1 }, failIf: 'finish without any pad' },
    collect: { type: 'collect', threeStar: { allItems: true, maxTime: r1(silver) }, twoStar: { allItems: true }, oneStar: 'finish' },
    stunt_score: { type: 'score', threeStar: Math.round(goal * 1.5), twoStar: goal, oneStar: Math.round(goal * 0.5) },
  }[obj];
  const objective = { type: obj, simMode: obj === 'race' ? 'race' : 'trial', aiRivals: obj === 'race' ? 3 : 0 };
  if (obj === 'collect') Object.assign(objective, { item: def.quest.item, count: def.quest.count ?? 6, note: 'uses the level quest items as the main objective' });
  if (obj === 'precision_landing') objective.pads = jumps.map(j => j.name);
  // resolve hazards to s ranges
  const hz = meta.hazards.map(h => {
    const o = { ...h, implemented: false };
    if (h.at && h.at.startsWith('gap:')) { const f = gaps.find(x => x.name === h.at.slice(4)); if (f) { o.s0 = r1(f.s0 - 30); o.s1 = r1(f.land0 + 20); } }
    else if (h.at && h.at.startsWith('land:')) { const f = gaps.find(x => x.name === h.at.slice(5)); if (f) { o.s0 = r1(f.land0); o.s1 = r1(f.land1); } }
    else if (h.at === 'traffic') o.ranges = tr.features.filter(f => f.type === 'traffic').map(f => [r1(f.s0), r1(f.s1)]);
    else { o.s0 = 0; o.s1 = r1(len); }
    return o;
  });
  const trafficSegs = tr.features.filter(f => f.type === 'traffic');
  if (trafficSegs.length) hz.unshift({ type: 'traffic', implemented: true, cars: trafficSegs.reduce((a, f) => a + f.count, 0), kickers: trafficSegs.reduce((a, f) => a + f.kickers, 0), ranges: trafficSegs.map(f => [r1(f.s0), r1(f.s1)]), reward: 'CAR JUMP 600 pts (sim.rules)' });
  const out = {
    id: def.id, name: def.name, planet: def.planet, gravity: g, env: def.env, diff: def.diff, order: meta.order,
    blurb: def.blurb, unlock: meta.order === 1 ? 'open (planet unlocked from start, req 21)' : 'needs >=1 star on the previous level of this planet (progress.isUnlocked uses LEVELS array order, so insert levels sorted by order)', source: ENGINE_LEVELS.some(l => l.id === def.id) ? 'engine (segments verbatim from src/levels.js)' : 'new',
    objective, stars,
    ...(def.storm ? { storm: def.storm } : {}), ...(def.storm ? { stormFx: stormFx(def.storm) } : {}),
    ...(def.terrain ? { terrain: def.terrain } : {}), ...(def.startY ? { startY: def.startY } : {}),
    quest: def.quest,
    battery: { start: 'stats.tank (60 s base + 12 s per tank tier)', checkpointBonus: '3 s + 1 s per charger robot (sim)', pickupValue: 12, pickupsAt: bat,
      budget: { estBronzeTime: r1(bronzeEst), supplyAtBaseTank: supply, drainAtBronze: r1(drainAtBronze), ratio: r2(supply / drainAtBronze) }, drainMul },
    coins: { autoPlace: 'sim.buildEntities (every 12 m, air coins on gaps)', estimated: coins, airCoins,
      bonus: [...jumps.map(j => ({ kind: 'goldCoinArc', at: 'apex:' + j.name, count: 5, value: 5 })), ...loops.map(l => ({ kind: 'loopRing', at: 'loop:' + l.name, count: 8, value: 2 }))],
      estimatedValue: coins + jumps.length * 25 + loops.length * 16 },
    checkpoints: { spacing: CP_SPACING[def.planet], engineSpacing: 220, engineList: tr.checkpoints.map(r1) },
    loops, jumps, landingZones, hazards: hz,
    analysis: { trackLength: r1(len), finishS: r1(tr.finishS), loops: loops.length, jumps: jumps.length, corks: tr.features.filter(f => f.type === 'cork').length, walls: tr.features.filter(f => f.type === 'wall').length },
    segments: segsOut,
  };
  return out;
}

const all = {};
for (const l of ENGINE_LEVELS) all[l.id] = { ...clone(l) };
for (const [id, d] of Object.entries(NEW)) all[id] = { id, ...d };
// strip engine-mutated gap len from verbatim engine segments (buildTrack sets sg.len at runtime)
for (const d of Object.values(all)) for (const sg of d.segments) if (sg.t === 'gap' && sg.designWidth === undefined) delete sg.len;

const files = {};
for (const d of Object.values(all)) {
  const a = analyse(d);
  (files[d.planet] ??= []).push(a);
}
const summary = [];
for (const [planet, levels] of Object.entries(files)) {
  levels.sort((a, b) => a.order - b.order);
  const doc = {
    schema: 'volt-roadster/levels@1', planet, gravity: G[planet], assist: PLANETS[planet].assist, unlocked: true,
    units: { distance: 'm', speed: 'm/s', angle: 'deg', time: 's', gravity: 'm/s^2' },
    notes: 'segments[] use the exact src/levels.js / track.js format and can be passed straight to buildTrack(def, gravity). All other fields are gameplay metadata; fields marked implemented:false need new code. Generated by design/gen/build_levels.mjs using the engine\'s own buildTrack.',
    physics: {
      loopEntry: 'v_entry_min = sqrt(5 g r) (energy: v_top^2 = v_entry^2 - 4 g r, need v_top >= sqrt(g r))',
      gapClear: 'v_min = sqrt(g x^2 / (2 cos^2 a (x tan a + drop))) — identical to track.js gap len solver',
    },
    levels,
  };
  writeFileSync(OUT + `levels.${planet}.json`, JSON.stringify(doc, null, 2));
  for (const l of levels) summary.push({ id: l.id, planet, order: l.order, diff: l.diff, obj: l.objective.type, len: l.analysis.trackLength, gold: r1(l.analysis.trackLength / 38), coins: l.coins.estimated, ratio: l.battery.budget.ratio, drainMul: l.battery.drainMul, jumps: l.jumps.map(j => `${j.name}:${j.gapLength}m@${j.minTakeoffSpeed}(pad ${j.padSpeed}, over ${j.overshootSpeed})`).join(' | '), loops: l.loops.map(x => `${x.radius}:${x.minEntrySpeed}`).join(',') });
}
writeFileSync(OUT + 'gen/levels_summary.json', JSON.stringify(summary, null, 1));
console.log(summary.map(s => JSON.stringify(s)).join('\n'));
