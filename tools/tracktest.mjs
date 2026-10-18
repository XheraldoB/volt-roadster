import { buildTrack } from '../src/track.js';
import { LEVELS, PLANETS } from '../src/levels.js';
for (const L of LEVELS) {
  const tr = buildTrack(L, PLANETS[L.planet].gravity);
  const sm = tr.samples; let minD = 1e9, where = null;
  for (let i = 0; i < sm.length; i += 2) for (let j = i + 40; j < sm.length; j += 2) {
    if (Math.abs(sm[i].s - sm[j].s) < 60) continue;
    if (sm[i].loop && sm[j].loop) continue;
    const d = sm[i].p.distanceTo(sm[j].p); if (d < minD) { minD = d; where = [i, j, sm[i].seg, sm[j].seg]; }
  }
  let ymin = 1e9, ymax = -1e9, xmin=1e9,xmax=-1e9,zmin=1e9,zmax=-1e9; for (const s of sm) { ymin = Math.min(ymin, s.p.y); ymax = Math.max(ymax, s.p.y); xmin=Math.min(xmin,s.p.x);xmax=Math.max(xmax,s.p.x);zmin=Math.min(zmin,s.p.z);zmax=Math.max(zmax,s.p.z);}
  const gaps = tr.features.filter(f => f.type === 'gap').map(f => Math.round(f.len));
  console.log(L.id, 'len', Math.round(tr.length), 'samples', sm.length, 'cps', tr.checkpoints.length, 'minCross', minD.toFixed(1), where, 'y', ymin.toFixed(0), ymax.toFixed(0), 'bbox', Math.round(xmax-xmin), Math.round(zmax-zmin), 'gaps', gaps.join(','));
}
