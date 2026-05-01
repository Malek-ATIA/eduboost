import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const DIR = "screenshots/redesigned-pages";
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
  // PUBLIC PAGES
  // ═══════════════════════════════════════════════════════════
  console.log("═══ PUBLIC REDESIGNED PAGES ═══\n");

  // Events list (public)
  await visitPage("/events", "events_list_public");

  // ═══════════════════════════════════════════════════════════
  // STUDENT PAGES
  // ═══════════════════════════════════════════════════════════
  console.log("\n═══ STUDENT REDESIGNED PAGES ═══\n");
  await login(STUDENT.email, STUDENT.pass);

  // Tier 1
  await visitPage("/calendar", "student_calendar");
  await visitPage("/mailbox", "student_mailbox");
  await visitPage("/events", "student_events_list");

  // Navigate to an event detail if one exists
  await page.goto(`${BASE}/events`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);
  const eventLink = await page.$('a[href*="/events/evt_"]');
  if (eventLink) {
    await eventLink.click();
    await page.waitForTimeout(3000);
    await shot("student_event_detail");
  } else {
    console.log("  (no events found, skipping detail)");
  }

  // Navigate to a study material detail
  await page.goto(`${BASE}/study-materials`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);
  const matLink = await page.$('a[href*="/study-materials/mat_"]');
  if (matLink) {
    await matLink.click();
    await page.waitForTimeout(3000);
    await shot("student_study_material_detail");
  } else {
    console.log("  (no study materials found, skipping detail)");
  }

  // Navigate to a marketplace listing detail
  await page.goto(`${BASE}/marketplace`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);
  const listLink = await page.$('a[href*="/marketplace/listings/"]');
  if (listLink) {
    await listLink.click();
    await page.waitForTimeout(3000);
    await shot("student_marketplace_listing_detail");
  } else {
    console.log("  (no marketplace listings found, skipping detail)");
  }

  // Tier 2
  await visitPage("/grades", "student_grades");
  await visitPage("/notifications", "student_notifications");
  await visitPage("/membership", "student_membership");
  await visitPage("/reviews/new?bookingId=test", "student_review_form_error");

  // Tier 3
  await visitPage("/favorites", "student_favorites");
  await visitPage("/orders", "student_orders");
  await visitPage("/requests", "student_requests");

  // Mailbox compose (click New message)
  await page.goto(`${BASE}/mailbox`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);
  const newMsgBtn = await page.$('button:has-text("New message")');
  if (newMsgBtn) {
    await newMsgBtn.click();
    await page.waitForTimeout(1500);
    await shot("student_mailbox_compose");
  }

  // Mailbox thread detail
  await page.goto(`${BASE}/mailbox`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);
  const threadLink = await page.$('a[href*="/mailbox/"]');
  if (threadLink) {
    await threadLink.click();
    await page.waitForTimeout(3000);
    await shot("student_mailbox_thread");
  }

  // ═══════════════════════════════════════════════════════════
  // TEACHER PAGES
  // ═══════════════════════════════════════════════════════════
  console.log("\n═══ TEACHER REDESIGNED PAGES ═══\n");
  await context.clearCookies();
  await page.evaluate(() => localStorage.clear());
  await login(TEACHER.email, TEACHER.pass);

  // Tier 1
  await visitPage("/calendar", "teacher_calendar");
  await visitPage("/mailbox", "teacher_mailbox");
  await visitPage("/events", "teacher_events_list");

  // Tier 2
  await visitPage("/grades", "teacher_grades");
  await visitPage("/notifications", "teacher_notifications");
  await visitPage("/seller/listings", "teacher_seller_listings");

  // Session scheduling (find a classroom first)
  await page.goto(`${BASE}/classrooms`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);
  const classLink = await page.$('a[href*="/classrooms/"]');
  let classroomId = null;
  if (classLink) {
    const h = await classLink.getAttribute("href");
    classroomId = h?.split("/classrooms/")[1]?.split("?")[0];
  }
  if (classroomId) {
    await visitPage(`/sessions/new?classroomId=${classroomId}`, "teacher_session_new");
  } else {
    // Show the missing-context state
    await visitPage("/sessions/new", "teacher_session_new_no_context");
  }

  // Tier 3
  await visitPage("/requests", "teacher_requests");
  await visitPage("/teacher/students", "teacher_students");
  await visitPage("/membership", "teacher_membership");

  // Teacher mailbox compose
  await page.goto(`${BASE}/mailbox`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);
  const tNewMsgBtn = await page.$('button:has-text("New message")');
  if (tNewMsgBtn) {
    await tNewMsgBtn.click();
    await page.waitForTimeout(1500);
    await shot("teacher_mailbox_compose");
  }

  console.log(`\n✅ Redesigned pages audit complete: ${shotN} screenshots`);
  await browser.close();
})();
