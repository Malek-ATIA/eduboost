import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const DIR = "screenshots/verify-seed-karim";

let page, browser;
let shotN = 0;

async function shot(name) {
  shotN++;
  const p = `${DIR}/${String(shotN).padStart(2, "0")}_${name}.png`;
  await page.screenshot({ path: p, fullPage: true });
  console.log(`📸 ${p}`);
}

(async () => {
  const { mkdirSync } = await import("fs");
  mkdirSync(DIR, { recursive: true });

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await context.newPage();

  // Login
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.fill('input[type="email"]', "malek.atia2@gmail.com");
  await page.fill('input[type="password"]', "Drakifech1234");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);

  // Go to seed_teacher_karim profile
  await page.goto(`${BASE}/teachers/seed_teacher_karim`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(4000);
  await shot("seed_karim_with_video");

  // Check for video element
  const video = await page.$("video");
  if (video) {
    console.log("✅ Video element found in right widget!");
    const src = await video.getAttribute("src");
    console.log("   Video src:", src?.substring(0, 80) + "...");
  } else {
    console.log("❌ No video element found");
  }

  // Check for avatar image
  const avatar = await page.$('img[alt*="Profile"], img[alt*="Avatar"]');
  if (avatar) {
    console.log("✅ Avatar image found!");
  }

  // Check bio text
  const bioEl = await page.$('section:has(h2:text("About Me")) p');
  if (bioEl) {
    const bioText = await bioEl.textContent();
    console.log("✅ Bio:", bioText?.substring(0, 80) + "...");
  }

  await browser.close();
  console.log(`\nDone: ${shotN} screenshots`);
})();
