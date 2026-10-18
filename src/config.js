// Feature flags. Real-money purchases stay OFF until a payment provider is fully wired
// (Stripe Checkout session + verified webhook that credits gems server-side). Never fake a purchase.
export const PAYMENTS = {
  enabled: false,                 // flip only after api/create-checkout-session.js + api/stripe-webhook.js are configured
  provider: 'stripe',
  checkoutEndpoint: '/api/create-checkout-session',
  currency: 'EUR',
  packs: [
    { id: 'gems_80', gems: 80, price: '€0.99', tag: '' },
    { id: 'gems_450', gems: 450, price: '€4.99', tag: '+12% bonus' },
    { id: 'gems_1000', gems: 1000, price: '€9.99', tag: 'Most popular' },
    { id: 'gems_2800', gems: 2800, price: '€24.99', tag: 'Best value' },
  ],
};
