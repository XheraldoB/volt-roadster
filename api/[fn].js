// Single Vercel function routing /api/<name> to server/<name>.js (keeps the deploy to one function).
import health from '../server/health.js';
import save from '../server/save.js';
import load from '../server/load.js';
import checkout from '../server/create-checkout-session.js';
import webhook from '../server/stripe-webhook.js';
import forget from '../server/forget.js';
const routes = { health, save, load, forget, 'create-checkout-session': checkout, 'stripe-webhook': webhook };
export default async function handler(req, res) {
  const name = new URL(req.url, 'http://x').pathname.replace(/^\/api\//, '').replace(/\/$/, '');
  const h = routes[name];
  if (!h) { res.statusCode = 404; res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify({ error: 'no-such-api' })); }
  return h(req, res);
}
