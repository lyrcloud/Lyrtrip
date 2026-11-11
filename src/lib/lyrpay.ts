// Pay with Lyrpay: pay from a Lyrpay balance (lyrpay.com, the Lyr wallet). Shown once NEXT_PUBLIC_LYRPAY=true is
// set at build time, alongside the API's LYRPAY_SECRET_KEY (infra/lambda/lyrpay.mjs).
export const LYRPAY_ENABLED = process.env.NEXT_PUBLIC_LYRPAY === 'true';

// The booking pages read the checkout id from Stripe's ?session_id= or Lyrpay's ?lyrpay_payment=
export const checkoutIdFrom = (params: URLSearchParams) => params.get('session_id') ?? params.get('lyrpay_payment');
