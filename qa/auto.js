// In-page autopilot (analog via tilt path) for sustained drives. window.__qaAuto(true/false)
window.__qaAuto = (on, opts = {}) => {
  const g = window.__game; cancelAnimationFrame(window.__qaAutoRaf); if (!on) { g.input.tilt = 0; g.input.touch.boost = 0; g.input.settings.steer = 'buttons'; return; }
  g.input.settings.steer = 'tilt'; g.input.isTouch = true; g.input.settings.autoGas = true;
  const step = () => {
    const s = g.sim();
    if (s && s.pose) {
      const P = s.pose.p, q = s.pose.q; const tgt = s.tr.samples[Math.min(s.tr.samples.length - 1, s.prog.i + 14)];
      const rx = tgt.p.x - P.x, ry = tgt.p.y - P.y, rz = tgt.p.z - P.z;
      // local +X ("left") axis of the car
      const x = q.x, y = q.y, z = q.z, w = q.w; const lx = 1 - 2 * (y * y + z * z), ly = 2 * (x * y + w * z), lz = 2 * (x * z - w * y);
      const lat = rx * lx + ry * ly + rz * lz;
      g.input.tilt = s.grounded ? Math.max(-1, Math.min(1, -lat * 0.18)) : 0;
      g.input.touch.boost = (opts.boost !== false && s.speed < 44) ? 1 : 0;
      if (opts.hover && s.veh.rcs) g.input.touch.jump = (!s.grounded && s.air > 0.3 && s.prog.h < 1.2) ? 1 : 0;
    }
    window.__qaAutoRaf = requestAnimationFrame(step);
  };
  step();
};
