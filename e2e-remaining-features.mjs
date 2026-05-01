import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const DIR = "screenshots/remaining-features";
const TEACHER = { email: "malek.freelance2@gmail.com", pass: "Drakifech1234" };
const STUDENT = { email: "malek.atia2@gmail.com", pass: "Drakifech1234" };

let page, browser, context;
let shotN = 0;

async function shot(name) {
  shotN++;
  const p = `${DIR}/${String(shotN).padStart(2, "0")}_${name}.png`;
  await page.screenshot({ path: p, fullPage: true });
  console.log(`📸 ${p}`);
}

async function login(email, pass) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', pass);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);
}

async function switchUser(email, pass) {
  await context.clearCookies();
  await page.evaluate(() => localStorage.clear());
  await login(email, pass);
}

(async () => {
  const { mkdirSync } = await import("fs");
  const { resolve } = await import("path");
  mkdirSync(DIR, { recursive: true });

  browser = await chromium.launch({ headless: true });
  context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await context.newPage();

  // ═══════════════════════════════════════════════════════════
  // PART 1: FORUM — Post + Comment + Vote (as Teacher)
  // ═══════════════════════════════════════════════════════════
  console.log("═══ PART 1: FORUM ═══\n");

  console.log("--- Teacher: Login ---");
  await login(TEACHER.email, TEACHER.pass);

  // Browse forum channels
  console.log("--- Step 1.1: Browse forum channels ---");
  await page.goto(`${BASE}/forum`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("forum_channels");

  const channels = await page.$$('a[href*="/forum/"]');
  console.log(`Found ${channels.length} forum channel links`);

  // Click into a channel
  if (channels.length > 0) {
    const href = await channels[0].getAttribute("href");
    console.log("Opening channel:", href);
    await channels[0].click();
    await page.waitForTimeout(3000);
    await shot("forum_channel_posts");
  }

  // Create a new forum post
  console.log("--- Step 1.2: Create new forum post ---");
  await page.goto(`${BASE}/forum/posts/new`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);
  await shot("forum_new_post_form");

  // Select channel
  const channelSelect = await page.$("select");
  if (channelSelect) {
    const options = await channelSelect.$$("option");
    if (options.length > 1) {
      const val = await options[1].getAttribute("value");
      await channelSelect.selectOption(val);
      console.log("✅ Selected channel:", val);
    }
  }

  // Fill title
  const postTitle = await page.$('input[maxlength="200"]');
  if (postTitle) {
    await postTitle.fill("Tips for Baccalaureate Math Preparation — What Worked for Me");
    console.log("✅ Filled post title");
  }

  // Fill body
  const postBody = await page.$('textarea[maxlength="10000"]');
  if (postBody) {
    await postBody.fill(
      "Sharing my study strategy that helped me score 18/20 in Mathematics:\n\n" +
      "1. **Practice past exams** — I did every bac exam from 2018 to 2023. Pattern recognition is key.\n" +
      "2. **Focus on Analysis** — Derivatives, integrals, and sequences make up 50% of the exam.\n" +
      "3. **Geometry proofs** — Memorize the key theorems (Thales, Pythagoras, trigonometric identities).\n" +
      "4. **Probability** — This is free points if you understand conditional probability and Bayes.\n" +
      "5. **Time management** — Spend 45 min on Analysis, 30 min on Geometry, 30 min on Probability, 15 min review.\n\n" +
      "What strategies worked for you? Drop your tips below!"
    );
    console.log("✅ Filled post body");
  }

  await shot("forum_post_filled");

  // Submit
  const postBtn = await page.$('button[type="submit"]');
  if (postBtn) {
    await postBtn.click();
    await page.waitForTimeout(5000);
    await shot("forum_post_created");
    console.log("URL after post:", page.url());

    if (page.url().includes("/forum/posts/")) {
      console.log("✅ Forum post created successfully!");

      // Add a comment
      console.log("--- Step 1.3: Add comment ---");
      const commentArea = await page.$('textarea[maxlength="4000"]');
      if (commentArea) {
        await commentArea.fill(
          "I'd also recommend the 'Mathématiques Terminale' textbook by Ben Slimane — " +
          "the exercises are very close to real bac questions."
        );
        const commentBtn = await page.$('button:has-text("Post comment")');
        if (commentBtn) {
          await commentBtn.click();
          await page.waitForTimeout(3000);
          await shot("forum_comment_added");
          console.log("✅ Comment posted");
        }
      }

      // Try voting
      console.log("--- Step 1.4: Upvote post ---");
      const upvoteBtn = await page.$('button:has-text("▲")');
      if (upvoteBtn) {
        await upvoteBtn.click();
        await page.waitForTimeout(1500);
        await shot("forum_upvoted");
        console.log("✅ Upvoted post");
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // PART 2: WALL POST (as Teacher on own profile)
  // ═══════════════════════════════════════════════════════════
  console.log("\n═══ PART 2: WALL POST ═══\n");

  // Get teacher's userId from profile page
  console.log("--- Step 2.1: Go to own teacher profile ---");
  await page.goto(`${BASE}/profile`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);

  // Get userId from the page or URL — teacher profile has a link to /teachers/{userId}
  const profileUrl = page.url();
  console.log("Profile URL:", profileUrl);

  // Find teacher's own public profile link
  const teacherLink = await page.$('a[href*="/teachers/"]');
  let teacherUserId = null;
  if (teacherLink) {
    const href = await teacherLink.getAttribute("href");
    teacherUserId = href?.split("/teachers/")[1]?.split("?")[0];
    console.log("Teacher userId:", teacherUserId);
  }

  if (teacherUserId) {
    await page.goto(`${BASE}/teachers/${teacherUserId}`, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(3000);
    await shot("teacher_own_profile");

    // Click on Wall tab
    const wallTab = await page.$('button:has-text("Wall")');
    if (wallTab) {
      await wallTab.click();
      await page.waitForTimeout(2000);
      await shot("teacher_wall_tab");

      // Write a wall post
      const wallTextarea = await page.$('textarea[maxlength="4000"]');
      if (wallTextarea) {
        await wallTextarea.fill(
          "📚 New study materials uploaded!\n\n" +
          "I just shared a full Mathematics Bac 2024 practice exam in the Study Materials portal. " +
          "It covers Analysis, Geometry, and Probability with a detailed marking scheme.\n\n" +
          "Also uploaded a Physics electromagnetic waves summary for those preparing for the science track.\n\n" +
          "Check them out at /study-materials and let me know if you have questions!"
        );
        console.log("✅ Filled wall post");

        const wallPostBtn = await page.$('button:has-text("Post to wall")');
        if (wallPostBtn) {
          await wallPostBtn.click();
          await page.waitForTimeout(4000);
          await shot("wall_post_created");
          console.log("✅ Wall post published");
        }
      } else {
        console.log("No wall textarea found (may not be on own profile)");
        await shot("wall_no_textarea_debug");
      }
    } else {
      console.log("No Wall tab found");
    }
  }

  // ═══════════════════════════════════════════════════════════
  // PART 3: MARKETPLACE LISTING (as Teacher/Seller)
  // ═══════════════════════════════════════════════════════════
  console.log("\n═══ PART 3: MARKETPLACE LISTING ═══\n");

  // Browse marketplace
  console.log("--- Step 3.1: Browse marketplace ---");
  await page.goto(`${BASE}/marketplace`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("marketplace_browse");

  // Create a new listing
  console.log("--- Step 3.2: Create digital listing ---");
  await page.goto(`${BASE}/seller/listings/new`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);
  await shot("seller_listing_form");

  // Fill listing form
  // Kind = digital
  const kindSel = await page.$("select");
  if (kindSel) {
    await kindSel.selectOption("digital");
    console.log("✅ Selected kind: digital");
    await page.waitForTimeout(500);
  }

  // Title
  const listTitle = await page.$('input[maxlength="200"]');
  if (listTitle) {
    await listTitle.fill("Complete Bac Math Revision Pack 2024");
    console.log("✅ Filled listing title");
  }

  // Description
  const listDesc = await page.$('textarea[maxlength="4000"]');
  if (listDesc) {
    await listDesc.fill(
      "A comprehensive revision pack for the Mathematics Baccalaureate 2024.\n\n" +
      "Includes:\n" +
      "• 5 full practice exams with solutions\n" +
      "• Summary sheets for Analysis, Geometry, and Probability\n" +
      "• Common mistakes guide\n" +
      "• Formula cheat sheet\n" +
      "• Tips for time management during the exam\n\n" +
      "Created by a teacher with 8 years of bac prep experience."
    );
    console.log("✅ Filled description");
  }

  // Subjects
  const subjInput = await page.$$("input.input");
  for (const inp of subjInput) {
    const ph = await inp.getAttribute("placeholder");
    if (ph && ph.toLowerCase().includes("comma")) {
      await inp.fill("Mathematics, Bac Prep, Exam Practice");
      console.log("✅ Filled subjects");
      break;
    }
  }

  // Price
  const priceInput = await page.$('input[type="number"][step="0.001"]');
  if (priceInput) {
    await priceInput.fill("35");
    console.log("✅ Set price: 35 TND");
  }

  // File upload
  const listFile = await page.$('input[type="file"]');
  if (listFile) {
    await listFile.setInputFiles(resolve("test-assets/math-exam-2024.txt"));
    console.log("✅ Attached file");
  }

  await shot("listing_form_filled");

  // Submit
  const publishListBtn = await page.$('button:has-text("Publish")');
  if (publishListBtn) {
    await publishListBtn.click();
    await page.waitForTimeout(6000);
    await shot("listing_created");
    console.log("URL after listing:", page.url());
  }

  // View seller listings
  console.log("--- Step 3.3: Seller listings page ---");
  await page.goto(`${BASE}/seller/listings`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("seller_listings_page");

  // Browse marketplace with the new listing
  console.log("--- Step 3.4: Browse marketplace (with new listing) ---");
  await page.goto(`${BASE}/marketplace`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("marketplace_with_listing");

  // Click on a listing
  const listingLink = await page.$('a[href*="/marketplace/listings/"]');
  if (listingLink) {
    await listingLink.click();
    await page.waitForTimeout(3000);
    await shot("listing_detail");
  }

  // ═══════════════════════════════════════════════════════════
  // PART 4: SUPPORT TICKET (as Teacher)
  // ═══════════════════════════════════════════════════════════
  console.log("\n═══ PART 4: SUPPORT TICKET ═══\n");

  console.log("--- Step 4.1: Support page ---");
  await page.goto(`${BASE}/support`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);
  await shot("support_page");

  console.log("--- Step 4.2: Create new ticket ---");
  await page.goto(`${BASE}/support/new`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);
  await shot("support_new_ticket_form");

  // Subject
  const ticketSubj = await page.$('input[maxlength="200"]');
  if (ticketSubj) {
    await ticketSubj.fill("Student payment not reflected in earnings dashboard");
    console.log("✅ Filled ticket subject");
  }

  // Category
  const selects = await page.$$("select");
  if (selects.length >= 1) {
    await selects[0].selectOption("payment_dispute");
    console.log("✅ Selected category: payment_dispute");
    await page.waitForTimeout(500);
  }

  // Priority
  if (selects.length >= 2) {
    await selects[1].selectOption("high");
    console.log("✅ Selected priority: high");
  }

  // Body
  const ticketBody = await page.$('textarea[maxlength="8000"]');
  if (ticketBody) {
    await ticketBody.fill(
      "A student completed a booking and paid for a single session on April 28, 2026. " +
      "The booking shows as 'confirmed' on both sides, but the payment is not showing " +
      "in my earnings dashboard.\n\n" +
      "Student email: malek.atia2@gmail.com\n" +
      "Session date: April 28, 2026\n" +
      "Amount: 55 TND\n\n" +
      "Could you please investigate and ensure the payment is credited to my account? " +
      "Thank you."
    );
    console.log("✅ Filled ticket body");
  }

  await shot("ticket_filled");

  // Submit
  const ticketBtn = await page.$('button:has-text("Submit ticket")');
  if (ticketBtn) {
    await ticketBtn.click();
    await page.waitForTimeout(5000);
    await shot("ticket_created");
    console.log("URL after ticket:", page.url());

    if (page.url().includes("/support/")) {
      console.log("✅ Support ticket created!");
    }
  }

  // View ticket list
  await page.goto(`${BASE}/support`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);
  await shot("support_with_ticket");

  // ═══════════════════════════════════════════════════════════
  // PART 5: SWITCH TO STUDENT
  // ═══════════════════════════════════════════════════════════
  console.log("\n═══ PART 5: STUDENT FEATURES ═══\n");

  console.log("--- Switching to student account ---");
  await switchUser(STUDENT.email, STUDENT.pass);
  await shot("student_logged_in");

  // ── 5A: Mailbox — Send DM to teacher ──────────────────────
  console.log("--- Step 5A: Send DM via mailbox ---");
  await page.goto(`${BASE}/mailbox`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("mailbox_page");

  // Check for compose form
  const recipientInput = await page.$('input[placeholder*="Recipient"], input[placeholder*="recipient"], input[placeholder*="user ID"]');
  if (recipientInput && teacherUserId) {
    await recipientInput.fill(teacherUserId);
    console.log("✅ Filled recipient:", teacherUserId);

    const subjInput2 = await page.$('input[placeholder="Subject"]');
    if (subjInput2) {
      await subjInput2.fill("Question about your math revision materials");
      console.log("✅ Filled subject");
    }

    const msgBody = await page.$('textarea[placeholder*="message"], textarea[placeholder*="Write"]');
    if (msgBody) {
      await msgBody.fill(
        "Hi Karim,\n\n" +
        "I just saw your Mathematics Bac 2024 practice exam in the study materials section. " +
        "I had a question about Exercise 2 on sequences — could you explain the approach " +
        "for proving that un is bounded?\n\n" +
        "Also, do you offer any group preparation sessions for the bac? " +
        "I'm interested in joining a study group if available.\n\n" +
        "Thanks!"
      );
      console.log("✅ Filled message body");
    }

    await shot("mailbox_compose_filled");

    const sendBtn = await page.$('button:has-text("Send")');
    if (sendBtn) {
      await sendBtn.click();
      await page.waitForTimeout(5000);
      await shot("mailbox_message_sent");
      console.log("URL after send:", page.url());

      if (page.url().includes("/mailbox/")) {
        console.log("✅ Message sent!");

        // Check thread view
        await page.waitForTimeout(2000);
        await shot("mailbox_thread_view");
      }
    }
  } else {
    console.log("No compose form or no teacher ID — taking debug screenshot");
    await shot("mailbox_debug");

    // Try alternate: find a "New message" or compose button
    const composeBtn = await page.$('a[href*="/mailbox/new"], button:has-text("New"), button:has-text("Compose")');
    if (composeBtn) {
      await composeBtn.click();
      await page.waitForTimeout(2000);
      await shot("mailbox_compose_page");
    }
  }

  // ── 5B: Student forum comment ─────────────────────────────
  console.log("\n--- Step 5B: Student comments on forum post ---");
  await page.goto(`${BASE}/forum`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);

  // Find the post we created
  const postLink = await page.$('a[href*="/forum/posts/"]');
  if (postLink) {
    await postLink.click();
    await page.waitForTimeout(3000);
    await shot("student_forum_post_view");

    // Add a comment as student
    const commentArea2 = await page.$('textarea[maxlength="4000"]');
    if (commentArea2) {
      await commentArea2.fill(
        "Great tips! I'd add that solving problems from the official Tunisian curriculum guide " +
        "is essential. The style of questions hasn't changed much in the past 5 years."
      );
      const commentBtn2 = await page.$('button:has-text("Post comment")');
      if (commentBtn2) {
        await commentBtn2.click();
        await page.waitForTimeout(3000);
        await shot("student_comment_added");
        console.log("✅ Student comment posted on forum");
      }
    }

    // Upvote the post
    const upBtn = await page.$('button:has-text("▲")');
    if (upBtn) {
      await upBtn.click();
      await page.waitForTimeout(1500);
      console.log("✅ Student upvoted the post");
    }
  }

  // ── 5C: Student support ticket ────────────────────────────
  console.log("\n--- Step 5C: Student creates support ticket ---");
  await page.goto(`${BASE}/support/new`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);

  const sTicketSubj = await page.$('input[maxlength="200"]');
  if (sTicketSubj) {
    await sTicketSubj.fill("Cannot download premium study material");
  }

  const sSelects = await page.$$("select");
  if (sSelects.length >= 1) {
    await sSelects[0].selectOption("technical");
    await page.waitForTimeout(500);
  }
  if (sSelects.length >= 2) {
    await sSelects[1].selectOption("normal");
  }

  const sTicketBody = await page.$('textarea[maxlength="8000"]');
  if (sTicketBody) {
    await sTicketBody.fill(
      "I'm trying to download a premium study material (Physics - Electromagnetic Waves Summary) " +
      "but I get a generic error message instead of a clear paywall message.\n\n" +
      "Expected: A message telling me to subscribe to premium.\n" +
      "Actual: 'Something went wrong. Please try again.'\n\n" +
      "Can you improve the error message for non-subscribers?"
    );
  }

  await shot("student_ticket_filled");

  const sTicketBtn = await page.$('button:has-text("Submit ticket")');
  if (sTicketBtn) {
    await sTicketBtn.click();
    await page.waitForTimeout(5000);
    await shot("student_ticket_created");
    console.log("✅ Student support ticket created");
  }

  // ── 5D: Student browses marketplace and tries to buy ──────
  console.log("\n--- Step 5D: Student marketplace browse + buy attempt ---");
  await page.goto(`${BASE}/marketplace`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("student_marketplace");

  const listing = await page.$('a[href*="/marketplace/listings/"]');
  if (listing) {
    await listing.click();
    await page.waitForTimeout(3000);
    await shot("student_listing_detail");

    // Look for buy button
    const buyBtn = await page.$('a[href*="/marketplace/buy/"], button:has-text("Buy"), a:has-text("Buy")');
    if (buyBtn) {
      await buyBtn.click();
      await page.waitForTimeout(5000);
      await shot("student_checkout");
      console.log("✅ Student reached checkout page");
    }
  }

  // ── 5E: Calendar view ─────────────────────────────────────
  console.log("\n--- Step 5E: Calendar ---");
  await page.goto(`${BASE}/calendar`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("student_calendar");

  // ── 5F: Grades view ───────────────────────────────────────
  console.log("\n--- Step 5F: Grades ---");
  await page.goto(`${BASE}/grades`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("student_grades");

  // ── 5G: Favorites ─────────────────────────────────────────
  console.log("\n--- Step 5G: Favorites ---");
  await page.goto(`${BASE}/favorites`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("student_favorites");

  // ── 5H: Orders ────────────────────────────────────────────
  console.log("\n--- Step 5H: Orders ---");
  await page.goto(`${BASE}/orders`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("student_orders");

  // ── 5I: Notifications ─────────────────────────────────────
  console.log("\n--- Step 5I: Notifications ---");
  const notifBtn = await page.$('button:has-text("Notifications"), a:has-text("Notifications")');
  if (notifBtn) {
    await notifBtn.click();
    await page.waitForTimeout(2000);
    await shot("student_notifications");
  }

  // ═══════════════════════════════════════════════════════════
  // PART 6: TEACHER SPACE & STUDENT SPACE DASHBOARDS
  // ═══════════════════════════════════════════════════════════
  console.log("\n═══ PART 6: DASHBOARDS ═══\n");

  // Student space
  console.log("--- Step 6.1: Student space/dashboard ---");
  await page.goto(`${BASE}/student`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("student_dashboard");

  // Switch to teacher
  await switchUser(TEACHER.email, TEACHER.pass);

  // Teacher space
  console.log("--- Step 6.2: Teacher space/dashboard ---");
  await page.goto(`${BASE}/teacher`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("teacher_dashboard");

  // Teacher earnings
  console.log("--- Step 6.3: Teacher earnings ---");
  await page.goto(`${BASE}/teacher/earnings`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("teacher_earnings");

  // Teacher students
  console.log("--- Step 6.4: Teacher students ---");
  await page.goto(`${BASE}/teacher/students`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("teacher_students");

  // Teacher bookings
  console.log("--- Step 6.5: Teacher bookings ---");
  await page.goto(`${BASE}/teacher/bookings`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("teacher_bookings");

  // Lesson requests
  console.log("--- Step 6.6: Lesson requests ---");
  await page.goto(`${BASE}/requests`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("lesson_requests");

  // Events
  console.log("--- Step 6.7: Events ---");
  await page.goto(`${BASE}/events`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("events_page");

  // FAQ
  console.log("--- Step 6.8: FAQ ---");
  await page.goto(`${BASE}/faq`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("faq_page");

  // Settings
  console.log("--- Step 6.9: Settings ---");
  await page.goto(`${BASE}/settings/sms`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("settings_sms");

  // Referrals
  console.log("--- Step 6.10: Referrals ---");
  await page.goto(`${BASE}/referrals`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("referrals_page");

  console.log(`\n✅ Remaining features E2E test complete: ${shotN} screenshots`);
  await browser.close();
})();
