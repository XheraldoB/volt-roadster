// Maps the game's existing shop/save ids (src/shop.js: paint, finish, wrap, rims, spoiler, underglow, flame)
// onto art/custom catalogue ids, so applyCustomization() can be driven straight from the save file.
// Pure data, no imports from src/. Anything without an art equivalent is listed in `unsupported`
// (keep the game's own implementation for those, or pick the nearest fallback given here).
//
//   import { fromGameSelection } from './art/custom/gameMap.js';
//   const { selection, unsupported } = fromGameSelection(save.car);   // { paint, finish, wrap, rims, spoiler, underglow, flame }
//   applyCustomization(car, selection);
const PAINT_HEX = {
  red: '#c4081c', white: '#f2f2f0', black: '#0d0d10', blue: '#1446c8', silver: '#9aa1a8', steel: 'raw-steel',
  green: '#5ee01a', orange: '#ff6a00', purple: '#7a2cff', gold: '#d4a017', cyan: '#00d0ff', pink: '#ff2f92',
  mars: '#b5502b', moon: '#6d6e72', mint: '#2dffb3', plasma: '#b400ff', void: '#020203', sunset: '#ff4d6d',
  aurora: '#2a7cff', liquid: '#d9dde3',
};
const FINISH = { gloss: 'gloss', metallic: 'metallic', matte: 'matte', satin: 'satin', brushed: 'brushed', pearl: 'pearl', chrome: 'chrome', candy: 'gloss', chameleon: 'pearl' };
const WRAP = { none: 'none', stripes: 'stripes', camo: 'camo', carbon: 'carbon', digital: 'fade' };
const RIMS = { aero: 'aero', spoke5: 'yspoke', mesh: 'mesh', turbine: 'turbine', forged: 'yspoke', neon: 'neon', blade: 'turbine', hologram: 'neon', offroad: 'offroad' };
const SPOILER = { none: 'none', lip: 'lip', ducktail: 'ducktail', wing: 'wing', swan: 'wing', dual: 'wing', active: 'wing' };
const FLAME = { ion: 'plasma', classic: 'inferno', toxic: 'toxic', pink: 'nebula', gold: 'solar', violet: 'nebula', white: 'whitehot', rainbow: 'nebula' };
const APPROX = new Set(['candy', 'chameleon', 'forged', 'blade', 'hologram', 'swan', 'dual', 'active', 'rainbow-flame', 'pulse']);

export function fromGameSelection(g = {}) {
  const selection = {}, unsupported = [], approximated = [];
  const map = (key, val, table, outKey) => {
    if (val == null) return;
    if (val in table) { selection[outKey] = table[val]; if (APPROX.has(val)) approximated.push(`${key}:${val}`); }
    else unsupported.push(`${key}:${val}`);
  };
  if (g.paint != null) { if (g.paint in PAINT_HEX) selection.paint = PAINT_HEX[g.paint]; else if (/^#|^rgb/.test(g.paint)) selection.paint = g.paint; else unsupported.push(`paint:${g.paint}`); }
  map('finish', g.finish, FINISH, 'finish');
  map('wrap', g.wrap, WRAP, 'wrap');
  map('rims', g.rims, RIMS, 'wheels');
  map('spoiler', g.spoiler, SPOILER, 'spoiler');
  if (g.underglow != null) {
    if (g.underglow === 'none' || g.underglow === 'rainbow') selection.underglow = g.underglow;
    else if (g.underglow === 'pulse') { selection.underglow = '#00e5ff'; approximated.push('underglow:pulse'); }
    else if (/^#/.test(g.underglow)) selection.underglow = g.underglow;
    else unsupported.push(`underglow:${g.underglow}`);
  }
  if (g.flame != null) { map('flame', g.flame, FLAME, 'boost'); if (g.flame === 'rainbow') approximated.push('flame:rainbow'); }
  return { selection, unsupported, approximated };
}
