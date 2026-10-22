import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport:{width:924,height:424}, deviceScaleFactor:1, isMobile:true, hasTouch:true })).newPage();
await p.goto(process.env.BASE+'/?q=low'); await p.waitForFunction(()=>window.__game?.screen==='title',null,{timeout:60000});
await p.evaluate(()=>{const g=window.__game; g.grantVehicle('hauler'); g.setVehicle('hauler'); g.loadLevel('e1');});
await p.waitForFunction(()=>window.__game.car?.state==='race',null,{timeout:60000});
const gap = await p.evaluate(()=>{const g0=window.__game, s=g0.sim(); const g=s.tr.features.find(f=>f.type==='gap'); const o=g0.input.state.bind(g0.input); g0.input.state=()=>{const r=o(); r.throttle=window.__J?0:1; r.jump=!!window.__J; return r;}; s.respawnAt(g.s0-120, 36); return {s0:g.s0,pad:g.padS};});
let air=0, t0=Date.now();
while (Date.now()-t0<400000) { const c = await p.evaluate(()=>{const s=window.__game.sim(); return {s:s.prog.s,gr:s.grounded};});
  if(!c.gr && c.s>gap.s0){ await p.evaluate(()=>window.__J=1); if(air++==8) await p.screenshot({path:'qa-shots/r7-hud-air.png'}); }
  if(air>3 && c.gr){ await p.evaluate(()=>window.__J=0); await p.waitForTimeout(150); await p.screenshot({path:'qa-shots/r7-hud-land.png'}); console.log('landed', c.s); break; }
  await p.waitForTimeout(150); }
await b.close();
