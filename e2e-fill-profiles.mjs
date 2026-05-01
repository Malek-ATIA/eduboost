import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const DIR = "screenshots/fill-profiles";

const STUDENT = { email: "malek.atia2@gmail.com", pass: "Drakifech1234" };
const TEACHER = { email: "malek.freelance2@gmail.com", pass: "Drakifech1234" };

let page, browser, context;
let shotN = 0;

async function shot(name) {
  shotN++;
  const path = `${DIR}/${String(shotN).padStart(2, "0")}_${name}.png`;
  await page.screenshot({ path, fullPage: true });
  console.log(`📸 ${path}`);
  return path;
}

async function login(email, pass) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.fill('input[type="email"], input[name="email"]', email);
  await page.fill('input[type="password"], input[name="password"]', pass);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);
}

async function logout() {
  // Use avatar dropdown to sign out
  const avatarBtn = await page.$('button[aria-label="Account menu"]');
  if (avatarBtn) {
    await avatarBtn.click();
    await page.waitForTimeout(500);
    const signOutBtn = await page.$('button:has-text("Log out"), button:has-text("Sign out")');
    if (signOutBtn) {
      await signOutBtn.click();
      await page.waitForTimeout(3000);
      return;
    }
  }
  // Fallback: navigate to login directly and clear cookies
  await context.clearCookies();
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);
}

(async () => {
  const { mkdirSync } = await import("fs");
  mkdirSync(DIR, { recursive: true });

  browser = await chromium.launch({ headless: true });
  context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await context.newPage();

  // ══════════════════════════════════════════════════════════════
  // PART 1: STUDENT PROFILE
  // ══════════════════════════════════════════════════════════════
  console.log("\n=== FILLING STUDENT PROFILE ===");
  await login(STUDENT.email, STUDENT.pass);
  await shot("student_logged_in");

  // Go to profile page
  await page.goto(`${BASE}/profile`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);
  await shot("student_profile_before");

  // Fill display name
  const studentNameInput = await page.$('input[maxlength="100"]');
  if (studentNameInput) {
    await studentNameInput.fill("");
    await studentNameInput.fill("Malek Atia");
    console.log("✅ Set student display name: Malek Atia");
  }
  await shot("student_profile_filled");

  // Save account
  const saveBtn = await page.$('button:has-text("Save profile")');
  if (saveBtn) {
    await saveBtn.click();
    await page.waitForTimeout(2000);
    console.log("✅ Saved student profile");
  }
  await shot("student_profile_saved");

  // Log out
  await logout();
  console.log("✅ Logged out student");

  // ══════════════════════════════════════════════════════════════
  // PART 2: TEACHER PROFILE
  // ══════════════════════════════════════════════════════════════
  console.log("\n=== FILLING TEACHER PROFILE ===");
  await login(TEACHER.email, TEACHER.pass);
  await shot("teacher_logged_in");

  // Go to profile page
  await page.goto(`${BASE}/profile`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("teacher_profile_before");

  // Fill display name
  const teacherNameInput = await page.$('input[maxlength="100"]');
  if (teacherNameInput) {
    await teacherNameInput.fill("");
    await teacherNameInput.fill("Karim Hamdi");
    console.log("✅ Set teacher display name: Karim Hamdi");
  }

  // Save display name first
  const saveAccountBtn = await page.$('button:has-text("Save profile")');
  if (saveAccountBtn) {
    await saveAccountBtn.click();
    await page.waitForTimeout(2000);
    console.log("✅ Saved teacher display name");
  }
  await shot("teacher_name_saved");

  // Now fill the teacher profile form
  // Bio
  const bioTextarea = await page.$('textarea');
  if (bioTextarea) {
    await bioTextarea.fill("");
    await bioTextarea.fill(
      "Passionate mathematics and physics teacher with 8 years of experience. I specialize in preparing students for the Baccalaureate exam with a focus on building strong problem-solving skills. My teaching approach combines clear explanations with practical exercises to ensure deep understanding."
    );
    console.log("✅ Set bio");
  }

  // Subjects
  const allInputs = await page.$$('input.input');
  // The inputs after the textarea in the teacher form:
  // subjects, languages, years exp, hourly rate, city, country

  // Find subjects input by placeholder
  const subjectsInput = await page.$('input[placeholder="Mathematics, Physics, Chemistry"]');
  if (subjectsInput) {
    await subjectsInput.fill("");
    await subjectsInput.fill("Mathematics, Physics, Science");
    console.log("✅ Set subjects");
  }

  // Languages
  const languagesInput = await page.$('input[placeholder="English, French, Arabic"]');
  if (languagesInput) {
    await languagesInput.fill("");
    await languagesInput.fill("Arabic, French, English");
    console.log("✅ Set languages");
  }

  // Years experience
  const yearsInput = await page.$('input[type="number"][min="0"][max="80"]');
  if (yearsInput) {
    await yearsInput.fill("");
    await yearsInput.fill("8");
    console.log("✅ Set years experience: 8");
  }

  // Hourly rate
  const rateInput = await page.$('input[type="number"][step="0.001"]');
  if (rateInput) {
    await rateInput.fill("");
    await rateInput.fill("55");
    console.log("✅ Set hourly rate: 55 TND");
  }

  // City
  const cityInput = await page.$('input[placeholder="Tunis"]');
  if (cityInput) {
    await cityInput.fill("");
    await cityInput.fill("Tunis");
    console.log("✅ Set city: Tunis");
  }

  // Country
  const countryInput = await page.$('input[placeholder="TN"]');
  if (countryInput) {
    await countryInput.fill("");
    await countryInput.fill("TN");
    console.log("✅ Set country: TN");
  }

  // Session type checkboxes
  const trialCheckbox = await page.$('input[type="checkbox"]:near(:text("Offer a free trial session"))');
  if (trialCheckbox) {
    const isChecked = await trialCheckbox.isChecked();
    if (!isChecked) {
      await trialCheckbox.check();
      console.log("✅ Enabled trial sessions");
    }
  }

  const individualCheckbox = await page.$('input[type="checkbox"]:near(:text("Offer 1-on-1 individual sessions"))');
  if (individualCheckbox) {
    const isChecked = await individualCheckbox.isChecked();
    if (!isChecked) {
      await individualCheckbox.check();
      console.log("✅ Enabled individual sessions");
    }
  }

  const groupCheckbox = await page.$('input[type="checkbox"]:near(:text("Offer group sessions"))');
  if (groupCheckbox) {
    const isChecked = await groupCheckbox.isChecked();
    if (!isChecked) {
      await groupCheckbox.check();
      console.log("✅ Enabled group sessions");
    }
  }

  await shot("teacher_profile_filled");

  // Save teacher profile
  const saveTeacherBtn = await page.$('button:has-text("Save teacher profile")');
  if (saveTeacherBtn) {
    await saveTeacherBtn.click();
    await page.waitForTimeout(3000);
    console.log("✅ Saved teacher profile");
  }
  await shot("teacher_profile_saved");

  // Scroll up to verify saved state
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  await shot("teacher_profile_top_after_save");

  // Now verify the teacher's public profile looks good
  await page.goto(`${BASE}/teachers`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("teachers_directory_after_fill");

  // Click on the teacher to see their full profile
  const teacherLink = await page.$('a[href*="/teachers/"]');
  if (teacherLink) {
    await teacherLink.click();
    await page.waitForTimeout(3000);
    await shot("teacher_public_profile_after_fill");
  }

  console.log(`\n✅ Profile fill complete: ${shotN} screenshots taken`);
  console.log("Screenshots saved to:", DIR);
  await browser.close();
})();
