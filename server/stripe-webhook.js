// Placeholder for gem fulfilment. Must verify the Stripe-Signature header (STRIPE_WEBHOOK_SECRET) and credit
// gems to the player's cloud save server-side on checkout.session.completed. Not implemented yet, so payments stay disabled.
import { send } from './_store.js';
export default async function handler(req, res) { return send(res, 501, { error: 'webhook-not-implemented', note: 'Gem fulfilment is not wired; keep PAYMENTS disabled.' }); }
