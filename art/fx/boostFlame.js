// Boost flame / plasma jet effect (additive shader cones + optional shock diamonds).
// The game had no dedicated flame mesh (only particles), so this is a drop-in visual.
//
//   import { createBoostFlame, BOOST_VARIANTS } from './art/fx/boostFlame.js';
//   const flame = createBoostFlame(car, { variant: 'plasma', quality: 'ultra' });
//   // per frame: flame.setIntensity(boosting ? 1 : 0); flame.update(dt);
//   flame.setVariant('inferno'); flame.dispose();
// Mount points: vehicle.userData.mounts.boost (array of Vector3 in vehicle frame), or opts.mounts.
import { Group, Mesh, CylinderGeometry, SphereGeometry, ShaderMaterial, AdditiveBlending, Color, Vector3, DoubleSide } from 'three';

export const BOOST_VARIANTS = [
  { id: 'plasma', name: 'Plasma Blue', core: '#e8fbff', mid: '#7cc4ff', outer: '#1f5cff' },
  { id: 'volt', name: 'Volt Cyan', core: '#f0ffff', mid: '#6ff4ff', outer: '#00b8d9' },
  { id: 'inferno', name: 'Inferno', core: '#fff4c8', mid: '#ffae3a', outer: '#ff3d00' },
  { id: 'toxic', name: 'Toxic Green', core: '#f4ffe0', mid: '#9cff5a', outer: '#1fbf2a' },
  { id: 'nebula', name: 'Nebula Magenta', core: '#fff0ff', mid: '#ff7ae0', outer: '#9b1fff' },
  { id: 'solar', name: 'Solar Gold', core: '#fffbe6', mid: '#ffd84a', outer: '#ff9a00' },
  { id: 'whitehot', name: 'White Hot', core: '#ffffff', mid: '#dfe8ff', outer: '#8fa6ff' },
];
const Q = { ultra: { seg: 24, rings: 10, diamonds: 4 }, high: { seg: 18, rings: 8, diamonds: 3 }, medium: { seg: 12, rings: 6, diamonds: 0 }, low: { seg: 8, rings: 4, diamonds: 0 } };

const VS = `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main(){ vUv = uv; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
const FS = `uniform vec3 uCore, uMid, uOuter; uniform float uTime, uIntensity, uLayer; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
float h(float n){ return fract(sin(n) * 43758.5453); }
float n1(float x){ float i = floor(x), f = fract(x); return mix(h(i), h(i + 1.), f * f * (3. - 2. * f)); }
void main(){
  float t = 1. - vUv.y;                       // 0 at nozzle, 1 at tip
  float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.5); // soft silhouette
  float flick = .75 + .25 * n1(uTime * 30. + vUv.x * 6.283 * 2. + t * 8.);
  float fall = pow(1. - t, 1.4 + uLayer);
  vec3 col = mix(uCore, uMid, smoothstep(0., .35, t)); col = mix(col, uOuter, smoothstep(.3, 1., t));
  float a = fall * edge * flick * uIntensity;
  gl_FragColor = vec4(col * a * (uLayer > .5 ? 6. : 3.), 1.);
}`;
const DIAMOND_FS = `uniform vec3 uCore; uniform float uIntensity; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main(){ float e = pow(abs(dot(normalize(vN), normalize(vV))), 3.); gl_FragColor = vec4(uCore * e * uIntensity * 4., 1.); }`;

export function createBoostFlame(vehicle, opts = {}) {
  const { quality = vehicle?.userData?.quality || 'high', variant = 'plasma', length = 1.4, radius = 0.11 } = opts;
  const mounts = opts.mounts || vehicle?.userData?.mounts?.boost || [new Vector3(0, 0, -2)];
  const q = Q[quality] || Q.high;
  const group = new Group(); group.name = 'boostFlames';
  const uniforms = { uCore: { value: new Color() }, uMid: { value: new Color() }, uOuter: { value: new Color() }, uTime: { value: 0 }, uIntensity: { value: 0 }, uLayer: { value: 0 } };
  const mk = (layer) => new ShaderMaterial({ uniforms: { ...uniforms, uLayer: { value: layer } }, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide, toneMapped: true });
  const outerMat = mk(0), coreMat = mk(1);
  // share colour/time/intensity uniforms across both layers
  for (const m of [outerMat, coreMat]) for (const k of ['uCore', 'uMid', 'uOuter', 'uTime', 'uIntensity']) m.uniforms[k] = uniforms[k];
  const dMat = q.diamonds ? new ShaderMaterial({ uniforms: { uCore: uniforms.uCore, uIntensity: uniforms.uIntensity }, vertexShader: VS, fragmentShader: DIAMOND_FS, transparent: true, depthWrite: false, blending: AdditiveBlending }) : null;
  // cone along -Z: base (nozzle) at z=0, tip at z=-1 (scaled by length)
  // top cap (y=0, uv.y=1) = nozzle radius r0, bottom (y=-1) = tip r1; rotateX(+90deg) maps -Y to -Z
  const cone = (r0, r1) => { const g = new CylinderGeometry(r0, r1, 1, q.seg, q.rings, true); g.translate(0, -0.5, 0); g.rotateX(Math.PI / 2); return g; };
  const gOuter = cone(radius, radius * 0.25), gCore = cone(radius * 0.55, radius * 0.08);
  const gDiamond = q.diamonds ? new SphereGeometry(radius * 0.35, 10, 8).scale(1, 1, 1.8) : null;
  const jets = mounts.map((p) => {
    const j = new Group(); j.position.copy(p);
    const outer = new Mesh(gOuter, outerMat), core = new Mesh(gCore, coreMat);
    outer.frustumCulled = core.frustumCulled = false; outer.renderOrder = core.renderOrder = 5;
    j.add(outer, core);
    const diamonds = [];
    for (let i = 0; i < q.diamonds; i++) { const d = new Mesh(gDiamond, dMat); d.renderOrder = 6; j.add(d); diamonds.push(d); }
    group.add(j); return { j, outer, core, diamonds };
  });
  vehicle?.add?.(group);
  let intensity = 0, target = 0, time = 0;
  const api = {
    group,
    setVariant(id) { const v = BOOST_VARIANTS.find(b => b.id === id) || BOOST_VARIANTS[0]; uniforms.uCore.value.set(v.core); uniforms.uMid.value.set(v.mid); uniforms.uOuter.value.set(v.outer); api.variant = v.id; },
    // free colours (game shop flames, animated rainbow): any THREE.Color-compatible values
    setColors(core, mid, outer) { uniforms.uCore.value.set(core); uniforms.uMid.value.set(mid); uniforms.uOuter.value.set(outer); api.variant = 'custom'; },
    setIntensity(x) { target = Math.max(0, Math.min(1.5, x)); },
    update(dt) {
      time += dt; uniforms.uTime.value = time;
      intensity += (target - intensity) * Math.min(1, dt * (target > intensity ? 18 : 8));
      uniforms.uIntensity.value = intensity;
      group.visible = intensity > 0.01;
      for (const { outer, core, diamonds } of jets) {
        const L = length * (0.35 + 0.65 * intensity) * (0.92 + 0.08 * Math.sin(time * 47));
        outer.scale.set(1, 1, L); core.scale.set(1, 1, L * 0.55);
        diamonds.forEach((d, i) => { d.position.z = -L * (0.16 + i * 0.17); d.scale.setScalar(1 - i * 0.18); });
      }
    },
    dispose() { group.removeFromParent(); gOuter.dispose(); gCore.dispose(); gDiamond?.dispose(); outerMat.dispose(); coreMat.dispose(); dMat?.dispose(); },
  };
  api.setVariant(variant);
  return api;
}
