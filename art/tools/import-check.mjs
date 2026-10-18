// Node smoke test: every art module imports and its factories build, run and dispose
// at all 4 quality levels without a GPU.
import * as THREE from 'three';
const mods = ['../car/createHypercar.js', '../truck/createPickup.js', '../robot/createHelperRobot.js', '../terrain/moonMaterial.js', '../terrain/marsMaterial.js',
  '../sky/moonSky.js', '../sky/marsSky.js', '../post/ultraPost.js', '../fx/coldGasThrusters.js', '../fx/boostFlame.js',
  '../custom/catalog.js', '../custom/wheels.js', '../custom/wraps.js', '../custom/parts.js', '../custom/gameMap.js'];
for (const m of mods) { const x = await import(new URL(m, import.meta.url)); console.log('import ok', m, Object.keys(x).join(',')); }
const { createHypercar, syncHypercarWheels } = await import('../car/createHypercar.js');
const { createPickup, syncPickupWheels, PICKUP_NAME } = await import('../truck/createPickup.js');
const { createHelperRobot, createRobotIdle } = await import('../robot/createHelperRobot.js');
const { createMoonMaterial } = await import('../terrain/moonMaterial.js');
const { createMarsMaterial } = await import('../terrain/marsMaterial.js');
const { createMoonSky } = await import('../sky/moonSky.js');
const { createMarsSky } = await import('../sky/marsSky.js');
const { createColdGasThrusters, THRUSTER_BUDGET } = await import('../fx/coldGasThrusters.js');
const { createBoostFlame, BOOST_VARIANTS } = await import('../fx/boostFlame.js');
const { getCatalog, applyCustomization } = await import('../custom/catalog.js');
const tris = (g) => { let t = 0; g.traverse(o => { if (o.isMesh) t += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1); }); return Math.round(t); };
const cat = getCatalog(); JSON.stringify(cat);
console.log('catalog:', Object.entries(cat).map(([k, v]) => `${k}=${v.length}`).join(' '));
const fakeVc = { wheelSuspensionLength: () => 0.3, wheelSteering: i => (i < 2 ? 0.2 : 0), wheelRotation: () => 1.0 };
for (const q of ['ultra', 'high', 'medium', 'low']) {
  const scene = new THREE.Scene();
  const car = createHypercar({ quality: q }); scene.add(car); syncHypercarWheels(car, fakeVc);
  const truck = createPickup({ quality: q }); scene.add(truck); syncPickupWheels(truck, fakeVc, truck.userData.wheelPos);
  const names = truck.userData.wheels.map(w => w.pivot.name + '/' + w.spin.name).join(' ');
  const rcsT = createColdGasThrusters(truck, { quality: q, scene }), rcsC = createColdGasThrusters(car, { quality: q });
  for (let i = 0; i < 30; i++) { rcsT.hover(1); rcsT.fire(new THREE.Vector3(1, 0, 0), 1); rcsC.fire(new THREE.Vector3(0, 0, -1), 0.6); rcsT.update(1 / 60); rcsC.update(1 / 60); }
  if (rcsT.activeCount > THRUSTER_BUDGET[q]) throw new Error('budget exceeded');
  const flame = createBoostFlame(car, { quality: q }); flame.setIntensity(1); flame.update(0.1); for (const v of BOOST_VARIANTS) flame.setVariant(v.id); flame.dispose();
  for (const v of [car, truck]) {
    for (const w of cat.wheels) applyCustomization(v, { wheels: w.id });
    for (const s of cat.spoilers) applyCustomization(v, { spoiler: s.id });
    for (const u of cat.underglows) applyCustomization(v, { underglow: u.id });
    for (const f of cat.finishes) applyCustomization(v, { finish: f.id });
    for (const r of cat.wraps) applyCustomization(v, { wrap: r.id });
    const c = applyCustomization(v, { paint: 'deep-blue', boost: 'inferno', underglow: 'rainbow', spoiler: 'wing' }); c.setBoost(1); c.update(0.1); JSON.stringify(c);
  }
  const bot = createHelperRobot({ quality: q }); const idle = createRobotIdle(bot); for (let i = 0; i < 100; i++) idle.update(1 / 60); idle.setWave(true); idle.update(0.5);
  console.log(q, '| car', tris(car), '| truck', tris(truck), `(${PICKUP_NAME})`, '| robot', tris(bot), '| rcs puffs', rcsT.activeCount, '/', THRUSTER_BUDGET[q], '|', names);
  rcsT.dispose(); rcsC.dispose(); car.userData.dispose(); truck.userData.dispose(); bot.userData.dispose();
  createMoonMaterial({ quality: q }).dispose(); createMarsMaterial({ quality: q }).dispose();
  const ms = createMoonSky({ quality: q }); ms.update(new THREE.PerspectiveCamera(), 0.1); ms.dispose();
  const rs = createMarsSky({ quality: q }); for (const t of [0, 0.25, 0.5, 0.74]) rs.setTimeOfDay(t); rs.setDust(1); rs.dispose();
}
{ // game save ids -> art selection -> applyCustomization, for every shop id
  const { fromGameSelection } = await import('../custom/gameMap.js');
  const ids = { paint: ['red','white','black','blue','silver','steel','green','orange','purple','gold','cyan','pink','mars','moon','mint','plasma','void','sunset','aurora','liquid'],
    finish: ['gloss','metallic','matte','satin','brushed','pearl','chrome','candy','chameleon'], wrap: ['none','stripes','camo','carbon','checker','flames','lightning','digital','galaxy','circuit','tiger','retrowave'],
    rims: ['aero','spoke5','mesh','turbine','forged','neon','blade','hologram'], spoiler: ['none','lip','ducktail','wing','swan','dual','active'],
    underglow: ['none','#00e5ff','#ff2f92','#39ff6a','#7a2cff','#ffb000','#ffffff','rainbow','pulse'], flame: ['ion','classic','toxic','pink','gold','violet','white','rainbow'] };
  const v = createHypercar({ quality: 'medium' }); const uns = new Set();
  const n = Math.max(...Object.values(ids).map(a => a.length));
  for (let i = 0; i < n; i++) { const g = {}; for (const [k, a] of Object.entries(ids)) g[k] = a[i % a.length]; const r = fromGameSelection(g); r.unsupported.forEach(u => uns.add(u)); applyCustomization(v, r.selection).update(0.016); }
  v.userData.dispose(); console.log('gameMap ok; unsupported (keep game impl):', [...uns].join(' '));
}
console.log('ALL OK');
