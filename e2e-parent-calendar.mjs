import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const DIR = "screenshots/parent-calendar";
const PARENT = { email: "malek.parent@gmail.com", pass: "Drakifech1234" };
const STUDENT = { email: "malek.atia2@gmail.com", pass: "Drakifech1234" };

let page, browser, context;
let shotN = 0;

async function shot(name, opts = {}) {
  shotN++;
  const p = `${DIR}/${String(shotN).padStart(2, "0")}_${name}.png`;
  await page.screenshot({ path: p, fullPage: opts.fullPage !== false, ...opts });
  console.log(`  📸 ${p}`);
}

async function login(email, pass, label) {
  console.log(`\n🔐 Logging in as ${label}...`);
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', pass);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);
}

async function logout() {
  await context.clearCookies();
  await page.evaluate(() => localStorage.clear());
}

(async () => {
  const { mkdirSync } = await import("fs");
  mkdirSync(DIR, { recursive: true });

  browser = await chromium.launch({ headless: true });
  context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  page = await context.newPage();

  // ═══════════════════════════════════════════════════════════════════
  // 1. Re-link parent and child (cleaned up by previous test)
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n═══ 1. RE-LINK PARENT AND CHILD ═══");
  await login(PARENT.email, PARENT.pass, "Parent");

  await page.goto(`${BASE}/parent/children`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);

  // Check if child is already linked
  const existingChild = await page.$('text=malek.atia2@gmail.com');
  if (!existingChild) {
    const emailInput = await page.$('input[type="email"]');
    if (emailInput) {
      await emailInput.fill(STUDENT.email);
      const relSelect = await page.$('select');
      if (relSelect) await relSelect.selectOption("father");
      const submitBtn = await page.$('button[type="submit"]');
      if (submitBtn) {
        await submitBtn.click();
        await page.waitForTimeout(3000);
        console.log("  ✅ Added child link request");
      }
    }

    await logout();

    // Student accepts
    await login(STUDENT.email, STUDENT.pass, "Student");
    await page.goto(`${BASE}/student/parents`, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(3000);

    const acceptBtn = await page.$('button:has-text("Accept")');
    if (acceptBtn) {
      await acceptBtn.click();
      await page.waitForTimeout(3000);
      console.log("  ✅ Student accepted parent link");
    }

    await logout();
    await login(PARENT.email, PARENT.pass, "Parent");
  } else {
    console.log("  ✅ Child already linked");
  }

  // ═══════════════════════════════════════════════════════════════════
  // 2. PARENT: Calendar — Month view
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n═══ 2. PARENT CALENDAR — MONTH VIEW ═══");

  await page.goto(`${BASE}/calendar`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(4000);
  await shot("parent_calendar_month");

  // Verify it says "Family calendar" not "My calendar"
  const calTitle = await page.textContent("h1");
  if (calTitle?.includes("Family")) {
    console.log(`  ✅ Title says "${calTitle}"`);
  } else {
    console.log(`  ⚠️ Title says "${calTitle}" (expected "Family calendar")`);
  }

  // Check stats bar
  const statsCards = await page.$$('.card.flex.flex-col');
  console.log(`  ✅ Found ${statsCards.length} stat cards`);

  // ═══════════════════════════════════════════════════════════════════
  // 3. PARENT: Calendar — Week view
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n═══ 3. PARENT CALENDAR — WEEK VIEW ═══");

  const weekBtn = await page.$('button:has-text("week")');
  if (weekBtn) {
    await weekBtn.click();
    await page.waitForTimeout(2000);
    await shot("parent_calendar_week");
    console.log("  ✅ Week view loaded");
  }

  // ═══════════════════════════════════════════════════════════════════
  // 4. PARENT: Calendar — Agenda view
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n═══ 4. PARENT CALENDAR — AGENDA VIEW ═══");

  const agendaBtn = await page.$('button:has-text("agenda")');
  if (agendaBtn) {
    await agendaBtn.click();
    await page.waitForTimeout(2000);
    await shot("parent_calendar_agenda");
    console.log("  ✅ Agenda view loaded");
  }

  // ═══════════════════════════════════════════════════════════════════
  // 5. PARENT: Calendar navigation
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n═══ 5. PARENT CALENDAR — NAVIGATION ═══");

  // Switch back to month
  const monthBtn = await page.$('button:has-text("month")');
  if (monthBtn) await monthBtn.click();
  await page.waitForTimeout(1000);

  // Navigate forward
  const nextBtn = await page.$('button:has-text("›")');
  if (nextBtn) {
    await nextBtn.click();
    await page.waitForTimeout(1000);
    await shot("parent_calendar_next_month");
    console.log("  ✅ Navigated to next month");
  }

  // Navigate back
  const prevBtn = await page.$('button:has-text("‹")');
  if (prevBtn) {
    await prevBtn.click();
    await page.waitForTimeout(500);
    await prevBtn.click();
    await page.waitForTimeout(1000);
    await shot("parent_calendar_prev_month");
    console.log("  ✅ Navigated to previous month");
  }

  // Today button
  const todayBtn = await page.$('button:has-text("Today")');
  if (todayBtn) {
    await todayBtn.click();
    await page.waitForTimeout(1000);
    console.log("  ✅ Navigated to today");
  }

  // ═══════════════════════════════════════════════════════════════════
  // 6. PARENT: Check other pages still work
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n═══ 6. PARENT DASHBOARD CHECK ═══");

  await page.goto(`${BASE}/parent`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("parent_dashboard_final");

  // Check child is shown as linked
  const linkedBadge = await page.$('text=Linked');
  if (linkedBadge) {
    console.log("  ✅ Child shows as linked on dashboard");
  }

  // ═══════════════════════════════════════════════════════════════════
  // DONE
  // ═══════════════════════════════════════════════════════════════════
  console.log(`\n✅ Parent Calendar E2E complete: ${shotN} screenshots saved to ${DIR}/`);
  await browser.close();
})();
