// Moon regolith terrain material: multi-scale craters, regolith noise, maria/highland
// albedo variation, fresh bright crater rims, darker rocky slopes. MeshStandardMaterial
// + onBeforeCompile, so it keeps PBR lighting, shadows, fog and the env map.
//
//   import { createMoonMaterial } from './art/terrain/moonMaterial.js';
//   const mat = createMoonMaterial({ quality: 'ultra' });
//   terrainMesh.material = mat;            // geometry needs normals (computeVertexNormals)
//   mat.userData.uniforms.uCraterDensity.value = 0.5;
//   mat.dispose();
import { MeshStandardMaterial, Color } from 'three';
import { installTerrainShader } from './terrainShaderCommon.js';

export function createMoonMaterial(opts = {}) {
  const {
    quality = 'high', highland = 0xb5b2ad, maria = 0x5f5e5c, rock = 0x47464a,
    craterDensity = 0.55, bumpStrength = 1.0, scale = 1.0, envMapIntensity = 0.35,
  } = opts;
  const uniforms = {
    uHighland: { value: new Color(highland) }, uMaria: { value: new Color(maria) }, uRock: { value: new Color(rock) },
    uCraterDensity: { value: craterDensity }, uBump: { value: bumpStrength }, uScale: { value: scale },
  };
  const m = new MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, envMapIntensity });
  m.name = 'VoltMoonRegolith';
  return installTerrainShader(m, {
    key: 'vr-moon', quality, uniforms,
    uniformDecl: 'uniform vec3 uHighland, uMaria, uRock; uniform float uCraterDensity, uBump, uScale;',
    surfaceGLSL: /* glsl */`
      vec3 vrP = vVR_WPos / uScale;
      vec3 vrN = normalize(vVR_WNrm);
      float vrFw = length(fwidth(vrP.xz)) + 1e-4;
      float vrFlat = smoothstep(.55, .9, vrN.y);
      // large maria patches
      float vrMare = smoothstep(-.05, .2, vr_fbm(vrP.xz / 900., vrFw / 900.));
      // crater layers (cell sizes 60 m, 14 m, 3.5 m), faded by pixel footprint and slope
      float vrH = 0., vrRim = 0., vrBowl = 0.;
      float vrS = 60.;
      for (int i = 0; i < CRATER_LAYERS; i++){
        float rm; float fade = (1. - smoothstep(vrS * .05, vrS * .25, vrFw)) * vrFlat;
        float c = vr_craters(vrP.xz / vrS + float(i) * 7.13, uCraterDensity, rm) * vrS * .35;
        vrH += c * fade; vrRim = max(vrRim, rm * fade); vrBowl += min(c, 0.) * fade / vrS;
        vrS *= .24;
      }
      float vrRegolith = vr_tri(vrP / 2.2, vrN, vrFw / 2.2);
      float vrRocks = vr_tri(vrP / 9., vrN, vrFw / 9.);
      vrH += vrRegolith * .09 + vrRocks * .35 * (1. - vrFlat * .6);
#if MICRO == 1
      vrH += (vr_noise(vrP.xz * 3.1) - .5) * .02 * (1. - smoothstep(.02, .08, vrFw));
#endif
      vrH *= uBump;
      vec3 vrAlbedo = mix(uHighland, uMaria, vrMare * .85);
      vrAlbedo *= .86 + vrRegolith * .5 + vrRocks * .25;
      vrAlbedo = mix(vrAlbedo, uRock, (1. - vrFlat) * .7);            // steep walls: darker rock
      vrAlbedo *= 1. + vrRim * .35;                                   // fresh bright rims / ejecta
      vrAlbedo *= 1. + vrBowl * 1.2;                                  // shadowed bowl floors slightly darker
      vrAlbedo = max(vrAlbedo, vec3(.02));
      float vrRough = .92 + vrRocks * .1;
    `,
  });
}
