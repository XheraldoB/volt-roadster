// Bolt-on cosmetic parts: spoilers and underglow. Positioned from vehicle.userData.mounts.
import {
  Group, Mesh, Shape, ExtrudeGeometry, BoxGeometry, PlaneGeometry, ShaderMaterial, AdditiveBlending,
  MeshPhysicalMaterial, Color,
} from 'three';

export const SPOILERS = [
  { id: 'none', name: 'None', preview: '#00000000' },
  { id: 'lip', name: 'Lip', preview: '#9aa1a8' },
  { id: 'ducktail', name: 'Ducktail', preview: '#c4081c' },
  { id: 'wing', name: 'GT Wing', preview: '#121316' },
];
export const UNDERGLOWS = [
  { id: 'none', name: 'Off', color: null, preview: '#222222' },
  { id: 'cyan', name: 'Volt Cyan', color: '#00e5ff', preview: '#00e5ff' },
  { id: 'magenta', name: 'Hot Magenta', color: '#ff2f92', preview: '#ff2f92' },
  { id: 'lime', name: 'Acid Lime', color: '#39ff6a', preview: '#39ff6a' },
  { id: 'violet', name: 'Violet', color: '#7a2cff', preview: '#7a2cff' },
  { id: 'amber', name: 'Amber', color: '#ffb000', preview: '#ffb000' },
  { id: 'rainbow', name: 'Rainbow Cycle', color: 'cycle', preview: '#ffffff' },
];

// profile in (z, y) extruded across X, centred
function extrudeX(pts, width, bevel = 0.004) {
  const sh = new Shape(pts.map(([z, y]) => ({ x: z, y })));
  const g = new ExtrudeGeometry(sh, { depth: width, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 6 });
  g.rotateY(-Math.PI / 2); g.translate(width / 2, 0, 0); return g;
}

export function createSpoiler(vehicle, id, { paintMaterial, quality = 'high' } = {}) {
  if (!id || id === 'none') return null;
  const m = vehicle.userData.mounts?.spoiler; if (!m) return null;
  const w = m.width, group = new Group(); group.name = 'spoiler_' + id; group.position.copy(m.position);
  const geos = [], mats = [];
  const paint = paintMaterial || vehicle.userData.paintMaterials?.[0];
  const carbon = new MeshPhysicalMaterial({ color: 0x0f1012, metalness: 0.3, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.1 }); mats.push(carbon);
  const add = (g, mat, x = 0, y = 0, z = 0) => { geos.push(g); const me = new Mesh(g, mat); me.position.set(x, y, z); me.castShadow = true; group.add(me); return me; };
  if (id === 'lip') add(extrudeX([[0.12, -0.01], [-0.06, -0.01], [-0.1, 0.06], [-0.05, 0.065]], w * 0.92), paint);
  else if (id === 'ducktail') add(extrudeX([[0.3, -0.02], [-0.14, -0.02], [-0.2, 0.14], [-0.12, 0.15], [0.1, 0.05]], w * 0.98, 0.008), paint);
  else if (id === 'wing') {
    // airfoil (rear-facing chord), two swan-neck uprights, end plates
    const foil = [[0.18, 0.0], [0.08, 0.035], [-0.08, 0.04], [-0.17, 0.02], [-0.18, 0.0], [-0.05, -0.012], [0.12, -0.012]];
    add(extrudeX(foil, w * 0.98, 0.006), carbon, 0, 0.34, -0.12).rotation.x = -0.12;
    for (const s of [1, -1]) {
      add(new BoxGeometry(0.025, 0.36, 0.12), carbon, s * w * 0.3, 0.17, -0.05).rotation.x = 0.2;
      add(new BoxGeometry(0.012, 0.13, 0.42), carbon, s * w * 0.495, 0.34, -0.12);
    }
  }
  vehicle.add(group);
  return { group, dispose() { group.removeFromParent(); geos.forEach(g => g.dispose()); mats.forEach(x => x.dispose()); } };
}

const UG_VS = `varying vec2 vUv; void main(){ vUv = uv * 2. - 1.; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
const UG_FS = `uniform vec3 uColor; uniform float uIntensity; uniform vec2 uAspect; varying vec2 vUv;
void main(){ vec2 q = abs(vUv) - (1. - uAspect * .45); float d = length(max(q, 0.)) / .45; float g = exp(-d * d * 3.) * smoothstep(1., .6, max(abs(vUv.x), abs(vUv.y)));
  gl_FragColor = vec4(uColor * g * uIntensity, 1.); }`;

export function createUnderglow(vehicle, color = '#00e5ff', { intensity = 1.6 } = {}) {
  const m = vehicle.userData.mounts?.underglow || { y: -0.7, width: 2, length: 4.4 };
  const pad = 1.4;
  const geo = new PlaneGeometry(m.width + pad, m.length + pad).rotateX(-Math.PI / 2);
  const mat = new ShaderMaterial({ uniforms: { uColor: { value: new Color() }, uIntensity: { value: intensity }, uAspect: { value: { x: pad / (m.width + pad) * 2, y: pad / (m.length + pad) * 2 } } }, vertexShader: UG_VS, fragmentShader: UG_FS, transparent: true, depthWrite: false, blending: AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4 });
  const mesh = new Mesh(geo, mat); mesh.position.y = m.y; mesh.renderOrder = 3; mesh.name = 'underglow';
  // emissive strip under the sills (visible from the side)
  const strip = new Mesh(new BoxGeometry(m.width * 0.82, 0.01, m.length * 0.8), new ShaderMaterial({ uniforms: { uColor: mat.uniforms.uColor, uIntensity: { value: 4 } }, vertexShader: 'void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }', fragmentShader: 'uniform vec3 uColor; uniform float uIntensity; void main(){ gl_FragColor = vec4(uColor * uIntensity, 1.); }' }));
  strip.position.y = m.y + 0.13;
  const group = new Group(); group.name = 'underglowGroup'; group.add(mesh, strip); vehicle.add(group);
  let t = 0, cycle = false;
  const api = {
    group,
    setColor(c) { cycle = c === 'cycle'; if (!cycle) mat.uniforms.uColor.value.set(c); },
    setIntensity(x) { mat.uniforms.uIntensity.value = x; },
    update(dt) { t += dt; if (cycle) mat.uniforms.uColor.value.setHSL((t * 0.15) % 1, 1, 0.55); },
    dispose() { group.removeFromParent(); geo.dispose(); mat.dispose(); strip.geometry.dispose(); strip.material.dispose(); },
  };
  api.setColor(color);
  return api;
}
