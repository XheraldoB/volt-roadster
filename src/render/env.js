// Sky, lighting, fog, environment maps and scenery for each world.
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { starsTexture, planetTexture, noiseNormalMap, windowsTexture } from './textures.js';

export const ENVS = {
  day:       { sky: 'sky', elev: 42, azim: 150, turb: 5, rayl: 1.4, fog: 0xc9d8e6, fogD: 0.00035, sun: 0xfff1dd, sunI: 3.0, hemi: [0xbfd8ff, 0x8a6a4a, 0.6], exposure: 0.8, road: 'asphalt', ground: 'desert' },
  afternoon: { sky: 'sky', elev: 20, azim: 230, turb: 7, rayl: 2, fog: 0xe6c9a6, fogD: 0.0004, sun: 0xffd6a0, sunI: 3.0, hemi: [0xffd9b0, 0x7a4a2a, 0.55], exposure: 0.8, road: 'asphalt', ground: 'canyon' },
  sunset:    { sky: 'sky', elev: 4, azim: 260, turb: 9, rayl: 3, fog: 0xf0a070, fogD: 0.0006, sun: 0xff9a50, sunI: 2.6, hemi: [0xff9f80, 0x404060, 0.75], exposure: 0.75, road: 'asphalt', ground: 'coast', ocean: true },
  spaceport: { sky: 'sky', elev: 30, azim: 120, turb: 4, rayl: 1.2, fog: 0xcfe0ee, fogD: 0.00035, sun: 0xffffff, sunI: 3.0, hemi: [0xcfe6ff, 0x6a6a5a, 0.6], exposure: 0.85, road: 'spaceport', ground: 'coast', ocean: true },
  night:     { sky: 'grad', top: 0x02030a, hor: 0x1a1240, bot: 0x05050a, stars: 0.6, fog: 0x140f2a, fogD: 0.0012, sun: 0x8090ff, sunI: 0.5, sunDir: [0.3, 0.6, -0.4], hemi: [0x4050a0, 0x201030, 0.6], exposure: 1.1, road: 'neon', ground: 'city' },
  moon:      { sky: 'grad', top: 0x000000, hor: 0x05060a, bot: 0x000000, stars: 1, fog: 0x000000, fogD: 0.00012, sun: 0xffffff, sunI: 4.2, sunDir: [-0.5, 0.45, 0.35], hemi: [0x404858, 0x101010, 0.35], exposure: 0.95, road: 'moon', ground: 'moon', earth: true },
  moonnight: { sky: 'grad', top: 0x000000, hor: 0x02030a, bot: 0x000000, stars: 1.3, fog: 0x000000, fogD: 0.0001, sun: 0x9fb4ff, sunI: 1.1, sunDir: [0.2, 0.3, -0.6], hemi: [0x2a3550, 0x080808, 0.35], exposure: 1.2, road: 'moon', ground: 'moon', earth: true, lamps: true },
  mars:      { sky: 'grad', top: 0x7a4a33, hor: 0xd9a170, bot: 0x6a3a22, stars: 0, fog: 0xc98a5a, fogD: 0.0009, sun: 0xffe0b8, sunI: 3.0, sunDir: [0.4, 0.5, 0.3], hemi: [0xe0a070, 0x5a2a18, 0.8], exposure: 0.85, road: 'mars', ground: 'mars' },
  marsstorm: { sky: 'grad', top: 0x6a3a26, hor: 0xb07040, bot: 0x5a2a18, stars: 0, fog: 0xa86a40, fogD: 0.0022, sun: 0xffd0a0, sunI: 2.2, sunDir: [0.5, 0.6, 0.2], hemi: [0xc08050, 0x4a2010, 0.9], exposure: 0.9, road: 'mars', ground: 'mars', storm: true },
};

const gradSky = (e) => new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color(e.top) }, hor: { value: new THREE.Color(e.hor) }, bot: { value: new THREE.Color(e.bot) }, sunDir: { value: new THREE.Vector3(...e.sunDir).normalize() }, sunCol: { value: new THREE.Color(e.sun) }, stars: { value: starsTexture() }, starAmt: { value: e.stars || 0 } },
  vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }',
  fragmentShader: `uniform vec3 top, hor, bot, sunDir, sunCol; uniform sampler2D stars; uniform float starAmt; varying vec3 vDir;
  void main(){ vec3 d = normalize(vDir); float h = d.y;
    vec3 col = h > 0.0 ? mix(hor, top, pow(h, 0.55)) : mix(hor, bot, pow(-h, 0.4));
    float s = max(dot(d, sunDir), 0.0); col += sunCol * (pow(s, 900.0) * 6.0 + pow(s, 12.0) * 0.18);
    vec2 uv = vec2(atan(d.z, d.x) / 6.2831853 + 0.5, asin(clamp(d.y,-1.0,1.0)) / 3.14159265 + 0.5);
    col += texture2D(stars, uv).rgb * starAmt * smoothstep(-0.05, 0.2, h);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`,
});

export function buildEnvironment(scene, renderer, envName, quality, center) {
  const e = ENVS[envName] || ENVS.day; const out = { e, update: () => {} };
  const sunDir = new THREE.Vector3();
  let skyMesh;
  if (e.sky === 'sky') {
    const sky = new Sky(); sky.scale.setScalar(4500);
    const u = sky.material.uniforms; u.turbidity.value = e.turb; u.rayleigh.value = e.rayl; u.mieCoefficient.value = 0.004; u.mieDirectionalG.value = 0.85;
    const phi = THREE.MathUtils.degToRad(90 - e.elev), th = THREE.MathUtils.degToRad(e.azim);
    sunDir.setFromSphericalCoords(1, phi, th); u.sunPosition.value.copy(sunDir); skyMesh = sky;
  } else { sunDir.set(...e.sunDir).normalize(); skyMesh = new THREE.Mesh(new THREE.SphereGeometry(4000, 32, 16), gradSky(e)); }
  skyMesh.frustumCulled = false; scene.add(skyMesh); out.sky = skyMesh;
  // environment map (reflections on paint/glass)
  const pm = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene(); const skyClone = skyMesh.clone(); skyClone.material = skyMesh.material.clone(); if (skyClone.material.uniforms?.starAmt) skyClone.material.uniforms.starAmt.value = 0; envScene.add(skyClone);
  const groundCol = { desert: 0x9a7650, canyon: 0x8a5a38, coast: 0x5a6a50, city: 0x101018, moon: 0x404040, mars: 0x8a4a2a }[e.ground];
  const g = new THREE.Mesh(new THREE.SphereGeometry(100, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshBasicMaterial({ color: groundCol, side: THREE.BackSide })); envScene.add(g);
  if (e.ground === 'city') for (let k = 0; k < 30; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(6, 20 + Math.random() * 30, 6), new THREE.MeshBasicMaterial({ color: [0xff2bd6, 0x29e7ff, 0xffb000][k % 3] })); const a = k / 30 * Math.PI * 2; b.position.set(Math.cos(a) * 60, 0, Math.sin(a) * 60); envScene.add(b); }
  const envRT = pm.fromScene(envScene, 0.02, 1, 5000); scene.environment = envRT.texture; scene.environmentIntensity = e.sky === 'sky' ? 0.28 : envName.startsWith('moon') ? 0.5 : 0.8; pm.dispose(); out.envRT = envRT;
  scene.background = null;
  scene.fog = new THREE.FogExp2(e.fog, e.fogD * (quality.draw < 1500 ? 1.6 : 1));
  // lights
  const hemi = new THREE.HemisphereLight(e.hemi[0], e.hemi[1], e.hemi[2]); scene.add(hemi);
  const sun = new THREE.DirectionalLight(e.sun, e.sunI); sun.position.copy(sunDir).multiplyScalar(200);
  if (quality.shadows) {
    sun.castShadow = true; sun.shadow.mapSize.set(quality.shadows, quality.shadows);
    const S = quality.shadows >= 4096 ? 70 : 55; Object.assign(sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 1, far: 600 });
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04; sun.shadow.radius = 3; sun.shadow.camera.updateProjectionMatrix();
  }
  scene.add(sun); scene.add(sun.target); out.sun = sun; out.sunDir = sunDir;
  out.follow = (p) => { sun.position.copy(p).addScaledVector(sunDir, 250); sun.target.position.copy(p); };
  // Earth in the lunar sky
  if (e.earth) {
    const earth = new THREE.Mesh(new THREE.SphereGeometry(120, 48, 24), new THREE.MeshStandardMaterial({ map: planetTexture('earth'), emissive: 0x112244, emissiveIntensity: 0.2, roughness: 0.8, fog: false }));
    earth.position.set(center.x - 1500, 900, center.z - 2600); scene.add(earth); out.earth = earth;
    const atm = new THREE.Mesh(new THREE.SphereGeometry(126, 48, 24), new THREE.MeshBasicMaterial({ color: 0x5aa0ff, transparent: true, opacity: 0.18, side: THREE.BackSide, fog: false })); atm.position.copy(earth.position); scene.add(atm);
  }
  if (e.ground === 'mars') { // tiny Phobos
    const ph = new THREE.Mesh(new THREE.IcosahedronGeometry(30, 2), new THREE.MeshStandardMaterial({ color: 0x6a5a50, roughness: 1, fog: false })); ph.position.set(center.x + 1200, 1500, center.z - 2400); scene.add(ph);
  }
  // ocean
  if (e.ocean) {
    const nm = noiseNormalMap(6, 1.4).clone(); nm.repeat.set(220, 220); nm.needsUpdate = true;
    const water = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshPhysicalMaterial({ color: 0x0b3a5c, roughness: 0.06, metalness: 0.1, normalMap: nm, normalScale: new THREE.Vector2(0.6, 0.6), clearcoat: 1, envMapIntensity: 1.3 }));
    water.rotation.x = -Math.PI / 2; water.receiveShadow = true; out.water = water; scene.add(water);
    out.update = (dt, t) => { nm.offset.set(t * 0.01, t * 0.006); };
  }
  out.exposure = e.exposure;
  return out;
}

export { windowsTexture };
