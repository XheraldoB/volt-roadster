// Moon sky: pure black airless sky, crisp procedural stars + faint galactic band,
// harsh small sun with lens glare, Earth disc with day/night terminator, oceans,
// continents, clouds and a thin blue atmosphere rim. Plus matching lights.
//
//   import { createMoonSky } from './art/sky/moonSky.js';
//   const sky = createMoonSky({ quality: 'ultra' });
//   scene.add(sky.object, sky.sun, sky.sun.target, sky.fill);
//   scene.environment = sky.bakeEnvironment(renderer).texture;  // once (re-bake if sun moves)
//   // per frame: sky.update(camera, dt);
//   sky.dispose();
import {
  Group, Mesh, SphereGeometry, ShaderMaterial, BackSide, AdditiveBlending, Vector3, Color,
  DirectionalLight, HemisphereLight, PlaneGeometry,
} from 'three';
import { SKY_QUALITY, STAR_GLSL, bakeSkyEnvironment } from './skyCommon.js';

export function createMoonSky(opts = {}) {
  const {
    quality = 'high', radius = 4500,
    sunDirection = new Vector3(-0.55, 0.32, -0.77), earthDirection = new Vector3(0.35, 0.28, 0.89),
    earthAngularDiameterDeg = 5.5, sunIntensity = 5.0, castShadow = true,
  } = opts;
  const Q = SKY_QUALITY[quality] || SKY_QUALITY.high;
  const sunDir = sunDirection.clone().normalize(), earthDir = earthDirection.clone().normalize();
  const object = new Group(); object.name = 'MoonSky';

  const domeU = { uSun: { value: sunDir }, uGround: { value: new Color(0.035, 0.034, 0.032) }, uPx: { value: 0.0015 } };
  const dome = new Mesh(new SphereGeometry(radius, Q.domeSeg, Q.domeSeg / 2), new ShaderMaterial({
    uniforms: domeU, side: BackSide, depthWrite: false, fog: false,
    defines: { STAR_LAYERS: Q.starLayers },
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); gl_Position.z = gl_Position.w; }`,
    fragmentShader: `
      uniform vec3 uSun, uGround; uniform float uPx; varying vec3 vDir;
      ${STAR_GLSL}
      float gn(vec3 p){ return sk_h13(floor(p)); }
      void main(){
        vec3 d = normalize(vDir);
        vec3 col = vec3(0.);
        // galactic band (great circle tilted ~60 deg)
        vec3 gp = normalize(vec3(.2, .87, -.45));
        float band = exp(-pow(dot(d, gp) / .16, 2.));
        float px = max(fwidth(d.x) + fwidth(d.y), 1e-4);
        col += vec3(.012, .012, .016) * band * (.6 + .4 * gn(d * 40.));
        col += sk_stars(d, 180., .014 * (1. + band * 2.), px);
        #if STAR_LAYERS > 1
        col += sk_stars(d, 420., .004 * (1. + band * 3.), px) * .6;
        #endif
        #if STAR_LAYERS > 2
        col += sk_stars(d, 900., .0012 * (1. + band * 4.), px) * .4;
        #endif
        // harsh sun: tiny disc + camera-lens style glare (no atmosphere scattering)
        float c = dot(d, uSun);
        float disc = smoothstep(cos(.0085), cos(.0065), c);
        col += vec3(1., .98, .94) * disc * 60.;
        col += vec3(1., .95, .88) * (pow(max(c, 0.), 900.) * 2.5 + pow(max(c, 0.), 60.) * .06);
        // below horizon: dim regolith bounce (mainly for env-map bakes)
        col = mix(col, uGround * (.4 + .6 * max(uSun.y, 0.)), smoothstep(.0, -.08, d.y));
        gl_FragColor = vec4(col, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  dome.name = 'moonDome'; dome.renderOrder = -10; dome.frustumCulled = false;
  object.add(dome);

  // Earth
  const er = radius * 0.9 * Math.tan((earthAngularDiameterDeg * Math.PI / 180) / 2);
  const earthU = { uSun: { value: sunDir }, uTime: { value: 0 } };
  const earth = new Mesh(new SphereGeometry(er, Q.earthSeg, Q.earthSeg / 2), new ShaderMaterial({
    uniforms: earthU, fog: false, depthWrite: false,
    vertexShader: `varying vec3 vN; varying vec3 vObj; varying vec3 vView;
      void main(){ vObj = normalize(position); vN = normalize(mat3(modelMatrix) * normal);
        vec4 wp = modelMatrix * vec4(position,1.); vView = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp; gl_Position.z = gl_Position.w * .99999; }`,
    fragmentShader: `
      uniform vec3 uSun; uniform float uTime; varying vec3 vN; varying vec3 vObj; varying vec3 vView;
      float h(vec3 p){ p = fract(p * .3183099 + .1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float n3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.-2.*f);
        return mix(mix(mix(h(i), h(i+vec3(1,0,0)), f.x), mix(h(i+vec3(0,1,0)), h(i+vec3(1,1,0)), f.x), f.y),
                   mix(mix(h(i+vec3(0,0,1)), h(i+vec3(1,0,1)), f.x), mix(h(i+vec3(0,1,1)), h(i+vec3(1,1,1)), f.x), f.y), f.z); }
      float fbm(vec3 p){ float s = 0., a = .5; for (int i = 0; i < 6; i++){ s += a * n3(p); p *= 2.03; a *= .5; } return s; }
      void main(){
        vec3 N = normalize(vN), V = normalize(vView);
        float ct = cos(uTime), st = sin(uTime);
        vec3 o = vec3(ct * vObj.x - st * vObj.z, vObj.y, st * vObj.x + ct * vObj.z);
        float land = smoothstep(.52, .56, fbm(o * 2.2 + 3.));
        float ice = smoothstep(.78, .86, abs(o.y));
        vec3 ocean = vec3(.015, .05, .16), ground = mix(vec3(.12, .2, .07), vec3(.35, .28, .16), fbm(o * 5.));
        vec3 alb = mix(ocean, ground, land); alb = mix(alb, vec3(.85), ice);
        float cloud = smoothstep(.5, .72, fbm(o * 3.5 + vec3(uTime * .3, 0., 0.)));
        alb = mix(alb, vec3(.95), cloud * .85);
        float ndl = dot(N, uSun);
        float day = smoothstep(-.08, .15, ndl);
        vec3 col = alb * max(ndl, 0.) * 3.2;
        // ocean glint
        vec3 H = normalize(uSun + V); col += (1. - land) * (1. - cloud) * pow(max(dot(N, H), 0.), 80.) * 2. * day;
        // night side city lights (faint)
        col += (1. - day) * land * (1. - cloud) * smoothstep(.55, .75, fbm(o * 14.)) * vec3(1., .7, .35) * .35;
        // atmosphere rim
        float fr = pow(1. - max(dot(N, V), 0.), 3.);
        col += vec3(.25, .5, 1.) * fr * smoothstep(-.25, .4, ndl) * 2.2;
        gl_FragColor = vec4(col, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  earth.name = 'earth'; earth.renderOrder = -9; earth.frustumCulled = false;
  earth.position.copy(earthDir).multiplyScalar(radius * 0.9);
  object.add(earth);
  // halo sprite around Earth (atmosphere glow seen from the Moon)
  const halo = new Mesh(new PlaneGeometry(er * 3.2, er * 3.2), new ShaderMaterial({
    uniforms: { uSun: { value: sunDir } }, transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv * 2. - 1.; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); gl_Position.z = gl_Position.w * .99999; }`,
    fragmentShader: `varying vec2 vUv; void main(){ float r = length(vUv) * 1.6; float g = smoothstep(1.35, 1.0, r) * smoothstep(.96, 1.02, r); gl_FragColor = vec4(vec3(.2, .45, 1.) * g * .5, 1.); }`,
  }));
  halo.name = 'earthHalo'; halo.renderOrder = -8; halo.frustumCulled = false; halo.position.copy(earth.position);
  object.add(halo);

  // lights: harsh white sun + very weak earthshine/regolith fill (deep black shadows)
  const sun = new DirectionalLight(0xfff7ee, sunIntensity);
  sun.name = 'moonSun'; sun.castShadow = castShadow;
  const fill = new HemisphereLight(0x3a4b6e, 0x55524c, 0.12); fill.name = 'moonFill';
  const placeSun = (center = new Vector3()) => { sun.position.copy(center).addScaledVector(sunDir, 300); sun.target.position.copy(center); sun.target.updateMatrixWorld(); };
  placeSun();

  const api = {
    object, sun, fill, earth, dome,
    sunDirection: sunDir,
    update(camera, dt = 0) {
      object.position.copy(camera.position);
      halo.quaternion.copy(camera.quaternion);
      earthU.uTime.value += dt * 0.01;
    },
    // keep the shadow frustum centred on the player
    followTarget(p) { placeSun(p); },
    setSunDirection(v) { sunDir.copy(v).normalize(); placeSun(sun.target.position); },
    bakeEnvironment(renderer, size = Q.env) {
      const pos = object.position.clone(); object.position.set(0, 0, 0); halo.visible = false;
      const rt = bakeSkyEnvironment(renderer, [object], size, radius * 2);
      halo.visible = true; object.position.copy(pos);
      api._envRT?.dispose(); api._envRT = rt; return rt;
    },
    dispose() {
      object.removeFromParent(); sun.removeFromParent(); fill.removeFromParent();
      object.traverse(m => { if (m.isMesh) { m.geometry.dispose(); m.material.dispose(); } });
      sun.dispose?.(); api._envRT?.dispose();
    },
  };
  return api;
}
