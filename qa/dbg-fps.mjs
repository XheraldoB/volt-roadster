import { launch, newPage, bootToTitle, G, UA } from './lib.mjs';
const b = await launch();
for (const [w, h, d, q] of [[924, 424, 1, 'low'], [924, 424, 1, 'ultra'], [1386, 636, 1, 'low']]) {
  const { page, ctx } = await newPage(b, { viewport: { width: w, height: h }, deviceScaleFactor: d, isMobile: true, hasTouch: true, userAgent: UA });
  await bootToTitle(page, `http://localhost:4173/?q=${q}`);
  await G(page, () => { __game.loadLevel('e1'); });
  await page.waitForFunction(() => __game.screen === 'race', null, { timeout: 60000 }); await page.waitForTimeout(3000);
  const f0 = await G(page, () => [__game.gfx.renderer.info.render.frame, performance.now()]); await page.waitForTimeout(5000);
  const f1 = await G(page, () => [__game.gfx.renderer.info.render.frame, performance.now(), __game.fps, __game.gfx.renderer.domElement.width]);
  console.log(w, h, d, q, 'real fps', ((f1[0] - f0[0]) / (f1[1] - f0[1]) * 1000).toFixed(1), 'reported', f1[2].toFixed(1), 'canvasW', f1[3]);
  await ctx.close();
}
await b.close();
