// Shared GLSL + onBeforeCompile plumbing for the procedural planet terrain materials.
// World-space procedural detail (no UVs needed, no tiling): works directly on the
// heightfield mesh from src/terrain.js (terrainArrays) or any other geometry.
export const TERRAIN_QUALITY = {
  ultra:  { OCT: 6, CRATER_LAYERS: 3, TRIPLANAR: 1, MICRO: 1 },
  high:   { OCT: 5, CRATER_LAYERS: 3, TRIPLANAR: 1, MICRO: 1 },
  medium: { OCT: 4, CRATER_LAYERS: 2, TRIPLANAR: 0, MICRO: 0 },
  low:    { OCT: 2, CRATER_LAYERS: 1, TRIPLANAR: 0, MICRO: 0 },
};

export const NOISE_GLSL = /* glsl */`
varying vec3 vVR_WPos;
varying vec3 vVR_WNrm;
float vr_h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 vr_h22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float vr_noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  return mix(mix(vr_h12(i), vr_h12(i + vec2(1,0)), u.x), mix(vr_h12(i + vec2(0,1)), vr_h12(i + vec2(1,1)), u.x), u.y); }
// fbm with analytic level-of-detail fade: octaves smaller than the pixel footprint are faded out
float vr_fbm(vec2 p, float fw){ float a = .5, s = 0., f = 1.;
  for (int i = 0; i < OCT; i++){ float fade = 1. - smoothstep(.25, .75, fw * f); s += a * fade * (vr_noise(p) - .5); p = mat2(1.6, 1.2, -1.2, 1.6) * p; f *= 2.; a *= .5; }
  return s; }
// cellular craters: bowl + raised rim + faint ejecta, returns height in cell units
float vr_craters(vec2 p, float density, out float rimMask){
  vec2 i = floor(p), f = fract(p); float h = 0.; rimMask = 0.;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){
    vec2 g = vec2(x, y), id = i + g; vec2 o = vr_h22(id);
    if (vr_h12(id + 17.3) > density) continue;
    float r = mix(.16, .46, vr_h12(id + 5.1));
    float d = length(g + o - f) / r;
    if (d > 2.2) continue;
    float bowl = d < 1. ? (d * d - 1.) * .7 : 0.;
    float rim = exp(-pow((d - 1.) * 3.2, 2.)) * .32;
    float ej = d > 1. ? exp(-(d - 1.) * 2.5) * .06 : 0.;
    h += (bowl + rim + ej) * r; rimMask = max(rimMask, exp(-pow((d - 1.05) * 4., 2.)));
  }
  return h; }
float vr_tri(vec3 p, vec3 n, float fw){
#if TRIPLANAR == 1
  vec3 w = pow(abs(n), vec3(4.)); w /= (w.x + w.y + w.z);
  return vr_fbm(p.zy, fw) * w.x + vr_fbm(p.xz, fw) * w.y + vr_fbm(p.xy, fw) * w.z;
#else
  return vr_fbm(p.xz, fw);
#endif
}
`;

const VERT_DECL = /* glsl */`
varying vec3 vVR_WPos;
varying vec3 vVR_WNrm;
`;
const VERT_BODY = /* glsl */`
vVR_WPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vVR_WNrm = normalize(mat3(modelMatrix) * objectNormal);
`;
// screen-space bump from a scalar height field H (metres), same maths as three's perturbNormalArb
const BUMP = /* glsl */`
{
  vec3 vSigmaX = dFdx(-vViewPosition), vSigmaY = dFdy(-vViewPosition);
  float dHx = dFdx(vrH), dHy = dFdy(vrH);
  vec3 R1 = cross(vSigmaY, normal), R2 = cross(normal, vSigmaX);
  float fDet = dot(vSigmaX, R1) * faceDirection;
  vec3 vGrad = sign(fDet) * (dHx * R1 + dHy * R2);
  normal = normalize(abs(fDet) * normal - vGrad);
}
`;

// Install a procedural surface into a MeshStandardMaterial.
// surfaceGLSL must define: vec3 vrAlbedo; float vrRough; float vrH;  (uses vVR_WPos / vVR_WNrm / uniforms)
export function installTerrainShader(material, { key, quality, uniforms, uniformDecl, surfaceGLSL }) {
  const defs = TERRAIN_QUALITY[quality] || TERRAIN_QUALITY.high;
  material.defines = { ...(material.defines || {}), ...defs };
  material.userData.uniforms = uniforms;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_DECL)
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n' + VERT_BODY);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + uniformDecl + NOISE_GLSL)
      .replace('#include <map_fragment>', '#include <map_fragment>\n' + surfaceGLSL + '\n diffuseColor.rgb *= vrAlbedo;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor *= vrRough;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + BUMP);
  };
  material.customProgramCacheKey = () => key + '-' + JSON.stringify(defs);
  material.needsUpdate = true;
  return material;
}
