import { chromium } from "playwright";
import path from "path";

const BASE = "http://localhost:3000";
const DIR = "screenshots/upload-media";
const TEACHER = { email: "malek.freelance2@gmail.com", pass: "Drakifech1234" };

const AVATAR_PATH = path.resolve("test-assets/teacher-avatar.png");
const VIDEO_PATH = path.resolve("test-assets/teacher-intro.mp4");

let page, browser, context;
let shotN = 0;

async function shot(name) {
  shotN++;
  const p = `${DIR}/${String(shotN).padStart(2, "0")}_${name}.png`;
  await page.screenshot({ path: p, fullPage: true });
  console.log(`📸 ${p}`);
  return p;
}

(async () => {
  const { mkdirSync } = await import("fs");
  mkdirSync(DIR, { recursive: true });

  browser = await chromium.launch({ headless: true });
  context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await context.newPage();

  // Login as teacher
  console.log("=== UPLOADING TEACHER MEDIA ===");
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.fill('input[type="email"], input[name="email"]', TEACHER.email);
  await page.fill('input[type="password"], input[name="password"]', TEACHER.pass);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);
  await shot("logged_in");

  // Go to profile page
  await page.goto(`${BASE}/profile`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("profile_before_upload");

  // ── Upload profile picture ────────────────────────────────
  console.log("\n--- Uploading profile picture ---");
  const fileInputs = await page.$$('input[type="file"]');
  console.log(`Found ${fileInputs.length} file inputs`);

  // First file input is the avatar picker (accepts image/jpeg,image/png,image/webp)
  const avatarInput = fileInputs[0];
  if (avatarInput) {
    const accept = await avatarInput.getAttribute("accept");
    console.log(`First file input accepts: ${accept}`);

    // Listen for network requests to track the upload
    page.on("response", (resp) => {
      if (resp.url().includes("avatar")) {
        console.log(`  [network] ${resp.status()} ${resp.url().substring(0, 80)}...`);
      }
    });

    await avatarInput.setInputFiles(AVATAR_PATH);
    console.log("Set avatar file, waiting for upload...");
    await page.waitForTimeout(8000);
    await shot("after_avatar_upload");

    // Check if avatar shows
    const avatarImg = await page.$('img[alt="Profile"]');
    if (avatarImg) {
      console.log("✅ Avatar image element found — upload successful!");
    } else {
      console.log("⚠️  No avatar image element found, checking for errors...");
      const errorText = await page.$('.text-seal');
      if (errorText) {
        const msg = await errorText.textContent();
        console.log("Error:", msg);
      }
    }
  }

  // ── Upload intro video ────────────────────────────────────
  console.log("\n--- Uploading intro video ---");
  // Second file input is the video picker (accepts video/mp4,video/webm,video/quicktime)
  const videoInput = fileInputs[1];
  if (videoInput) {
    const accept = await videoInput.getAttribute("accept");
    console.log(`Second file input accepts: ${accept}`);

    page.on("response", (resp) => {
      if (resp.url().includes("video")) {
        console.log(`  [network] ${resp.status()} ${resp.url().substring(0, 80)}...`);
      }
    });

    await videoInput.setInputFiles(VIDEO_PATH);
    console.log("Set video file, waiting for upload...");
    await page.waitForTimeout(12000);
    await shot("after_video_upload");

    // Check if video player shows
    const videoEl = await page.$("video");
    if (videoEl) {
      console.log("✅ Video element found — upload successful!");
    } else {
      console.log("⚠️  No video element found, checking for errors...");
      const errorText = await page.$$('.text-seal');
      for (const el of errorText) {
        const msg = await el.textContent();
        if (msg) console.log("Error:", msg);
      }
    }
  }

  // Scroll to top to see final state
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1000);
  await shot("profile_final_top");

  // Scroll down to see teacher profile section
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(500);
  await shot("profile_final_mid");

  // Check public teacher profile
  console.log("\n--- Checking public profile ---");
  await page.goto(`${BASE}/teachers`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("teachers_list_with_avatar");

  const teacherLink = await page.$('a[href*="/teachers/"]');
  if (teacherLink) {
    await teacherLink.click();
    await page.waitForTimeout(4000);
    await shot("public_profile_with_media");
  }

  console.log(`\n✅ Media upload complete: ${shotN} screenshots taken`);
  await browser.close();
})();
