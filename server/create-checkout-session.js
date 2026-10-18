// Stripe Checkout for gem packs. DISABLED unless the deployment sets PAYMENTS_ENABLED=1 and STRIPE_SECRET_KEY
// plus one price id per pack (STRIPE_PRICE_GEMS_80, ..._450, ..._1000, ..._2800).
// Gems must ONLY be credited by a verified Stripe webhook (api/stripe-webhook.js), never by the client.
import { send, readJson } from './_store.js';
const PACKS = { gems_80: 'STRIPE_PRICE_GEMS_80', gems_450: 'STRIPE_PRICE_GEMS_450', gems_1000: 'STRIPE_PRICE_GEMS_1000', gems_2800: 'STRIPE_PRICE_GEMS_2800' };
export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  if (process.env.PAYMENTS_ENABLED !== '1' || !process.env.STRIPE_SECRET_KEY) return send(res, 501, { error: 'payments-not-enabled' });
  try {
    const { pack, playerId } = await readJson(req); const priceEnv = PACKS[pack]; const price = priceEnv && process.env[priceEnv];
    if (!price || !playerId) return send(res, 400, { error: 'bad-request' });
    const origin = `https://${req.headers['x-forwarded-host'] || req.headers.host}`;
    const body = new URLSearchParams({ mode: 'payment', 'line_items[0][price]': price, 'line_items[0][quantity]': '1', success_url: `${origin}/?checkout=success`, cancel_url: `${origin}/?checkout=cancel`, client_reference_id: String(playerId).slice(0, 64), 'metadata[pack]': pack });
    const r = await fetch('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'content-type': 'application/x-www-form-urlencoded' }, body });
    const j = await r.json(); if (!r.ok) return send(res, 502, { error: j.error?.message || 'stripe-error' });
    return send(res, 200, { url: j.url });
  } catch (e) { return send(res, 500, { error: String(e.message || e).slice(0, 200) }); }
}
