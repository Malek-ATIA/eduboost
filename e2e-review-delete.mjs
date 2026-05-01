import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const DIR = "screenshots/review-test";
const STUDENT = { email: "malek.atia2@gmail.com", pass: "Drakifech1234" };

let page, browser, context;
let shotN = 14; // continue numbering

async function shot(name) {
  shotN++;
  const p = `${DIR}/${String(shotN).padStart(2, "0")}_${name}.png`;
  await page.screenshot({ path: p, fullPage: true });
  console.log(`📸 ${p}`);
}

(async () => {
  browser = await chromium.launch({ headless: true });
  context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await context.newPage();

  // Login
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.fill('input[type="email"]', STUDENT.email);
  await page.fill('input[type="password"]', STUDENT.pass);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);

  // ── Test deletion on seed_teacher_karim (where the review was posted) ──
  console.log("=== REVIEW DELETION TEST ===\n");
  await page.goto(`${BASE}/teachers/seed_teacher_karim`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);

  // Scroll to reviews section
  await page.evaluate(() => {
    const el = document.querySelector('#reviews');
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
  });
  await page.waitForTimeout(1000);
  await shot("seed_karim_reviews_before_delete");

  // Check for review content
  const reviewCards = await page.$$('#reviews .card, #reviews li');
  console.log(`Found ${reviewCards.length} review cards`);

  // Look for Delete button
  const deleteBtn = await page.$('button:has-text("Delete")');
  if (deleteBtn) {
    console.log("✅ Found Delete button");
    await shot("delete_button_visible");

    // Accept the confirm dialog
    page.on("dialog", (dialog) => {
      console.log("Dialog:", dialog.message());
      dialog.accept();
    });

    await deleteBtn.click();
    await page.waitForTimeout(3000);
    await shot("after_review_deleted");

    // Verify review is gone
    const reviewsAfter = await page.$$('#reviews .card, #reviews li');
    console.log(`Reviews after deletion: ${reviewsAfter.length}`);

    // Check for "No reviews yet"
    const noReviews = await page.$('text=No reviews yet');
    if (noReviews) {
      console.log("✅ Review deleted — 'No reviews yet' message shown");
    }
  } else {
    console.log("❌ No Delete button found");
    // Take a screenshot to debug
    await shot("no_delete_debug");
  }

  // ── Now re-submit a review (book again + review) ──────────
  console.log("\n=== RE-BOOKING + SECOND REVIEW ===\n");

  // Book another session with seed_teacher_karim
  console.log("--- Booking a new session ---");
  await page.goto(`${BASE}/book/seed_teacher_karim?type=single`, {
    waitUntil: "networkidle",
    timeout: 20000,
  });
  await page.waitForTimeout(5000);
  await shot("new_booking_checkout");

  const payBtn = await page.$('button[type="submit"]');
  if (payBtn) {
    await payBtn.click();
    await page.waitForTimeout(5000);
    await shot("new_booking_success");
    console.log("✅ New booking created, URL:", page.url());
  }

  // Go to bookings to find the new review link
  await page.goto(`${BASE}/bookings`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("bookings_with_new");

  // Find Review button for a booking that hasn't been reviewed yet
  const reviewLinks = await page.$$('a[href*="/reviews/new"]');
  console.log(`Found ${reviewLinks.length} review links`);

  if (reviewLinks.length > 0) {
    // Click the first one (should be the newest booking)
    const href = await reviewLinks[0].getAttribute("href");
    console.log("Clicking review link:", href);
    await reviewLinks[0].click();
    await page.waitForTimeout(3000);
    await shot("new_review_form");

    // Select 4 stars this time
    const stars = await page.$$('button[aria-label*="star"], button:has-text("★"), button:has-text("☆")');
    if (stars.length >= 4) {
      await stars[3].click(); // 4th star
      console.log("✅ Selected 4 stars");
    }

    // Fill comment
    const textarea = await page.$("textarea");
    if (textarea) {
      await textarea.fill(
        "Great session! Really helped me prepare for my upcoming math exam. The teacher is patient and explains concepts clearly. Would book again."
      );
    }
    await shot("second_review_filled");

    // Submit
    const submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) {
      await submitBtn.click();
      await page.waitForTimeout(5000);
      await shot("second_review_submitted");
      console.log("URL after submit:", page.url());

      if (page.url().includes("/teachers/")) {
        console.log("✅ Second review submitted successfully!");

        // Scroll to reviews
        await page.evaluate(() => {
          const el = document.querySelector('#reviews');
          if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
        });
        await page.waitForTimeout(500);
        await shot("teacher_with_new_review");
      }
    }
  }

  console.log(`\n✅ Review deletion + re-review test complete: screenshots ${15}-${shotN}`);
  await browser.close();
})();
