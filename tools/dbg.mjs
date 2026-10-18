import { Sim } from '../src/sim.js';
import { levelById } from '../src/levels.js';
import { Vector3 } from 'three';
const L = levelById(process.argv[2] || 'e1'); const T0 = +(process.argv[3]||15), T1 = +(process.argv[4]||17);
const sim = new Sim(L, { mode: 'race' }); await sim.init();
const names = new Map([[sim.roadCollider.handle,'road'],[sim.terrainCollider.handle,'terrain']]);
sim.ai.forEach((a,i)=>{ for(let k=0;k<a.rb.numColliders();k++) names.set(a.rb.collider(k).handle,'ai'+i)});
sim.traffic.forEach((a,i)=>{ for(let k=0;k<a.rb.numColliders();k++) names.set(a.rb.collider(k).handle,'traffic'+i)});
const inp = { throttle: 1, brake: 0, steer: 0, boost: false, jump: false };
let t = 0;
while (t < T1) {
  const P = sim.pose.p, q = sim.pose.q;
  const tgt = sim.tr.samples[Math.min(sim.tr.samples.length - 1, sim.prog.i + 14)];
  const left = new Vector3(1, 0, 0).applyQuaternion(q);
  inp.steer = sim.grounded ? Math.max(-1, Math.min(1, -tgt.p.clone().sub(P).dot(left) * 0.18)) : 0;
  inp.boost = sim.speed < 44;
  sim.update(1 / 60, inp); t += 1 / 60; sim.events.length=0;
  if (t > T0) {
    const hits=[];
    for (const c of [sim.chassisCol, sim.roofCol]) sim.world.contactPairsWith(c, o => { let has=false; sim.world.contactPair(c,o,(m)=>{ if(m.numContacts()>0) has=true;}); if(has) hits.push((c===sim.roofCol?'roof':'chassis')+'-'+(names.get(o.handle)||o.handle)); });
    const ai = sim.ai.map(a=>`${a.s.toFixed(0)}/${a.x.toFixed(1)}`).join(' ');
    console.log(t.toFixed(2), sim.prog.s.toFixed(1), 'v', sim.speed.toFixed(1), 'c', sim.contacts, hits.join(','), 'ai', ai);
  }
}
