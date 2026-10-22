import { launch, newPage, bootToTitle, shot, G, OP15 } from './lib.mjs';
const b = await launch(); const { page, log } = await newPage(b, OP15);
await bootToTitle(page, 'http://localhost:4173/?q=low');
await G(page, () => { __game.loadLevel('e1'); });
for (let i = 0; i < 12; i++) { await page.waitForTimeout(5000); console.log(await G(page, () => ({ sc: __game.screen, fps: __game.fps, car: __game.car && { st: __game.car.state, t: __game.car.raceTime }, cd: __game.sim()?.countdown, frame: __game.gfx.renderer.info.render.frame }))); }
await shot(page, 'dbg-race');
console.log(log.errors, log.console);
await b.close();
