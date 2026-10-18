// Procedural vehicle wraps, evaluated in the paint shader (no textures, no UVs needed):
// object-space projection picked by the dominant normal axis. Original patterns.
//
//   installWrap(paintMaterial);                 // once per material (idempotent)
//   setWrap(paintMaterial, 'hex', { a: '#111', b: '#2ee6ff', scale: 0.3 });
//   setWrap(paintMaterial, 'none');
import { Color } from 'three';

export const WRAPS = [
  { id: 'none', name: 'None', mode: 0, preview: ['#00000000', '#00000000'] },
  { id: 'carbon', name: 'Carbon Weave', mode: 1, a: '#121316', b: '#2c2f35', scale: 0.12, preview: ['#121316', '#2c2f35'] },
  { id: 'hex', name: 'Hex Grid', mode: 2, a: '#2ee6ff', b: '#0b0d10', scale: 0.32, preview: ['#2ee6ff', '#0b0d10'] },
  { id: 'stripes', name: 'Twin Stripes', mode: 3, a: '#f2f2f0', b: '#0d0d10', scale: 1.0, preview: ['#f2f2f0', '#0d0d10'] },
  { id: 'camo', name: 'Digital Camo', mode: 4, a: '#3c4a3a', b: '#1d221c', scale: 0.09, preview: ['#3c4a3a', '#1d221c'] },
  { id: 'fade', name: 'Pixel Fade', mode: 5, a: '#0d0d10', b: '#2ee6ff', scale: 0.07, preview: ['#0d0d10', '#2ee6ff'] },
];

const DECL = /* glsl */`
uniform int uWrapMode; uniform vec3 uWrapA, uWrapB; uniform float uWrapScale, uWrapZ0, uWrapLen, uWrapMidY;
varying vec3 vWrapPos; varying vec3 vWrapNrm;
float wr_h(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 wr_proj(vec3 p, vec3 n){ vec3 a = abs(n); return a.y > a.x && a.y > a.z ? p.zx : (a.x > a.z ? p.zy : p.xy); }
float wr_hex(vec2 p){ // distance to hex cell edge (0 at edge, ~.5 at centre)
  const vec2 s = vec2(1., 1.7320508);
  vec4 hc = floor(vec4(p, p - vec2(.5, 1.)) / s.xyxy) + .5;
  vec4 h = vec4(p - hc.xy * s, p - (hc.zw + .5) * s);
  vec2 q = dot(h.xy, h.xy) < dot(h.zw, h.zw) ? h.xy : h.zw;
  q = abs(q); return .5 - max(dot(q, s * .5), q.x);
}
// returns rgb in .rgb, coverage in .a
vec4 wrapColor(vec3 p, vec3 n){
  if (uWrapMode == 0) return vec4(0.);
  vec2 uv = wr_proj(p, n);
  if (uWrapMode == 1) { // carbon 2x2 twill
    vec2 g = uv / uWrapScale * 4.; vec2 c = floor(g);
    bool horiz = mod(c.x + c.y, 4.) < 2.;
    float fib = .5 + .5 * sin((horiz ? g.y : g.x) * 6.283 * 3.);
    float tow = horiz ? smoothstep(0., .15, fract(g.y)) * smoothstep(1., .85, fract(g.y)) : smoothstep(0., .15, fract(g.x)) * smoothstep(1., .85, fract(g.x));
    return vec4(mix(uWrapA, uWrapB, fib * .6 * tow + (horiz ? .25 : 0.)), 1.);
  }
  if (uWrapMode == 2) { // hex grid lines
    float d = wr_hex(uv / uWrapScale);
    float line = 1. - smoothstep(.02, .045, d);
    float pulse = step(.93, wr_h(floor(uv / uWrapScale * 1.0)));
    return vec4(mix(uWrapB, uWrapA, line), max(line, pulse * .35));
  }
  if (uWrapMode == 3) { // twin racing stripes over the top + side pinstripe
    float ax = abs(p.x);
    float top = step(.3, n.y + abs(n.z) * .8);
    float st = top * step(.07, ax) * step(ax, .2);
    float pin = top * (step(.045, ax) * step(ax, .06) + step(.21, ax) * step(ax, .225));
    float side = step(.6, abs(n.x)) * (1. - step(.035, abs(p.y - uWrapMidY)));
    return vec4(mix(uWrapA, uWrapB, pin), clamp(st + pin + side, 0., 1.));
  }
  if (uWrapMode == 4) { // digital camo: 3 tones, two block scales
    vec2 c1 = floor(uv / (uWrapScale * 3.)), c2 = floor(uv / uWrapScale);
    float v = wr_h(c1) * .6 + wr_h(c2 + 7.) * .4;
    vec3 col = v < .38 ? uWrapA : v < .62 ? uWrapB : mix(uWrapA, vec3(.55, .58, .5), .5);
    return vec4(col, v < .8 ? 1. : 0.);
  }
  if (uWrapMode == 5) { // halftone pixel fade from front (paint) to rear (colour A) + accent edge
    float t = smoothstep(uWrapZ0 + uWrapLen * .75, uWrapZ0 + uWrapLen * .2, p.z);
    vec2 g = uv / uWrapScale; vec2 f = fract(g) - .5;
    float r = max(abs(f.x), abs(f.y));
    float dotm = step(r, t * .55);
    float edge = step(r, (t - .15) * .55) * (1. - step(r, (t - .3) * .55));
    return vec4(mix(uWrapA, uWrapB, edge), dotm);
  }
  return vec4(0.);
}
`;

export function installWrap(material) {
  if (material.userData.wrap) return material.userData.wrap;
  const u = {
    uWrapMode: { value: 0 }, uWrapA: { value: new Color() }, uWrapB: { value: new Color() }, uWrapScale: { value: 0.3 },
    uWrapZ0: { value: -2.2 }, uWrapLen: { value: 4.4 }, uWrapMidY: { value: 0.45 },
  };
  material.userData.wrap = u;
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, r) => {
    prev?.call(material, shader, r);
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWrapPos; varying vec3 vWrapNrm;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWrapPos = position; vWrapNrm = normal;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + DECL)
      .replace('#include <map_fragment>', '#include <map_fragment>\n{ vec4 wc = wrapColor(vWrapPos, normalize(vWrapNrm)); diffuseColor.rgb = mix(diffuseColor.rgb, wc.rgb, wc.a); }');
  };
  const prevKey = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () => (prevKey ? prevKey() : '') + '|wrap';
  material.needsUpdate = true;
  return u;
}

// geometry hints: { z0, length, midY } of the vehicle in the paint mesh's local frame
export function setWrap(material, id, { a, b, scale, z0, length, midY } = {}) {
  const w = WRAPS.find(x => x.id === id) || WRAPS[0];
  const u = installWrap(material);
  u.uWrapMode.value = w.mode;
  if (w.mode) { u.uWrapA.value.set(a || w.a); u.uWrapB.value.set(b || w.b); u.uWrapScale.value = scale || w.scale; }
  if (z0 !== undefined) u.uWrapZ0.value = z0; if (length !== undefined) u.uWrapLen.value = length; if (midY !== undefined) u.uWrapMidY.value = midY;
  return u;
}
