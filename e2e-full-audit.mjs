import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const DIR = "screenshots/full-audit";
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

async function visitPage(url, name, waitMs = 3000) {
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(waitMs);
  await shot(name);
}

(async () => {
  const { mkdirSync } = await import("fs");
  mkdirSync(DIR, { recursive: true });

  browser = await chromium.launch({ headless: true });
  context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await context.newPage();

  // ═══════════════════════════════════════════════════════════
  // PUBLIC PAGES (no login)
  // ═══════════════════════════════════════════════════════════
  console.log("═══ PUBLIC PAGES ═══\n");

  await visitPage("/", "landing_page");
  await visitPage("/login", "login_page");
  await visitPage("/signup", "signup_page");
  await visitPage("/teachers", "teachers_directory");
  await visitPage("/faq", "faq_page");
  await visitPage("/terms", "terms_page");
  await visitPage("/privacy", "privacy_page");
  await visitPage("/code-of-conduct", "code_of_conduct");
  await visitPage("/forum", "forum_public");
  await visitPage("/marketplace", "marketplace_public");
  await visitPage("/study-materials", "study_materials_public");
  await visitPage("/events", "events_public");

  // Teacher profile (seed)
  await visitPage("/teachers/seed_teacher_karim", "teacher_profile_seed");

  // ═══════════════════════════════════════════════════════════
  // STUDENT PAGES
  // ═══════════════════════════════════════════════════════════
  console.log("\n═══ STUDENT PAGES ═══\n");
  await login(STUDENT.email, STUDENT.pass);

  await visitPage("/student", "student_dashboard");
  await visitPage("/profile", "student_profile");
  await visitPage("/bookings", "student_bookings");
  await visitPage("/classrooms", "student_classrooms");
  await visitPage("/calendar", "student_calendar");
  await visitPage("/mailbox", "student_mailbox");
  await visitPage("/grades", "student_grades");
  await visitPage("/favorites", "student_favorites");
  await visitPage("/orders", "student_orders");
  await visitPage("/study-materials", "student_study_materials");
  await visitPage("/study-materials/new", "student_study_materials_new");
  await visitPage("/forum", "student_forum");
  await visitPage("/marketplace", "student_marketplace");
  await visitPage("/support", "student_support");
  await visitPage("/support/new", "student_support_new");
  await visitPage("/settings/sms", "student_settings_sms");
  await visitPage("/referrals", "student_referrals");
  await visitPage("/membership", "student_membership");
  await visitPage("/notifications", "student_notifications");

  // Teacher profile with Wall tab
  await page.goto(`${BASE}/teachers/seed_teacher_karim`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);
  const wallTab = await page.$('button:has-text("Wall")');
  if (wallTab) {
    await wallTab.click();
    await page.waitForTimeout(2000);
  }
  await shot("teacher_profile_wall_tab");

  // Whiteboard
  // Find a classroom first
  await page.goto(`${BASE}/classrooms`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);
  const classLink = await page.$('a[href*="/classrooms/"]');
  if (classLink) {
    const href = await classLink.getAttribute("href");
    const cid = href?.split("/classrooms/")[1]?.split("?")[0];
    if (cid) {
      await visitPage(`/whiteboard/${cid}`, "whiteboard");
      await visitPage(`/classroom-chat/${cid}`, "classroom_chat");
    }
  }

  // Live session page (with fake session)
  await visitPage("/classroom/test-session-audit", "live_session_joining");
  await page.waitForTimeout(6000);
  await shot("live_session_error");

  // Forum post detail
  await page.goto(`${BASE}/forum`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);
  // Click into a channel
  const chanLink = await page.$('a[href*="/forum/"]');
  if (chanLink) {
    await chanLink.click();
    await page.waitForTimeout(2000);
    await shot("forum_channel_detail");
    // Click into a post
    const postLink = await page.$('a[href*="/forum/posts/"]');
    if (postLink) {
      await postLink.click();
      await page.waitForTimeout(2000);
      await shot("forum_post_detail");
    }
  }

  // Forum new post
  await visitPage("/forum/posts/new", "forum_new_post");

  // Marketplace listing detail
  await page.goto(`${BASE}/marketplace`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);
  const listLink = await page.$('a[href*="/marketplace/listings/"]');
  if (listLink) {
    await listLink.click();
    await page.waitForTimeout(2000);
    await shot("marketplace_listing_detail");
  }

  // Study material detail
  await page.goto(`${BASE}/study-materials`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);
  const matLink = await page.$('a[href*="/study-materials/mat_"]');
  if (matLink) {
    await matLink.click();
    await page.waitForTimeout(2000);
    await shot("study_material_detail");
  }

  // Support ticket detail
  await page.goto(`${BASE}/support`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);
  const ticketLink = await page.$('a[href*="/support/tkt_"]');
  if (ticketLink) {
    await ticketLink.click();
    await page.waitForTimeout(2000);
    await shot("support_ticket_detail");
  }

  // Booking detail — book page
  await visitPage("/book/seed_teacher_karim?type=single", "booking_checkout");

  // Review new page
  await visitPage("/reviews/new?bookingId=test", "review_new_page");

  // ═══════════════════════════════════════════════════════════
  // TEACHER PAGES
  // ═══════════════════════════════════════════════════════════
  console.log("\n═══ TEACHER PAGES ═══\n");
  await context.clearCookies();
  await page.evaluate(() => localStorage.clear());
  await login(TEACHER.email, TEACHER.pass);

  await visitPage("/teacher", "teacher_dashboard");
  await visitPage("/profile", "teacher_profile");
  await visitPage("/teacher/students", "teacher_students");
  await visitPage("/teacher/bookings", "teacher_bookings");
  await visitPage("/teacher/earnings", "teacher_earnings");
  await visitPage("/requests", "teacher_requests");
  await visitPage("/classrooms", "teacher_classrooms");
  await visitPage("/calendar", "teacher_calendar");
  await visitPage("/seller/listings", "teacher_seller_listings");
  await visitPage("/seller/listings/new", "teacher_seller_new");
  await visitPage("/mailbox", "teacher_mailbox");
  await visitPage("/support", "teacher_support");
  await visitPage("/settings/sms", "teacher_settings_sms");
  await visitPage("/referrals", "teacher_referrals");

  // Teacher's own public profile
  // find userId
  await page.goto(`${BASE}/teacher`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);
  const viewProfileLink = await page.$('a[href*="/teachers/"]');
  if (viewProfileLink) {
    await viewProfileLink.click();
    await page.waitForTimeout(3000);
    await shot("teacher_own_public_profile");

    // Wall tab
    const wTab = await page.$('button:has-text("Wall")');
    if (wTab) {
      await wTab.click();
      await page.waitForTimeout(2000);
      await shot("teacher_own_wall_tab");
    }
  }

  // Classroom detail
  await page.goto(`${BASE}/classrooms`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);
  const tClassLink = await page.$('a[href*="/classrooms/"]');
  if (tClassLink) {
    await tClassLink.click();
    await page.waitForTimeout(3000);
    await shot("teacher_classroom_detail");
  }

  // New classroom
  await visitPage("/classrooms/new", "teacher_classroom_new");

  // Sessions new
  await page.goto(`${BASE}/classrooms`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);
  const tClass2 = await page.$('a[href*="/classrooms/"]');
  let classroomId = null;
  if (tClass2) {
    const h = await tClass2.getAttribute("href");
    classroomId = h?.split("/classrooms/")[1]?.split("?")[0];
  }
  if (classroomId) {
    await visitPage(`/sessions/new?classroomId=${classroomId}`, "teacher_session_new");
  }

  // Wall post detail (if any)
  await page.goto(`${BASE}/forum`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);

  console.log(`\n✅ Full audit complete: ${shotN} screenshots`);
  await browser.close();
})();
