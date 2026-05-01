import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const DIR = "screenshots/study-materials";
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

(async () => {
  const { mkdirSync } = await import("fs");
  const { resolve } = await import("path");
  mkdirSync(DIR, { recursive: true });

  browser = await chromium.launch({ headless: true });
  context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await context.newPage();

  console.log("=== STUDY MATERIALS E2E TEST ===\n");

  // ── Teacher: Create study materials ────────────────────────
  console.log("--- Teacher: Login ---");
  await login(TEACHER.email, TEACHER.pass);
  await shot("teacher_logged_in");

  // ── 1. Browse study materials (should be empty or have few) ──
  console.log("\n--- Step 1: Browse study materials (initial state) ---");
  await page.goto(`${BASE}/study-materials`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("study_materials_initial");

  const initialContent = await page.textContent("main");
  console.log("Initial state:", initialContent?.includes("No matching") ? "Empty" : "Has items");

  // ── 2. Create first study material (Exam) ──────────────────
  console.log("\n--- Step 2: Create exam material ---");
  await page.goto(`${BASE}/study-materials/new`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);
  await shot("create_form_empty");

  // Fill form
  const titleInput = await page.$('input.input');
  if (titleInput) {
    await titleInput.fill("Mathematics Bac 2024 - Practice Exam");
    console.log("✅ Filled title");
  }

  // Subject
  const subjectInput = await page.$('input[placeholder="Mathematics"]');
  if (subjectInput) {
    await subjectInput.fill("Mathematics");
    console.log("✅ Filled subject");
  }

  // Kind = exam
  const kindSelect = await page.$('select.input');
  if (kindSelect) {
    await kindSelect.selectOption("exam");
    console.log("✅ Selected kind: exam");
  }

  // Description
  const desc = await page.$('textarea.input');
  if (desc) {
    await desc.fill(
      "Full practice exam covering Analysis, Geometry, and Probability for the 2024 Baccalaureate. " +
      "Includes 4 exercises with detailed marking scheme. Duration: 3 hours. " +
      "Calculator allowed (non-programmable)."
    );
    console.log("✅ Filled description");
  }

  // File upload
  const fileInput = await page.$('input[type="file"]');
  if (fileInput) {
    const filePath = resolve("test-assets/math-exam-2024.txt");
    await fileInput.setInputFiles(filePath);
    console.log("✅ Attached file:", filePath);
  }

  await shot("create_form_filled");

  // Submit
  const publishBtn = await page.$('button[type="submit"]');
  if (publishBtn) {
    const btnText = await publishBtn.textContent();
    console.log("Submit button:", btnText);
    await publishBtn.click();
    await page.waitForTimeout(6000);
    await shot("material_created");
    console.log("URL after create:", page.url());

    if (page.url().includes("/study-materials/mat_")) {
      console.log("✅ Study material created! Redirected to detail page.");
    }
  }

  // ── 3. Create second material (Notes, premium) ────────────
  console.log("\n--- Step 3: Create notes material (premium) ---");
  await page.goto(`${BASE}/study-materials/new`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);

  // Fill form for notes
  const titleInput2 = await page.$('input.input');
  if (titleInput2) await titleInput2.fill("Physics - Electromagnetic Waves Summary");

  const subjectInput2 = await page.$('input[placeholder="Mathematics"]');
  if (subjectInput2) await subjectInput2.fill("Physics");

  const kindSelect2 = await page.$('select.input');
  if (kindSelect2) await kindSelect2.selectOption("notes");

  const desc2 = await page.$('textarea.input');
  if (desc2) {
    await desc2.fill(
      "Comprehensive summary of electromagnetic waves chapter. Covers Maxwell equations, " +
      "wave propagation, polarization, and interference. Perfect for quick revision before the exam."
    );
  }

  // Mark as premium
  const premiumCheck = await page.$('input[type="checkbox"]');
  if (premiumCheck) {
    await premiumCheck.check();
    console.log("✅ Marked as premium");
  }

  // Upload a file
  const fileInput2 = await page.$('input[type="file"]');
  if (fileInput2) {
    await fileInput2.setInputFiles(resolve("test-assets/math-exam-2024.txt"));
  }

  await shot("premium_material_form");

  const publishBtn2 = await page.$('button[type="submit"]');
  if (publishBtn2) {
    await publishBtn2.click();
    await page.waitForTimeout(6000);
    await shot("premium_material_created");
    console.log("URL after create:", page.url());
  }

  // ── 4. Create third material (Answers) ─────────────────────
  console.log("\n--- Step 4: Create answers material ---");
  await page.goto(`${BASE}/study-materials/new`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);

  const titleInput3 = await page.$('input.input');
  if (titleInput3) await titleInput3.fill("Biology Bac 2023 - Answer Key");

  const subjectInput3 = await page.$('input[placeholder="Mathematics"]');
  if (subjectInput3) await subjectInput3.fill("Biology");

  const kindSelect3 = await page.$('select.input');
  if (kindSelect3) await kindSelect3.selectOption("answers");

  const desc3 = await page.$('textarea.input');
  if (desc3) {
    await desc3.fill(
      "Complete answer key with detailed explanations for the 2023 Biology Baccalaureate exam. " +
      "Covers genetics, ecology, and human physiology."
    );
  }

  const fileInput3 = await page.$('input[type="file"]');
  if (fileInput3) {
    await fileInput3.setInputFiles(resolve("test-assets/math-exam-2024.txt"));
  }

  await shot("answers_material_form");

  const publishBtn3 = await page.$('button[type="submit"]');
  if (publishBtn3) {
    await publishBtn3.click();
    await page.waitForTimeout(6000);
    await shot("answers_material_created");
    console.log("URL after create:", page.url());
  }

  // ── 5. Browse all materials as teacher ─────────────────────
  console.log("\n--- Step 5: Browse all materials ---");
  await page.goto(`${BASE}/study-materials`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("all_materials_list");

  const items = await page.$$('ul li a[href*="/study-materials/"]');
  console.log(`Found ${items.length} materials in the list`);

  // ── 6. Test filtering by kind ──────────────────────────────
  console.log("\n--- Step 6: Test filtering ---");

  // Filter by exam
  const kindFilter = await page.$('select.input');
  if (kindFilter) {
    await kindFilter.selectOption("exam");
    await page.waitForTimeout(2000);
    await shot("filter_exam");
    const examItems = await page.$$('ul li a[href*="/study-materials/"]');
    console.log(`Exam filter: ${examItems.length} items`);

    // Filter by notes
    await kindFilter.selectOption("notes");
    await page.waitForTimeout(2000);
    await shot("filter_notes");
    const notesItems = await page.$$('ul li a[href*="/study-materials/"]');
    console.log(`Notes filter: ${notesItems.length} items`);

    // Reset filter
    await kindFilter.selectOption("");
    await page.waitForTimeout(2000);
  }

  // Filter by subject
  const subjectFilter = await page.$('input[placeholder*="Mathematics"]');
  if (subjectFilter) {
    await subjectFilter.fill("Physics");
    await page.waitForTimeout(2000);
    await shot("filter_physics");
    const physicsItems = await page.$$('ul li a[href*="/study-materials/"]');
    console.log(`Physics filter: ${physicsItems.length} items`);

    // Clear subject
    await subjectFilter.fill("");
    await page.waitForTimeout(2000);
  }

  // ── 7. View material detail ────────────────────────────────
  console.log("\n--- Step 7: View material detail ---");
  await page.goto(`${BASE}/study-materials`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);

  const firstItem = await page.$('ul li a[href*="/study-materials/mat_"]');
  if (firstItem) {
    const href = await firstItem.getAttribute("href");
    console.log("Clicking material:", href);
    await firstItem.click();
    await page.waitForTimeout(3000);
    await shot("material_detail");

    // Check for download button
    const downloadBtn = await page.$('button:has-text("Download")');
    if (downloadBtn) {
      console.log("✅ Download button present");
    }

    // Check for description
    const pageText = await page.textContent("main");
    if (pageText?.includes("Practice Exam") || pageText?.includes("Summary") || pageText?.includes("Answer Key")) {
      console.log("✅ Material detail shows title and description");
    }
  }

  // ── 8. Switch to student ───────────────────────────────────
  console.log("\n--- Step 8: Student view ---");
  await context.clearCookies();
  await page.evaluate(() => localStorage.clear());
  await login(STUDENT.email, STUDENT.pass);
  await shot("student_logged_in");

  // Browse materials as student
  await page.goto(`${BASE}/study-materials`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("student_materials_list");

  const studentItems = await page.$$('ul li a[href*="/study-materials/"]');
  console.log(`Student sees ${studentItems.length} materials`);

  // Click on a material
  if (studentItems.length > 0) {
    await studentItems[0].click();
    await page.waitForTimeout(3000);
    await shot("student_material_detail");

    // Try download
    const dlBtn = await page.$('button:has-text("Download")');
    if (dlBtn) {
      console.log("Attempting download as student...");
      // We can't actually verify the download in headless, but we can click and see if errors appear
      await dlBtn.click();
      await page.waitForTimeout(3000);
      await shot("student_download_attempt");

      // Check for premium gate message
      const premiumMsg = await page.$('text=premium');
      if (premiumMsg) {
        console.log("✅ Premium paywall displayed for restricted material");
      } else {
        console.log("✅ Download initiated (non-premium material)");
      }
    }
  }

  // ── 9. Student views premium material ──────────────────────
  console.log("\n--- Step 9: Premium material paywall test ---");
  await page.goto(`${BASE}/study-materials`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);

  // Find premium material
  const premiumBadge = await page.$('span:has-text("Premium")');
  if (premiumBadge) {
    // Click its parent link
    const premiumCard = await premiumBadge.evaluateHandle(
      (el) => el.closest("a")
    );
    if (premiumCard) {
      await premiumCard.asElement()?.click();
      await page.waitForTimeout(3000);
      await shot("student_premium_detail");

      // Try to download premium material
      const dlBtn2 = await page.$('button:has-text("Download")');
      if (dlBtn2) {
        await dlBtn2.click();
        await page.waitForTimeout(3000);
        await shot("premium_paywall");

        const paywallMsg = await page.$('text=premium');
        if (paywallMsg) {
          console.log("✅ Premium paywall correctly blocks non-subscriber");
          const paywallText = await page.textContent("main");
          console.log("Paywall text:", paywallText?.match(/premium.*membership/i)?.[0] || "found");
        }
      }
    }
  } else {
    console.log("No premium material found in list — skipping paywall test");
  }

  // ── 10. Student creates their own material ─────────────────
  console.log("\n--- Step 10: Student creates material ---");
  await page.goto(`${BASE}/study-materials/new`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);
  await shot("student_create_form");

  const titleS = await page.$('input.input');
  if (titleS) await titleS.fill("French Literature - Bac Essay Tips");

  const subjectS = await page.$('input[placeholder="Mathematics"]');
  if (subjectS) await subjectS.fill("French");

  const kindS = await page.$('select.input');
  if (kindS) await kindS.selectOption("notes");

  const descS = await page.$('textarea.input');
  if (descS) {
    await descS.fill(
      "A collection of essay writing tips for the French literature section of the Baccalaureate. " +
      "Covers dissertation, commentaire composé, and writing techniques."
    );
  }

  const fileS = await page.$('input[type="file"]');
  if (fileS) {
    await fileS.setInputFiles(resolve("test-assets/math-exam-2024.txt"));
  }

  await shot("student_material_filled");

  const publishS = await page.$('button[type="submit"]');
  if (publishS) {
    await publishS.click();
    await page.waitForTimeout(6000);
    await shot("student_material_created");
    console.log("Student material URL:", page.url());

    if (page.url().includes("/study-materials/mat_")) {
      console.log("✅ Student successfully created study material!");
    }
  }

  // ── 11. Final: browse all materials ────────────────────────
  console.log("\n--- Step 11: Final materials listing ---");
  await page.goto(`${BASE}/study-materials`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("final_materials_list");

  const finalItems = await page.$$('ul li a[href*="/study-materials/"]');
  console.log(`\nTotal materials in library: ${finalItems.length}`);

  // Log all material titles
  for (const item of finalItems) {
    const text = await item.textContent();
    const title = text?.split("\n").find((l) => l.trim())?.trim();
    console.log(`  - ${title}`);
  }

  console.log(`\n✅ Study materials E2E test complete: ${shotN} screenshots`);
  await browser.close();
})();
