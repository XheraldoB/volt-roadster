// Headless preview renderer: starts an isolated vite server and screenshots each scene
// with Chrome + SwiftShader (software WebGL2). Usage (project root):
//   node art/tools/render-previews.mjs [preset] [scene,...]
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const preset = process.argv[2] || 'ultra';
const extra = process.env.EXTRA || '';
const scenes = (process.argv[3] || 'car,car-rear,robot,moon,mars,mars-sunset').split(',');
const server = await createServer({ configFile: path.join(here, '../vite.preview.config.js'), server: { port: 5199, strictPort: false } });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({
  executablePath: process.env.CHROME || '/usr/bin/google-chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--no-sandbox'],
});
let failed = 0;
for (const s of scenes) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const logs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
  let pageErr = null;
  page.on('pageerror', e => { pageErr = e; logs.push('pageerror: ' + (e.stack || e.message)); });
  const t0 = Date.now();
  try {
    await page.goto(`${url}art/preview.html?scene=${s}&preset=${preset}${extra}`);
    for (let w = 0; ; w += 500) { if (pageErr) throw pageErr; if (await page.evaluate(() => window.__ready === true)) break; if (w > 240000) throw new Error('timeout'); await page.waitForTimeout(500); }
    const out = path.join(here, `../previews/${s}${preset === 'ultra' ? '' : '-' + preset}${process.env.SUFFIX || ''}.png`);
    await page.screenshot({ path: out });
    const stats = await page.evaluate(() => window.__stats);
    console.log(`OK ${s} ${((Date.now() - t0) / 1000).toFixed(1)}s ${JSON.stringify(stats)} -> ${path.relative(process.cwd(), out)}`);
  } catch (e) { failed++; console.log(`FAIL ${s}: ${e.message.split('\n')[0]}`); }
  for (const l of logs) console.log('   ' + l.slice(0, 400));
  await page.close();
}
await browser.close(); await server.close();
process.exit(failed ? 1 : 0);
