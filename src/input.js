// Keyboard + multi-touch + tilt input with low-latency pointer handling.
export class Input {
  constructor(root) {
    this.keys = new Set(); this.touch = { left: 0, right: 0, gas: 0, brake: 0, boost: 0, jump: 0 }; this.tilt = 0;
    this.steerVal = 0; this.settings = { autoGas: false, steer: 'buttons' }; this.isTouch = false;
    addEventListener('keydown', e => { if (e.repeat) return; this.keys.add(e.code); if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); this.onKey && this.onKey(e.code); });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); for (const k in this.touch) this.touch[k] = 0; });
    this.bindTouch(root);
    addEventListener('deviceorientation', e => { if (e.beta == null) return; const ang = (screen.orientation && screen.orientation.angle) || window.orientation || 0; const v = ang === 90 ? e.beta : ang === -90 || ang === 270 ? -e.beta : e.gamma; this.tilt = Math.max(-1, Math.min(1, (v || 0) / 22)); });
  }
  bindTouch(root) {
    const map = new Map(); // pointerId -> control
    const set = (ctl, v, el) => { if (!ctl) return; this.touch[ctl] = v; if (el) el.classList.toggle('on', !!v); if (v && this.onPress) this.onPress(ctl); };
    root.addEventListener('pointerdown', e => {
      const el = e.target.closest('[data-ctl]'); if (!el) return; e.preventDefault(); this.isTouch = e.pointerType === 'touch' || this.isTouch;
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
      map.set(e.pointerId, el); set(el.dataset.ctl, 1, el);
    }, { passive: false });
    const up = e => { const el = map.get(e.pointerId); if (!el) return; map.delete(e.pointerId); if (![...map.values()].includes(el)) set(el.dataset.ctl, 0, el); };
    root.addEventListener('pointerup', up); root.addEventListener('pointercancel', up); root.addEventListener('lostpointercapture', up);
    // slide between left/right steer buttons without lifting the finger
    root.addEventListener('pointermove', e => {
      const el = map.get(e.pointerId); if (!el || !['left', 'right'].includes(el.dataset.ctl)) return;
      const over = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-ctl]');
      if (over && over !== el && ['left', 'right'].includes(over.dataset.ctl)) { set(el.dataset.ctl, 0, el); map.set(e.pointerId, over); set(over.dataset.ctl, 1, over); }
    });
  }
  state(airborne, dt = 1 / 60) {
    const k = this.keys, t = this.touch;
    const left = k.has('ArrowLeft') || k.has('KeyA') || t.left, right = k.has('ArrowRight') || k.has('KeyD') || t.right;
    let target = (right ? 1 : 0) - (left ? 1 : 0);
    if (this.settings.steer === 'tilt' && this.isTouch && !left && !right) target = this.tilt;
    // analog-feel ramp for digital input (fast but not twitchy)
    const grow = Math.abs(target) > Math.abs(this.steerVal); const a = 1 - Math.exp(-dt * (grow ? 15 : 30)); this.steerVal += (target - this.steerVal) * a;
    if (Math.abs(this.steerVal) < 0.01) this.steerVal = 0;
    const gasKey = k.has('ArrowUp') || k.has('KeyW') || t.gas, brakeKey = k.has('ArrowDown') || k.has('KeyS') || t.brake;
    const throttle = gasKey || (this.settings.autoGas && this.isTouch && !brakeKey) ? 1 : 0;
    return {
      steer: this.steerVal, throttle, brake: brakeKey ? 1 : 0,
      boost: !!(k.has('ShiftLeft') || k.has('ShiftRight') || k.has('KeyN') || t.boost), jump: !!(k.has('Space') || t.jump),
      pitch: (brakeKey ? 1 : 0) - (gasKey ? 1 : 0), airRoll: this.settings.airRoll, assist: this.settings.assist,
    };
  }
}
export function haptic(on, pattern) { if (on && navigator.vibrate) try { navigator.vibrate(pattern); } catch (e) {} }
