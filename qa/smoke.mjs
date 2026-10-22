import { launch, newPage, bootToTitle, shot, G } from './lib.mjs';
const b = await launch(); const { page, log } = await newPage(b);
const t = await bootToTitle(page, 'http://localhost:4173/');
console.log('boot ms', t);
await page.waitForTimeout(3000);
console.log(await G(page, () => ({ q: __game.quality, gpu: __game.gpu, fps: __game.fps, w: innerWidth, h: innerHeight, dpr: devicePixelRatio, cw: __game.gfx.renderer.domElement.width, ch: __game.gfx.renderer.domElement.height, gl2: __game.gfx.renderer.capabilities.isWebGL2, lvls: __game.levels().length, coarse: matchMedia('(pointer:coarse)').matches })));
await shot(page, 'p1-title-2772');
console.log(JSON.stringify(log, null, 1).slice(0, 3000));
await b.close();
