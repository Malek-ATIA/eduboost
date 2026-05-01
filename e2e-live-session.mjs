import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const DIR = "screenshots/live-session";
const TEACHER = { email: "malek.freelance2@gmail.com", pass: "Drakifech1234" };
const STUDENT = { email: "malek.atia2@gmail.com", pass: "Drakifech1234" };

let page, browser, context;
let shotN = 0;

async function shot(name) {
  shotN++;
  const p = `${DIR}/${String(shotN).padStart(2, "0")}_${name}.png`;
  await page.screenshot({ path: p, fullPage: false });
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

(async () => {
  const { mkdirSync } = await import("fs");
  mkdirSync(DIR, { recursive: true });

  browser = await chromium.launch({ headless: true });
  context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await context.newPage();

  console.log("=== LIVE SESSION UI TEST ===\n");

  // ── Teacher flow: Create a session ────────────────────────
  console.log("--- Teacher: Login & create session ---");
  await login(TEACHER.email, TEACHER.pass);

  // First ensure we have a classroom
  await page.goto(`${BASE}/classrooms`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);
  await shot("teacher_classrooms");

  // Create a new classroom if needed
  const newClassBtn = await page.$('a[href="/classrooms/new"]');
  if (newClassBtn) {
    await newClassBtn.click();
    await page.waitForTimeout(2000);
    await shot("new_classroom_form");

    // Fill classroom form
    const titleInput = await page.$('input[name="title"], input[placeholder*="title"], input.input');
    if (titleInput) {
      await titleInput.fill("Mathematics Bac Prep - Group A");
    }
    const subjectInput = await page.$('input[name="subject"], input[placeholder*="subject"]');
    if (subjectInput) {
      await subjectInput.fill("Mathematics");
    }
    await shot("classroom_form_filled");

    const createBtn = await page.$('button[type="submit"]');
    if (createBtn) {
      await createBtn.click();
      await page.waitForTimeout(3000);
      await shot("classroom_created");
      console.log("✅ Classroom created, URL:", page.url());
    }
  }

  // Navigate to session creation
  await page.goto(`${BASE}/sessions/new`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);
  await shot("new_session_form");

  // Check what the session creation form looks like
  const sessionPageContent = await page.textContent("main");
  console.log("Session form content:", sessionPageContent?.substring(0, 200));

  // ── Test the classroom/session UI (joining state + error state) ──
  console.log("\n--- Testing live session UI states ---");

  // Test the joining/loading state
  await page.goto(`${BASE}/classroom/test-session-123`, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(1000);
  await shot("session_joining_state");

  // Wait for error state (will fail to join since it's a fake session)
  await page.waitForTimeout(8000);
  await shot("session_error_state");

  // Log out teacher, login as student
  console.log("\n--- Student: Test session views ---");
  await context.clearCookies();
  await page.evaluate(() => localStorage.clear());
  await login(STUDENT.email, STUDENT.pass);

  // Student tries to join a session
  await page.goto(`${BASE}/classroom/test-session-456`, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(1000);
  await shot("student_joining_state");

  await page.waitForTimeout(8000);
  await shot("student_error_state");

  // ── Test whiteboard ───────────────────────────────────────
  console.log("\n--- Testing whiteboard ---");
  await page.goto(`${BASE}/classrooms`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);

  // Find a classroom to open its whiteboard
  const classroomLink = await page.$('a[href*="/classrooms/"]');
  if (classroomLink) {
    const href = await classroomLink.getAttribute("href");
    console.log("Found classroom:", href);
    await classroomLink.click();
    await page.waitForTimeout(3000);
    await shot("classroom_detail");

    // Get classroomId from URL
    const classroomUrl = page.url();
    const classroomId = classroomUrl.split("/classrooms/")[1]?.split("?")[0];
    if (classroomId) {
      // Open whiteboard
      await page.goto(`${BASE}/whiteboard/${classroomId}`, { waitUntil: "networkidle", timeout: 20000 });
      await page.waitForTimeout(2000);
      await shot("whiteboard");
    }
  }

  // ── Test classroom-chat ───────────────────────────────────
  console.log("\n--- Testing classroom chat ---");
  await page.goto(`${BASE}/classrooms`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);

  const classLink2 = await page.$('a[href*="/classrooms/"]');
  if (classLink2) {
    const href2 = await classLink2.getAttribute("href");
    const cid = href2?.split("/classrooms/")[1];
    if (cid) {
      await page.goto(`${BASE}/classroom-chat/${cid}`, { waitUntil: "networkidle", timeout: 20000 });
      await page.waitForTimeout(2000);
      await shot("classroom_chat");
    }
  }

  // ── Show calendar with sessions ───────────────────────────
  console.log("\n--- Calendar view ---");
  await page.goto(`${BASE}/calendar`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);
  await shot("calendar");

  console.log(`\n✅ Live session test complete: ${shotN} screenshots`);
  await browser.close();
})();
