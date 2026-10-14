// Retired. This Lambda opened Stripe Checkout for food, grocery, pickup, legacy hotel and legacy flight orders
// that nothing ever fulfilled. Flights, hotels, shipping and gift cards are paid through lyrtrip-search
// (search.mjs), which books what it charges for. Kept answering 410 so old pages can't take a payment.

const CORS = {
  'Access-Control-Allow-Origin':  'https://www.lyrtrip.com',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const handler = async (event) => {
  if (event.requestContext?.http?.method === 'OPTIONS' || event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }
  return {
    statusCode: 410,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: 'This payment page has been retired. Book flights, hotels and shipping from the Lyrtrip home page.' }),
  };
};
