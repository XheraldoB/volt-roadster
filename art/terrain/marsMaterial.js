// Mars terrain material: rust-red dust on flats, dark basaltic rock on steep slopes,
// layered sedimentary strata on canyon walls (Valles Marineris look), sparse craters,
// wind ripples and a dust-cover uniform that storms can raise.
//
//   import { createMarsMaterial } from './art/terrain/marsMaterial.js';
//   const mat = createMarsMaterial({ quality: 'ultra' });
//   terrainMesh.material = mat;
//   mat.userData.uniforms.uDust.value = 0.8;   // during/after a dust storm
import { MeshStandardMaterial, Color } from 'three';
import { installTerrainShader } from './terrainShaderCommon.js';

export function createMarsMaterial(opts = {}) {
  const {
    quality = 'high', dust = 0xb8693a, dustLight = 0xd39a63, rock = 0x4a2c20, strataA = 0x9a5a36, strataB = 0x5e3424,
    dustAmount = 0.5, craterDensity = 0.22, bumpStrength = 1.0, scale = 1.0, envMapIntensity = 0.45,
  } = opts;
  const uniforms = {
    uDustCol: { value: new Color(dust) }, uDustLight: { value: new Color(dustLight) }, uRock: { value: new Color(rock) },
    uStrataA: { value: new Color(strataA) }, uStrataB: { value: new Color(strataB) },
    uDust: { value: dustAmount }, uCraterDensity: { value: craterDensity }, uBump: { value: bumpStrength }, uScale: { value: scale },
    uWind: { value: 0.6 },
  };
  const m = new MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, envMapIntensity });
  m.name = 'VoltMarsSurface';
  return installTerrainShader(m, {
    key: 'vr-mars', quality, uniforms,
    uniformDecl: 'uniform vec3 uDustCol, uDustLight, uRock, uStrataA, uStrataB; uniform float uDust, uCraterDensity, uBump, uScale, uWind;',
    surfaceGLSL: /* glsl */`
      vec3 vrP = vVR_WPos / uScale;
      vec3 vrN = normalize(vVR_WNrm);
      float vrFw = length(fwidth(vrP.xz)) + 1e-4;
      float vrSlope = 1. - vrN.y;
      float vrFlat = smoothstep(.12, .45, vrN.y - .3);
      float vrBig = vr_fbm(vrP.xz / 700., vrFw / 700.);
      float vrRocks = vr_tri(vrP / 6., vrN, vrFw / 6.);
      float vrFine = vr_tri(vrP / 1.3, vrN, vrFw / 1.3);
      // strata: horizontal bands warped by noise, visible on walls
      float vrWarp = vr_fbm(vrP.xz / 120., vrFw / 120.) * 18.;
      float vrBand = sin((vrP.y + vrWarp) * .55) * .5 + .5;
      float vrBand2 = sin((vrP.y + vrWarp * .6) * 2.3) * .5 + .5;
      vec3 vrStrata = mix(uStrataB, uStrataA, smoothstep(.3, .7, vrBand) * .8 + vrBand2 * .2);
      // craters (sparse, two scales)
      float vrH = 0., vrRim = 0.; float vrS = 45.;
      for (int i = 0; i < CRATER_LAYERS; i++){
        if (i > 1) break;
        float rm; float fade = (1. - smoothstep(vrS * .05, vrS * .25, vrFw)) * vrFlat;
        vrH += vr_craters(vrP.xz / vrS + float(i) * 3.7, uCraterDensity, rm) * vrS * .3 * fade; vrRim = max(vrRim, rm * fade);
        vrS *= .22;
      }
      // wind ripples on dusty flats
      float vrRip = sin(dot(vrP.xz, vec2(.8, .6)) * 2.2 + vr_noise(vrP.xz * .15) * 6.) * (1. - smoothstep(.05, .2, vrFw));
      vrH += vrRocks * .45 * (.4 + vrSlope) + vrFine * .06 + vrRip * .025 * vrFlat * uWind;
      vrH += (vrBand2 - .5) * .25 * smoothstep(.25, .6, vrSlope);       // ledges in the strata
      vrH *= uBump;
      vec3 vrDust = mix(uDustCol, uDustLight, smoothstep(-.2, .3, vrBig) * .7 + vrFine * .3);
      vec3 vrRockC = uRock * (.8 + vrRocks * .8);
      float vrRockMask = smoothstep(.15, .5, vrSlope + vrRocks * .5 - uDust * .25);
      vec3 vrAlbedo = mix(vrDust, mix(vrRockC, vrStrata, smoothstep(.35, .65, vrSlope)), vrRockMask);
      vrAlbedo *= 1. + vrRim * .15;
      float vrRough = mix(.95, .8, vrRockMask);
    `,
  });
}
