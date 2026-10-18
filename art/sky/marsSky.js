// Mars sky: butterscotch daytime sky from suspended dust, darker brown zenith, small
// pale sun; at low sun the famous blue halo forms around the sun while the rest of the
// sky goes grey-brown. Time-of-day and dust-storm parameters drive sky, sun light,
// hemisphere fill and fog colour together so everything stays coherent.
//
//   import { createMarsSky } from './art/sky/marsSky.js';
//   const sky = createMarsSky({ quality: 'ultra', timeOfDay: 0.32 });
//   scene.add(sky.object, sky.sun, sky.sun.target, sky.fill);
//   scene.fog = sky.fog;                         // FogExp2 kept in sync
//   scene.environment = sky.bakeEnvironment(renderer).texture;
//   sky.setTimeOfDay(0.74); sky.setDust(1.0);    // sunset in a storm (re-bake env if changed a lot)
//   // per frame: sky.update(camera, dt);
import {
  Group, Mesh, SphereGeometry, ShaderMaterial, BackSide, Vector3, Color,
  DirectionalLight, HemisphereLight, FogExp2, MathUtils,
} from 'three';
import { SKY_QUALITY, STAR_GLSL, bakeSkyEnvironment } from './skyCommon.js';

const C = (r, g, b) => new Color(r, g, b);
// linear-light key colours
const DAY_ZENITH = C(0.20, 0.12, 0.075), DAY_HORIZON = C(0.78, 0.50, 0.30);
const SET_ZENITH = C(0.035, 0.03, 0.035), SET_HORIZON = C(0.28, 0.19, 0.14);
const NIGHT = C(0.003, 0.0025, 0.003);
const STORM = C(0.55, 0.32, 0.17);
const BLUE_HALO = C(0.30, 0.52, 1.0);

export function createMarsSky(opts = {}) {
  const { quality = 'high', radius = 4500, timeOfDay = 0.35, dust = 0.0, sunAzimuthDeg = 115, castShadow = true, fogDensity = 0.00055 } = opts;
  const Q = SKY_QUALITY[quality] || SKY_QUALITY.high;
  const object = new Group(); object.name = 'MarsSky';
  const U = {
    uSun: { value: new Vector3(0, 1, 0) }, uZenith: { value: new Color() }, uHorizon: { value: new Color() },
    uHalo: { value: new Color() }, uHaloSize: { value: 0.2 }, uSunCol: { value: new Color() }, uDust: { value: dust },
    uNight: { value: 0 }, uGround: { value: new Color(0.16, 0.07, 0.035) },
  };
  const dome = new Mesh(new SphereGeometry(radius, Q.domeSeg, Q.domeSeg / 2), new ShaderMaterial({
    uniforms: U, side: BackSide, depthWrite: false, fog: false, defines: { STAR_LAYERS: Q.starLayers },
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); gl_Position.z = gl_Position.w; }`,
    fragmentShader: `
      uniform vec3 uSun, uZenith, uHorizon, uHalo, uSunCol, uGround; uniform float uHaloSize, uDust, uNight;
      varying vec3 vDir;
      ${STAR_GLSL}
      void main(){
        vec3 d = normalize(vDir);
        float up = max(d.y, 0.);
        // dust-laden gradient: bright horizon band, darker zenith
        float hz = pow(1. - up, 3.2);
        vec3 col = mix(uZenith, uHorizon, hz);
        float c = dot(d, uSun);
        float ang = acos(clamp(c, -1., 1.));
        // forward-scattering: warm aureole + blue halo (low sun) around the sun
        col += uHorizon * .5 * exp(-ang / .3) * (1. - uDust * .5);
        col += uHalo * exp(-ang / uHaloSize);
        // sun disc (smaller and paler than on Earth) - dimmed by storm opacity
        float disc = smoothstep(cos(.0062), cos(.0046), c);
        col += uSunCol * disc * 40. * (1. - uDust * .92);
        // storm: flatten towards uniform ochre murk
        col = mix(col, uHorizon * (.75 + .25 * hz), uDust * .75);
        // night stars (only when dark & clear)
        float px = max(fwidth(d.x) + fwidth(d.y), 1e-4);
        col += sk_stars(d, 220., .01, px) * uNight * (1. - uDust) * smoothstep(0., .15, d.y);
        #if STAR_LAYERS > 1
        col += sk_stars(d, 520., .003, px) * .5 * uNight * (1. - uDust) * smoothstep(0., .15, d.y);
        #endif
        col = mix(col, uGround * (.5 + .5 * length(uHorizon)), smoothstep(0., -.06, d.y));
        gl_FragColor = vec4(col, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  dome.name = 'marsDome'; dome.renderOrder = -10; dome.frustumCulled = false;
  object.add(dome);

  const sun = new DirectionalLight(0xffe2c2, 3); sun.name = 'marsSun'; sun.castShadow = castShadow;
  const fill = new HemisphereLight(0xc08060, 0x4a2414, 0.5); fill.name = 'marsFill';
  const fog = new FogExp2(0xb07850, fogDensity);
  const state = { t: timeOfDay, dust, az: MathUtils.degToRad(sunAzimuthDeg) };
  const tmp = new Color();

  function recompute() {
    // t: 0 midnight, .25 sunrise, .5 noon, .75 sunset
    const elev = Math.sin((state.t - 0.25) * Math.PI * 2) * MathUtils.degToRad(68);
    const sd = U.uSun.value.set(Math.cos(elev) * Math.cos(state.az), Math.sin(elev), Math.cos(elev) * Math.sin(state.az)).normalize();
    const e = sd.y;
    const day = MathUtils.smoothstep(e, -0.12, 0.25);          // 0 night .. 1 day
    const low = 1 - MathUtils.smoothstep(e, 0.02, 0.35);       // 1 near horizon
    const lowDay = low * MathUtils.smoothstep(e, -0.15, 0.0);
    const k = state.dust;
    // sky colours
    U.uZenith.value.copy(NIGHT).lerp(tmp.copy(SET_ZENITH).lerp(DAY_ZENITH, 1 - low), day);
    U.uHorizon.value.copy(NIGHT).lerp(tmp.copy(SET_HORIZON).lerp(DAY_HORIZON, 1 - low), day);
    if (k > 0) { const s = tmp.copy(STORM).multiplyScalar(0.15 + 0.85 * day); U.uZenith.value.lerp(s, k * 0.8); U.uHorizon.value.lerp(s, k * 0.7); }
    U.uHalo.value.copy(BLUE_HALO).multiplyScalar((0.12 + 1.6 * lowDay) * (1 - k * 0.85) * MathUtils.smoothstep(e, -0.2, -0.02));
    U.uHaloSize.value = 0.06 + 0.07 * lowDay;
    U.uSunCol.value.setRGB(1, 0.94 - 0.15 * low, 0.86 - 0.3 * low);
    U.uNight.value = 1 - MathUtils.smoothstep(e, -0.22, -0.05);
    U.uDust.value = k;
    // lights (Mars receives ~43% of Earth's sunlight; dust scatters it into the sky)
    sun.color.copy(U.uSunCol.value).lerp(tmp.setRGB(1, 0.6, 0.35), k * 0.6);
    sun.intensity = 3.2 * MathUtils.smoothstep(e, -0.04, 0.12) * (1 - 0.75 * k);
    fill.color.copy(U.uHorizon.value).multiplyScalar(1.4).lerp(U.uZenith.value, 0.3);
    fill.groundColor.copy(U.uHorizon.value).multiplyScalar(0.35);
    fill.intensity = 0.05 + 0.9 * day + 0.6 * k * day;
    fog.color.copy(U.uHorizon.value);
    fog.density = fogDensity * (1 + 9 * k * k) * (1 - 0.35 * low);
    placeSun(sun.target.position);
  }
  const placeSun = (center = new Vector3()) => { sun.position.copy(center).addScaledVector(U.uSun.value, 300); sun.target.position.copy(center); sun.target.updateMatrixWorld(); };
  recompute();

  const api = {
    object, sun, fill, fog, dome, uniforms: U,
    get sunDirection() { return U.uSun.value; },
    get timeOfDay() { return state.t; },
    setTimeOfDay(t) { state.t = ((t % 1) + 1) % 1; recompute(); },
    setDust(d) { state.dust = MathUtils.clamp(d, 0, 1); recompute(); },
    setSunAzimuth(deg) { state.az = MathUtils.degToRad(deg); recompute(); },
    followTarget(p) { placeSun(p); },
    update(camera) { object.position.copy(camera.position); },
    // scene.fog / background colour helper
    getFogColor(target = new Color()) { return target.copy(fog.color); },
    bakeEnvironment(renderer, size = Q.env) {
      const pos = object.position.clone(); object.position.set(0, 0, 0);
      const rt = bakeSkyEnvironment(renderer, [object], size, radius * 2);
      object.position.copy(pos); api._envRT?.dispose(); api._envRT = rt; return rt;
    },
    dispose() {
      object.removeFromParent(); sun.removeFromParent(); fill.removeFromParent();
      dome.geometry.dispose(); dome.material.dispose(); sun.dispose?.(); api._envRT?.dispose();
    },
  };
  return api;
}
