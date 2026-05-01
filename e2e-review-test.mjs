import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const DIR = "screenshots/review-test";
const STUDENT = { email: "malek.atia2@gmail.com", pass: "Drakifech1234" };

let page, browser, context;
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
  context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await context.newPage();

  console.log("=== REVIEW SYSTEM TEST ===\n");

  // ── Step 1: Login as student ──────────────────────────────
  console.log("--- Step 1: Login as student ---");
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.fill('input[type="email"]', STUDENT.email);
  await page.fill('input[type="password"]', STUDENT.pass);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);
  await shot("01_logged_in");

  // ── Step 2: Go to My Bookings ─────────────────────────────
  console.log("--- Step 2: My Bookings page ---");
  await page.goto(`${BASE}/bookings`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("02_my_bookings");

  // Check for bookings
  const bookingCards = await page.$$('.card, [class*="booking"]');
  console.log(`Found ${bookingCards.length} booking cards`);

  // Look for a Review button/link
  const reviewLink = await page.$('a[href*="/reviews/new"], a:has-text("Review"), button:has-text("Review")');
  if (reviewLink) {
    const href = await reviewLink.getAttribute("href");
    console.log("Found Review link:", href);
    await shot("03_review_button_found");

    // Click the review link
    await reviewLink.click();
    await page.waitForTimeout(3000);
    await shot("04_review_form_page");

    // ── Step 3: Fill review form ──────────────────────────────
    console.log("--- Step 3: Fill review form ---");

    // Click on stars (select 5 stars)
    const stars = await page.$$('button[aria-label*="star"], button:has-text("★"), button:has-text("☆")');
    console.log(`Found ${stars.length} star buttons`);
    if (stars.length >= 5) {
      await stars[4].click(); // 5th star = 5 stars
      console.log("✅ Selected 5 stars");
    } else if (stars.length > 0) {
      await stars[stars.length - 1].click();
      console.log(`✅ Selected ${stars.length} stars`);
    } else {
      // Try other star selectors
      const starBtns = await page.$$('[role="button"][data-rating], .star-rating button');
      console.log(`Alternative star buttons: ${starBtns.length}`);
    }

    await page.waitForTimeout(500);
    await shot("05_stars_selected");

    // Fill comment
    const commentArea = await page.$("textarea");
    if (commentArea) {
      await commentArea.fill(
        "Excellent teacher! Karim explains complex mathematics concepts with great clarity. His step-by-step approach to problem-solving really helped me understand derivatives and integrals. Highly recommend for anyone preparing for the baccalaureate exam."
      );
      console.log("✅ Filled review comment");
    }
    await shot("06_review_filled");

    // ── Step 4: Submit review ─────────────────────────────────
    console.log("--- Step 4: Submit review ---");
    const submitBtn = await page.$('button[type="submit"], button:has-text("Submit"), button:has-text("Post review")');
    if (submitBtn) {
      const btnText = await submitBtn.textContent();
      console.log("Submit button text:", btnText);
      await submitBtn.click();
      await page.waitForTimeout(5000);
      await shot("07_after_submit");
      console.log("Current URL after submit:", page.url());

      // Check if we got redirected to the teacher profile (success)
      if (page.url().includes("/teachers/")) {
        console.log("✅ Redirected to teacher profile — review submitted!");

        // Scroll to reviews section
        const reviewsSection = await page.$('#reviews, section:has(h2:has-text("Review"))');
        if (reviewsSection) {
          await reviewsSection.scrollIntoViewIfNeeded();
          await page.waitForTimeout(1000);
        }
        await shot("08_teacher_profile_with_review");

        // Scroll down more to see the full review
        await page.evaluate(() => {
          const el = document.querySelector('#reviews');
          if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
        });
        await page.waitForTimeout(500);
        await shot("09_review_on_profile");
      } else {
        // Might still be on the review page with an error
        const errorEl = await page.$('.text-seal, [class*="error"]');
        if (errorEl) {
          const errorText = await errorEl.textContent();
          console.log("Error:", errorText);

          // If already reviewed, that's fine — let's still check the teacher profile
          if (errorText?.includes("already reviewed")) {
            console.log("Already reviewed — navigating to teacher profile to verify");
          }
        }
      }
    }
  } else {
    console.log("No Review button found on bookings page.");
    console.log("Let's check if we have any confirmed bookings...");

    // Print what's on the page
    const pageText = await page.textContent("main");
    console.log("Page content preview:", pageText?.substring(0, 300));

    // If no bookings or no review button, we need to create a booking first
    // Let's check if there are any bookings at all
    const noBookings = await page.$('text=No bookings, text=no bookings');
    if (noBookings) {
      console.log("No bookings found. Creating a booking first...");

      // Book with seed_teacher_karim
      await page.goto(`${BASE}/book/seed_teacher_karim?type=single`, {
        waitUntil: "networkidle",
        timeout: 20000,
      });
      await page.waitForTimeout(5000);
      await shot("booking_checkout");

      // Complete demo payment
      const payBtn = await page.$('button[type="submit"]');
      if (payBtn) {
        await payBtn.click();
        await page.waitForTimeout(4000);
        await shot("booking_paid");
      }

      // Now go back to bookings
      await page.goto(`${BASE}/bookings`, { waitUntil: "networkidle", timeout: 20000 });
      await page.waitForTimeout(3000);
      await shot("bookings_after_new_booking");

      // Try again to find review link
      const reviewLink2 = await page.$('a[href*="/reviews/new"]');
      if (reviewLink2) {
        console.log("Found Review link after booking!");
        await reviewLink2.click();
        await page.waitForTimeout(3000);
        await shot("review_form_after_booking");
      }
    }
  }

  // ── Step 5: Verify on teacher profile ─────────────────────
  console.log("\n--- Step 5: Verify review on teacher profile ---");

  // Find which teacher was reviewed by checking the URL or going to the bookings teacher
  // Navigate to the teacher profile that should have the review
  // First try seed_teacher_karim (the real teacher we booked with)
  const realTeacherId = "62f5e4d4-c091-70a7-2117-a0641c3d7dad";
  await page.goto(`${BASE}/teachers/${realTeacherId}`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);

  // Scroll to reviews
  await page.evaluate(() => {
    const el = document.querySelector('#reviews');
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
  });
  await page.waitForTimeout(500);
  await shot("10_real_teacher_reviews");

  // Also check seed_teacher_karim
  await page.goto(`${BASE}/teachers/seed_teacher_karim`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    const el = document.querySelector('#reviews');
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
  });
  await page.waitForTimeout(500);
  await shot("11_seed_karim_reviews");

  // ── Step 6: Test duplicate review prevention ──────────────
  console.log("\n--- Step 6: Test duplicate review prevention ---");
  // Try to review the same booking again
  await page.goto(`${BASE}/bookings`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);
  const reviewLink3 = await page.$('a[href*="/reviews/new"]');
  if (reviewLink3) {
    const href3 = await reviewLink3.getAttribute("href");
    console.log("Attempting duplicate review:", href3);
    await reviewLink3.click();
    await page.waitForTimeout(3000);
    await shot("12_duplicate_review_attempt");

    // Try to submit
    const textarea2 = await page.$("textarea");
    if (textarea2) await textarea2.fill("Trying a duplicate review");
    const submitBtn2 = await page.$('button[type="submit"]');
    if (submitBtn2) {
      await submitBtn2.click();
      await page.waitForTimeout(3000);
      await shot("13_duplicate_review_result");
      console.log("URL after duplicate attempt:", page.url());

      // Check for error
      const errorEl = await page.$('.text-seal');
      if (errorEl) {
        const errorText = await errorEl.textContent();
        console.log("Duplicate review error:", errorText);
      }
    }
  }

  // ── Step 7: Test review deletion ──────────────────────────
  console.log("\n--- Step 7: Test review deletion ---");
  // Go to the teacher profile where the review was posted
  await page.goto(`${BASE}/teachers/${realTeacherId}`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);

  // Scroll to reviews
  await page.evaluate(() => {
    const el = document.querySelector('#reviews');
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
  });
  await page.waitForTimeout(500);

  // Look for Delete button
  const deleteBtn = await page.$('button:has-text("Delete")');
  if (deleteBtn) {
    console.log("Found Delete button on review");
    await shot("14_before_delete");

    // Accept the confirm dialog
    page.on("dialog", (dialog) => dialog.accept());

    await deleteBtn.click();
    await page.waitForTimeout(3000);
    await shot("15_after_delete");
    console.log("✅ Review deleted");
  } else {
    console.log("No Delete button found (user might not be the review author for this teacher)");
    await shot("14_no_delete_button");
  }

  console.log(`\n✅ Review system test complete: ${shotN} screenshots`);
  await browser.close();
})();
