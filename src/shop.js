// Customization catalog. price: { coins } or { gems } (gems = premium currency earned slowly in game).
export const PAINT_LIST = [
  { id: 'red', name: 'Volt Red', color: '#c4081c' }, { id: 'white', name: 'Pearl White', color: '#f2f2f0' }, { id: 'black', name: 'Obsidian', color: '#0d0d10' },
  { id: 'blue', name: 'Deep Blue', color: '#1446c8' }, { id: 'silver', name: 'Quicksilver', color: '#9aa1a8' }, { id: 'steel', name: 'Raw Stainless', color: '#c3c7cc' },
  { id: 'green', name: 'Electric Lime', color: '#5ee01a', price: { coins: 120 } }, { id: 'orange', name: 'Solar Orange', color: '#ff6a00', price: { coins: 120 } },
  { id: 'purple', name: 'Nebula Purple', color: '#7a2cff', price: { coins: 150 } }, { id: 'gold', name: 'Gold Rush', color: '#d4a017', price: { coins: 250 } },
  { id: 'cyan', name: 'Ion Cyan', color: '#00d0ff', price: { coins: 150 } }, { id: 'pink', name: 'Hot Pink', color: '#ff2f92', price: { coins: 150 } },
  { id: 'mars', name: 'Mars Dust', color: '#b5502b', price: { coins: 200 } }, { id: 'moon', name: 'Regolith Grey', color: '#6d6e72', price: { coins: 200 } },
  { id: 'mint', name: 'Neon Mint', color: '#2dffb3', price: { gems: 15 } }, { id: 'plasma', name: 'Plasma Violet', color: '#b400ff', price: { gems: 15 } },
  { id: 'void', name: 'Void Black', color: '#020203', price: { gems: 20 } }, { id: 'sunset', name: 'Synthwave Sunset', color: '#ff4d6d', price: { gems: 20 } },
  { id: 'aurora', name: 'Aurora Shift', color: '#2a7cff', shift: true, price: { gems: 35 } }, { id: 'liquid', name: 'Liquid Metal', color: '#d9dde3', price: { gems: 30 } },
];
export const FINISH_LIST = [
  { id: 'gloss', name: 'Gloss', metalness: 0.15, roughness: 0.32, clearcoat: 1 },
  { id: 'metallic', name: 'Metallic', metalness: 0.75, roughness: 0.28, clearcoat: 1 },
  { id: 'matte', name: 'Matte', metalness: 0.1, roughness: 0.78, clearcoat: 0, price: { coins: 150 } },
  { id: 'satin', name: 'Satin', metalness: 0.45, roughness: 0.5, clearcoat: 0.3, price: { coins: 250 } },
  { id: 'brushed', name: 'Brushed Steel', metalness: 0.95, roughness: 0.35, clearcoat: 0, price: { coins: 350 } },
  { id: 'pearl', name: 'Pearl', metalness: 0.4, roughness: 0.25, clearcoat: 1, iridescence: 1, price: { coins: 400 } },
  { id: 'chrome', name: 'Chrome', metalness: 1, roughness: 0.05, clearcoat: 1, price: { coins: 600 } },
  { id: 'candy', name: 'Candy Coat', metalness: 0.6, roughness: 0.12, clearcoat: 1, sheen: 1, price: { gems: 25 } },
  { id: 'chameleon', name: 'Chameleon Flip', metalness: 0.7, roughness: 0.18, clearcoat: 1, iridescence: 1, iridescenceIOR: 2.2, price: { gems: 40 } },
];
export const WRAP_LIST = [
  { id: 'none', name: 'None' }, { id: 'stripes', name: 'Racing Stripes', price: { coins: 150 } }, { id: 'camo', name: 'Camo', price: { coins: 200 } },
  { id: 'carbon', name: 'Carbon', price: { coins: 250 } }, { id: 'checker', name: 'Checkered', price: { coins: 250 } }, { id: 'flames', name: 'Flames', price: { coins: 300 } },
  { id: 'lightning', name: 'Lightning', price: { coins: 300 } }, { id: 'digital', name: 'Digital Fade', price: { coins: 350 } },
  { id: 'galaxy', name: 'Galaxy', price: { gems: 30 } }, { id: 'circuit', name: 'Circuit Board', price: { gems: 30 } }, { id: 'tiger', name: 'Tiger Stripe', price: { gems: 25 } }, { id: 'retrowave', name: 'Retrowave Grid', price: { gems: 35 } },
];
export const RIM_LIST = [
  { id: 'aero', name: 'Aero Disc' }, { id: 'spoke5', name: '5-Spoke', price: { coins: 120 } }, { id: 'mesh', name: 'Mesh', price: { coins: 200 } },
  { id: 'turbine', name: 'Turbine', price: { coins: 250 } }, { id: 'forged', name: 'Forged 20', price: { coins: 350 } }, { id: 'neon', name: 'Neon Ring', price: { coins: 400 } },
  { id: 'blade', name: 'Blade Fan', price: { gems: 20 } }, { id: 'hologram', name: 'Hologram', price: { gems: 35 } },
];
export const SPOILER_LIST = [
  { id: 'none', name: 'None' }, { id: 'lip', name: 'Lip', price: { coins: 150 } }, { id: 'ducktail', name: 'Ducktail', price: { coins: 300 } },
  { id: 'wing', name: 'GT Wing', price: { coins: 600 } }, { id: 'swan', name: 'Swan Neck', price: { coins: 900 } },
  { id: 'dual', name: 'Dual Plane', price: { gems: 25 } }, { id: 'active', name: 'Active Aero (moves!)', price: { gems: 45 } },
];
export const UNDERGLOW_LIST = [
  { id: 'none', name: 'Off' }, { id: '#00e5ff', name: 'Cyan', price: { coins: 300 } }, { id: '#ff2f92', name: 'Magenta', price: { coins: 300 } },
  { id: '#39ff6a', name: 'Green', price: { coins: 300 } }, { id: '#7a2cff', name: 'Violet', price: { coins: 300 } }, { id: '#ffb000', name: 'Amber', price: { coins: 300 } },
  { id: '#ffffff', name: 'Ice White', price: { coins: 400 } }, { id: 'rainbow', name: 'Rainbow Cycle', price: { gems: 30 } }, { id: 'pulse', name: 'Beat Pulse', price: { gems: 25 } },
];
// colors are linear-ish RGB for the additive particle system
export const FLAME_LIST = [
  { id: 'ion', name: 'Ion Blue', c1: [0.35, 0.55, 1], c2: [1, 0.4, 0.9] }, { id: 'classic', name: 'Classic Orange', c1: [1, 0.5, 0.12], c2: [1, 0.85, 0.3], price: { coins: 200 } },
  { id: 'toxic', name: 'Toxic Green', c1: [0.3, 1, 0.3], c2: [0.8, 1, 0.3], price: { coins: 300 } }, { id: 'pink', name: 'Bubblegum', c1: [1, 0.3, 0.7], c2: [1, 0.7, 0.9], price: { coins: 300 } },
  { id: 'gold', name: 'Gold Fire', c1: [1, 0.75, 0.2], c2: [1, 1, 0.6], price: { coins: 400 } },
  { id: 'violet', name: 'Plasma Violet', c1: [0.65, 0.2, 1], c2: [0.3, 0.9, 1], price: { gems: 20 } }, { id: 'white', name: 'White-Hot', c1: [1, 1, 1], c2: [0.6, 0.85, 1], price: { gems: 25 } },
  { id: 'rainbow', name: 'Rainbow Plasma', rainbow: true, c1: [1, 0, 0], c2: [1, 1, 1], price: { gems: 40 } },
];
export const TRAIL_LIST = [
  { id: 'none', name: 'None' }, { id: 'streak', name: 'Light Streak', price: { coins: 250 } }, { id: 'sparks', name: 'Spark Shower', price: { coins: 400 } },
  { id: 'smoke', name: 'Colour Smoke', price: { coins: 500 } }, { id: 'stars', name: 'Stardust', price: { gems: 20 } },
  { id: 'lightning', name: 'Lightning Arc', price: { gems: 30 } }, { id: 'rainbow', name: 'Rainbow Road', price: { gems: 45 } },
];
export const HORN_LIST = [
  { id: 'beep', name: 'Beep Beep' }, { id: 'air', name: 'Air Horn', price: { coins: 150 } }, { id: 'goose', name: 'Angry Goose', price: { coins: 200 } },
  { id: 'kazoo', name: 'Kazoo', price: { coins: 200 } }, { id: 'train', name: 'Freight Train', price: { coins: 350 } }, { id: 'arcade', name: 'Retro Arcade', price: { coins: 350 } },
  { id: 'synth', name: 'Synth Chord', price: { gems: 15 } }, { id: 'laser', name: 'Space Laser', price: { gems: 20 } }, { id: 'choir', name: 'Robot Choir', price: { gems: 30 } },
];
export const CATS = [
  { id: 'paints', key: 'paint', name: 'Paint', icon: '🎨', list: PAINT_LIST, kind: 'swatch' },
  { id: 'finishes', key: 'finish', name: 'Finish', icon: '✨', list: FINISH_LIST },
  { id: 'wraps', key: 'wrap', name: 'Wraps', icon: '🦓', list: WRAP_LIST },
  { id: 'rims', key: 'rims', name: 'Wheels', icon: '🛞', list: RIM_LIST },
  { id: 'spoilers', key: 'spoiler', name: 'Spoilers', icon: '🪽', list: SPOILER_LIST },
  { id: 'underglow', key: 'underglow', name: 'Underglow', icon: '💡', list: UNDERGLOW_LIST, kind: 'swatch' },
  { id: 'flames', key: 'flame', name: 'Boost Flame', icon: '🔥', list: FLAME_LIST, kind: 'swatch' },
  { id: 'trails', key: 'trail', name: 'Trails', icon: '🌠', list: TRAIL_LIST },
  { id: 'horns', key: 'horn', name: 'Horns', icon: '📯', list: HORN_LIST },
];
export const catOf = id => CATS.find(c => c.id === id);
export const itemOf = (cat, id) => (catOf(cat)?.list || []).find(i => i.id === id);
export const isFree = it => !it.price;
export const owns = (save, cat, id) => { const it = itemOf(cat, id); return !it || isFree(it) || (save.owned[cat] || []).includes(id); };
export function priceLabel(it) { if (!it.price) return 'FREE'; return it.price.gems ? `💎 ${it.price.gems}` : `🪙 ${it.price.coins}`; }
// Buy with in-game currency only. Returns {ok, reason}.
export function buyItem(save, cat, id) {
  const it = itemOf(cat, id); if (!it) return { ok: false, reason: 'unknown item' };
  if (owns(save, cat, id)) return { ok: true, already: true };
  const p = it.price;
  if (p.gems) { if ((save.gems || 0) < p.gems) return { ok: false, reason: `Need 💎 ${p.gems} (you have ${save.gems || 0})` }; save.gems -= p.gems; }
  else { if (save.coins < p.coins) return { ok: false, reason: `Need 🪙 ${p.coins}` }; save.coins -= p.coins; }
  (save.owned[cat] = save.owned[cat] || []).push(id); return { ok: true };
}
export function hornColor(id) { return { beep: '#fff', air: '#ffb000', goose: '#f2f2f0', kazoo: '#ff2f92', train: '#888', arcade: '#39ff6a', synth: '#7a2cff', laser: '#00e5ff', choir: '#d4a017' }[id] || '#fff'; }
