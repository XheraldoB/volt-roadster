import { Sim } from '../src/sim.js';
import { levelById } from '../src/levels.js';
import { Vector3 } from 'three';
const sim = new Sim(levelById(process.argv[2]||'r1'), { mode: 'race' }); await sim.init();
const inp = { throttle: 1, brake: 0, steer: 0, boost: false, jump: false }; let t=0, nl=0;
while (t < 70 && sim.state!=='finished') { const P=sim.pose.p,q=sim.pose.q; const tgt=sim.tr.samples[Math.min(sim.tr.samples.length-1,sim.prog.i+14)]; inp.steer=sim.grounded?Math.max(-1,Math.min(1,-tgt.p.clone().sub(P).dot(new Vector3(1,0,0).applyQuaternion(q))*0.18)):0; inp.boost=sim.speed<44;
 sim.update(1/60,inp); t+=1/60; const fe = sim.events.filter(e=>e.type==='aiFinish'||e.type==='finish'); sim.events.length=0;
 if (t>=nl || fe.length){ nl+=5; console.log(t.toFixed(1), 'player', sim.prog.s.toFixed(0), sim.speed.toFixed(0), 'ai', sim.ai.map(a=>a.s.toFixed(0)+'@'+a.v.toFixed(0)+(a.finished?'F':'')).join(' '), fe.map(e=>e.type+(e.name||'')).join(','), sim.tr.finishS.toFixed(0)); } }
