// Procedural audio: electric motor, wind, tyres, SFX and a synthwave "radio".
const STATIONS = ['VOLT-FM 88.8', 'NEON 101', 'ORBIT RADIO', 'RED PLANET WAVES'];
const ADJ = ['Neon', 'Midnight', 'Chrome', 'Solar', 'Electric', 'Lunar', 'Turbo', 'Velvet', 'Hyper', 'Crimson', 'Quantum', 'Retro'];
const NOUN = ['Highway', 'Horizon', 'Drive', 'Pulse', 'Runner', 'Dreams', 'Overdrive', 'Skyline', 'Orbit', 'Mirage', 'Voltage', 'Sunset'];
const SCALES = { minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], phryg: [0, 1, 3, 5, 7, 8, 10] };

export class Audio {
  constructor() { this.ctx = null; this.musicVol = 0.5; this.sfxVol = 0.8; this.enabled = true; this.trackIdx = 0; this.onTrack = null; }
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC({ latencyHint: 'interactive' });
    this.master = c.createGain(); this.master.connect(c.destination);
    this.comp = c.createDynamicsCompressor(); this.comp.threshold.value = -14; this.comp.connect(this.master);
    this.sfx = c.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(this.comp);
    this.music = c.createGain(); this.music.gain.value = this.musicVol * 0.55; this.music.connect(this.comp);
    // noise buffer
    const nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate); const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; this.noise = nb;
    // reverb-ish delay for music
    this.delay = c.createDelay(1); this.delay.delayTime.value = 0.28; const fb = c.createGain(); fb.gain.value = 0.28; this.delay.connect(fb); fb.connect(this.delay); this.delay.connect(this.music);
    this.buildEngine();
  }
  setVolumes(m, s) { this.musicVol = m; this.sfxVol = s; if (this.ctx) { this.music.gain.value = m * 0.55; this.sfx.gain.value = s; } }
  buildEngine() {
    const c = this.ctx;
    this.eng = c.createGain(); this.eng.gain.value = 0; this.eng.connect(this.sfx);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 800; lp.connect(this.eng); this.engLP = lp;
    this.o1 = c.createOscillator(); this.o1.type = 'sawtooth'; this.o2 = c.createOscillator(); this.o2.type = 'square'; this.o3 = c.createOscillator(); this.o3.type = 'sine';
    const g1 = c.createGain(); g1.gain.value = 0.25; const g2 = c.createGain(); g2.gain.value = 0.08; const g3 = c.createGain(); g3.gain.value = 0.18;
    this.o1.connect(g1).connect(lp); this.o2.connect(g2).connect(lp); this.o3.connect(g3).connect(this.eng);
    [this.o1, this.o2, this.o3].forEach(o => o.start());
    // wind + tyre noise
    const mk = (type, f, q) => { const src = c.createBufferSource(); src.buffer = this.noise; src.loop = true; const bp = c.createBiquadFilter(); bp.type = type; bp.frequency.value = f; bp.Q.value = q; const g = c.createGain(); g.gain.value = 0; src.connect(bp).connect(g).connect(this.sfx); src.start(); return g; };
    this.wind = mk('bandpass', 700, 0.4); this.tyre = mk('bandpass', 2400, 6); this.thrustN = mk('lowpass', 500, 0.7); this.hiss = mk('highpass', 5200, 0.8);
  }
  engine(speed, throttle, boost, slip, thrust, on) {
    if (!this.ctx) return; /* B40: never feed NaN/Infinity to AudioParams */ const fin = (x, d = 0) => Number.isFinite(x) ? x : d; speed = Math.min(400, Math.max(0, fin(speed))); throttle = Math.min(1, Math.max(0, fin(throttle))); slip = Math.max(0, fin(slip)); const t = this.ctx.currentTime;
    const f = 40 + speed * 3.2; this.o1.frequency.setTargetAtTime(f, t, 0.05); this.o2.frequency.setTargetAtTime(f * 1.5, t, 0.05); this.o3.frequency.setTargetAtTime(300 + speed * 26 + (boost ? 300 : 0), t, 0.05);
    this.engLP.frequency.setTargetAtTime(500 + throttle * 1500 + speed * 20, t, 0.08);
    this.eng.gain.setTargetAtTime(on ? 0.05 + throttle * 0.08 + (boost ? 0.06 : 0) : 0, t, 0.1);
    this.wind.gain.setTargetAtTime(on ? Math.min(0.35, speed * speed * 0.00008) : 0, t, 0.2);
    this.tyre.gain.setTargetAtTime(on ? Math.min(0.25, slip * 0.3) : 0, t, 0.05);
    this.thrustN.gain.setTargetAtTime(on && thrust && !this.coldGas ? 0.5 : 0, t, 0.05);
  }
  // cold-gas RCS hiss (pickup): k = 0..1 intensity
  rcs(k) { if (!this.ctx || !this.hiss) return; k = Number.isFinite(k) ? Math.max(0, k) : 0; /* B40 */ this.hiss.gain.setTargetAtTime(Math.min(0.55, k * 0.5), this.ctx.currentTime, k > 0 ? 0.02 : 0.06); }
  rcsPuff() { this.noiseHit(0.12, 7000, 0.18, 'highpass'); }
  // procedural horns (all original synth patches)
  horn(id = 'beep') {
    if (!this.ctx) return; const T = (f, d, ty, v, sl = 0, dl = 0) => this.tone(f, d, ty, v, sl, dl);
    switch (id) {
      case 'air': T(233, 0.9, 'sawtooth', 0.22); T(277, 0.9, 'sawtooth', 0.18); T(349, 0.9, 'sawtooth', 0.14); break;
      case 'goose': for (let i = 0; i < 3; i++) { T(420, 0.16, 'sawtooth', 0.22, -160, i * 0.2); T(840, 0.16, 'square', 0.06, -300, i * 0.2); } break;
      case 'kazoo': [392, 440, 392, 523].forEach((f, i) => { T(f, 0.18, 'sawtooth', 0.16, 12, i * 0.18); T(f * 2.01, 0.18, 'square', 0.05, 0, i * 0.18); }); break;
      case 'train': T(185, 1.4, 'sawtooth', 0.16); T(220, 1.4, 'sawtooth', 0.14); T(277, 1.4, 'sawtooth', 0.12); T(330, 1.4, 'triangle', 0.1); break;
      case 'arcade': [523, 659, 784, 1046, 784, 1046].forEach((f, i) => T(f, 0.08, 'square', 0.12, 0, i * 0.07)); break;
      case 'synth': [261, 329, 392, 494].forEach(f => T(f, 1.0, 'sawtooth', 0.09, 0)); T(65, 1.0, 'sine', 0.3); break;
      case 'laser': for (let i = 0; i < 3; i++) T(1800, 0.22, 'square', 0.12, -1500, i * 0.16); break;
      case 'choir': [220, 277, 330, 440, 554].forEach((f, i) => { T(f, 1.3, 'triangle', 0.09, 0, i * 0.04); T(f * 1.005, 1.3, 'sine', 0.07, 0, i * 0.04); }); break;
      default: T(440, 0.16, 'square', 0.18); T(554, 0.16, 'square', 0.12); T(440, 0.22, 'square', 0.18, 0, 0.22); T(554, 0.22, 'square', 0.12, 0, 0.22);
    }
  }
  tone(freq, dur, type = 'sine', vol = 0.3, slide = 0, delay = 0) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g).connect(this.sfx); o.start(t); o.stop(t + dur + 0.05);
  }
  noiseHit(dur, f = 800, vol = 0.5, type = 'lowpass') {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime; const s = c.createBufferSource(); s.buffer = this.noise; const bf = c.createBiquadFilter(); bf.type = type; bf.frequency.setValueAtTime(f, t); bf.frequency.exponentialRampToValueAtTime(60, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(bf).connect(g).connect(this.sfx); s.start(t, Math.random()); s.stop(t + dur);
  }
  play(name, k = 1) {
    switch (name) {
      case 'coin': this.tone(1320, 0.09, 'square', 0.12); this.tone(1980, 0.12, 'square', 0.1, 0, 0.05); break;
      case 'battery': this.tone(440, 0.3, 'sine', 0.25, 440); break;
      case 'nitro': case 'boost': this.noiseHit(0.5, 3000, 0.35, 'bandpass'); this.tone(200, 0.4, 'sawtooth', 0.12, 600); break;
      case 'jump': this.tone(300, 0.2, 'sine', 0.2, 300); break;
      case 'land': this.noiseHit(0.25 + k * 0.3, 300 + k * 400, 0.3 + k * 0.5); break;
      case 'crash': this.noiseHit(1.2, 2500, 0.9); this.tone(90, 0.8, 'sawtooth', 0.3, -60); break;
      case 'hit': this.noiseHit(0.15, 1800, 0.3 * k + 0.1, 'bandpass'); break;
      case 'trick': this.tone(660, 0.1, 'triangle', 0.18); this.tone(880, 0.1, 'triangle', 0.18, 0, 0.08); this.tone(1320, 0.15, 'triangle', 0.18, 0, 0.16); break;
      case 'perfect': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.2, 0, i * 0.07)); break;
      case 'count': this.tone(660, 0.2, 'square', 0.15); break;
      case 'go': this.tone(1320, 0.5, 'square', 0.18); break;
      case 'checkpoint': this.tone(988, 0.12, 'sine', 0.2); this.tone(1318, 0.18, 'sine', 0.2, 0, 0.1); break;
      case 'quest': [392, 523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.3, 'square', 0.12, 0, i * 0.09)); break;
      case 'fail': this.tone(300, 0.5, 'sawtooth', 0.15, -150); break;
      case 'moo': this.tone(180, 0.9, 'sawtooth', 0.25, -60); this.tone(184, 0.9, 'square', 0.08, -62); break;
      case 'beep': [1200, 900, 1500].forEach((f, i) => this.tone(f, 0.08, 'square', 0.12, 0, i * 0.12)); break;
      case 'meteor': this.tone(1600, 1.6, 'sine', 0.06, -1400); break;
      case 'boom': this.noiseHit(1.5, 1200, 1.0); break;
      case 'click': this.tone(900, 0.04, 'square', 0.08); break;
      case 'buy': this.tone(880, 0.08, 'square', 0.12); this.tone(1760, 0.2, 'square', 0.12, 0, 0.07); break;
      case 'whoosh': this.noiseHit(0.6, 1500, 0.4, 'bandpass'); break;
      case 'rocket': this.noiseHit(6, 400, 1.0); break;
      case 'near': this.noiseHit(0.35, 2500, 0.3, 'highpass'); break;
    }
  }
  // ---- procedural synthwave radio ----
  trackInfo(i) { const r = mulberry(i * 7919 + 13); return { name: `${ADJ[Math.floor(r() * ADJ.length)]} ${NOUN[Math.floor(r() * NOUN.length)]}`, station: STATIONS[i % STATIONS.length], seed: i }; }
  startRadio(i = this.trackIdx) {
    if (!this.ctx) return; this.stopRadio(); this.trackIdx = i;
    const info = this.trackInfo(i); const r = mulberry(i * 7919 + 13); r(); r();
    const bpm = 92 + Math.floor(r() * 40), root = 38 + Math.floor(r() * 10), scale = Object.values(SCALES)[Math.floor(r() * 3)];
    const prog = [[0, 5, 3, 4], [0, 3, 5, 4], [0, 6, 5, 3], [5, 3, 0, 4]][Math.floor(r() * 4)];
    const arpPat = Array.from({ length: 16 }, () => Math.floor(r() * 7)); const leadPat = Array.from({ length: 32 }, () => (r() < 0.45 ? Math.floor(r() * 7) + 7 : -1));
    const step = 60 / bpm / 4; let n = 0, next = this.ctx.currentTime + 0.1;
    const midi = m => 440 * Math.pow(2, (m - 69) / 12); const deg = (d) => root + 12 * Math.floor(d / 7) + scale[((d % 7) + 7) % 7];
    this.radio = setInterval(() => {
      const c = this.ctx; while (next < c.currentTime + 0.2) {
        const bar = Math.floor(n / 16) % 4, s = n % 16, chord = prog[bar];
        if (s % 4 === 0) this.drum('kick', next); if (s % 8 === 4) this.drum('snare', next); if (s % 2 === 1) this.drum('hat', next);
        if (s % 2 === 0) this.voice(midi(deg(chord) - 12), step * 1.8, 'sawtooth', 0.12, next, 300 + 500 * (s % 4 === 0));
        this.voice(midi(deg(chord + arpPat[s] % 3 * 2) + 12), step * 0.9, 'square', 0.035, next, 2400, true);
        if (s === 0) [0, 2, 4].forEach(k => this.voice(midi(deg(chord + k)), step * 15, 'sawtooth', 0.025, next, 900, true));
        const L = leadPat[n % 32]; if (L >= 0 && n % 64 >= 32) this.voice(midi(deg(chord + L) + 12), step * 2, 'triangle', 0.06, next, 3000, true);
        n++; next += step;
      }
    }, 50);
    this.onTrack && this.onTrack(info); return info;
  }
  nextTrack() { return this.startRadio(this.trackIdx + 1); }
  stopRadio() { if (this.radio) clearInterval(this.radio); this.radio = null; }
  voice(f, dur, type, vol, t, cutoff, wet) {
    const c = this.ctx; const o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter(); o.type = type; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.value = cutoff;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp).connect(g).connect(this.music); if (wet) g.connect(this.delay); o.start(t); o.stop(t + dur + 0.05);
  }
  drum(kind, t) {
    const c = this.ctx;
    if (kind === 'kick') { const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25); o.connect(g).connect(this.music); o.start(t); o.stop(t + 0.3); }
    else { const s = c.createBufferSource(); s.buffer = this.noise; const f = c.createBiquadFilter(); f.type = kind === 'hat' ? 'highpass' : 'bandpass'; f.frequency.value = kind === 'hat' ? 7000 : 1800; const g = c.createGain(); const d = kind === 'hat' ? 0.04 : 0.18; g.gain.setValueAtTime(kind === 'hat' ? 0.06 : 0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + d); s.connect(f).connect(g).connect(this.music); if (kind === 'snare') g.connect(this.delay); s.start(t, Math.random()); s.stop(t + d + 0.02); }
  }
  setSlowmo(on) { if (!this.ctx) return; this.master.gain.setTargetAtTime(on ? 0.6 : 1, this.ctx.currentTime, 0.1); }
}
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
