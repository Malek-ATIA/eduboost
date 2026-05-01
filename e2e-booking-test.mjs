import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const DIR = "screenshots/booking-test";
const EMAIL = "malek.atia2@gmail.com";
const PASS = "Drakifech1234";

let page, browser, context;
let shotN = 0;

async function shot(name) {
  shotN++;
  const path = `${DIR}/${String(shotN).padStart(2, "0")}_${name}.png`;
  await page.screenshot({ path, fullPage: true });
  console.log(`📸 ${path}`);
  return path;
}

(async () => {
  const { mkdirSync } = await import("fs");
  mkdirSync(DIR, { recursive: true });

  browser = await chromium.launch({ headless: true });
  context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await context.newPage();

  // Login
  console.log("=== BOOKING FLOW TEST ===");
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.fill('input[type="email"], input[name="email"]', EMAIL);
  await page.fill('input[type="password"], input[name="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);
  await shot("logged_in");

  // Browse teachers
  await page.goto(`${BASE}/teachers`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);
  await shot("teachers_list");

  // Click first teacher
  const teacherLink = await page.$('a[href*="/teachers/"]');
  if (teacherLink) {
    await teacherLink.click();
    await page.waitForTimeout(3000);
    await shot("teacher_profile");

    // Click "Book lesson" button
    const bookBtn = await page.$('a[href*="/book/"], a:has-text("Book lesson"), a:has-text("Book a session")');
    if (bookBtn) {
      console.log("Found book button, clicking...");
      await bookBtn.click();
      await page.waitForTimeout(5000);
      await shot("booking_checkout_page");

      // Check if demo checkout form appeared
      const demoLabel = await page.$('text=Demo payment');
      if (demoLabel) {
        console.log("✅ Demo checkout form loaded!");
        await shot("demo_checkout_form");

        // Click Pay button
        const payBtn = await page.$('button[type="submit"]');
        if (payBtn) {
          console.log("Clicking Pay...");
          await payBtn.click();
          await page.waitForTimeout(3000);
          await shot("after_payment");
          console.log("Current URL:", page.url());
        }
      } else {
        console.log("No demo form found — checking for errors...");
        const errorText = await page.$('.text-seal');
        if (errorText) {
          const msg = await errorText.textContent();
          console.log("Error:", msg);
        }
      }
    } else {
      // Try the Book button on session types
      const bookLink = await page.$('a:has-text("Book")');
      if (bookLink) {
        const href = await bookLink.getAttribute("href");
        console.log("Found Book link:", href);
        await bookLink.click();
        await page.waitForTimeout(5000);
        await shot("booking_checkout_page");
      } else {
        console.log("No book button found");
        await shot("no_book_button");
      }
    }
  }

  console.log(`\n✅ Booking test complete: ${shotN} screenshots`);
  await browser.close();
})();
