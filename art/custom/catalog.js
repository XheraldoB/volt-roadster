// Volt Roadster customisation catalogue: JSON-serialisable options for the UI, plus
// applyCustomization(vehicle, selection) for the hypercar, the pickup, or any vehicle
// exposing userData.{paintMaterials, wheelMaterials, wheels, mounts, quality}.
//
//   import { getCatalog, applyCustomization, DEFAULT_SELECTION } from './art/custom/catalog.js';
//   const ui = getCatalog();        // { paints, finishes, wraps, wheels, spoilers, underglows, boosts, rimColors }
//   const custom = applyCustomization(car, { paint: 'deep-blue', finish: 'pearl', wrap: 'hex', wheels: 'yspoke',
//                                            spoiler: 'wing', underglow: 'magenta', boost: 'inferno' });
//   // per frame: custom.update(dt); custom.setBoost(boosting ? 1 : 0);
//   // re-apply any subset later: applyCustomization(car, { wheels: 'neon' });
import { Color } from 'three';
import { WRAPS, setWrap } from './wraps.js';
import { WHEEL_DESIGNS, createWheel } from './wheels.js';
import { SPOILERS, UNDERGLOWS, createSpoiler, createUnderglow } from './parts.js';
import { BOOST_VARIANTS, createBoostFlame } from '../fx/boostFlame.js';

export const PAINTS = [
  { id: 'volt-red', name: 'Volt Red', color: '#b3121f' }, { id: 'pearl-white', name: 'Pearl White', color: '#f2f2f0' },
  { id: 'obsidian', name: 'Obsidian', color: '#0d0d10' }, { id: 'deep-blue', name: 'Deep Blue', color: '#1446c8' },
  { id: 'quicksilver', name: 'Quicksilver', color: '#9aa1a8' }, { id: 'electric-lime', name: 'Electric Lime', color: '#5ee01a' },
  { id: 'solar-orange', name: 'Solar Orange', color: '#ff6a00' }, { id: 'nebula-purple', name: 'Nebula Purple', color: '#7a2cff' },
  { id: 'ion-cyan', name: 'Ion Cyan', color: '#00c8f0' }, { id: 'mars-dust', name: 'Mars Dust', color: '#b5502b' },
  { id: 'gold-rush', name: 'Gold Rush', color: '#d4a017' }, { id: 'raw-steel', name: 'Raw Steel', color: '#b5b6b8' },
];
export const FINISHES = [
  { id: 'gloss', name: 'Gloss', preview: '#d0d0d0', props: { metalness: 0.1, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.03, iridescence: 0, sheen: 0 } },
  { id: 'metallic', name: 'Metallic', preview: '#b8bcc4', props: { metalness: 0.6, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.035, iridescence: 0, sheen: 0.2 } },
  { id: 'matte', name: 'Matte', preview: '#6a6a6a', props: { metalness: 0.05, roughness: 0.82, clearcoat: 0, iridescence: 0, sheen: 0 } },
  { id: 'satin', name: 'Satin', preview: '#8a8a90', props: { metalness: 0.35, roughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.3, iridescence: 0, sheen: 0 } },
  { id: 'chrome', name: 'Chrome', preview: '#e8ecf2', props: { metalness: 1, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.0, iridescence: 0, sheen: 0 } },
  { id: 'pearl', name: 'Pearlescent', preview: '#f0e6ff', props: { metalness: 0.35, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.03, iridescence: 1, iridescenceIOR: 1.6, sheen: 0.7, sheenRoughness: 0.35 } },
  { id: 'brushed', name: 'Brushed Steel', preview: '#b5b6b8', props: { metalness: 1, roughness: 0.4, clearcoat: 0, iridescence: 0, sheen: 0 }, pickupOnly: true },
];
export const RIM_COLORS = [
  { id: 'graphite', name: 'Graphite', color: '#22252b' }, { id: 'silver', name: 'Silver', color: '#c8ccd2' }, { id: 'black', name: 'Gloss Black', color: '#0b0b0d' },
  { id: 'gold', name: 'Bronze Gold', color: '#b08a3a' }, { id: 'white', name: 'White', color: '#eeeeee' }, { id: 'cyan', name: 'Volt Cyan', color: '#2ee6ff' },
];
export const DEFAULT_SELECTION = { paint: 'volt-red', finish: 'metallic', wrap: 'none', wheels: 'turbine', rimColor: 'graphite', spoiler: 'none', underglow: 'none', boost: 'plasma' };

// Plain JSON for the UI (ids, display names, preview colours).
export function getCatalog() {
  return JSON.parse(JSON.stringify({
    paints: PAINTS.map(({ id, name, color }) => ({ id, name, preview: color })),
    finishes: FINISHES.map(({ id, name, preview, pickupOnly }) => ({ id, name, preview, pickupOnly: !!pickupOnly })),
    wraps: WRAPS.map(({ id, name, preview }) => ({ id, name, preview })),
    wheels: WHEEL_DESIGNS.map(({ id, name, preview, desc }) => ({ id, name, preview, desc })),
    rimColors: RIM_COLORS.map(({ id, name, color }) => ({ id, name, preview: color })),
    spoilers: SPOILERS.map(({ id, name, preview }) => ({ id, name, preview })),
    underglows: UNDERGLOWS.map(({ id, name, preview }) => ({ id, name, preview })),
    boosts: BOOST_VARIANTS.map(({ id, name, core, mid, outer }) => ({ id, name, preview: [core, mid, outer] })),
  }));
}

const byId = (list, id) => list.find(x => x.id === id);

function vehicleExtents(v) {
  const k = v.userData.kind;
  return k === 'pickup' ? { z0: -2.75, length: 5.5, midY: 0.82 } : { z0: -2.15, length: 4.3, midY: 0.45 };
}

export function applyCustomization(vehicle, selection = {}) {
  const ud = vehicle.userData;
  const quality = ud.quality || 'high';
  const st = ud.custom || (ud.custom = createState(vehicle));
  const sel = Object.assign(st.selection, selection);

  // paint colour (accepts catalogue id or any CSS/hex colour)
  if ('paint' in selection) {
    const p = byId(PAINTS, sel.paint); const col = new Color(p ? p.color : sel.paint);
    for (const m of ud.paintMaterials || []) { m.color.copy(col); if (m.sheenColor) m.sheenColor.copy(col).offsetHSL(0.08, 0, 0.25); }
  }
  // finish
  if ('finish' in selection) {
    const f = byId(FINISHES, sel.finish) || FINISHES[1];
    for (const m of ud.paintMaterials || []) {
      for (const [k, v] of Object.entries(f.props)) if (k in m) m[k] = v;
      if (m.isMeshPhysicalMaterial && 'anisotropy' in m) m.anisotropy = 0; // see truck/createPickup.js Q note: grain comes from the roughness map
      if (m.sheenColor && f.id === 'pearl') m.sheenColor.copy(m.color).offsetHSL(0.15, 0.2, 0.3);
      m.needsUpdate = true;
    }
  }
  // wrap
  if ('wrap' in selection || 'wrapA' in selection || 'wrapB' in selection) {
    for (const m of ud.paintMaterials || []) setWrap(m, sel.wrap, { a: sel.wrapA, b: sel.wrapB, ...vehicleExtents(vehicle) });
  }
  // wheels
  if ('wheels' in selection && ud.wheels) {
    for (const w of ud.wheels) {
      if (w.visual?.object?.userData.design === sel.wheels) continue;
      w.visual?.dispose();
      w.visual = createWheel({ design: sel.wheels, radius: w.radius, width: w.width, side: w.side, quality, mats: ud.wheelMaterials });
      w.spin.add(w.visual.object);
      if (w.caliper) w.caliper.position.x = w.visual.discX - w.side * 0.005;
    }
  }
  if ('rimColor' in selection && ud.wheelMaterials) { const r = byId(RIM_COLORS, sel.rimColor); ud.wheelMaterials.rim.color.set(r ? r.color : sel.rimColor); }
  if ('caliper' in selection && ud.wheelMaterials) ud.wheelMaterials.caliper.color.set(sel.caliper);
  // spoiler
  if ('spoiler' in selection) { st.spoiler?.dispose(); st.spoiler = createSpoiler(vehicle, sel.spoiler, { quality }); }
  // underglow
  if ('underglow' in selection) {
    const u = byId(UNDERGLOWS, sel.underglow); const col = u ? u.color : sel.underglow;
    if (!col) { st.underglow?.dispose(); st.underglow = null; }
    else if (st.underglow) st.underglow.setColor(col); else st.underglow = createUnderglow(vehicle, col);
  }
  // boost flame
  if ('boost' in selection) {
    if (!st.boost) st.boost = createBoostFlame(vehicle, { quality, variant: sel.boost, ...(ud.kind === 'pickup' ? { radius: 0.13, length: 1.6 } : {}) });
    else st.boost.setVariant(sel.boost);
  }
  return st;
}

function createState(vehicle) {
  const st = {
    selection: { ...DEFAULT_SELECTION, ...(vehicle.userData.kind === 'pickup' ? { paint: 'raw-steel', finish: 'brushed', wheels: 'offroad', rimColor: 'black' } : {}) },
    spoiler: null, underglow: null, boost: null,
    setBoost(x) { st.boost?.setIntensity(x); },
    update(dt) { st.underglow?.update(dt); st.boost?.update(dt); },
    toJSON() { return { ...st.selection }; },
    dispose() { st.spoiler?.dispose(); st.underglow?.dispose(); st.boost?.dispose(); st.spoiler = st.underglow = st.boost = null; vehicle.userData.custom = null; },
  };
  return st;
}
