// Renderer, quality presets, post-processing, adaptive resolution.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAPass } from 'three/examples/jsm/postprocessing/FXAAPass.js';
import { PRESETS as ART_POST } from '../../art/post/ultraPost.js';

// Mobile-first presets (OnePlus 15 feedback). Ultra = native resolution (DPR up to 3) with a light post chain: no AO by default
// (optional extra in Settings), no MSAA resolve, quarter-res emitter-only bloom, FXAA (invisible as blur at DPR >= 2).
// Dynamic resolution holds the frame time; minScale bounds it so the image is never visibly upscaled.
export const PRESETS = {
  performance: { target: 120, name: 'Performance', dpr: 1.5, shadows: 1024, bloom: false, ao: false, msaa: 0, particles: 0.45, terrainRes: 120, draw: 1300, decor: 0.45, vignette: false, minScale: 0.75 },
  low:    { target: 60, name: 'Low',    dpr: 1,   shadows: 0,    bloom: false, ao: false, msaa: 0, particles: 0.25, terrainRes: 96,  draw: 900,  decor: 0.3, vignette: false, minScale: 0.7 },
  medium: { target: 90, name: 'Medium', dpr: 1.75, shadows: 1024, bloom: false, ao: false, msaa: 0, particles: 0.5,  terrainRes: 140, draw: 1400, decor: 0.6, vignette: true, minScale: 0.75 },
  high:   { target: 120, name: 'High',   dpr: 2,   shadows: 1024, bloom: true,  ao: false, msaa: 0, particles: 0.6, terrainRes: 180, draw: 2000, decor: 0.8, vignette: true, minScale: 0.85 },
  ultra:  { target: 120, name: 'Ultra',  dpr: 2,   shadows: 2048, bloom: true,  ao: false, msaa: 0, particles: 0.7, terrainRes: 220, draw: 2600, decor: 1, vignette: true, minScale: 0.85 },
};

export function detectTier(renderer) {
  let gpu = '';
  try { const gl = renderer.getContext(); const ext = gl.getExtension('WEBGL_debug_renderer_info'); gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); } catch (e) {}
  const cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 4;
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  let tier = 'high';
  const m = /Adreno[^0-9]*(\d{3})/i.exec(gpu);
  if (m) { const n = +m[1]; tier = n >= 830 ? 'ultra' : n >= 740 ? 'ultra' : n >= 650 ? 'high' : n >= 610 ? 'medium' : 'low'; }
  else if (/Immortalis|Mali-G7[1-9]|Mali-G9|Xclipse/i.test(gpu)) tier = 'high';
  else if (/Mali|PowerVR|Adreno/i.test(gpu)) tier = 'medium';
  else if (/Apple/i.test(gpu)) tier = mobile ? 'high' : 'ultra';
  else if (/RTX|Radeon RX|GeForce GTX 1[0-9]|Arc|M[1-9]/i.test(gpu)) tier = 'ultra';
  else if (/Intel|SwiftShader|llvmpipe/i.test(gpu)) tier = /SwiftShader|llvmpipe/i.test(gpu) ? 'low' : 'medium';
  if (mobile && (cores < 6 || mem < 4) && tier === 'ultra') tier = 'high';
  return { tier, gpu, cores, mem, mobile };
}

const VignetteShader = {
  uniforms: { tDiffuse: { value: null }, amount: { value: 0.15 }, chroma: { value: 0.0 }, speedLines: { value: 0 }, time: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float amount; uniform float chroma; uniform float speedLines; uniform float time; varying vec2 vUv;
  void main(){ vec2 c = vUv - 0.5; float d = length(c);
    vec2 off = c * chroma * 0.012;
    vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
    float a = atan(c.y, c.x); float lines = step(0.985, fract(sin(floor(a * 90.0) * 43.1 + floor(time * 18.0)) * 1000.0)) * smoothstep(0.25, 0.6, d) * speedLines;
    col += lines * 0.25;
    col *= 1.0 - amount * smoothstep(0.35, 0.85, d);
    gl_FragColor = vec4(col, 1.0); }`,
};

export class Gfx {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false, alpha: false, preserveDrawingBuffer: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping; this.renderer.toneMappingExposure = 1.0; // art: Khronos Neutral keeps blacks/contrast; AgX washed midtones out on device
    this.renderer.shadowMap.type = THREE.PCFShadowMap; // r186: PCFSoft is deprecated
    this.info = detectTier(this.renderer);
    this.dynScale = 1; this.fpsSamples = []; this.composer = null;
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.3, 6000); // > sky dome radius
    this.refreshHz = 60; this.dtHist = []; this.fpsCap = 0;
  }
  setQuality(name, scene) {
    this.qName = name; this.q = PRESETS[name];
    const r = this.renderer;
    r.shadowMap.enabled = this.q.shadows > 0;
    this.scene = scene || this.scene;
    this.buildComposer();
    this.resize();
  }
  buildComposer() {
    const q = this.q; if (this.composer) { this.composer.dispose?.(); this.composer = null; }
    if (!this.scene) return;
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), { type: THREE.HalfFloatType, samples: q.msaa });
    const c = this.composer = new EffectComposer(this.renderer, rt);
    this.renderPass = new RenderPass(this.scene, this.camera); c.addPass(this.renderPass);
    if ((q.ao || this.extraAO)) { this.aoPass = new GTAOPass(this.scene, this.camera, size.x, size.y); this.aoPass.output = GTAOPass.OUTPUT.Default; this.aoPass.blendIntensity = 0.85; this.aoPass.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1.2, scale: 1 }); c.addPass(this.aoPass); } else this.aoPass = null;
    if (q.bloom) { const b = ART_POST[this.qName]?.bloom || { strength: 0.35, radius: 0.12, threshold: 3.6 }; this.bloom = new UnrealBloomPass(new THREE.Vector2(Math.ceil(size.x / 4), Math.ceil(size.y / 4)), b.strength * 0.6, b.radius, Math.max(4, b.threshold)); c.addPass(this.bloom); } else this.bloom = null; // art preset: only true emitters bloom (thr 3.6), the HDR sky no longer hazes the frame
    if (q.vignette) { this.vig = new ShaderPass(VignetteShader); c.addPass(this.vig); } else this.vig = null; // no full-screen pass at all when vignette is off
    c.addPass(new OutputPass());
    if (!q.msaa) { this.fxaa = new FXAAPass(); c.addPass(this.fxaa); } else this.fxaa = null; // cheap AA on Low/Medium
  }
  setScene(scene) { this.scene = scene; if (this.renderPass) { this.renderPass.scene = scene; } if (this.aoPass) this.aoPass.scene = scene; if (!this.composer) this.buildComposer(); }
  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, this.q.dpr) * this.dynScale;
    this.renderer.setPixelRatio(dpr); this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    if (this.composer) { this.composer.setPixelRatio(dpr); this.composer.setSize(w, h); }
    if (this.fxaa && this.fxaa.setSize) this.fxaa.setSize(w * dpr, h * dpr);
    this.vh = h * dpr;
  }
  // adaptive resolution: keeps frame times near target on weaker GPUs
  adapt(dt, auto) {
    const W = this._win || (this._win = new Float32Array(48)); W[this._wn = this._wn || 0] = dt; this._wn++;
    if (this._wn < W.length) return; this._wn = 0;
    const srt = this._srt || (this._srt = new Float32Array(W.length)); srt.set(W); srt.sort();
    const fps = 1 / srt[srt.length >> 1], p90fps = 1 / srt[Math.floor(srt.length * 0.9)]; this.avgFps = fps; this.p90Fps = p90fps; // median-based: one hitch does not drop resolution
    // target: preset goal (120 on Ultra) limited by the display refresh rate and the user's FPS cap
    const target = Math.min(this.q.target || 60, this.refreshHz * 0.97, this.fpsCap || 1e9);
    this.target = target;
    const prev = this.dynScale, floor = this.q.minScale || (this.q.dpr >= 2 ? 0.85 : 0.6); // art: keep Ultra/High crisp, never upscale blurrily
    if (fps < target * 0.85) {
      // shed effects before resolution: GTAO, then bloom, then small resolution steps down to the floor
      if (this.aoPass && this.aoPass.enabled) this.aoPass.enabled = false;
      else if (this.bloom && this.bloom.enabled) this.bloom.enabled = false;
      else if (this.dynScale > floor) this.dynScale = Math.max(floor, this.dynScale - 0.05);
    } else if (fps > target * 0.96 && this.dynScale < 1) this.dynScale = Math.min(1, this.dynScale + 0.05);
    if (prev !== this.dynScale) this.resize();
    if (auto && fps < Math.min(30, target * 0.5) && this.dynScale <= floor + 0.01) return 'downgrade';
  }
  // WebGL context restored: GL objects of the old context are gone; drop references (disposing them would hit a dead context)
  contextRestored() { this.composer = null; this.aoPass = null; this.bloom = null; this.fxaa = null; this.buildComposer(); this.resize(); }
  // estimate the display refresh rate from light (menu) frames
  sampleRefresh(dt) {
    this.dtHist.push(dt); if (this.dtHist.length < 120) return; const a = this.dtHist.slice().sort((x, y) => x - y); this.dtHist.length = 0;
    const hz = 1 / a[Math.floor(a.length * 0.2)]; const snap = [60, 90, 120, 144, 165, 240].reduce((b, v) => Math.abs(v - hz) < Math.abs(b - hz) ? v : b, 60); this.refreshHz = Math.max(this.refreshHz === 60 ? 0 : this.refreshHz, snap);
  }
  render(scene, camera) {
    if (this.composer) { this.renderPass.scene = scene; this.renderPass.camera = camera; if (this.aoPass) { this.aoPass.scene = scene; this.aoPass.camera = camera; } this.composer.render(); }
    else this.renderer.render(scene, camera);
  }
}
