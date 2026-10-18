// Preview harness for the art modules (dev only, not shipped). Served by vite.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createHypercar } from './car/createHypercar.js';
import { createPickup } from './truck/createPickup.js';
import { createColdGasThrusters } from './fx/coldGasThrusters.js';
import { applyCustomization } from './custom/catalog.js';
import { createHelperRobot, createRobotIdle } from './robot/createHelperRobot.js';
import { createMoonMaterial } from './terrain/moonMaterial.js';
import { createMarsMaterial } from './terrain/marsMaterial.js';
import { createMoonSky } from './sky/moonSky.js';
import { createMarsSky } from './sky/marsSky.js';
import { createPostPipeline, applyShadowPreset, PRESETS } from './post/ultraPost.js';
// read-only use of the game's level/track/terrain generators for realistic previews
import { LEVELS, PLANETS } from '../src/levels.js';
import { buildTrack, buildRoadArrays } from '../src/track.js';
import { makeTerrain, terrainArrays } from '../src/terrain.js';

const qs = new URLSearchParams(location.search);
const sceneName = qs.get('scene') || 'car';
const preset = qs.get('preset') || 'ultra';
const extra = qs.get('extra') || '';
const live = qs.get('live') === '1';
const hud = document.getElementById('hud');
const errors = []; window.__errors = errors;
window.addEventListener('error', e => errors.push(String(e.message)));

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight, false);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(sceneName.startsWith('car') || sceneName === 'robot' ? 32 : 55, innerWidth / innerHeight, 0.1, 9000);
const updaters = [];

function roadTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#2a2b2e'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4000; i++) { const v = 30 + Math.random() * 30; g.fillStyle = `rgb(${v},${v},${v + 2})`; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
  g.fillStyle = '#e8e4d8'; g.fillRect(6, 0, 5, 256); g.fillRect(245, 0, 5, 256);
  g.fillStyle = '#2ee6ff'; g.fillRect(126, 0, 4, 128);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

function studio() {
  const pm = new THREE.PMREMGenerator(renderer);
  // Softbox studio env (bounded HDR, like the game's showroom/env.js). RoomEnvironment's ~50x ceiling
  // emitters produced clipped hotspots on metal/clearcoat that bloom then amplified.
  const es = new THREE.Scene();
  es.add(new THREE.Mesh(new THREE.SphereGeometry(20, 24, 12), new THREE.MeshBasicMaterial({ color: 0x1a1d24, side: THREE.BackSide })));
  const box = (w, h, x, y, z, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k * 1.04), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); es.add(m); };
  box(14, 3, 0, 12, 0, 3.2); box(6, 8, -14, 4, 6, 1.6); box(6, 8, 14, 4, -6, 1.2); box(10, 2, 0, 1, -15, 0.8);
  scene.environment = pm.fromScene(es, 0.03).texture;
  scene.environmentIntensity = 1.0;
  scene.background = new THREE.Color(0x07090d);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x0a0b0d, roughness: 0.7, metalness: 0.0, envMapIntensity: 0.15 }));
  floor.receiveShadow = true; scene.add(floor);
  const key = new THREE.DirectionalLight(0xffffff, 2.6); key.position.set(-4, 7, 5); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5 }); key.shadow.bias = -0.0003; key.shadow.normalBias = 0.02;
  scene.add(key);
  // Truck shots: neutral rim + fill. The flank facing camera is in key shadow, so polished stainless would
  // otherwise just mirror the car studio's cyan rim and read blue.
  const steelShot = sceneName.startsWith('truck');
  if (steelShot) { const fill = new THREE.DirectionalLight(0xf2f4f7, 0.9); fill.position.set(7, 3, 3); scene.add(fill); }
  const rim = new THREE.SpotLight(steelShot ? 0xdfe9f5 : 0x66ccff, steelShot ? 24 : 30, 20, 0.5, 0.6); rim.position.set(5, 2.5, -6); rim.target.position.set(0, 0.6, 0); scene.add(rim.target); scene.add(rim);
  // softbox strip above (shows in clearcoat reflections)
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(8, 0.5), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 1.2, 1.2) }));
  strip.position.set(0, 5, 0); strip.rotation.x = Math.PI / 2; scene.add(strip);
}

function planet(levelId, kind) {
  const level = LEVELS.find(l => l.id === levelId) || LEVELS.find(l => l.planet === kind);
  const tr = buildTrack(level, PLANETS[level.planet].gravity);
  const T = makeTerrain(tr, level);
  const P = PRESETS[preset];
  const { pos, idx } = terrainArrays(T, Math.min(P.terrainRes, 448));
  const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); tg.setIndex(new THREE.BufferAttribute(idx, 1)); tg.computeVertexNormals();
  const terrainMat = kind === 'moon' ? createMoonMaterial({ quality: preset }) : createMarsMaterial({ quality: preset, dustAmount: 0.45 });
  const terrain = new THREE.Mesh(tg, terrainMat); terrain.receiveShadow = true; terrain.castShadow = true; scene.add(terrain);
  const ra = buildRoadArrays(tr);
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(ra.top.pos, 3)); rg.setAttribute('uv', new THREE.Float32BufferAttribute(ra.top.uv, 2)); rg.setIndex(ra.top.idx); rg.computeVertexNormals();
  const road = new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ map: roadTexture(), roughness: 0.8, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2 })); road.receiveShadow = true; scene.add(road);
  const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(ra.walls.pos, 3)); wg.setIndex(ra.walls.idx); wg.computeVertexNormals();
  const walls = new THREE.Mesh(wg, new THREE.MeshStandardMaterial({ color: 0xc9ccd2, roughness: 0.7, metalness: 0.0, side: THREE.DoubleSide })); walls.castShadow = true; walls.receiveShadow = true; scene.add(walls);
  return { tr, T };
}

function placeOnTrack(obj, tr, i, lateral = 0, lift = 0.72) {
  const s = tr.samples[i];
  obj.position.copy(s.p).addScaledVector(s.X, lateral).addScaledVector(s.U, lift);
  obj.quaternion.copy(s.q);
  return s;
}

let sky = null;
const car = createHypercar({ quality: preset });
if (!sceneName.startsWith('truck') && !['custom-grid', 'glow-boost'].includes(sceneName)) scene.add(car);

if (sceneName === 'truck' || sceneName === 'truck-34') {
  studio();
  const truck = createPickup({ quality: preset }); truck.position.y = 0.86; scene.add(truck);
  truck.userData.setSteer(sceneName === 'truck' ? 0 : 0.3);
  if (sceneName === 'truck') { camera.fov = 30; camera.position.set(2.4, 1.15, 10.5); } else { camera.fov = 32; camera.position.set(6.2, 2.2, 7.4); }
  camera.updateProjectionMatrix(); camera.lookAt(0, 0.95, 0);
} else if (sceneName === 'truck-thrusters') {
  studio();
  const truck = createPickup({ quality: preset }); truck.position.set(0, 2.9, 0); truck.rotation.set(0.04, -0.25, -0.1); scene.add(truck);
  truck.userData.wheels.forEach(w => { w.pivot.position.y -= 0.14; }); // suspension at full droop in the air
  const rcs = createColdGasThrusters(truck, { quality: preset, scene });
  for (let k = 0; k < 40; k++) { rcs.hover(1.0); if (k > 18) rcs.fire(new THREE.Vector3(-1, 0, 0), 1.2); if (k > 28) rcs.fire(new THREE.Vector3(0, 0, -1), 0.8); rcs.update(1 / 60); }
  camera.fov = 34; camera.position.set(8.5, 5.2, 9.5); camera.updateProjectionMatrix(); camera.lookAt(0, 1.6, 0);
} else if (sceneName === 'custom-grid') {
  studio();
  const looks = [
    { name: 'Deep Blue · Pearl · Hex · Y-Spoke · Wing', sel: { paint: 'deep-blue', finish: 'pearl', wrap: 'hex', wheels: 'yspoke', spoiler: 'wing' } },
    { name: 'Obsidian · Matte · Carbon · Turbine · Ducktail', sel: { paint: 'obsidian', finish: 'matte', wrap: 'carbon', wheels: 'turbine', spoiler: 'ducktail' } },
    { name: 'Pearl White · Gloss · Stripes · Aero · Lip', sel: { paint: 'pearl-white', finish: 'gloss', wrap: 'stripes', wheels: 'aero', spoiler: 'lip', wrapA: '#c4081c' } },
    { name: 'Quicksilver · Chrome · Lattice', sel: { paint: 'quicksilver', finish: 'chrome', wrap: 'none', wheels: 'mesh', rimColor: 'gold', spoiler: 'none' } },
    { name: 'Mars Dust · Satin · Camo · Beadlock', sel: { paint: 'mars-dust', finish: 'satin', wrap: 'camo', wheels: 'offroad', spoiler: 'none' } },
    { name: 'Nebula Purple · Metallic · Fade · Neon', sel: { paint: 'nebula-purple', finish: 'metallic', wrap: 'fade', wheels: 'neon', spoiler: 'wing', wrapB: '#ff2f92' } },
    { name: 'Solar Orange · Metallic · Stripes · Y-Spoke', sel: { paint: 'solar-orange', finish: 'metallic', wrap: 'stripes', wheels: 'yspoke', spoiler: 'ducktail', wrapA: '#0d0d10', wrapB: '#ffffff', rimColor: 'black' } },
    { name: 'Ferrox · Brushed · Beadlock · Lip', truck: true, sel: { wheels: 'offroad', spoiler: 'lip', rimColor: 'black' } },
  ];
  const labels = [];
  looks.forEach((L, i) => {
    const v = L.truck ? createPickup({ quality: preset }) : createHypercar({ quality: preset });
    const col = i % 4, row = Math.floor(i / 4);
    v.position.set((col - 1.5) * 3.2, L.truck ? 0.86 : 0.72, (row - 0.5) * -6.4); v.rotation.y = 0.55;
    if (L.truck) v.scale.setScalar(0.82), v.position.y = 0.86 * 0.82;
    scene.add(v); applyCustomization(v, L.sel); v.userData.setLights?.({ head: false }); labels.push([v, L.name]);
  });
  camera.fov = 36; camera.position.set(7.5, 9.5, 14.5); camera.updateProjectionMatrix(); camera.lookAt(0.6, 0, -1.4);
  scene.environmentIntensity = 0.75;
  window.__labels = () => { for (const [v, t] of labels) { const p = v.position.clone().add(new THREE.Vector3(0, -0.9, 1.6)).project(camera); const d = document.createElement('div'); d.textContent = t; Object.assign(d.style, { position: 'fixed', left: ((p.x + 1) / 2 * innerWidth) + 'px', top: ((1 - p.y) / 2 * innerHeight) + 'px', transform: 'translate(-50%,0)', color: '#cfefff', font: '600 12px system-ui', background: 'rgba(5,7,10,.6)', padding: '2px 6px', borderRadius: '6px', whiteSpace: 'nowrap' }); document.body.appendChild(d); } };
} else if (sceneName === 'glow-boost') {
  scene.background = new THREE.Color(0x020306);
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.12;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0x0b0c10, roughness: 0.32, metalness: 0.2, clearcoat: 0.6, clearcoatRoughness: 0.2 }));
  floor.receiveShadow = true; scene.add(floor); floor.material.clearcoat = 0; floor.material.roughness = 0.45;
  const moon = new THREE.DirectionalLight(0x8aa0ff, 0.5); moon.position.set(-5, 8, -3); scene.add(moon);
  const c1 = createHypercar({ quality: preset }); c1.position.set(-1.5, 0.72, -0.6); c1.rotation.y = -0.08; scene.add(c1);
  const h1 = applyCustomization(c1, { paint: 'obsidian', finish: 'gloss', wheels: 'neon', underglow: 'magenta', boost: 'inferno', spoiler: 'wing' });
  const t1 = createPickup({ quality: preset }); t1.position.set(2.6, 0.86, 1.8); t1.rotation.y = 0.05; scene.add(t1);
  const h2 = applyCustomization(t1, { underglow: 'cyan', boost: 'plasma' });
  c1.userData.setLights({ brake: false }); t1.userData.setLights({ brake: false });
  h1.setBoost(1); h2.setBoost(1); for (let k = 0; k < 30; k++) { h1.update(1 / 60); h2.update(1 / 60); }
  updaters.push(dt => { h1.update(dt); h2.update(dt); });
  camera.fov = 42; camera.position.set(-3.2, 1.7, -9.5); camera.updateProjectionMatrix(); camera.lookAt(0.6, 0.6, -1.0);
} else if (sceneName === 'car' || sceneName === 'car-rear') {
  studio();
  car.position.y = 0.72;
  car.userData.setLights({ brake: sceneName === 'car-rear' });
  car.userData.setSteer(sceneName === 'car' ? 0.32 : 0);
  if (sceneName === 'car') camera.position.set(4.6, 1.35, 6.2); else camera.position.set(-4.4, 1.7, -6.0);
  camera.lookAt(0, 0.5, 0);
} else if (sceneName === 'robot') {
  studio();
  car.position.set(1.6, 0.72, -1.5); car.rotation.y = -0.6;
  const a = createHelperRobot({ quality: preset }); a.position.set(-0.6, 0, 0.6); a.rotation.y = 0.35; scene.add(a);
  const b = createHelperRobot({ quality: preset, accent: 0xffb020 }); b.position.set(0.55, 0, 1.4); b.rotation.y = -0.4; scene.add(b);
  const ia = createRobotIdle(a, { seed: 1 }), ib = createRobotIdle(b, { seed: 4 }); ib.setWave(true);
  for (let k = 0; k < 90; k++) { ia.update(1 / 30); ib.update(1 / 30); }
  updaters.push(dt => { ia.update(dt); ib.update(dt); });
  camera.position.set(0.6, 1.45, 5.6); camera.lookAt(0.1, 0.95, 0.4);
} else if (sceneName === 'moon') {
  const { tr } = planet('m1', 'moon');
  sky = createMoonSky({ quality: preset });
  scene.add(sky.object, sky.sun, sky.sun.target, sky.fill);
  const s = placeOnTrack(car, tr, 70, 1.5);
  const fwd = s.T.clone(), left = s.X.clone(), up = s.U.clone();
  camera.position.copy(car.position).addScaledVector(fwd, -7.5).addScaledVector(up, 1.9).addScaledVector(left, -3.2);
  camera.lookAt(car.position.clone().addScaledVector(fwd, 4).addScaledVector(up, 0.8));
  // Earth hanging above the horizon in front of the camera, sun low from the side (long shadows)
  const view = new THREE.Vector3(); camera.getWorldDirection(view);
  sky.dispose(); sky = createMoonSky({ quality: preset, earthDirection: view.clone().setY(0).normalize().add(new THREE.Vector3(0, 0.22, 0)).addScaledVector(left, -0.25), sunDirection: left.clone().multiplyScalar(0.8).add(new THREE.Vector3(0, 0.22, 0)).addScaledVector(fwd, -0.4) });
  scene.add(sky.object, sky.sun, sky.sun.target, sky.fill);
  applyShadowPreset(sky.sun, preset); sky.followTarget(car.position);
  scene.environment = sky.bakeEnvironment(renderer).texture;
  const r = createHelperRobot({ quality: preset }); placeOnTrack(r, tr, 64, -3.5, 0); r.rotateY(0.9); scene.add(r);
  const ir = createRobotIdle(r, { seed: 2 }); ir.setWave(true); for (let k = 0; k < 40; k++) ir.update(1 / 30); updaters.push(dt => ir.update(dt));
} else if (sceneName === 'mars' || sceneName === 'mars-sunset') {
  const { tr } = planet('r2', 'mars');
  const sunset = sceneName === 'mars-sunset';
  const s = tr.samples[sunset ? 380 : 120];
  const fwd = s.T.clone(), left = s.X.clone(), up = s.U.clone();
  // put the sun ahead-left of the camera at sunset so the blue halo is in frame
  const az = Math.atan2(fwd.z, fwd.x) * 180 / Math.PI + (sunset ? 18 : 120);
  sky = createMarsSky({ quality: preset, timeOfDay: sunset ? 0.735 : 0.36, sunAzimuthDeg: az, dust: sunset ? 0.05 : 0.15 });
  scene.add(sky.object, sky.sun, sky.sun.target, sky.fill); scene.fog = sky.fog;
  placeOnTrack(car, tr, s.i, -1.5);
  camera.position.copy(car.position).addScaledVector(fwd, -8).addScaledVector(up, 2.0).addScaledVector(left, 3.0);
  camera.lookAt(car.position.clone().addScaledVector(fwd, 6).addScaledVector(up, sunset ? 2.2 : 0.6));
  applyShadowPreset(sky.sun, preset); sky.followTarget(car.position);
  scene.environment = sky.bakeEnvironment(renderer).texture;
  if (!sunset) { const r = createHelperRobot({ quality: preset, accent: 0xffb020 }); placeOnTrack(r, tr, s.i + 6, 4.2, 0); r.rotateY(-2.4); scene.add(r); const ir = createRobotIdle(r, { seed: 5 }); for (let k = 0; k < 50; k++) ir.update(1 / 30); }
  car.userData.setLights({ brake: sunset });
}

const overrides = {};
if (qs.get('nobloom')) overrides.bloom = null;
if (qs.get('noao')) overrides.ao = { enabled: false };
if (qs.get('nomsaa')) overrides.msaa = 0;
const post = createPostPipeline(renderer, scene, camera, { preset, toneMapping: 'agx', dynamicResolution: live, overrides });
post.setSize(innerWidth, innerHeight);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); post.setSize(innerWidth, innerHeight); });

let frames = 0, last = performance.now();
function frame() {
  const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
  for (const u of updaters) u(live ? dt : 0);
  sky?.update(camera, dt);
  post.render(dt);
  frames++;
  hud.textContent = `${sceneName} | preset ${preset} | ${renderer.info.render.triangles} tris | ${renderer.info.render.calls} calls`;
  if (frames === 3) { window.__labels?.(); window.__ready = true; window.__stats = { tris: renderer.info.render.triangles, calls: renderer.info.render.calls }; }
  if (live || frames < 3) requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
