// Shared sky helpers: camera-following dome, HDR output chunks, PMREM environment bake.
import { Scene, PMREMGenerator } from 'three';

export const SKY_QUALITY = {
  ultra: { domeSeg: 64, starLayers: 3, earthSeg: 96, env: 512 },
  high: { domeSeg: 48, starLayers: 2, earthSeg: 64, env: 256 },
  medium: { domeSeg: 32, starLayers: 2, earthSeg: 48, env: 128 },
  low: { domeSeg: 24, starLayers: 1, earthSeg: 32, env: 64 },
};

export const STAR_GLSL = /* glsl */`
float sk_h13(vec3 p){ p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
vec3 sk_h33(vec3 p){ p = fract(p * vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
// procedural star field on the unit sphere; returns HDR colour
vec3 sk_stars(vec3 d, float scale, float density, float pxAngle){
  vec3 p = d * scale; vec3 i = floor(p), f = fract(p);
  vec3 o = sk_h33(i) * .8 + .1;
  float r = sk_h13(i + 11.7);
  if (r > density) return vec3(0.);
  float dist = length(f - o) / scale;               // ~ angular distance in radians
  float sz = max(pxAngle * .9, 1.5e-4);
  float b = exp(-pow(dist / sz, 2.)) * pow(sk_h13(i + 3.1), 6.) * 3.5;
  float t = sk_h13(i + 7.7);
  vec3 c = mix(vec3(.75, .82, 1.), vec3(1., .86, .7), t);
  return c * b;
}
`;

// Bake a PMREM environment from a list of sky objects (rendered at the origin).
export function bakeSkyEnvironment(renderer, objects, size = 256, far = 1e5) {
  const scene = new Scene();
  const parents = objects.map(o => [o, o.parent, o.position.clone()]);
  for (const o of objects) { scene.add(o); }
  const pmrem = new PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, 0, 0.1, far, { size });
  for (const [o, p, pos] of parents) { if (p) p.add(o); else scene.remove(o); o.position.copy(pos); }
  pmrem.dispose();
  return rt; // rt.texture -> scene.environment ; dispose rt when done
}
