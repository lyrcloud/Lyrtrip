// Renders the Google Play icon (512x512) and feature graphic (1024x500) into store/.
// Play wants 24-bit PNGs, so alpha is flattened.
import sharp from "../node_modules/sharp/lib/index.js";

await sharp("../assets/icon-only.png").resize(512, 512).flatten({ background: "#ffffff" }).png().toFile("play-icon-512.png");

// The site logo recoloured white, by using its alpha as a mask over solid white.
const logo = sharp("../../public/logo.png").trim();
const { width, height } = await logo.metadata().then(() => logo.clone().toBuffer({ resolveWithObject: true })).then((r) => r.info);
const alpha = await logo.clone().extractChannel(3).toBuffer();
const whiteLogo = await sharp({ create: { width, height, channels: 3, background: "#ffffff" } }).joinChannel(alpha).png().toBuffer();

const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500">
  <rect width="1024" height="500" fill="#ff3d00"/>
  <circle cx="930" cy="60" r="230" fill="#fff" opacity="0.08"/>
  <circle cx="80" cy="480" r="170" fill="#fff" opacity="0.08"/>
  <text x="512" y="372" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="34" fill="#fff">Flights, stays, rides, shipping &amp; more</text>
</svg>`);
await sharp(bg)
  .composite([{ input: await sharp(whiteLogo).resize({ width: 600 }).toBuffer(), top: 110, left: 212 }])
  .removeAlpha().png().toFile("feature-graphic-1024x500.png");
console.log("store art written");
