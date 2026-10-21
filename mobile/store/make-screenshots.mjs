// Captures Play Store phone screenshots (1080x1920) of the live site into screenshots/.
// Run from mobile/store with the site's Playwright: node make-screenshots.mjs
import { chromium } from "../../node_modules/playwright/index.mjs";

const shots = [
  ["1-home", "/"],
  ["2-flights", "/?tab=flights"],
  ["3-hotels", "/?tab=hotels"],
  ["4-shipping", "/?tab=shipping"],
  ["5-tours", "/?tab=tourism"],
  ["6-jobs", "/?tab=career"],
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, geolocation: { latitude: 40.7128, longitude: -74.006 }, permissions: ["geolocation"], userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36 LyrtripApp" });
for (const [name, path] of shots) {
  await page.goto("https://www.lyrtrip.com" + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  // Tab shots scroll the tile grid to the top so the open form shows below it
  if (path !== "/") {
    await page.getByText("Transport", { exact: true }).first().evaluate((el) => window.scrollBy(0, el.getBoundingClientRect().top - 140));
    await page.waitForTimeout(1200);
  }
  await page.screenshot({ path: `screenshots/${name}.png` });
}
await browser.close();
console.log("screenshots written");
