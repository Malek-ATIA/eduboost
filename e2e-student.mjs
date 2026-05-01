import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const DIR = "screenshots/student";
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

  console.log("=== STUDENT FLOW ===");
  console.log("Logging in as student:", EMAIL);
  await login();

  // Student dashboard
  await nav("/student", "student_dashboard", { wait: 2000 });

  // Profile
  await nav("/profile", "profile", { wait: 2000 });

  // ── Find & browse teachers ─────────────────────────────────
  await nav("/teachers", "teachers_browse", { wait: 3000 });

  // Click on first teacher to view their profile
  const firstTeacherLink = await page.$('a[href*="/teachers/"]');
  if (firstTeacherLink) {
    await firstTeacherLink.click();
    await page.waitForTimeout(3000);
    await shot("teacher_profile_detail");
  }

  // ── Booking flow ───────────────────────────────────────────
  // Go back to teachers list and try to book
  await nav("/teachers", "teachers_before_booking", { wait: 2000 });

  // Find a "Book now" or similar link on teacher cards
  const bookLink = await page.$('a[href*="/book/"]');
  if (bookLink) {
    const href = await bookLink.getAttribute("href");
    console.log("Found booking link:", href);
    await bookLink.click();
    await page.waitForTimeout(3000);
    await shot("booking_page");

    // Try to interact with booking form
    const sessionTypeSelect = await page.$('select, input[type="radio"]');
    if (sessionTypeSelect) {
      await shot("booking_form_options");
    }
  } else {
    console.log("No direct book link found on teacher cards, trying teacher profile");
    // Navigate to a specific teacher profile and look for book button
    const teacherLinks = await page.$$('a[href*="/teachers/"]');
    if (teacherLinks.length > 0) {
      await teacherLinks[0].click();
      await page.waitForTimeout(2000);
      await shot("teacher_profile_for_booking");

      // Look for Book/Request buttons on the teacher profile page
      const bookBtn = await page.$('a[href*="/book/"], button:has-text("Book"), a:has-text("Book a session"), a:has-text("Book a trial")');
      if (bookBtn) {
        await bookBtn.click();
        await page.waitForTimeout(3000);
        await shot("booking_page_from_profile");
      }

      // Look for Request lesson button
      const requestBtn = await page.$('button:has-text("Request"), a:has-text("Request a lesson")');
      if (requestBtn) {
        await shot("request_lesson_button_visible");
      }

      // Look for Message button
      const msgBtn = await page.$('button:has-text("Contact"), button:has-text("Message"), a:has-text("Contact")');
      if (msgBtn) {
        await shot("contact_teacher_button_visible");
      }

      // Look for Save/Favorite button
      const saveBtn = await page.$('button:has-text("Save"), button:has-text("Favorite"), button:has-text("Bookmark")');
      if (saveBtn) {
        await saveBtn.click();
        await page.waitForTimeout(1000);
        await shot("teacher_saved");
      }
    }
  }

  // ── Bookings list ──────────────────────────────────────────
  await nav("/bookings", "my_bookings", { wait: 2000 });

  // ── Calendar ───────────────────────────────────────────────
  await nav("/calendar", "calendar", { wait: 2000 });

  // ── Classrooms ─────────────────────────────────────────────
  await nav("/classrooms", "classrooms", { wait: 2000 });

  // Try joining a classroom if there's a join option
  const joinBtn = await page.$('button:has-text("Join"), a:has-text("Join")');
  if (joinBtn) {
    await shot("classroom_join_available");
  }

  // Click on first classroom if available
  const classroomLink = await page.$('a[href*="/classrooms/"]');
  if (classroomLink) {
    await classroomLink.click();
    await page.waitForTimeout(3000);
    await shot("classroom_detail");

    // Look for classroom sub-sections: wall, whiteboard, chat, notes
    const wallTab = await page.$('a[href*="wall"], button:has-text("Wall")');
    if (wallTab) {
      await wallTab.click();
      await page.waitForTimeout(1500);
      await shot("classroom_wall");
    }

    const notesTab = await page.$('a[href*="notes"], button:has-text("Notes")');
    if (notesTab) {
      await notesTab.click();
      await page.waitForTimeout(1500);
      await shot("classroom_notes");
    }
  }

  // ── Marketplace ────────────────────────────────────────────
  await nav("/marketplace", "marketplace_browse", { wait: 2000 });

  // Click on a listing to see detail
  const listingLink = await page.$('a[href*="/marketplace/listings/"]');
  if (listingLink) {
    await listingLink.click();
    await page.waitForTimeout(2000);
    await shot("listing_detail");
  }

  // ── Orders ─────────────────────────────────────────────────
  await nav("/orders", "my_orders", { wait: 2000 });

  // ── Forum / Community ──────────────────────────────────────
  await nav("/forum", "forum_channels", { wait: 2000 });

  // Click on a channel
  const channelLink = await page.$('a[href*="/forum/channels/"]');
  if (channelLink) {
    await channelLink.click();
    await page.waitForTimeout(2000);
    await shot("forum_channel_posts");

    // Click on a post if available
    const postLink = await page.$('a[href*="/forum/posts/"]');
    if (postLink) {
      await postLink.click();
      await page.waitForTimeout(2000);
      await shot("forum_post_detail");
    }
  }

  // Create a forum post
  await nav("/forum/posts/new", "forum_new_post_form", { wait: 2000 });
  const postTitle = await page.$('input[name="title"], input[placeholder*="title"]');
  if (postTitle) {
    await postTitle.fill("Need help with math derivatives");
    const postBody = await page.$('textarea');
    if (postBody) await postBody.fill("Can someone explain the chain rule for derivatives? I'm preparing for my bac exam and struggling with composite functions.");
    await shot("forum_post_filled");
  }

  // ── Mailbox ────────────────────────────────────────────────
  await nav("/mailbox", "mailbox", { wait: 2000 });

  // ── Notifications ──────────────────────────────────────────
  await nav("/notifications", "notifications", { wait: 2000 });

  // ── Grades ─────────────────────────────────────────────────
  await nav("/grades", "grades", { wait: 2000 });

  // ── Assessments / Exams ────────────────────────────────────
  await nav("/assessments", "assessments", { wait: 2000 });

  // Try taking an exam if available
  const examLink = await page.$('a[href*="/assessments/"]');
  if (examLink) {
    await examLink.click();
    await page.waitForTimeout(2000);
    await shot("exam_detail");

    // Look for "Start" or "Take exam" button
    const startBtn = await page.$('button:has-text("Start"), button:has-text("Take"), a:has-text("Start")');
    if (startBtn) {
      await startBtn.click();
      await page.waitForTimeout(2000);
      await shot("exam_taking");
    }
  }

  // ── Study Materials ────────────────────────────────────────
  await nav("/study-materials", "study_materials", { wait: 2000 });

  // Click on a material if available
  const materialLink = await page.$('a[href*="/study-materials/"]');
  if (materialLink) {
    await materialLink.click();
    await page.waitForTimeout(2000);
    await shot("study_material_detail");
  }

  // ── Notes ──────────────────────────────────────────────────
  await nav("/notes", "notes", { wait: 2000 });

  // ── Favorites ──────────────────────────────────────────────
  await nav("/favorites", "favorites", { wait: 2000 });

  // ── Referrals ──────────────────────────────────────────────
  await nav("/referrals", "referrals", { wait: 2000 });

  // ── Support ────────────────────────────────────────────────
  await nav("/support", "support_tickets", { wait: 2000 });

  // Try creating a support ticket
  const newTicketBtn = await page.$('a[href*="/support/new"], button:has-text("New ticket")');
  if (newTicketBtn) {
    await newTicketBtn.click();
    await page.waitForTimeout(2000);
    await shot("support_ticket_form");
  }

  // ── Analytics ──────────────────────────────────────────────
  await nav("/analytics", "analytics", { wait: 2000 });

  // ── Payments ───────────────────────────────────────────────
  await nav("/payments", "payments", { wait: 2000 });

  // ── Attendance ─────────────────────────────────────────────
  await nav("/attendance", "attendance", { wait: 2000 });

  // ── Settings ───────────────────────────────────────────────
  await nav("/settings/sms", "settings_sms", { wait: 2000 });

  // ── FAQ ────────────────────────────────────────────────────
  await nav("/faq", "faq", { wait: 1500 });

  // ── Terms ──────────────────────────────────────────────────
  await nav("/terms", "terms", { wait: 1500 });

  // ── Landing page (logged in view) ──────────────────────────
  await nav("/", "landing_page_logged_in", { wait: 3000 });

  // ── Avatar dropdown ────────────────────────────────────────
  await nav("/student", "before_dropdown", { wait: 1500 });
  const avatarBtn = await page.$('button[aria-label="Account menu"]');
  if (avatarBtn) {
    await avatarBtn.click();
    await page.waitForTimeout(500);
    await shot("avatar_dropdown_open");
  }

  console.log(`\n✅ Student flow complete: ${shotN} screenshots taken`);
  await browser.close();
})();
