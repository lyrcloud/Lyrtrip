// Renders a second, differently named set of Play Store assets into the folder given as argv[2]:
// icon + feature graphic variants, and phone, 7"/10" tablet, Chromebook and Android XR screenshots of the live site.
// Run from mobile/store: node make-store-set2.mjs ~/Desktop/Lyrtrip-Play-Store-v2
import { existsSync, mkdirSync } from "node:fs";
import sharp from "../node_modules/sharp/lib/index.js";
import { chromium } from "../../node_modules/playwright/index.mjs";

const out = process.argv[2];
for (const dir of ["", "phone", "tablet-7in", "tablet-10in", "chromebook", "android-xr"]) mkdirSync(`${out}/${dir}`, { recursive: true });

// Common assets: white pin mark on brand orange (the first set was orange on white).
const mark = await sharp("../../public/logo.png").extract({ left: 520, top: 300, width: 700, height: 840 }).toBuffer();
const markAlpha = await sharp(mark).extractChannel(3).toBuffer();
const markInfo = await sharp(mark).metadata();
const whiteMark = await sharp({ create: { width: markInfo.width, height: markInfo.height, channels: 3, background: "#ffffff" } }).joinChannel(markAlpha).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 3, background: "#ff3d00" } })
  .composite([{ input: await sharp(whiteMark).resize({ height: 340 }).toBuffer(), gravity: "center" }])
  .png().toFile(`${out}/lyrtrip-app-icon-orange-512.png`);

// Feature graphic: orange wordmark on white, with a tagline band (the first set was white on orange).
const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500">
  <rect width="1024" height="500" fill="#ffffff"/>
  <circle cx="960" cy="40" r="200" fill="#ff3d00" opacity="0.08"/>
  <circle cx="40" cy="470" r="150" fill="#ff3d00" opacity="0.08"/>
  <rect x="0" y="380" width="1024" height="120" fill="#ff3d00"/>
  <text x="512" y="452" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="32" fill="#fff">Book trips, rides, tickets &amp; deliveries in one app</text>
</svg>`);
await sharp(bg)
  .composite([{ input: await sharp("../../public/logo.png").trim().resize({ width: 560, height: 260, fit: "inside" }).toBuffer(), top: 70, left: 232 }])
  .removeAlpha().png().toFile(`${out}/lyrtrip-feature-banner-1024x500.png`);

// Screenshots: different sections from the first set (home/flights/hotels/shipping/tours/jobs).
const sections = [
  ["events", "events"], ["cruise", "cruise"], ["train", "train"], ["helicopter", "helicopter"],
  ["study-abroad", "study"], ["freight", "freight"], ["food", "food"], ["charity", "charity"],
];
const ua = (device) => `Mozilla/5.0 (Linux; Android 14; ${device}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 LyrtripApp`;
// Each viewport x scale gives the final pixel size Play accepts (sides 320-3840, long side <= 2x short side).
const devices = [
  { dir: "phone", prefix: "lyrtrip-phone", viewport: { width: 360, height: 640 }, scale: 3, mobile: true, ua: ua("Pixel 8") }, // 1080x1920
  { dir: "tablet-7in", prefix: "lyrtrip-tab7", viewport: { width: 600, height: 960 }, scale: 2, mobile: true, ua: ua("Pixel Tablet") }, // 1200x1920
  { dir: "tablet-10in", prefix: "lyrtrip-tab10", viewport: { width: 800, height: 1280 }, scale: 2, mobile: true, ua: ua("Pixel Tablet") }, // 1600x2560
  { dir: "chromebook", prefix: "lyrtrip-desktop", viewport: { width: 1280, height: 720 }, scale: 1.5, mobile: false }, // 1920x1080
  { dir: "android-xr", prefix: "lyrtrip-xr", viewport: { width: 1280, height: 720 }, scale: 1.5, mobile: false }, // 1920x1080
];

const browser = await chromium.launch();
for (const d of devices) {
  const page = await browser.newPage({ viewport: d.viewport, deviceScaleFactor: d.scale, isMobile: d.mobile, hasTouch: d.mobile, geolocation: { latitude: 40.7128, longitude: -74.006 }, permissions: ["geolocation"], ...(d.ua && { userAgent: d.ua }) });
  // XR gets a different half of the sections so its shots don't duplicate the Chromebook ones.
  const list = d.dir === "android-xr" ? sections.slice(4) : d.dir === "chromebook" ? sections.slice(0, 4) : sections;
  for (const [i, [name, tab]] of list.entries()) {
    const file = `${out}/${d.dir}/${d.prefix}-${String(i + 1).padStart(2, "0")}-${name}.png`;
    if (existsSync(file)) continue;
    // networkidle sometimes never settles on the live site; fall back to the load event
    await page.goto(`https://www.lyrtrip.com/?tab=${tab}`, { waitUntil: "networkidle", timeout: 20000 }).catch(() => page.goto(`https://www.lyrtrip.com/?tab=${tab}`, { waitUntil: "load" }));
    await page.waitForTimeout(3000);
    // Scroll the tile grid to the top so the open form shows below it
    await page.getByText("Transport", { exact: true }).first().evaluate((el) => window.scrollBy(0, el.getBoundingClientRect().top - 140)).catch(() => {});
    await page.waitForTimeout(1200);
    await page.screenshot({ path: file });
  }
  await page.close();
}
await browser.close();
console.log("store set 2 written to", out);
