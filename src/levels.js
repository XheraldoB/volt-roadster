// World + level definitions.
export const PLANETS = {
  earth: { id: 'earth', name: 'Earth', gravity: 9.81, assist: 0, icon: '🌍', desc: 'Desert canyons, neon cities and ocean cliffs.' },
  moon:  { id: 'moon',  name: 'Moon',  gravity: 1.62, assist: 0.85, icon: '🌙', desc: 'Real 1/6 g. Craters, holes and endless air time.' },
  mars:  { id: 'mars',  name: 'Mars',  gravity: 3.71, assist: 0.7, icon: '🔴', desc: 'Red canyons, Olympus volcano and dust storms.' },
};

const S = (len, o = {}) => ({ t: 'straight', len, ...o });
const T = (ang, len, bank = 0) => ({ t: 'turn', ang, len, bank });
const W = (ang, len) => ({ t: 'wall', ang, len });
const L = (r, name, shift) => ({ t: 'loop', r, name, shift });
const C = (len, turns = 1, dir = 1, h = 10) => ({ t: 'cork', len, turns, dir, h });
const H = (len, h) => ({ t: 'hill', len, h });
const B = (len, h) => ({ t: 'bump', len, h });
const J = (ang, speed, o = {}) => [{ t: 'straight', len: 50 }, { t: 'ramp', len: o.rampLen ?? 34, ang }, { t: 'gap', speed, ang, ...o }];

import { DESIGN_LEVELS } from './levels.data.js';
// Spaceport finale (engine original; drives onto a rocket at the end)
const EXTRA = [
  { id: 'e9', order: 9, planet: 'earth', name: 'Spaceport Tour', env: 'spaceport', diff: 4, spaceport: true, objective: { type: 'race', ai: 3 }, drainMul: 1.1,
    blurb: 'Tour the coastal spaceport, then drive straight up the ramp into a waiting rocket. Liftoff!',
    quest: { type: 'deliver', item: 'satellite', name: 'Last-Minute Cargo', text: 'Grab the forgotten satellite and get it to the launch tower', time: 45, reward: 450 },
    segments: [S(160), T(30, 220, 6), L(22, 'Launch Loop'), S(80), ...J(14, 38, { name: 'Fuel Depot Jump' }), S(60), S(300, { traffic: 5, kickers: 2 }),
      T(-40, 240, 8), W(90, 220), S(60), C(220, 1, 1, 0), S(100), ...J(12, 40, { name: 'Gantry Leap', padR: 7 }), S(80), T(25, 200), H(120, 10), S(140)] },
];
const PORDER = { earth: 0, moon: 1, mars: 2 };
export const LEVELS = [...DESIGN_LEVELS, ...EXTRA].sort((a, b) => PORDER[a.planet] - PORDER[b.planet] || a.order - b.order);
// Bonus side quests (design/side_quests.json, the needs-code types fragile / speedtrap / statGoal).
// A bonus quest replaces the level's main quest once the main quest is done and its star trigger is met.
const BONUS = {
  e2: { id: 'sq_grandma_eggs', type: 'fragile', item: 'eggs', name: "Grandma's Eggs", giver: 'Grandma Ada', text: 'Deliver a dozen eggs to the finish. No hard landings, no crashes.', failText: 'Well, now we are having omelettes.', reward: 500, after: { stars: 1 } },
  e6: { id: 'sq_speed_camera', type: 'speedtrap', name: 'Say Cheese, Speed Camera', giver: 'Speed Camera SC-9', text: 'Pass speed camera SC-9 at 160 km/h or faster for the perfect blurry photo', speed: 160 / 3.6, reward: 450, after: { stars: 1 } },
  e5: { id: 'sq_parcel_traffic', type: 'statGoal', stat: 'carJumps', value: 3, name: 'Express Parcel', giver: 'Courier Dee', text: 'Jump 3 cars in one run. Traffic is the enemy, the sky is free.', reward: 450, after: { stars: 1 } },
  e4: { id: 'sq_robot_sulk', type: 'statGoal', stat: 'loops', value: 2, name: 'Robot Feelings', giver: 'Juice the charger robot', text: 'Juice is sulking. Do 2 loops in one run to cheer it up', reward: 350, after: { stars: 1 } },
  m1: { id: 'sq_moon_golf', type: 'statGoal', stat: 'maxAir', value: 6, name: 'Moon Golf', giver: 'Caddie Bot', text: 'Stay airborne 6 seconds in one jump to "drive" the golf ball', reward: 400, after: { stars: 1 } },
  r4: { id: 'sq_martian_dj', type: 'statGoal', stat: 'flips+rolls', value: 2, withinSeconds: 40, name: 'Martian DJ', giver: 'DJ Phobos', text: 'Land 2 flips or barrel rolls within 40 s to drop the beat', reward: 450, after: { stars: 1 } },
};
for (const l of LEVELS) if (BONUS[l.id]) l.bonus = BONUS[l.id];
export const levelById = id => LEVELS.find(l => l.id === id);
export const levelsOf = planet => LEVELS.filter(l => l.planet === planet);
