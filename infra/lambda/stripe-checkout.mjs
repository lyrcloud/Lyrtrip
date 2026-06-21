import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

const CORS = {
  'Access-Control-Allow-Origin':  'https://www.lyrtrip.com',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function nightsBetween(checkin, checkout) {
  if (!checkin || !checkout) return 1;
  const ms = new Date(checkout) - new Date(checkin);
  const nights = Math.round(ms / (1000 * 60 * 60 * 24));
  return nights > 0 ? nights : 1;
}

// Estimated base price per night (cents) by price level
const BASE_PRICE = {
  'Free': 0,
  '$':    8900,
  '$$':   16000,
  '$$$':  30000,
  '$$$$': 50000,
};

export const handler = async (event) => {
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    const { hotelName, address, checkin, checkout, guests, guestName, priceLevel, nights: bodyNights, totalPrice } = body;

    const nights       = bodyNights ?? nightsBetween(checkin, checkout);
    const unitPriceCents = BASE_PRICE[priceLevel] ?? BASE_PRICE['$$'];
    // totalPrice from client is in dollars; Stripe needs cents
    const amountCents  = totalPrice
      ? Math.round(totalPrice * 100)
      : unitPriceCents * nights;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: amountCents,
          product_data: {
            name: hotelName,
            description: `${address} · ${nights} night${nights > 1 ? 's' : ''} · ${guests} guest${guests > 1 ? 's' : ''}`,
          },
        },
        quantity: 1,
      }],
      metadata: { hotelName, address, checkin, checkout, guests: String(guests), guestName, priceLevel: priceLevel ?? '' },
      customer_email: guestName.includes('@') ? guestName : undefined,
      success_url: 'https://www.lyrtrip.com/booking/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url:  'https://www.lyrtrip.com/booking/cancel',
    });

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url, sessionId: session.id }),
    };
  } catch (err) {
    console.error('Stripe error:', err);
    return {
      statusCode: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
