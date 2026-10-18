// Isolated vite config for the art preview harness (own cache dir so it never
// interferes with the game's dev server). Run from the project root:
//   npx vite --config art/vite.preview.config.js --port 5199
export default { root: new URL('..', import.meta.url).pathname, cacheDir: '/tmp/volt-art-vite-cache', server: { host: '127.0.0.1' }, logLevel: 'warn' };
