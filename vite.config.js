import { defineConfig } from 'vite';
// Serve the real /api serverless handlers locally (dev + preview) so the client never hits a 404.
function localApi() {
  const mw = async (req, res, next) => {
    if (!req.url.startsWith('/api/')) return next();
    try { const mod = await import(new URL('./api/[fn].js', import.meta.url).href); await mod.default(req, res); }
    catch (e) { res.statusCode = 404; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ error: 'no-such-api' })); }
  };
  return { name: 'local-api', configureServer(s) { s.middlewares.use(mw); }, configurePreviewServer(s) { s.middlewares.use(mw); } };
}
export default defineConfig({
  plugins: [localApi()],
  build: { target: 'es2022', chunkSizeWarningLimit: 6000, assetsInlineLimit: 0, rollupOptions: { output: { manualChunks: { rapier: ['@dimforge/rapier3d-compat'], three: ['three'] } } } },
  optimizeDeps: { exclude: ['@dimforge/rapier3d-compat'] },
  server: { host: true },
});
