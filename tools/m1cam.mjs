import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport:{width:924,height:424}, deviceScaleFactor:1, isMobile:true, hasTouch:true })).newPage();
await p.goto(process.env.BASE+'/?q=low'); await p.waitForFunction(()=>window.__game?.screen==='title',null,{timeout:60000});
await p.evaluate(()=>{const g=window.__game; g.grantVehicle('hauler'); g.setVehicle('hauler'); g.loadLevel('m1');});
await p.waitForFunction(()=>window.__game.car?.state==='race',null,{timeout:60000});
const gap = await p.evaluate(()=>{const g0=window.__game, s=g0.sim(); const g=s.tr.features.find(f=>f.type==='gap'); const o=g0.input.state.bind(g0.input); g0.input.state=()=>{const r=o(); r.throttle=window.__J?0:1; r.jump=!!window.__J; return r;}; return {s0:g.s0,pad:g.padS};}); let jumped=false, landed=false, t0=Date.now(), n=0;
while (Date.now()-t0<(+process.env.TMAX||600000)) { const c = await p.evaluate(()=>{const s=window.__game.sim(); return {s:s.prog.s,gr:s.grounded,st:s.state,kmh:s.speed*3.6};});
  if(!jumped && !c.gr && c.s>gap.s0){ await p.evaluate(()=>window.__J=1); jumped=true; }
  if(jumped && c.gr && c.s>gap.s0+20){ landed=true; await p.evaluate(()=>window.__J=0); break; }
  if(jumped && n%15==0) await p.screenshot({path:`qa-shots/r6-m1-air-${n}.png`}); if(n%25==0) console.log(JSON.stringify(c)); n++; await p.waitForTimeout(200); }
for (const k of [0,1,2]) { await p.waitForTimeout(700); await p.screenshot({path:`qa-shots/r6-m1-land-${k}.png`}); }
console.log(JSON.stringify({gap,landed, cam: await p.evaluate(()=>{const g=window.__game, s=g.sim(), c=g.gfx.camera.position; return {cam:c.toArray().map(v=>+v.toFixed(1)), ground:+s.terrain.heightAt(c.x,c.z).toFixed(1), car:s.pose.p.toArray().map(v=>+v.toFixed(1)), s:s.prog.s};})}));
await b.close();
