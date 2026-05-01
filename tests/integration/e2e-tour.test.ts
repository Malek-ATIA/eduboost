// Visual tour of the app — captures full-page screenshots of every public
// surface AND every signed-in surface that doesn't require a live Chime
// session. Output lands in tests/integration/screenshots/tour-*.png. Use
// these as proof-of-life or to spot UI regressions before deploy.

import { afterAll, beforeAll, describe, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const WEB_URL = "https://d29jvbfa3ftzxl.cloudfront.net";
const TOUR_DIR = resolve(here, "screenshots", "tour");
mkdirSync(TOUR_DIR, { recursive: true });

let browser: Browser | null = null;
let page: Page | null = null;
let counter = 0;
const indexLines: string[] = [];

async function snap(p: Page, group: "public" | "auth", url: string, label: string) {
  counter += 1;
  const safe = label.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
  const file = `${String(counter).padStart(2, "0")}-${group}-${safe}.png`;
  const path = resolve(TOUR_DIR, file);
  // Land on the URL, give Next.js + lazy data fetches a beat to settle,
  // then full-page snapshot.
  await p.goto(`${WEB_URL}${url}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await p.waitForTimeout(1500);
  await p.screenshot({ path, fullPage: true });
  indexLines.push(`${file} | ${group} | ${url} | ${label}`);
  console.log(`[tour] ${file}`);
}

beforeAll(async () => {
  browser = await chromium.launch();
}, 30_000);

afterAll(async () => {
  if (page) await page.close().catch(() => {});
  if (browser) await browser.close().catch(() => {});
  writeFileSync(
    resolve(TOUR_DIR, "INDEX.txt"),
    `EduBoost UI tour — ${new Date().toISOString()}\n` +
      `${counter} screenshots\n\n` +
      indexLines.join("\n") + "\n",
    "utf8",
  );
});

describe("Visual tour — public pages (anonymous browser)", () => {
  it("snaps every page a logged-out visitor would see", async () => {
    if (!browser) throw new Error("no browser");
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    page = await ctx.newPage();

    await snap(page, "public", "/", "landing");
    await snap(page, "public", "/teachers", "teachers-directory");
    await snap(page, "public", "/teachers/seed_teacher_leila", "teacher-detail-leila");
    await snap(page, "public", "/teachers/seed_teacher_karim", "teacher-detail-karim");
    await snap(page, "public", "/marketplace", "marketplace");
    await snap(page, "public", "/marketplace/listings/lst_seed_bac_math_papers", "marketplace-detail-papers");
    await snap(page, "public", "/marketplace/listings/lst_seed_physics_workbook", "marketplace-detail-workbook");
    await snap(page, "public", "/events", "events-list");
    await snap(page, "public", "/forum", "forum-channels");
    await snap(page, "public", "/forum/posts/post_seed_integration_by_parts", "forum-post-liate");
    await snap(page, "public", "/forum/posts/post_seed_no_shows", "forum-post-noshows");
    await snap(page, "public", "/study-materials", "study-materials");
    await snap(page, "public", "/faq", "faq");
    await snap(page, "public", "/login", "login");
    await snap(page, "public", "/signup", "signup");
    await snap(page, "public", "/terms", "terms");
    await snap(page, "public", "/code-of-conduct", "code-of-conduct");

    await ctx.close();
    page = null;
  }, 240_000);
});

describe("Visual tour — signed-in pages (teacher account)", () => {
  it("logs in and snaps every authenticated surface", async () => {
    if (!browser) throw new Error("no browser");
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    page = await ctx.newPage();

    // Drive the login form once; remaining navigations reuse the session
    // localStorage. Wait for full network-idle so React has hydrated and
    // the form's onSubmit handler is wired before we click — otherwise the
    // button can fall back to a native form submit that just reloads /login.
    await page.goto(`${WEB_URL}/login`, { waitUntil: "domcontentloaded" });
    // Wait for hydration so the React onSubmit handler is wired before we
    // click — otherwise the button falls back to a native form submit that
    // just reloads /login.
    await page.waitForFunction(
      () => !!document.querySelector('button[type="submit"]'),
      undefined,
      { timeout: 10_000 },
    );
    await page.waitForTimeout(500);
    await page.fill('input[type="email"]', process.env.EDUBOOST_TEST_EMAIL!);
    await page.fill('input[type="password"]', process.env.EDUBOOST_TEST_PASSWORD!);
    // Click + wait for navigation, with a longer timeout to ride out
    // Cognito + redirect chain.
    await Promise.all([
      page
        .waitForURL(/\/dashboard|\/teacher|\/parent|\/student/, { timeout: 40_000 })
        .catch(async () => {
          // Retry once if the first click didn't redirect — sometimes the
          // form's React handler isn't bound yet on a cold context.
          await page.fill('input[type="password"]', process.env.EDUBOOST_TEST_PASSWORD!);
          await page.click('button[type="submit"]');
          await page.waitForURL(
            /\/dashboard|\/teacher|\/parent|\/student/,
            { timeout: 30_000 },
          );
        }),
      page.click('button[type="submit"]'),
    ]);
    await page.waitForTimeout(1500);

    // Hubs + role spaces
    await snap(page, "auth", "/teacher", "teacher-space-hub");
    await snap(page, "auth", "/dashboard", "dashboard-with-sidebar");
    await snap(page, "auth", "/profile", "my-profile");
    await snap(page, "auth", "/teacher/profile", "teacher-edit-profile");
    await snap(page, "auth", "/teacher/students", "my-students");

    // Classroom portal
    await snap(page, "auth", "/classrooms", "my-classrooms");
    await snap(page, "auth", "/classrooms/new", "new-classroom-form");

    // Communication
    await snap(page, "auth", "/mailbox", "mailbox");
    await snap(page, "auth", "/notifications", "notifications");

    // Study materials portal
    await snap(page, "auth", "/assessments", "assessments-list");
    await snap(page, "auth", "/assessments/new", "new-assessment-form");
    await snap(page, "auth", "/grades", "grades");
    await snap(page, "auth", "/teacher/grader", "ai-grader");

    // Marketplace (teacher side)
    await snap(page, "auth", "/seller/listings", "seller-listings");
    await snap(page, "auth", "/seller/listings/new", "new-listing-form");
    await snap(page, "auth", "/seller/orders", "seller-orders");

    // Money
    await snap(page, "auth", "/payments", "payments-history");
    await snap(page, "auth", "/teacher/earnings", "teacher-earnings");
    await snap(page, "auth", "/membership", "membership-plans");

    // Calendar / reminders
    await snap(page, "auth", "/calendar", "calendar");
    await snap(page, "auth", "/settings/sms", "sms-settings");
    await snap(page, "auth", "/settings/google", "google-calendar-settings");

    // Community + analytics + favorites
    await snap(page, "auth", "/favorites", "favorites");
    await snap(page, "auth", "/analytics", "analytics");
    await snap(page, "auth", "/orgs", "organizations");
    await snap(page, "auth", "/referrals", "referrals");

    // Support
    await snap(page, "auth", "/support", "support-tickets");
    await snap(page, "auth", "/support/new", "new-support-ticket");

    // Events authoring
    await snap(page, "auth", "/events/new", "new-event-form");

    // Bookings + lesson requests
    await snap(page, "auth", "/bookings", "bookings");
    await snap(page, "auth", "/requests", "lesson-requests");

    await ctx.close();
    page = null;
  }, 600_000);
});
