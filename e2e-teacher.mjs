import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const DIR = "screenshots/teacher";
const EMAIL = "malek.freelance2@gmail.com";
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

async function nav(url, name, opts = {}) {
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle", timeout: 20000 });
  if (opts.wait) await page.waitForTimeout(opts.wait);
  return shot(name);
}

async function login() {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"], input[name="email"]', EMAIL);
  await page.fill('input[type="password"], input[name="password"]', PASS);
  await shot("login_filled");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);
  await shot("after_login");
}

(async () => {
  const { mkdirSync } = await import("fs");
  mkdirSync(DIR, { recursive: true });

  browser = await chromium.launch({ headless: true });
  context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await context.newPage();

  console.log("=== TEACHER FLOW ===");
  console.log("Logging in as teacher:", EMAIL);
  await login();

  // Teacher space / dashboard
  await nav("/teacher", "teacher_dashboard", { wait: 2000 });

  // Profile
  await nav("/profile", "profile", { wait: 2000 });

  // Try editing profile
  await nav("/profile", "profile_edit_page", { wait: 1500 });

  // Public teacher profile (via /teachers/me or sub)
  // First get the userId from the page
  const currentUrl = page.url();
  console.log("Current URL after login:", currentUrl);

  // Teacher bookings
  await nav("/teacher/bookings", "teacher_bookings", { wait: 2000 });

  // Teacher students
  await nav("/teacher/students", "teacher_students", { wait: 2000 });

  // Lesson requests
  await nav("/requests", "lesson_requests", { wait: 2000 });

  // Calendar
  await nav("/calendar", "calendar", { wait: 2000 });

  // Classrooms list
  await nav("/classrooms", "classrooms", { wait: 2000 });

  // Try creating a classroom
  await nav("/classrooms", "classrooms_before_create", { wait: 1500 });
  // Look for create button
  const createClassBtn = await page.$('a[href*="new"], button:has-text("Create"), button:has-text("New"), a:has-text("Create")');
  if (createClassBtn) {
    await createClassBtn.click();
    await page.waitForTimeout(2000);
    await shot("classroom_create_form");
    // Fill the form if it exists
    const titleInput = await page.$('input[name="title"], input[placeholder*="title"], input[placeholder*="Title"]');
    if (titleInput) {
      await titleInput.fill("Test Math Classroom");
      const subjectInput = await page.$('input[name="subject"], input[placeholder*="subject"], input[placeholder*="Subject"]');
      if (subjectInput) await subjectInput.fill("Mathematics");
      const descInput = await page.$('textarea[name="description"], textarea[placeholder*="description"]');
      if (descInput) await descInput.fill("A test classroom for math tutoring sessions");
      await shot("classroom_form_filled");
      const submitBtn = await page.$('button[type="submit"]');
      if (submitBtn) {
        await submitBtn.click();
        await page.waitForTimeout(3000);
        await shot("classroom_created");
      }
    }
  } else {
    console.log("No create classroom button found");
    await shot("classrooms_no_create_btn");
  }

  // Marketplace - seller listings
  await nav("/seller/listings", "seller_listings", { wait: 2000 });

  // Create a listing
  await nav("/seller/listings/new", "create_listing_form", { wait: 2000 });
  // Fill listing form
  const listingTitle = await page.$('input[name="title"], input[placeholder*="title"], input[placeholder*="Title"]');
  if (listingTitle) {
    await listingTitle.fill("Math Bac Preparation Notes 2026");
    const priceInput = await page.$('input[name="price"], input[placeholder*="price"], input[placeholder*="Price"], input[type="number"]');
    if (priceInput) await priceInput.fill("25");
    const descField = await page.$('textarea');
    if (descField) await descField.fill("Comprehensive math notes for bac preparation covering all topics.");
    await shot("listing_form_filled");
    const submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) {
      await submitBtn.click();
      await page.waitForTimeout(3000);
      await shot("listing_created_result");
    }
  }

  // Marketplace browse
  await nav("/marketplace", "marketplace_browse", { wait: 2000 });

  // Teacher earnings
  await nav("/teacher/earnings", "teacher_earnings", { wait: 2000 });

  // Forum / community
  await nav("/forum", "forum_channels", { wait: 2000 });

  // Try creating a forum post
  await nav("/forum/posts/new", "forum_post_form", { wait: 2000 });
  const postTitle = await page.$('input[name="title"], input[placeholder*="title"]');
  if (postTitle) {
    await postTitle.fill("Tips for effective online tutoring");
    const postBody = await page.$('textarea');
    if (postBody) await postBody.fill("Here are some tips I've learned from teaching online for the past 3 years. Engagement is key...");
    await shot("forum_post_filled");
    const submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) {
      await submitBtn.click();
      await page.waitForTimeout(3000);
      await shot("forum_post_created");
    }
  }

  // Mailbox
  await nav("/mailbox", "mailbox", { wait: 2000 });

  // Notifications
  await nav("/notifications", "notifications", { wait: 2000 });

  // Grades
  await nav("/grades", "grades", { wait: 2000 });

  // Assessments / exams
  await nav("/assessments", "assessments", { wait: 2000 });

  // Create an exam
  await nav("/assessments/new", "exam_create_form", { wait: 2000 });
  const examTitle = await page.$('input[name="title"], input[placeholder*="title"]');
  if (examTitle) {
    await examTitle.fill("Math Mid-Term Quiz");
    const examSubject = await page.$('input[name="subject"], input[placeholder*="subject"]');
    if (examSubject) await examSubject.fill("Mathematics");
    await shot("exam_form_filled");
  }

  // Study materials
  await nav("/study-materials", "study_materials", { wait: 2000 });

  // Create study material
  await nav("/study-materials/new", "study_material_form", { wait: 2000 });

  // Notes
  await nav("/notes", "notes", { wait: 2000 });

  // Orders
  await nav("/orders", "orders", { wait: 2000 });

  // Settings
  await nav("/settings/sms", "settings_sms", { wait: 2000 });

  // Referrals
  await nav("/referrals", "referrals", { wait: 2000 });

  // Favorites
  await nav("/favorites", "favorites", { wait: 2000 });

  // Support
  await nav("/support", "support_tickets", { wait: 2000 });

  // Analytics
  await nav("/analytics", "analytics", { wait: 2000 });

  // Payments
  await nav("/payments", "payments", { wait: 2000 });

  // Attendance
  await nav("/attendance", "attendance", { wait: 2000 });

  // Find teachers page (browse)
  await nav("/teachers", "teachers_browse", { wait: 3000 });

  // FAQ
  await nav("/faq", "faq", { wait: 1500 });

  // Terms
  await nav("/terms", "terms", { wait: 1500 });

  // Avatar dropdown test
  await nav("/teacher", "before_dropdown", { wait: 1500 });
  const avatarBtn = await page.$('button[aria-label="Account menu"]');
  if (avatarBtn) {
    await avatarBtn.click();
    await page.waitForTimeout(500);
    await shot("avatar_dropdown_open");
  }

  console.log(`\n✅ Teacher flow complete: ${shotN} screenshots taken`);
  await browser.close();
})();
