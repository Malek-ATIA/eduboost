// End-to-end browser test: drives a real Chromium instance through the
// full live-session flow exactly the way a teacher would.
//
//   1. Pre-create a throwaway classroom + future session via the API
//      (skips the Schedule form so we test the meeting itself, not form UX).
//   2. Launch headless Chromium with fake camera + microphone so the
//      Chime SDK has devices to bind to.
//   3. Log in via the /login form with the .env.test credentials.
//   4. Navigate to /classroom/[sessionId].
//   5. Wait for the on-page "Status: joined" indicator — that's the React
//      state set after the Chime SDK reports MeetingConnected. If it
//      appears, the browser successfully created a WebRTC + WebSocket
//      session against AWS Chime.
//   6. Snapshot the page and tear down: end the meeting via the API so we
//      don't leak an active Chime meeting.
//
// Cost note: same as the chime integration suite — ~$0.001 per run.

import { afterAll, describe, it, expect, beforeAll } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { api, session } from "./api";

const here = dirname(fileURLToPath(import.meta.url));
const WEB_URL = "https://d29jvbfa3ftzxl.cloudfront.net";
const SHOTS_DIR = resolve(here, "screenshots");
mkdirSync(SHOTS_DIR, { recursive: true });

let shotCounter = 0;
async function snap(p: Page, label: string): Promise<string> {
  shotCounter += 1;
  const safe = label.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
  const path = resolve(SHOTS_DIR, `${String(shotCounter).padStart(2, "0")}-${safe}.png`);
  await p.screenshot({ path, fullPage: true });
  console.log(`[shot] ${path}`);
  return path;
}

let browser: Browser | null = null;
let page: Page | null = null;
let classroomId: string | null = null;
let sessionId: string | null = null;
const consoleErrors: string[] = [];

beforeAll(async () => {
  // Set up the classroom + session via API first — this is faster and more
  // deterministic than driving forms for setup data.
  const cls = await api<{ classroomId: string; teacherId: string }>(
    "/classrooms",
    {
      method: "POST",
      body: {
        title: `[E2E ${Date.now()}] Live-session smoke`,
        subject: "Mathematics",
        description: "Throwaway classroom for the e2e browser suite.",
        maxStudents: 2,
      },
    },
  );
  if (!cls.ok) throw new Error("classroom create failed");
  classroomId = cls.data.classroomId;

  const sessRes = await api<{ sessionId: string; classroomId: string }>(
    "/sessions",
    {
      method: "POST",
      body: {
        classroomId,
        startsAt: new Date(Date.now() + 60_000).toISOString(),
        endsAt: new Date(Date.now() + 3_600_000).toISOString(),
        title: "[E2E] live-session smoke",
      },
    },
  );
  if (!sessRes.ok) throw new Error("session create failed");
  sessionId = sessRes.data.sessionId;

  // Chromium with fake camera + mic permissions so Chime SDK has devices
  // to bind to. Without these flags, getUserMedia would block on a real
  // device-permission prompt that never resolves in headless mode.
  browser = await chromium.launch({
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "--autoplay-policy=no-user-gesture-required",
    ],
  });
}, 60_000);

afterAll(async () => {
  // Clean up the live Chime meeting first — even if a test failed.
  if (sessionId) {
    try {
      await api(`/chime/sessions/${sessionId}/end`, {
        method: "POST",
        expectError: true,
      });
    } catch {
      /* best-effort */
    }
  }
  if (page) await page.close().catch(() => {});
  if (browser) await browser.close().catch(() => {});
});

describe("E2E browser — live session", () => {
  it("logs in via the form and lands on the dashboard", async () => {
    if (!browser) throw new Error("browser not launched");
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      // Pre-grant camera + mic at the browser-context layer too so the
      // app's permission requests resolve immediately.
      permissions: ["camera", "microphone"],
    });
    page = await ctx.newPage();

    page.on("pageerror", (e) => consoleErrors.push(`[pageerror] ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(`[console.error] ${m.text()}`);
    });

    await page.goto(`${WEB_URL}/login`, { waitUntil: "domcontentloaded" });
    await snap(page, "login-form");
    await page.fill('input[type="email"]', process.env.EDUBOOST_TEST_EMAIL!);
    await page.fill('input[type="password"]', process.env.EDUBOOST_TEST_PASSWORD!);
    await snap(page, "login-form-filled");
    await Promise.all([
      page.waitForURL(/\/dashboard|\/teacher|\/parent|\/student/, {
        timeout: 20_000,
      }),
      page.click('button[type="submit"]'),
    ]);
    expect(page.url()).toMatch(/\/dashboard|\/teacher|\/parent|\/student/);
    // Give the role-aware redirect a moment to settle and the role-space
    // hub to render its sections.
    await page.waitForTimeout(1000);
    await snap(page, "after-login-teacher-space");
  }, 60_000);

  it("opens the classroom session page and Chime reaches Status: joined", async () => {
    if (!page || !sessionId) throw new Error("no page/session");
    await page.goto(`${WEB_URL}/classroom/${sessionId}`, {
      waitUntil: "domcontentloaded",
    });
    await snap(page, "classroom-loading");

    // Wait for the page to display "Status: joining" briefly...
    await page.waitForFunction(
      () => /Status:\s*(joining|joined)/i.test(document.body.innerText),
      undefined,
      { timeout: 10_000 },
    );
    await snap(page, "classroom-joining");

    // ...then "Status: joined" once Chime's MeetingConnected event fires.
    await page.waitForFunction(
      () => /Status:\s*joined/i.test(document.body.innerText),
      undefined,
      { timeout: 30_000 },
    );
    // Give the SDK a beat to attach the local video tile so the screenshot
    // shows the fake-camera frame instead of a blank box.
    await page.waitForTimeout(2000);
    await snap(page, "classroom-joined-fullpage");

    const videoEl = await page.locator("video").count();
    expect(videoEl).toBeGreaterThan(0);
  }, 60_000);

  it("scrolls down to capture the my-notes panel + breakouts/attendance section", async () => {
    if (!page) throw new Error("no page");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(500);
    await snap(page, "classroom-mid-scroll");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await snap(page, "classroom-bottom-scroll");
  }, 30_000);

  it("writes the test URL alongside screenshots for traceability", async () => {
    if (!page) throw new Error("no page");
    writeFileSync(
      resolve(SHOTS_DIR, "session-url.txt"),
      `${page.url()}\nclassroomId=${classroomId}\nsessionId=${sessionId}\nshotCount=${shotCounter}\n`,
      "utf8",
    );
  });

  it("page emitted no fatal console errors during the session", () => {
    // Filter out two known-harmless noise sources:
    //  - React DevTools probe (inspector.js — only fires when the user has
    //    the extension installed; never in CI Chromium)
    //  - 404 favicon (we ship icon.svg via app/icon.svg, but Safari + some
    //    Chromiums still probe /favicon.ico)
    const fatal = consoleErrors.filter(
      (e) =>
        !e.includes("inspector.js") &&
        !e.includes("favicon.ico") &&
        !e.includes("Failed to load resource: the server responded with a status of 404"),
    );
    if (fatal.length > 0) {
      console.log("[e2e] non-fatal errors collected:", consoleErrors);
      console.log("[e2e] fatal errors that failed the test:", fatal);
    }
    expect(fatal).toEqual([]);
  });
});
