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
export const levelById = id => LEVELS.find(l => l.id === id);
export const levelsOf = planet => LEVELS.filter(l => l.planet === planet);
