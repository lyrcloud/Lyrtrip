// Builds public/og-image.png (1200x630), the preview shown when lyrtrip.com is shared.
//   node scripts/og-image.mjs
import sharp from 'sharp';

const W = 1200, H = 630;
const logo = await sharp('public/logo.png').resize({ width: 760 }).toBuffer();
const { height: lh } = await sharp(logo).metadata();
const text = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <text x="600" y="545" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="40" font-weight="700" fill="#8a2100">Flights · Hotels · Rides · Tours · Shipping</text>
</svg>`);
await sharp({ create: { width: W, height: H, channels: 4, background: '#fff4ef' } })
  .composite([
    { input: logo, top: Math.round((H - 110 - lh) / 2), left: (W - 760) / 2 },
    { input: text, top: 0, left: 0 },
  ])
  .png()
  .toFile('public/og-image.png');
console.log('wrote public/og-image.png');
