import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const DIR = "screenshots/check-profiles";

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

  // Check seed_teacher_karim profile
  console.log("--- seed_teacher_karim ---");
  await page.goto(`${BASE}/teachers/seed_teacher_karim`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("seed_karim_profile");

  // Check real teacher profile
  console.log("--- real teacher (62f5e4d4) ---");
  await page.goto(`${BASE}/teachers/62f5e4d4-c091-70a7-2117-a0641c3d7dad`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(4000);
  await shot("real_teacher_profile");

  await browser.close();
  console.log("Done");
})();
