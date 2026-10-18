// Volt Roadster post-processing + renderer quality presets.
// Ultra is tuned for OnePlus 15 (Snapdragon 8 Elite Gen 5 / Adreno 8-series, 2772x1272
// 120/165 Hz): HDR half-float pipeline, MSAA x4 on the scene target, GTAO, HDR bloom
// (emissives only), AgX/ACES tone mapping, SMAA, and dynamic resolution that holds the
// frame-time budget instead of dropping effects.
//
//   import { createPostPipeline, detectPreset, applyRendererPreset } from './art/post/ultraPost.js';
//   const preset = detectPreset(renderer);             // 'ultra' on Adreno 8xx, etc.
//   applyRendererPreset(renderer, preset);              // pixel ratio, shadows, tone mapping
//   const post = createPostPipeline(renderer, scene, camera, { preset, toneMapping: 'agx' });
//   // loop: post.render(dt)   (instead of renderer.render)
//   // resize: post.setSize(innerWidth, innerHeight)
//   // settings menu: post.setPreset('high')
//   post.dispose();
import {
  WebGLRenderTarget, HalfFloatType, Vector2, ACESFilmicToneMapping, AgXToneMapping,
  NeutralToneMapping, SRGBColorSpace, PCFShadowMap, VSMShadowMap,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { FXAAPass } from 'three/examples/jsm/postprocessing/FXAAPass.js';

// Single source of truth for graphics settings (also consumed by terrain/sky/car/robot modules
// via `quality` = preset name, and by the game for particles/terrain LOD).
export const PRESETS = {
  ultra: {
    label: 'Ultra (OnePlus 15)', maxPixelRatio: 3, renderScale: 0.9, dynRes: { min: 0.7, max: 1.0, targetFps: 120 },
    msaa: 4, aa: 'smaa', bloom: { strength: 0.4, radius: 0.12, threshold: 3.6 }, ao: { enabled: true, radius: 0.6, samples: 12, blend: 0.9 },
    shadow: { enabled: true, mapSize: 4096, type: 'pcfsoft', radius: 3, camExtent: 60 }, envSize: 512, anisotropy: 8,
    particles: { dust: 6000, sparks: 800, debris: 300 }, terrainRes: 512, drawDistance: 6000, exposure: 1.0,
  },
  high: {
    label: 'High', maxPixelRatio: 2, renderScale: 0.8, dynRes: { min: 0.65, max: 0.9, targetFps: 90 },
    msaa: 0, aa: 'smaa', bloom: { strength: 0.35, radius: 0.12, threshold: 3.6 }, ao: { enabled: false },
    shadow: { enabled: true, mapSize: 2048, type: 'pcfsoft', radius: 2, camExtent: 50 }, envSize: 256, anisotropy: 4,
    particles: { dust: 3000, sparks: 400, debris: 150 }, terrainRes: 384, drawDistance: 4500, exposure: 1.0,
  },
  medium: {
    label: 'Medium', maxPixelRatio: 1.5, renderScale: 0.75, dynRes: { min: 0.6, max: 0.85, targetFps: 60 },
    msaa: 0, aa: 'fxaa', bloom: { strength: 0.3, radius: 0.1, threshold: 3.8 }, ao: { enabled: false },
    shadow: { enabled: true, mapSize: 1024, type: 'pcf', radius: 1, camExtent: 40 }, envSize: 128, anisotropy: 2,
    particles: { dust: 1200, sparks: 200, debris: 60 }, terrainRes: 256, drawDistance: 3200, exposure: 1.0,
  },
  low: {
    label: 'Low', maxPixelRatio: 1, renderScale: 1.0, dynRes: { min: 0.6, max: 1.0, targetFps: 45 },
    msaa: 0, aa: 'none', bloom: null, ao: { enabled: false },
    shadow: { enabled: false, mapSize: 0, type: 'none', camExtent: 0 }, envSize: 64, anisotropy: 1,
    particles: { dust: 400, sparks: 80, debris: 20 }, terrainRes: 160, drawDistance: 2200, exposure: 1.0, usePost: false,
  },
};

const TONE = { agx: AgXToneMapping, aces: ACESFilmicToneMapping, neutral: NeutralToneMapping };

// GPU-string heuristic. Always let the player override in settings.
export function detectPreset(renderer) {
  let s = '';
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    s = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
  } catch { /* ignore */ }
  const r = s.toLowerCase();
  if (/swiftshader|llvmpipe|software|basic render/.test(r)) return 'low';
  const adreno = r.match(/adreno[^0-9]*(\d{3})/);
  if (adreno) { const n = +adreno[1]; return n >= 830 ? 'ultra' : n >= 730 ? 'high' : n >= 640 ? 'medium' : 'low'; }
  if (/apple|m[1-9]\b|rtx|radeon rx|geforce/.test(r)) return 'ultra';
  if (/mali-g7[1-9]|immortalis|xclipse/.test(r)) return 'high';
  if (/mali|powervr/.test(r)) return 'medium';
  return 'high';
}

export function applyRendererPreset(renderer, presetName, { toneMapping = 'agx', exposure } = {}) {
  const p = PRESETS[presetName] || PRESETS.high;
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  renderer.setPixelRatio(Math.min(dpr, p.maxPixelRatio) * p.renderScale);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = TONE[toneMapping] ?? AgXToneMapping;
  renderer.toneMappingExposure = exposure ?? p.exposure;
  renderer.shadowMap.enabled = p.shadow.enabled;
  // r18x: PCFSoftShadowMap was removed; PCFShadowMap + shadow.radius gives soft filtering
  renderer.shadowMap.type = p.shadow.type === 'vsm' ? VSMShadowMap : PCFShadowMap;
  renderer.shadowMap.needsUpdate = true;
  return p;
}

// Configure a DirectionalLight's shadow for the preset (call after creating sky.sun).
export function applyShadowPreset(light, presetName) {
  const p = (PRESETS[presetName] || PRESETS.high).shadow;
  light.castShadow = p.enabled;
  if (!p.enabled) return;
  const s = light.shadow; const e = p.camExtent;
  s.mapSize.set(p.mapSize, p.mapSize);
  s.camera.left = -e; s.camera.right = e; s.camera.top = e; s.camera.bottom = -e; s.camera.near = 1; s.camera.far = 800;
  s.bias = -0.0002; s.normalBias = 0.03; s.radius = p.radius ?? 1;
  s.camera.updateProjectionMatrix();
  s.map?.dispose(); s.map = null;
}

export function createPostPipeline(renderer, scene, camera, opts = {}) {
  let presetName = opts.preset || 'high';
  const toneMapping = opts.toneMapping || 'agx';
  const size = new Vector2();
  let composer = null, passes = {}, rt = null, p = null;
  // dynamic resolution
  const dyn = { enabled: opts.dynamicResolution ?? true, scale: 1, ema: 0, timer: 0 };

  function basePixelRatio() {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    return Math.min(dpr, p.maxPixelRatio) * p.renderScale;
  }

  function build() {
    disposePasses();
    p = applyRendererPreset(renderer, presetName, { toneMapping, exposure: opts.exposure });
    if (opts.overrides) p = { ...p, ...opts.overrides };
    dyn.scale = 1;
    renderer.getSize(size);
    if (p.usePost === false) { composer = null; return; }
    const pr = renderer.getPixelRatio();
    rt = new WebGLRenderTarget(size.x * pr, size.y * pr, { type: HalfFloatType, samples: p.msaa || 0 });
    composer = new EffectComposer(renderer, rt);
    composer.setPixelRatio(pr); composer.setSize(size.x, size.y);
    passes.render = new RenderPass(scene, camera); composer.addPass(passes.render);
    if (p.ao?.enabled) {
      const ao = new GTAOPass(scene, camera, size.x * pr, size.y * pr);
      ao.output = GTAOPass.OUTPUT.Default;
      ao.blendIntensity = p.ao.blend ?? 1;
      ao.updateGtaoMaterial({ radius: p.ao.radius ?? 0.5, distanceExponent: 1, thickness: 1, scale: 1, samples: p.ao.samples ?? 12 });
      ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, rings: 2, samples: 8 });
      passes.ao = ao; composer.addPass(ao);
    }
    if (p.bloom) {
      const b = new UnrealBloomPass(new Vector2(size.x, size.y), p.bloom.strength, p.bloom.radius, p.bloom.threshold);
      passes.bloom = b; composer.addPass(b);
    }
    passes.output = new OutputPass(); composer.addPass(passes.output);   // tone mapping + sRGB
    if (p.aa === 'smaa') { passes.aa = new SMAAPass(); composer.addPass(passes.aa); }
    else if (p.aa === 'fxaa') { passes.aa = new FXAAPass(); composer.addPass(passes.aa); }
    composer.setSize(size.x, size.y);
  }

  function disposePasses() {
    for (const k in passes) passes[k].dispose?.();
    passes = {};
    composer?.dispose?.(); composer = null;
    rt?.dispose(); rt = null;
  }

  function applyScale() {
    const pr = basePixelRatio() * dyn.scale;
    renderer.setPixelRatio(pr);
    if (composer) { composer.setPixelRatio(pr); composer.setSize(size.x, size.y); }
  }

  build();

  return {
    get preset() { return presetName; },
    get settings() { return p; },
    get composer() { return composer; },
    get passes() { return passes; },
    get resolutionScale() { return dyn.scale; },
    setPreset(name) { if (!PRESETS[name]) return; presetName = name; build(); },
    setDynamicResolution(on) { dyn.enabled = on; if (!on) { dyn.scale = 1; applyScale(); } },
    setSize(w, h) { size.set(w, h); renderer.setSize(w, h, false); if (composer) composer.setSize(w, h); },
    setCamera(cam) { camera = cam; if (passes.render) passes.render.camera = cam; if (passes.ao) passes.ao.camera = cam; },
    render(dt = 1 / 60) {
      // dynamic resolution: hold target fps by trading render scale, with hysteresis
      if (dyn.enabled && p.dynRes && dt > 0 && dt < 0.25) {
        dyn.ema = dyn.ema ? dyn.ema * 0.92 + dt * 0.08 : dt;
        dyn.timer += dt;
        if (dyn.timer > 0.75) {
          dyn.timer = 0;
          const budget = 1 / p.dynRes.targetFps;
          let s = dyn.scale;
          if (dyn.ema > budget * 1.12) s -= 0.05; else if (dyn.ema < budget * 0.8) s += 0.025;
          const lo = p.dynRes.min / p.renderScale, hi = p.dynRes.max / p.renderScale;
          s = Math.min(hi, Math.max(lo, s));
          if (Math.abs(s - dyn.scale) > 1e-3) { dyn.scale = s; applyScale(); }
        }
      }
      if (composer) composer.render(dt); else renderer.render(scene, camera);
    },
    dispose() { disposePasses(); },
  };
}
