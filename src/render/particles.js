// GPU-friendly CPU particle pools (one draw call per pool).
import * as THREE from 'three';
import { glowSprite } from './textures.js';

const VS = `attribute float size; attribute vec4 col; varying vec4 vCol; uniform float scale;
void main(){ vCol = col; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`;
const FS = `uniform sampler2D map; varying vec4 vCol; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vCol.rgb, vCol.a * t.a); if (gl_FragColor.a < 0.01) discard; }`;

export class Particles {
  constructor(max, additive = true) {
    this.max = max; this.n = 0;
    this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3); this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max); this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.grow = new Float32Array(max); this.drag = new Float32Array(max); this.grav = new Float32Array(max); this.alpha0 = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('col', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({ uniforms: { map: { value: glowSprite() }, scale: { value: 400 } }, vertexShader: VS, fragmentShader: FS,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.geo = g;
    this.budget = 1;
  }
  emit(p, v, o = {}) {
    if (Math.random() > this.budget) return;
    let i = this.n < this.max ? this.n++ : Math.floor(Math.random() * this.max);
    const sp = o.spread || 0;
    this.pos[i * 3] = p.x + (Math.random() - 0.5) * (o.jitter || 0); this.pos[i * 3 + 1] = p.y + (Math.random() - 0.5) * (o.jitter || 0); this.pos[i * 3 + 2] = p.z + (Math.random() - 0.5) * (o.jitter || 0);
    this.vel[i * 3] = v.x + (Math.random() - 0.5) * sp; this.vel[i * 3 + 1] = v.y + (Math.random() - 0.5) * sp; this.vel[i * 3 + 2] = v.z + (Math.random() - 0.5) * sp;
    const c = o.color || [1, 1, 1]; this.col[i * 4] = c[0]; this.col[i * 4 + 1] = c[1]; this.col[i * 4 + 2] = c[2]; this.col[i * 4 + 3] = this.alpha0[i] = o.alpha ?? 1;
    this.size[i] = o.size || 1; this.life[i] = this.maxLife[i] = o.life || 1; this.grow[i] = o.grow || 0; this.drag[i] = o.drag ?? 0.5; this.grav[i] = o.gravity ?? 0;
  }
  burst(p, n, speed, o = {}) { for (let k = 0; k < n; k++) { const d = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5 + (o.up || 0), Math.random() - 0.5).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.8)); if (o.base) d.add(o.base); this.emit(p, d, o); } }
  update(dt, viewportH) {
    this.mat.uniforms.scale.value = viewportH * 0.9;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.col[i * 4 + 3] = 0; this.size[i] = 0; continue; }
      const d = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i * 3] *= d; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d - this.grav[i] * dt; this.vel[i * 3 + 2] *= d;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const t = this.life[i] / this.maxLife[i]; this.col[i * 4 + 3] = this.alpha0[i] * Math.min(1, t * 2.5); this.size[i] += this.grow[i] * dt;
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.col.needsUpdate = true; this.geo.attributes.size.needsUpdate = true;
    this.geo.setDrawRange(0, this.n);
  }
  clear() { this.n = 0; }
}
