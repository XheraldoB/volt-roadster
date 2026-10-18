import { Sim } from '../src/sim.js';
import { levelById } from '../src/levels.js';
for (const id of ['e1','r1','m1']) {
const sim = new Sim(levelById(id), { mode: 'trial' }); await sim.init();
const inp = { throttle: 1, brake: 0, steer: 0, boost: false }; let t=0; const out=[];
while (t < 12) { sim.update(1/60, inp); t+=1/60; sim.events.length=0; if (Math.abs(t%1)<1/60) out.push(sim.speed.toFixed(1)+'/'+sim.curStiff?.toFixed(0)); }
console.log(id, out.join(' '));
}
