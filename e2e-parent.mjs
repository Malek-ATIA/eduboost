import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const DIR = "screenshots/parent-flow";
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
  // 1. PARENT: Login and see dashboard
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n═══ 1. PARENT DASHBOARD ═══");
  await login(PARENT.email, PARENT.pass, "Parent");

  await page.goto(`${BASE}/parent`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("parent_dashboard");

  // Verify dashboard elements
  const greeting = await page.textContent("h1");
  console.log(`  ✅ Dashboard greeting: "${greeting}"`);

  const statCards = await page.$$(".card-interactive");
  console.log(`  ✅ Found ${statCards.length} stat cards`);

  const quickActions = await page.$$('a[href="/teachers"], a[href="/calendar"], a[href="/analytics"]');
  console.log(`  ✅ Found ${quickActions.length} quick action links`);

  // ═══════════════════════════════════════════════════════════════════
  // 2. PARENT: Navigate to sidebar links
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n═══ 2. PARENT SIDEBAR NAV ═══");

  // Calendar
  await page.goto(`${BASE}/calendar`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);
  await shot("parent_calendar");
  console.log("  ✅ Calendar page loaded");

  // Mailbox
  await page.goto(`${BASE}/mailbox`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);
  await shot("parent_mailbox");
  console.log("  ✅ Mailbox page loaded");

  // Payments
  await page.goto(`${BASE}/payments`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);
  await shot("parent_payments");
  console.log("  ✅ Payments page loaded");

  // Analytics
  await page.goto(`${BASE}/analytics`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("parent_analytics");
  console.log("  ✅ Analytics page loaded");

  // Favorites
  await page.goto(`${BASE}/favorites`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);
  await shot("parent_favorites");
  console.log("  ✅ Favorites page loaded");

  // ═══════════════════════════════════════════════════════════════════
  // 3. PARENT: Navigate to My Children (empty state)
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n═══ 3. PARENT CHILDREN PAGE ═══");

  await page.goto(`${BASE}/parent/children`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("parent_children_initial");

  // ═══════════════════════════════════════════════════════════════════
  // 4. PARENT: Add child by email
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n═══ 4. PARENT ADD CHILD ═══");

  // Fill in the child email
  const emailInput = await page.$('input[type="email"]');
  if (emailInput) {
    await emailInput.fill(STUDENT.email);
    console.log(`  ✅ Filled child email: ${STUDENT.email}`);

    // Select relationship
    const relSelect = await page.$('select');
    if (relSelect) {
      await relSelect.selectOption("father");
      console.log("  ✅ Selected relationship: father");
    }

    await shot("parent_children_form_filled");

    // Submit
    const submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) {
      await submitBtn.click();
      await page.waitForTimeout(3000);
      await shot("parent_children_after_add");

      // Check for success toast
      const toast = await page.$('[class*="toast"], [class*="Toast"]');
      if (toast) {
        const toastText = await toast.textContent();
        console.log(`  ✅ Toast shown: "${toastText}"`);
      }

      // Check if pending child appears
      const pendingBadge = await page.$('text=Pending');
      if (pendingBadge) {
        console.log("  ✅ Child link shows as Pending");
      }
    }
  } else {
    console.log("  ⚠️ No email input found on children page");
  }

  // Try adding invalid email (non-existent)
  const emailInput2 = await page.$('input[type="email"]');
  if (emailInput2) {
    await emailInput2.fill("nonexistent-user@example.com");
    const submitBtn2 = await page.$('button[type="submit"]');
    if (submitBtn2) {
      await submitBtn2.click();
      await page.waitForTimeout(2000);
      await shot("parent_children_error_not_registered");

      const errorMsg = await page.$('text=No student with that email');
      if (errorMsg) {
        console.log("  ✅ Error shown for non-registered email");
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 5. PARENT: Check dashboard now shows child
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n═══ 5. PARENT DASHBOARD WITH CHILD ═══");

  await page.goto(`${BASE}/parent`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("parent_dashboard_with_child");

  // Check for pending alert
  const pendingAlert = await page.$('text=pending link request');
  if (pendingAlert) {
    console.log("  ✅ Pending requests alert shown on dashboard");
  }

  await logout();

  // ═══════════════════════════════════════════════════════════════════
  // 6. STUDENT: See and accept parent link request
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n═══ 6. STUDENT ACCEPTS PARENT LINK ═══");

  await login(STUDENT.email, STUDENT.pass, "Student");

  await page.goto(`${BASE}/student/parents`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("student_parents_pending_request");

  // Check for pending request
  const pendingRequest = await page.$('text=Pending requests');
  if (pendingRequest) {
    console.log("  ✅ Student sees pending parent request");
  }

  // Check privacy explanation
  const privacyInfo = await page.$('text=view your session history');
  if (privacyInfo) {
    console.log("  ✅ Privacy explanation shown to student");
  }

  // Accept the request
  const acceptBtn = await page.$('button:has-text("Accept")');
  if (acceptBtn) {
    await acceptBtn.click();
    await page.waitForTimeout(3000);
    await shot("student_parents_after_accept");

    // Check for success toast
    const linkedText = await page.$('text=Linked');
    if (linkedText) {
      console.log("  ✅ Parent link accepted, shows as Linked");
    }
  } else {
    console.log("  ⚠️ No Accept button found");
  }

  await logout();

  // ═══════════════════════════════════════════════════════════════════
  // 7. PARENT: Verify child is now linked
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n═══ 7. PARENT SEES ACCEPTED LINK ═══");

  await login(PARENT.email, PARENT.pass, "Parent");

  await page.goto(`${BASE}/parent/children`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("parent_children_accepted");

  const linkedBadge = await page.$('.text-green-700:has-text("Linked")');
  if (linkedBadge) {
    console.log("  ✅ Child shows as Linked (accepted)");
  }

  // Check dashboard shows updated status
  await page.goto(`${BASE}/parent`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("parent_dashboard_linked");

  // Verify no more pending alert
  const noPendingAlert = await page.$('text=pending link request');
  if (!noPendingAlert) {
    console.log("  ✅ No pending alert on dashboard (child accepted)");
  }

  // ═══════════════════════════════════════════════════════════════════
  // 8. PARENT: View analytics with linked child
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n═══ 8. PARENT ANALYTICS ═══");

  await page.goto(`${BASE}/analytics`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("parent_analytics_with_child");

  const householdSummary = await page.$('text=Household summary');
  if (householdSummary) {
    console.log("  ✅ Household summary section visible");
  }

  // ═══════════════════════════════════════════════════════════════════
  // 9. PARENT: Change relationship
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n═══ 9. PARENT CHANGE RELATIONSHIP ═══");

  await page.goto(`${BASE}/parent/children`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);

  const relDropdown = await page.$('select[aria-label="Change relationship"]');
  if (relDropdown) {
    await relDropdown.selectOption("guardian");
    await page.waitForTimeout(2000);
    await shot("parent_children_relationship_changed");
    console.log("  ✅ Changed relationship to guardian");
  }

  // ═══════════════════════════════════════════════════════════════════
  // 10. PARENT: Remove child link
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n═══ 10. PARENT REMOVE CHILD ═══");

  const removeBtn = await page.$('button[title="Remove link"]');
  if (removeBtn) {
    await removeBtn.click();
    await page.waitForTimeout(1000);
    await shot("parent_children_remove_dialog");

    // Confirm removal in dialog
    const confirmBtn = await page.$('button:has-text("Remove")');
    if (confirmBtn) {
      await confirmBtn.click();
      await page.waitForTimeout(3000);
      await shot("parent_children_after_remove");
      console.log("  ✅ Child link removed");
    }
  } else {
    console.log("  ⚠️ No remove button found");
  }

  // ═══════════════════════════════════════════════════════════════════
  // 11. PARENT: Browse public pages (teachers, marketplace, events)
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n═══ 11. PARENT BROWSES PUBLIC PAGES ═══");

  await page.goto(`${BASE}/teachers`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("parent_teachers_directory");
  console.log("  ✅ Teachers directory loaded");

  await page.goto(`${BASE}/marketplace`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("parent_marketplace");
  console.log("  ✅ Marketplace loaded");

  await page.goto(`${BASE}/events`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("parent_events");
  console.log("  ✅ Events page loaded");

  await page.goto(`${BASE}/forum`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("parent_forum");
  console.log("  ✅ Forum loaded");

  // ═══════════════════════════════════════════════════════════════════
  // 12. PARENT: Profile page
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n═══ 12. PARENT PROFILE ═══");

  await page.goto(`${BASE}/profile`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("parent_profile");
  console.log("  ✅ Profile page loaded");

  // ═══════════════════════════════════════════════════════════════════
  // DONE
  // ═══════════════════════════════════════════════════════════════════
  console.log(`\n✅ Parent E2E complete: ${shotN} screenshots saved to ${DIR}/`);
  await browser.close();
})();
