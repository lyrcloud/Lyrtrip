// Renders the store icon artwork (assets/*.png) from the map-pin mark in the website's logo.png for `npm run assets`.
import sharp from "sharp";

// The mark sits at the left of the 3500x1440 wordmark logo.
const mark = await sharp("../public/logo.png").extract({ left: 520, top: 300, width: 700, height: 840 }).toBuffer();
const onCanvas = async (size, markHeight, background) =>
  sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: await sharp(mark).resize({ height: markHeight }).toBuffer(), gravity: "center" }])
    .png();

const white = { r: 255, g: 255, b: 255, alpha: 1 };
const clear = { r: 0, g: 0, b: 0, alpha: 0 };
// Square icon with no rounded corners: Android applies its own mask.
await (await onCanvas(1024, 700, white)).toFile("assets/icon-only.png");
// Adaptive icon: the mark shrunk into the 66% safe zone, on a white layer.
await (await onCanvas(1024, 520, clear)).toFile("assets/icon-foreground.png");
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: white } }).png().toFile("assets/icon-background.png");
// Splash: the mark centred on white.
await (await onCanvas(2732, 600, white)).toFile("assets/splash.png");
console.log("icons written");
