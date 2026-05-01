// Two-role tour: log in as the dedicated student account, snap their
// space; then log in as the dedicated teacher account, snap their space.
// Output lands in tests/integration/screenshots/student/ and /teacher/.
//
// Use these to compare the two role experiences side-by-side or hand them
// to design / product for review without spinning up two browsers manually.

import { afterAll, beforeAll, describe, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const WEB_URL = "https://d29jvbfa3ftzxl.cloudfront.net";

let browser: Browser | null = null;

beforeAll(async () => {
  browser = await chromium.launch();
}, 30_000);

afterAll(async () => {
  if (browser) await browser.close().catch(() => {});
});

type RoleSpec = {
  label: "student" | "teacher";
  email: string;
  password: string;
  // Pages each role can meaningfully visit. Routes a role can't see (e.g.
  // /teacher for a student) get redirected to /dashboard, which still
  // produces a useful screenshot but isn't the page we asked for.
  pages: { url: string; label: string }[];
};

async function login(p: Page, email: string, password: string) {
  await p.goto(`${WEB_URL}/login`, { waitUntil: "domcontentloaded" });
  // Wait for hydration so the React onSubmit handler is wired before we
  // click — otherwise the button falls back to a native form submit.
  await p.waitForFunction(
    () => !!document.querySelector('button[type="submit"]'),
    undefined,
    { timeout: 10_000 },
  );
  await p.waitForTimeout(500);
  await p.fill('input[type="email"]', email);
  await p.fill('input[type="password"]', password);
  await Promise.all([
    p
      .waitForURL(/\/dashboard|\/teacher|\/parent|\/student/, { timeout: 40_000 })
      .catch(async () => {
        await p.fill('input[type="password"]', password);
        await p.click('button[type="submit"]');
        await p.waitForURL(/\/dashboard|\/teacher|\/parent|\/student/, {
          timeout: 30_000,
        });
      }),
    p.click('button[type="submit"]'),
  ]);
  await p.waitForTimeout(1500);
}

async function tour(role: RoleSpec) {
  if (!browser) throw new Error("no browser");
  const dir = resolve(here, "screenshots", role.label);
  mkdirSync(dir, { recursive: true });

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  let counter = 0;
  const indexLines: string[] = [];

  try {
    await login(page, role.email, role.password);

    // Capture the post-login landing page first — that's the role-aware
    // redirect destination (Teacher space / Student space / Dashboard).
    counter += 1;
    const landingFile = `${String(counter).padStart(2, "0")}-${role.label}-landing.png`;
    await page.screenshot({ path: resolve(dir, landingFile), fullPage: true });
    indexLines.push(`${landingFile} | ${page.url()} | post-login landing`);
    console.log(`[${role.label}] ${landingFile} (${page.url()})`);

    for (const target of role.pages) {
      try {
        await page.goto(`${WEB_URL}${target.url}`, {
          waitUntil: "domcontentloaded",
          timeout: 30_000,
        });
        // Some pages (calendar, notifications) keep polling — domcontentloaded
        // is enough; we just wait briefly for the lazy data load to render.
        await page.waitForTimeout(1500);
        counter += 1;
        const safe = target.label.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
        const file = `${String(counter).padStart(2, "0")}-${role.label}-${safe}.png`;
        await page.screenshot({ path: resolve(dir, file), fullPage: true });
        const finalUrl = page.url();
        indexLines.push(`${file} | ${finalUrl} | ${target.label}`);
        console.log(
          `[${role.label}] ${file}${finalUrl !== `${WEB_URL}${target.url}` ? ` (redirected → ${finalUrl})` : ""}`,
        );
      } catch (err) {
        console.log(`[${role.label}] FAILED ${target.url}: ${(err as Error).message}`);
      }
    }
  } finally {
    writeFileSync(
      resolve(dir, "INDEX.txt"),
      `EduBoost ${role.label} space tour — ${new Date().toISOString()}\n` +
        `account: ${role.email}\n` +
        `${counter} screenshots\n\n` +
        indexLines.join("\n") + "\n",
      "utf8",
    );
    await ctx.close();
  }
}

describe("Two-role tour", () => {
  it("snaps the student space", async () => {
    await tour({
      label: "student",
      email: process.env.EDUBOOST_STUDENT_EMAIL!,
      password: process.env.EDUBOOST_STUDENT_PASSWORD!,
      pages: [
        { url: "/student", label: "student-space-hub" },
        { url: "/dashboard", label: "dashboard-with-sidebar" },
        { url: "/profile", label: "my-profile" },
        { url: "/classrooms", label: "my-classrooms" },
        { url: "/teachers", label: "find-a-teacher" },
        { url: "/bookings", label: "my-bookings" },
        { url: "/requests", label: "lesson-requests" },
        { url: "/calendar", label: "my-calendar" },
        { url: "/payments", label: "payments-history" },
        { url: "/orders", label: "my-orders" },
        { url: "/grades", label: "my-grades" },
        { url: "/attendance", label: "my-attendance" },
        { url: "/notes", label: "session-notes" },
        { url: "/favorites", label: "favorites" },
        { url: "/student/parents", label: "my-parents" },
        { url: "/assessments", label: "exams-and-quizzes" },
        { url: "/study-materials", label: "study-materials" },
        { url: "/membership", label: "premium-membership" },
        { url: "/mailbox", label: "mailbox" },
        { url: "/notifications", label: "notifications" },
        { url: "/forum", label: "forum" },
        { url: "/events", label: "events" },
        { url: "/marketplace", label: "marketplace" },
        { url: "/referrals", label: "invite-a-friend" },
        { url: "/support", label: "support-tickets" },
        { url: "/support/new", label: "file-a-dispute" },
        { url: "/settings/sms", label: "sms-reminders" },
        { url: "/settings/google", label: "google-calendar" },
        { url: "/analytics", label: "analytics-shared-with-tos" },
      ],
    });
  }, 600_000);

  it("snaps the teacher space", async () => {
    await tour({
      label: "teacher",
      email: process.env.EDUBOOST_TEACHER_EMAIL!,
      password: process.env.EDUBOOST_TEACHER_PASSWORD!,
      pages: [
        { url: "/teacher", label: "teacher-space-hub" },
        { url: "/dashboard", label: "dashboard-with-sidebar" },
        { url: "/teacher/profile", label: "edit-teacher-profile" },
        { url: "/profile", label: "my-account-profile" },
        { url: "/classrooms", label: "my-classrooms" },
        { url: "/classrooms/new", label: "new-classroom-form" },
        { url: "/teacher/students", label: "my-students" },
        { url: "/teacher/bookings", label: "teacher-bookings" },
        { url: "/requests", label: "lesson-requests-incoming" },
        { url: "/calendar", label: "my-calendar" },
        { url: "/attendance", label: "attendance" },
        { url: "/notes", label: "session-notes-cross" },
        { url: "/assessments", label: "assessments-list" },
        { url: "/assessments/new", label: "new-assessment-form" },
        { url: "/grades", label: "grades-given" },
        { url: "/teacher/grader", label: "ai-grader" },
        { url: "/study-materials", label: "study-materials" },
        { url: "/study-materials/new", label: "share-a-document" },
        { url: "/seller/listings", label: "marketplace-listings" },
        { url: "/seller/listings/new", label: "new-listing-form" },
        { url: "/seller/orders", label: "marketplace-sales" },
        { url: "/teacher/earnings", label: "earnings" },
        { url: "/payments", label: "payments-received" },
        { url: "/membership", label: "membership-pro" },
        { url: "/events", label: "events-feed" },
        { url: "/events/new", label: "new-event-form" },
        { url: "/orgs", label: "organizations" },
        { url: "/forum", label: "forum" },
        { url: "/mailbox", label: "mailbox" },
        { url: "/notifications", label: "notifications" },
        { url: "/favorites", label: "favorites" },
        { url: "/analytics", label: "analytics" },
        { url: "/referrals", label: "invite-a-friend" },
        { url: "/support", label: "support-tickets" },
        { url: "/support/new", label: "file-a-ticket" },
        { url: "/settings/sms", label: "sms-reminders" },
        { url: "/settings/google", label: "google-calendar" },
      ],
    });
  }, 900_000);
});
