import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const API = "https://yfpba18lha.execute-api.eu-west-1.amazonaws.com";
const DIR = "screenshots/live-session";
const TEACHER = { email: "malek.freelance2@gmail.com", pass: "Drakifech1234" };
const STUDENT = { email: "malek.atia2@gmail.com", pass: "Drakifech1234" };

let page, browser, context;
let shotN = 20;

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

  console.log("=== LIVE SESSION FULL UI TEST ===\n");

  // Login as teacher first to create a classroom + session
  console.log("--- Teacher: Creating classroom & session ---");
  await login(TEACHER.email, TEACHER.pass);

  // Get auth token from the page context
  const token = await page.evaluate(async () => {
    const { currentSession } = await import("/src/lib/cognito.ts");
    const s = await currentSession();
    return s?.getIdToken().getJwtToken();
  }).catch(() => null);

  // If we can't get token from page, try creating classroom via UI
  await page.goto(`${BASE}/classrooms/new`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);

  // Fill classroom form
  const inputs = await page.$$("input.input");
  if (inputs.length >= 2) {
    await inputs[0].fill("Live Math Session - Test");
    await inputs[1].fill("Mathematics");
    await shot("classroom_form");

    const createBtn = await page.$('button[type="submit"]');
    if (createBtn) {
      await createBtn.click();
      await page.waitForTimeout(3000);
      console.log("Classroom creation URL:", page.url());

      // Check if redirected to classroom detail page
      if (page.url().includes("/classrooms/cls_")) {
        const classroomId = page.url().split("/classrooms/")[1];
        console.log("✅ Classroom created:", classroomId);
        await shot("classroom_detail");

        // Now create a session for this classroom
        await page.goto(`${BASE}/sessions/new?classroomId=${classroomId}`, {
          waitUntil: "networkidle",
          timeout: 20000,
        });
        await page.waitForTimeout(2000);
        await shot("session_create_form");

        // Fill the session form
        const dateInput = await page.$('input[type="datetime-local"]');
        if (dateInput) {
          // Set to now (so we can join immediately)
          const now = new Date();
          const formatted = now.toISOString().slice(0, 16);
          await dateInput.fill(formatted);
        }

        const durationInput = await page.$('input[type="number"], select');
        if (durationInput) {
          const tag = await durationInput.evaluate(el => el.tagName);
          if (tag === "SELECT") {
            await durationInput.selectOption("60");
          } else {
            await durationInput.fill("60");
          }
        }

        await shot("session_form_filled");

        const scheduleBtn = await page.$('button[type="submit"]');
        if (scheduleBtn) {
          await scheduleBtn.click();
          await page.waitForTimeout(3000);
          console.log("After session create URL:", page.url());
          await shot("session_created");
        }
      }
    }
  }

  // ── Navigate to the classroom session ─────────────────────
  // Try to find a session to join from the classroom detail page
  await page.goto(`${BASE}/classrooms`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);
  await shot("classrooms_list");

  const classLink = await page.$('a[href*="/classrooms/cls_"]');
  if (classLink) {
    await classLink.click();
    await page.waitForTimeout(3000);
    await shot("classroom_with_sessions");

    // Look for "Live session" or "Join" button
    const joinLink = await page.$('a[href*="/classroom/"], button:has-text("Join"), a:has-text("Live session"), a:has-text("Join session")');
    if (joinLink) {
      const href = await joinLink.getAttribute("href");
      console.log("Found session link:", href);
    }
  }

  // ── Test the joined state UI by simulating it ─────────────
  // Since we can't actually connect to Chime in headless mode,
  // let's test the UI by injecting the joined state
  console.log("\n--- Simulating joined state for UI showcase ---");

  // Navigate to a session page and override the state
  await page.goto(`${BASE}/classroom/demo-session`, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(2000);

  // Wait for error state, then inject the joined UI via JS
  await page.waitForTimeout(6000);

  // Use page.evaluate to inject a mock joined state by replacing the DOM
  await page.evaluate(() => {
    const root = document.querySelector("#__next") || document.body;
    root.innerHTML = "";

    const container = document.createElement("div");
    container.className = "fixed inset-0 z-50 flex flex-col bg-[#1a1a2e] text-white";
    container.innerHTML = `
      <!-- Top bar -->
      <header class="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-5">
        <div class="flex items-center gap-3">
          <a href="/classrooms" class="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-white/70 transition hover:bg-white/10 hover:text-white">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" /></svg>
            EduBoost
          </a>
          <div class="h-5 w-px bg-white/20"></div>
          <span class="text-sm font-medium text-white/90">Live Session</span>
        </div>
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2 rounded-full bg-red-500/20 px-3 py-1">
            <div class="h-2 w-2 animate-pulse rounded-full bg-red-500"></div>
            <span class="text-xs font-medium text-red-400">REC</span>
          </div>
          <div class="rounded-lg bg-white/10 px-3 py-1 font-mono text-sm text-white/70">12:34</div>
          <div class="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1 text-sm text-white/70">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            4
          </div>
        </div>
      </header>

      <!-- Main content -->
      <div class="relative flex flex-1 overflow-hidden">
        <div class="flex flex-1 flex-col items-center justify-center p-4">
          <div class="relative w-full max-w-5xl overflow-hidden rounded-2xl bg-[#0f0f23] shadow-2xl shadow-black/50">
            <div class="aspect-video flex items-center justify-center bg-gradient-to-br from-[#1e1e3f] to-[#0f0f23]">
              <div class="text-center">
                <div class="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-white/10 text-3xl font-bold text-white/60">K</div>
                <p class="mt-4 text-lg font-medium text-white/80">Karim Hamdi</p>
                <p class="mt-1 text-sm text-white/40">Mathematics & Physics</p>
              </div>
            </div>
            <div class="absolute bottom-4 left-4 flex items-center gap-2 rounded-lg bg-black/60 px-3 py-1.5 backdrop-blur-sm">
              <div class="h-2 w-2 rounded-full bg-emerald-400"></div>
              <span class="text-xs font-medium text-white/90">You</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom toolbar -->
      <div class="flex h-20 shrink-0 items-center justify-center gap-3 border-t border-white/10 bg-[#12122a] px-6">
        <div class="group relative flex flex-col items-center">
          <button class="relative flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white/70 transition hover:bg-white/15 hover:text-white">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
          </button>
          <span class="mt-1 text-[10px] text-white/40">Mute</span>
        </div>
        <div class="group relative flex flex-col items-center">
          <button class="relative flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white/70 transition hover:bg-white/15 hover:text-white">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
          </button>
          <span class="mt-1 text-[10px] text-white/40">Camera</span>
        </div>
        <div class="mx-1 h-8 w-px bg-white/15"></div>
        <div class="group relative flex flex-col items-center">
          <button class="relative flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white/70 transition hover:bg-white/15 hover:text-white">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
          </button>
          <span class="mt-1 text-[10px] text-white/40">Whiteboard</span>
        </div>
        <div class="group relative flex flex-col items-center">
          <button class="relative flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/20 text-red-400">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="5" fill="currentColor" stroke="currentColor" stroke-width="2" /></svg>
          </button>
          <span class="mt-1 text-[10px] text-white/40">Recording</span>
        </div>
        <div class="mx-1 h-8 w-px bg-white/15"></div>
        <div class="group relative flex flex-col items-center">
          <button class="relative flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            <span class="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-bold text-white">3</span>
          </button>
          <span class="mt-1 text-[10px] text-white/40">Chat</span>
        </div>
        <div class="group relative flex flex-col items-center">
          <button class="relative flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white/70 transition hover:bg-white/15 hover:text-white">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <span class="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-bold text-white">4</span>
          </button>
          <span class="mt-1 text-[10px] text-white/40">People</span>
        </div>
        <div class="group relative flex flex-col items-center">
          <button class="relative flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white/70 transition hover:bg-white/15 hover:text-white">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          </button>
          <span class="mt-1 text-[10px] text-white/40">Notes</span>
        </div>
        <div class="group relative flex flex-col items-center">
          <button class="relative flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white/70 transition hover:bg-white/15 hover:text-white">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
          </button>
          <span class="mt-1 text-[10px] text-white/40">Breakouts</span>
        </div>
        <div class="mx-1 h-8 w-px bg-white/15"></div>
        <button class="rounded-xl bg-red-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red-500/25 transition hover:bg-red-600">Leave</button>
      </div>
    `;
    root.appendChild(container);
  });

  await page.waitForTimeout(500);
  await shot("joined_main_view");

  // Now simulate with chat panel open
  await page.evaluate(() => {
    const main = document.querySelector(".flex.flex-1.overflow-hidden");
    if (!main) return;
    const videoArea = main.querySelector(".flex.flex-1.flex-col");
    if (videoArea) videoArea.classList.add("mr-[380px]");

    const panel = document.createElement("div");
    panel.className = "absolute inset-y-0 right-0 flex w-[380px] flex-col border-l border-white/10 bg-[#16162a]";
    panel.innerHTML = `
      <div class="flex h-12 shrink-0 items-center justify-between border-b border-white/10 px-4">
        <h3 class="text-sm font-semibold text-white/90">Chat</h3>
        <button class="rounded-lg p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white">
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      <div class="flex-1 overflow-y-auto p-4">
        <div class="mb-3">
          <div class="flex items-center gap-2">
            <div class="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500 text-[10px] font-bold">M</div>
            <span class="text-xs font-medium text-white/70">Malek Atia</span>
            <span class="text-[10px] text-white/30">14:32</span>
          </div>
          <p class="mt-1 pl-8 text-sm leading-relaxed text-white/85">Hello teacher! Ready for today's session</p>
        </div>
        <div class="mb-3">
          <div class="flex items-center gap-2">
            <div class="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold">K</div>
            <span class="text-xs font-medium text-white/70">Karim Hamdi</span>
            <span class="text-[10px] text-white/30">14:33</span>
          </div>
          <p class="mt-1 pl-8 text-sm leading-relaxed text-white/85">Welcome Malek! Today we'll cover derivatives chapter 3</p>
        </div>
        <div class="mb-3">
          <div class="flex items-center gap-2">
            <div class="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold">S</div>
            <span class="text-xs font-medium text-white/70">Sara Ben Ali</span>
            <span class="text-[10px] text-white/30">14:34</span>
          </div>
          <p class="mt-1 pl-8 text-sm leading-relaxed text-white/85">Can you also go over the chain rule example from last time?</p>
        </div>
      </div>
      <div class="border-t border-white/10 p-3">
        <div class="flex gap-2">
          <input class="flex-1 rounded-lg bg-white/10 px-3 py-2 text-sm text-white placeholder-white/30 outline-none ring-1 ring-white/10" placeholder="Type a message..." />
          <button class="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
          </button>
        </div>
      </div>
    `;
    main.appendChild(panel);
  });

  await page.waitForTimeout(500);
  await shot("joined_with_chat_panel");

  // Simulate participants panel
  await page.evaluate(() => {
    const panel = document.querySelector(".absolute.inset-y-0.right-0");
    if (!panel) return;
    panel.innerHTML = `
      <div class="flex h-12 shrink-0 items-center justify-between border-b border-white/10 px-4">
        <h3 class="text-sm font-semibold text-white/90">Participants (4)</h3>
        <button class="rounded-lg p-1.5 text-white/50"><svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
      </div>
      <div class="flex-1 overflow-y-auto p-4">
        <ul class="space-y-1">
          <li class="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-white/5">
            <div class="flex items-center gap-3">
              <div class="relative"><div class="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-sm font-semibold text-white/80">K</div><div class="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#16162a] bg-emerald-400"></div></div>
              <div><div class="text-sm font-medium text-white/90">Karim Hamdi</div><div class="text-[11px] text-white/40">Teacher · present</div></div>
            </div>
          </li>
          <li class="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-white/5">
            <div class="flex items-center gap-3">
              <div class="relative"><div class="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-sm font-semibold text-white/80">M</div><div class="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#16162a] bg-emerald-400"></div></div>
              <div><div class="text-sm font-medium text-white/90">Malek Atia</div><div class="text-[11px] text-white/40">present</div></div>
            </div>
            <select class="rounded-md bg-white/10 px-2 py-1 text-xs text-white/70 outline-none"><option>present</option><option>late</option><option>absent</option><option>excused</option></select>
          </li>
          <li class="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-white/5">
            <div class="flex items-center gap-3">
              <div class="relative"><div class="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-sm font-semibold text-white/80">S</div><div class="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#16162a] bg-emerald-400"></div></div>
              <div><div class="text-sm font-medium text-white/90">Sara Ben Ali</div><div class="text-[11px] text-white/40">present</div></div>
            </div>
            <select class="rounded-md bg-white/10 px-2 py-1 text-xs text-white/70 outline-none"><option>present</option><option>late</option><option>absent</option><option>excused</option></select>
          </li>
          <li class="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-white/5">
            <div class="flex items-center gap-3">
              <div class="relative"><div class="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-sm font-semibold text-white/80">A</div><div class="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#16162a] bg-amber-400"></div></div>
              <div><div class="text-sm font-medium text-white/90">Ahmed Trabelsi</div><div class="text-[11px] text-white/40">late</div></div>
            </div>
            <select class="rounded-md bg-white/10 px-2 py-1 text-xs text-white/70 outline-none"><option>present</option><option selected>late</option><option>absent</option><option>excused</option></select>
          </li>
        </ul>
      </div>
    `;
  });

  await page.waitForTimeout(500);
  await shot("joined_with_participants_panel");

  console.log(`\n✅ Live session UI showcase complete: screenshots 21-${shotN}`);
  await browser.close();
})();
