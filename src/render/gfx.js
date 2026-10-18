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

export const PRESETS = {
  low:    { target: 45, name: 'Low',    dpr: 1,   shadows: 0,    bloom: false, ao: false, msaa: 0, particles: 0.25, terrainRes: 96,  draw: 900,  decor: 0.3, vignette: false },
  medium: { target: 60, name: 'Medium', dpr: 1.5, shadows: 1024, bloom: false, ao: false, msaa: 0, particles: 0.5,  terrainRes: 140, draw: 1400, decor: 0.6, vignette: true },
  high:   { target: 90, name: 'High',   dpr: 2,   shadows: 2048, bloom: true,  ao: false, msaa: 4, particles: 0.8,  terrainRes: 200, draw: 2200, decor: 0.85, vignette: true },
  ultra:  { target: 120, name: 'Ultra',  dpr: 3,   shadows: 4096, bloom: true,  ao: true,  msaa: 4, particles: 1,    terrainRes: 280, draw: 3200, decor: 1, vignette: true },
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
  uniforms: { tDiffuse: { value: null }, amount: { value: 0.32 }, chroma: { value: 0.0 }, speedLines: { value: 0 }, time: { value: 0 } },
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
    this.renderer.toneMapping = THREE.AgXToneMapping; this.renderer.toneMappingExposure = 1.0;
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
    if (q.ao) { this.aoPass = new GTAOPass(this.scene, this.camera, size.x, size.y); this.aoPass.output = GTAOPass.OUTPUT.Default; this.aoPass.blendIntensity = 0.85; this.aoPass.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1.2, scale: 1 }); c.addPass(this.aoPass); } else this.aoPass = null;
    if (q.bloom) { const b = ART_POST[this.qName]?.bloom || { strength: 0.35, radius: 0.12, threshold: 3.6 }; this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), b.strength, b.radius, b.threshold); c.addPass(this.bloom); } else this.bloom = null; // art preset: only true emitters bloom (thr 3.6), the HDR sky no longer hazes the frame
    this.vig = new ShaderPass(VignetteShader); if (!q.vignette) this.vig.uniforms.amount.value = 0; c.addPass(this.vig);
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
    this.fpsSamples.push(dt); if (this.fpsSamples.length < 90) return;
    const avg = this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length; this.fpsSamples.length = 0;
    const fps = 1 / avg; this.avgFps = fps;
    // target: preset goal (120 on Ultra) limited by the display refresh rate and the user's FPS cap
    const target = Math.min(this.q.target || 60, this.refreshHz * 0.97, this.fpsCap || 1e9);
    this.target = target;
    const prev = this.dynScale;
    if (fps < target * 0.85 && this.dynScale > 0.55) this.dynScale = Math.max(0.55, this.dynScale - 0.08);
    else if (fps > target * 0.96 && this.dynScale < 1) this.dynScale = Math.min(1, this.dynScale + 0.04);
    if (prev !== this.dynScale) this.resize();
    if (auto && fps < Math.min(30, target * 0.5) && this.dynScale <= 0.56) return 'downgrade';
  }
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
