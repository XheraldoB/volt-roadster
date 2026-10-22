// Keyboard + multi-touch + tilt input with low-latency pointer handling.
// Touch steering pad: one large zone. 'drag' = analog (offset from where the thumb landed), 'buttons' = left/right halves,
// 'tilt' = phone tilt (the pad still overrides). Every pointer is tracked independently, so steer + gas + jump work together
// and nothing sticks when a finger slides off (pointer capture + cancel/lost-capture/blur all release).
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export class Input {
  constructor(root) {
    this.keys = new Set(); this.touch = { left: 0, right: 0, gas: 0, brake: 0, rev: 0, boost: 0, jump: 0, drift: 0 }; this.tilt = 0;
    this.padSteer = 0; this.padActive = false;
    this.steerVal = 0; this.settings = { autoGas: false, steer: 'drag', sens: 1, esc: true, assist: true, airRoll: false }; this.isTouch = false;
    addEventListener('keydown', e => { if (e.repeat) return; this.keys.add(e.code); if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); this.onKey && this.onKey(e.code); });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => this.releaseAll());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.releaseAll(); });
    this.root = root; this.bindTouch(root);
    addEventListener('deviceorientation', e => { if (e.beta == null) return; const ang = (screen.orientation && screen.orientation.angle) || window.orientation || 0; const v = ang === 90 ? e.beta : ang === -90 || ang === 270 ? -e.beta : e.gamma; this.tilt = clamp((v || 0) / 22, -1, 1); });
  }
  releaseAll() { this.keys.clear(); for (const k in this.touch) this.touch[k] = 0; this.padSteer = 0; this.padActive = false; this.ptrs && this.ptrs.clear(); this.root && this.root.querySelectorAll('.on').forEach(el => el.classList.remove('on')); this.drawPad(); }
  bindTouch(root) {
    const ptrs = this.ptrs = new Map(); // pointerId -> { el, ctl, x0 }
    const set = (ctl, v, el) => { if (!ctl || ctl === 'steer') return; this.touch[ctl] = v; if (el) el.classList.toggle('on', !!v); if (v && this.onPress) this.onPress(ctl); };
    const padVal = (p, e) => {
      const r = p.el.getBoundingClientRect();
      if (this.steerMode() === 'buttons') return e.clientX < r.left + r.width / 2 ? -1 : 1;
      const span = Math.max(40, r.width * 0.2); // full lock at ~20% of the pad width from the touch-down point
      const d = e.clientX - p.x0; if (Math.abs(d) > span) p.x0 = e.clientX - Math.sign(d) * span; // the origin follows the thumb: no dead travel when reversing
      return clamp(d / span, -1, 1);
    };
    const updPad = () => { let v = 0, any = false; for (const p of ptrs.values()) if (p.ctl === 'steer') { v = p.v; any = true; } this.padSteer = v; this.padActive = any; this.drawPad(); };
    root.addEventListener('pointerdown', e => {
      const el = e.target.closest('[data-ctl]'); if (!el) return; e.preventDefault(); this.isTouch = e.pointerType === 'touch' || this.isTouch;
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
      const p = { el, ctl: el.dataset.ctl, x0: e.clientX, v: 0 }; ptrs.set(e.pointerId, p);
      if (p.ctl === 'steer') { if (this.steerMode() === 'buttons') p.v = padVal(p, e); else { const r = el.getBoundingClientRect(); p.cx = clamp(e.clientX, r.left, r.right); } updPad(); }
      else set(p.ctl, 1, el);
    }, { passive: false });
    const up = e => { const p = ptrs.get(e.pointerId); if (!p) return; ptrs.delete(e.pointerId); if (p.ctl === 'steer') updPad(); else if (![...ptrs.values()].some(q => q.el === p.el)) set(p.ctl, 0, p.el); };
    root.addEventListener('pointerup', up); root.addEventListener('pointercancel', up); root.addEventListener('lostpointercapture', up);
    root.addEventListener('pointermove', e => {
      const p = ptrs.get(e.pointerId); if (!p) return;
      if (p.ctl === 'steer') { p.v = padVal(p, e); updPad(); return; }
      // slide between the right-hand buttons (e.g. gas -> brake) without lifting the thumb
      const over = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-ctl]');
      if (over && over !== p.el && over.dataset.ctl !== 'steer' && root.contains(over) && ['gas', 'brake'].includes(p.ctl) && ['gas', 'brake'].includes(over.dataset.ctl)) {
        const old = p.el; p.el = over; const oc = p.ctl; p.ctl = over.dataset.ctl;
        if (![...ptrs.values()].some(q => q.el === old)) set(oc, 0, old); set(p.ctl, 1, over);
      }
    }, { passive: true });
  }
  steerMode() { return this.settings.layout === 'classic' ? 'buttons' : this.settings.steer; }
  drawPad() { const k = this.root && this.root.querySelector('.knob'); if (k) { k.style.transform = `translateX(${(this.padSteer * 38).toFixed(1)}%)`; k.parentElement.classList.toggle('on', this.padActive); k.parentElement.classList.toggle('L', this.padActive && this.padSteer < 0); k.parentElement.classList.toggle('R', this.padActive && this.padSteer > 0); } }
  state(airborne, dt = 1 / 60) {
    const k = this.keys, t = this.touch, S = this.settings, SM = this.steerMode();
    const left = k.has('ArrowLeft') || k.has('KeyA'), right = k.has('ArrowRight') || k.has('KeyD');
    let target = (right ? 1 : 0) - (left ? 1 : 0), analog = false;
    if (!left && !right) {
      if (this.padActive) { target = this.padSteer; analog = SM !== 'buttons'; }
      else if (SM === 'tilt' && this.isTouch) { target = Math.abs(this.tilt) < 0.06 ? 0 : this.tilt; analog = true; }
    }
    // smoothing: analog input follows quickly (it is already smooth), digital input ramps in, both centre fast
    const grow = Math.abs(target) > Math.abs(this.steerVal) && Math.sign(target || 1) === Math.sign(this.steerVal || target || 1);
    const rate = analog ? 28 : grow ? 12 : 26; const a = 1 - Math.exp(-dt * rate); this.steerVal += (target - this.steerVal) * a;
    if (Math.abs(this.steerVal) < 0.01 && target === 0) this.steerVal = 0;
    const rev = !!t.rev; /* R28: dedicated R pedal = brake to a stop, then drive backwards (same as holding BRAKE when stopped) */
    const gasKey = !rev && (k.has('ArrowUp') || k.has('KeyW') || t.gas), brakeKey = k.has('ArrowDown') || k.has('KeyS') || t.brake || rev;
    const throttle = gasKey || (S.autoGas && this.isTouch && !brakeKey) ? 1 : 0;
    return {
      steer: this.steerVal, throttle, reverse: rev, brake: brakeKey ? 1 : 0, handbrake: !!(k.has('KeyX') || k.has('ControlLeft') || t.drift),
      boost: !!(k.has('ShiftLeft') || k.has('ShiftRight') || k.has('KeyN') || t.boost), jump: !!(k.has('Space') || t.jump),
      pitch: (brakeKey ? 1 : 0) - (gasKey ? 1 : 0), airRoll: S.airRoll, assist: S.assist, esc: S.esc !== false, sens: S.sens || 1,
    };
  }
}
export function haptic(on, pattern) { if (on && navigator.vibrate) try { navigator.vibrate(pattern); } catch (e) {} }
