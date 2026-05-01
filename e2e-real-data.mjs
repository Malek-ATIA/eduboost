import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const DIR = "screenshots/real-data";
const TEACHER = { email: "malek.freelance2@gmail.com", pass: "Drakifech1234" };
const STUDENT = { email: "malek.atia2@gmail.com", pass: "Drakifech1234" };

let page, browser, context;
let shotN = 0;

async function shot(name, opts = {}) {
  shotN++;
  const p = `${DIR}/${String(shotN).padStart(2, "0")}_${name}.png`;
  await page.screenshot({ path: p, fullPage: opts.fullPage !== false, ...opts });
  console.log(`📸 ${p}`);
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

async function getUserId() {
  return page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.includes("LastAuthUser")) {
        return localStorage.getItem(key);
      }
    }
    return null;
  });
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
  // 0. Discover real user IDs
  // ═══════════════════════════════════════════════════════════════════
  console.log("═══ 0. DISCOVERING USER IDs ═══");

  await login(TEACHER.email, TEACHER.pass, "Teacher (id discovery)");
  const teacherUserId = await getUserId();
  console.log(`  Teacher userId: ${teacherUserId}`);
  await logout();

  await login(STUDENT.email, STUDENT.pass, "Student (id discovery)");
  const studentUserId = await getUserId();
  console.log(`  Student userId: ${studentUserId}`);

  if (!teacherUserId || !studentUserId) {
    console.error("❌ Could not discover user IDs");
    await browser.close();
    process.exit(1);
  }

  // Student is already logged in

  // ═══════════════════════════════════════════════════════════════════
  // 1. STUDENT: Favorite a teacher
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n═══ 1. STUDENT: FAVORITE A TEACHER ═══");

  await page.goto(`${BASE}/teachers/seed_teacher_karim`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);

  const favBtn = await page.$('button[aria-label="Save teacher"]');
  if (favBtn) {
    await favBtn.click();
    await page.waitForTimeout(2000);
    console.log("  ✅ Favorited teacher");
  } else {
    console.log("  ⚠️ Already favorited or button not found");
  }
  await shot("student_teacher_profile_fav_state");

  await page.goto(`${BASE}/favorites`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("student_favorites_with_data");

  // ═══════════════════════════════════════════════════════════════════
  // 2. STUDENT: Send a message to REAL teacher
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n═══ 2. STUDENT: SEND MESSAGE TO REAL TEACHER ═══");

  await page.goto(`${BASE}/mailbox`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);

  const newMsgBtn = await page.$('button:has-text("New message")');
  if (newMsgBtn) {
    await newMsgBtn.click();
    await page.waitForTimeout(1000);

    const recipientInput = await page.$('input[placeholder*="Search contacts"]');
    if (recipientInput) await recipientInput.fill(teacherUserId);

    const subjectInput = await page.$('input[placeholder*="What"]');
    if (subjectInput) await subjectInput.fill("Question about Math tutoring");

    const bodyInput = await page.$('textarea[placeholder*="Write"]');
    if (bodyInput) {
      await bodyInput.fill("Hello! I'm interested in your math tutoring sessions. I'm preparing for the Baccalaureate exam and need help with integrals and complex numbers. What times are you available this week?");
    }

    await shot("student_mailbox_compose_filled");

    const sendBtn = await page.$('button:has-text("Send message")');
    if (sendBtn && await sendBtn.isEnabled()) {
      await sendBtn.click();
      await page.waitForTimeout(3000);
      console.log("  ✅ Message sent to real teacher");
      // Thread view — viewport only to avoid sticky header artifact
      await shot("student_mailbox_thread_view", { fullPage: false });
    }
  }

  await page.goto(`${BASE}/mailbox`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("student_mailbox_with_threads");

  // ═══════════════════════════════════════════════════════════════════
  // 3. STUDENT: Send lesson request to REAL teacher
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n═══ 3. STUDENT: LESSON REQUEST TO REAL TEACHER ═══");

  await page.goto(`${BASE}/requests/new?teacherId=${teacherUserId}`, {
    waitUntil: "networkidle",
    timeout: 20000,
  });
  await page.waitForTimeout(2000);

  const reqSubject = await page.$('input[placeholder*="Mathematics"]');
  if (reqSubject) {
    await reqSubject.fill("Physics - Mechanics and Optics");

    const reqMsg = await page.$('textarea[placeholder*="What do you need"]');
    if (reqMsg) {
      await reqMsg.fill("I need help preparing for the physics Bac exam, specifically chapters on Mechanics and Optics. Could we schedule 2 sessions per week?");
    }

    await shot("student_lesson_request_form");

    const submitReq = await page.$('button:has-text("Send request")');
    if (submitReq) {
      await submitReq.click();
      await page.waitForTimeout(3000);
      console.log("  ✅ Lesson request sent to real teacher");
      await shot("student_lesson_request_sent");
    }
  } else {
    console.log("  ⚠️ Request form not found");
    await shot("student_lesson_request_page");
  }

  await page.goto(`${BASE}/requests`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("student_requests_with_data");

  // ═══════════════════════════════════════════════════════════════════
  // 4. STUDENT: Book a session with REAL teacher (trial = free)
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n═══ 4. STUDENT: BOOK WITH REAL TEACHER ═══");

  await page.goto(`${BASE}/book/${teacherUserId}?type=trial`, {
    waitUntil: "networkidle",
    timeout: 20000,
  });
  await page.waitForTimeout(5000);
  await shot("student_booking_real_teacher");

  // Click the demo "Pay" button to complete the booking
  const payBtn = await page.$('button[type="submit"]');
  if (payBtn) {
    await payBtn.click();
    await page.waitForTimeout(3000);
    console.log("  ✅ Demo payment submitted");
    await shot("student_booking_success");
  } else {
    console.log("  ⚠️ Pay button not found");
  }

  await page.goto(`${BASE}/bookings`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("student_bookings_with_data");

  // ═══════════════════════════════════════════════════════════════════
  // 5. STUDENT: Buy an event ticket
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n═══ 5. STUDENT: BUY EVENT TICKET ═══");

  await page.goto(`${BASE}/events`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);

  const eventCard = await page.$('a[href*="/events/evt_"]');
  if (eventCard) {
    await eventCard.click();
    await page.waitForTimeout(3000);
    const buyBtn = await page.$('button:has-text("ticket"), button:has-text("Reserve")');
    if (buyBtn) {
      await buyBtn.click();
      await page.waitForTimeout(3000);
      console.log("  ✅ Ticket action triggered");
      await shot("student_event_ticket_purchased");
    }
  } else {
    console.log("  ⚠️ No events found");
  }

  // ═══════════════════════════════════════════════════════════════════
  // 6. STUDENT: Check notifications
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n═══ 6. STUDENT: NOTIFICATIONS ═══");

  await page.goto(`${BASE}/notifications`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("student_notifications");

  // ═══════════════════════════════════════════════════════════════════
  // 6B. STUDENT: FORUM — social features (reactions, post creation)
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n═══ 6B. STUDENT: FORUM ═══");

  await page.goto(`${BASE}/forum`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);
  await shot("student_forum_channels");

  // Click first channel
  const channelLink = await page.$('a[href*="/forum/"]');
  if (channelLink) {
    await channelLink.click();
    await page.waitForTimeout(3000);
    await shot("student_forum_channel_posts");

    // Create a new post
    const newPostBtn = await page.$('a:has-text("New post")');
    if (newPostBtn) {
      await newPostBtn.click();
      await page.waitForTimeout(2000);

      const titleInput = await page.$('form input.input');
      const bodyInput = await page.$('form textarea.input');
      if (titleInput && bodyInput) {
        await titleInput.fill("Tips for Bac exam preparation — Physics");
        await bodyInput.fill("Hey everyone! I've been studying mechanics and optics for the upcoming Bac exam. Here are some tips that helped me:\n\n1. Practice past exam papers — patterns repeat!\n2. Draw diagrams for every optics problem\n3. Master the fundamental equations before attempting complex problems\n\nWhat strategies are working for you?");
        await shot("student_forum_new_post_filled");

        const submitPost = await page.$('button[type="submit"]');
        if (submitPost) {
          await submitPost.click();
          await page.waitForTimeout(4000);
          console.log("  ✅ Forum post created");
          await shot("student_forum_post_created");
        }
      }
    }

    // Back to channel — try adding reactions to a post
    await page.goBack();
    await page.waitForTimeout(3000);

    // Click the + reaction picker button on the first post
    const reactionPickerBtn = await page.$('button[aria-label="Add reaction"]');
    if (reactionPickerBtn) {
      await reactionPickerBtn.click();
      await page.waitForTimeout(500);

      // Click the first emoji (like / 👍)
      const emojiBtn = await page.$('button[title="like"]');
      if (emojiBtn) {
        await emojiBtn.click();
        await page.waitForTimeout(1500);
        console.log("  ✅ Reaction added to post");
      }
      await shot("student_forum_reaction_added");
    }

    // Click into a post to see detail view + comments
    const postLink = await page.$('a[href*="/forum/posts/"]');
    if (postLink) {
      await postLink.click();
      await page.waitForTimeout(3000);
      await shot("student_forum_post_detail");

      // Add a comment
      const commentBox = await page.$('textarea[placeholder*="comment"], textarea[placeholder*="Comment"], textarea.input');
      if (commentBox) {
        await commentBox.fill("Great tips! I'd add: make sure to understand the derivation of each formula, not just memorize it. It helps when the exam throws a variation.");
        const commentBtn = await page.$('button:has-text("Comment")');
        if (commentBtn) {
          await commentBtn.click();
          await page.waitForTimeout(3000);
          console.log("  ✅ Comment added to post");
          await shot("student_forum_comment_added");
        }
      }

      // Add reaction to the post on detail page
      const detailReactionBtn = await page.$('button[aria-label="Add reaction"]');
      if (detailReactionBtn) {
        await detailReactionBtn.click();
        await page.waitForTimeout(500);
        const loveBtn = await page.$('button[title="love"]');
        if (loveBtn) {
          await loveBtn.click();
          await page.waitForTimeout(1500);
          console.log("  ✅ Love reaction added on detail page");
        }
      }
      await shot("student_forum_post_with_reactions");
    }
  } else {
    console.log("  ⚠️ No forum channels found");
    await shot("student_forum_empty");
  }

  // ═══════════════════════════════════════════════════════════════════
  // 7. STUDENT: Send second message + reply in thread
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n═══ 7. STUDENT: SECOND MESSAGE ═══");

  await page.goto(`${BASE}/mailbox`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);

  const newMsg2 = await page.$('button:has-text("New message")');
  if (newMsg2) {
    await newMsg2.click();
    await page.waitForTimeout(1000);

    const recip2 = await page.$('input[placeholder*="Search contacts"]');
    if (recip2) await recip2.fill(teacherUserId);

    const subj2 = await page.$('input[placeholder*="What"]');
    if (subj2) await subj2.fill("Homework help needed");

    const body2 = await page.$('textarea[placeholder*="Write"]');
    if (body2) {
      await body2.fill("Hi teacher! I'm stuck on exercise 3 of chapter 7 about differential equations. Could you explain the method for solving separable ODEs?");
    }

    const send2 = await page.$('button:has-text("Send message")');
    if (send2 && await send2.isEnabled()) {
      await send2.click();
      await page.waitForTimeout(3000);
      console.log("  ✅ Second message sent");
    }
  }

  // Reply in existing thread
  await page.goto(`${BASE}/mailbox`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);

  const threadLink = await page.$('a[href*="/mailbox/"]');
  if (threadLink) {
    await threadLink.click();
    await page.waitForTimeout(3000);

    const replyBox = await page.$('textarea');
    if (replyBox) {
      await replyBox.fill("Thank you for the quick response! I'll try that approach and let you know how it goes.");
      const replyBtn = await page.$('button[type="submit"]');
      if (replyBtn) {
        await replyBtn.click();
        await page.waitForTimeout(3000);
        console.log("  ✅ Reply sent in thread");
      }
    }
    // Thread with reply — viewport only
    await shot("student_thread_with_reply", { fullPage: false });
  }

  await page.goto(`${BASE}/mailbox`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("student_mailbox_multiple_threads");

  // ═══════════════════════════════════════════════════════════════════
  // SWITCH TO TEACHER
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n═══ SWITCHING TO TEACHER ═══");
  await logout();
  await login(TEACHER.email, TEACHER.pass, "Teacher");

  // ═══════════════════════════════════════════════════════════════════
  // 8. TEACHER: Mailbox (should have student messages)
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n═══ 8. TEACHER: MAILBOX ═══");

  await page.goto(`${BASE}/mailbox`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("teacher_mailbox_with_threads");

  const tThread = await page.$('a[href*="/mailbox/"]');
  if (tThread) {
    await tThread.click();
    await page.waitForTimeout(3000);

    const tReply = await page.$('textarea');
    if (tReply) {
      await tReply.fill("Hello! Great to hear from you. For differential equations, start by separating variables: move all y terms to one side and x terms to the other. Then integrate both sides. Don't forget the constant!");
      const tSendBtn = await page.$('button[type="submit"]');
      if (tSendBtn) {
        await tSendBtn.click();
        await page.waitForTimeout(3000);
        console.log("  ✅ Teacher replied");
      }
    }
    // Thread — viewport only
    await shot("teacher_thread_replied", { fullPage: false });
  }

  // ═══════════════════════════════════════════════════════════════════
  // 9. TEACHER: Notifications (should have DM notifications)
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n═══ 9. TEACHER: NOTIFICATIONS ═══");

  await page.goto(`${BASE}/notifications`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("teacher_notifications");

  // ═══════════════════════════════════════════════════════════════════
  // 10. TEACHER: Students (should have student from booking)
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n═══ 10. TEACHER: STUDENTS ═══");

  await page.goto(`${BASE}/teacher/students`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("teacher_students");

  // ═══════════════════════════════════════════════════════════════════
  // 11. TEACHER: AI Grader (use real student ID)
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n═══ 11. TEACHER: AI GRADER ═══");

  await page.goto(`${BASE}/teacher/grader`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);

  const sidInput = await page.$('input[placeholder="sub_..."]');
  const graderSubjectInput = await page.$('input[placeholder="Calculus — chain rule"]');
  const rubricArea = await page.$('textarea[placeholder*="Correct differentiation"]');
  const submissionArea = await page.$('textarea[placeholder*="Paste the student"]');

  if (sidInput && graderSubjectInput && submissionArea) {
    await sidInput.fill(studentUserId);
    await graderSubjectInput.fill("Mathematics — Integration & Complex Numbers");

    if (rubricArea) {
      await rubricArea.fill("- Correct methodology and steps (40%)\n- Accurate calculations (40%)\n- Clear notation and presentation (20%)");
    }

    await submissionArea.fill(`Problem 1: Find the integral of x²·sin(x) dx

Solution: Using integration by parts twice:
Let u = x², dv = sin(x)dx → du = 2x dx, v = -cos(x)
= -x²cos(x) + 2∫x·cos(x)dx

Second IBP: u = 2x, dv = cos(x)dx
= -x²cos(x) + 2x·sin(x) - 2∫sin(x)dx
= -x²cos(x) + 2x·sin(x) + 2cos(x) + C

Problem 2: Solve z² + 2z + 5 = 0 in C
D = 4 - 20 = -16
z = (-2 ± 4i) / 2
z1 = -1 + 2i, z2 = -1 - 2i`);

    await shot("teacher_grader_filled");

    const gradeBtn = await page.$('button:has-text("Grade with AI")');
    if (gradeBtn && await gradeBtn.isEnabled()) {
      await gradeBtn.click();
      await page.waitForTimeout(15000);
      console.log("  ✅ Grading submitted");
      await shot("teacher_grader_result");
    }
  } else {
    console.log("  ⚠️ Grader form fields not found");
  }

  // ═══════════════════════════════════════════════════════════════════
  // 12. TEACHER: Lesson requests inbox (should have student request)
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n═══ 12. TEACHER: LESSON REQUESTS ═══");

  await page.goto(`${BASE}/requests`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("teacher_requests_inbox");

  // ═══════════════════════════════════════════════════════════════════
  // 13. TEACHER: Bookings (should have student booking)
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n═══ 13. TEACHER: BOOKINGS ═══");

  await page.goto(`${BASE}/teacher/bookings`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("teacher_bookings");

  // ═══════════════════════════════════════════════════════════════════
  // 14. TEACHER: Grades
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n═══ 14. TEACHER: GRADES ═══");

  await page.goto(`${BASE}/grades`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("teacher_grades");

  // ═══════════════════════════════════════════════════════════════════
  // 15. TEACHER: Seller listings
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n═══ 15. TEACHER: SELLER LISTINGS ═══");

  await page.goto(`${BASE}/seller/listings`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("teacher_seller_listings");

  // ═══════════════════════════════════════════════════════════════════
  // 16. TEACHER: Earnings
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n═══ 16. TEACHER: EARNINGS ═══");

  await page.goto(`${BASE}/teacher/earnings`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("teacher_earnings");

  // ═══════════════════════════════════════════════════════════════════
  // SWITCH BACK TO STUDENT for final views
  // ═══════════════════════════════════════════════════════════════════
  // 9. FORUM: Share + Delete (tests new features)
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n═══ 9. FORUM: SHARE & DELETE ═══");

  // Navigate to forum and find a channel
  await page.goto(`${BASE}/forum`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);
  const forumChannel = await page.$('a[href*="/forum/"]');
  if (forumChannel) {
    await forumChannel.click();
    await page.waitForTimeout(3000);

    // Test Share button — should show "Copied!" after clicking
    const shareBtn = await page.$('button:has-text("Share")');
    if (shareBtn) {
      await shareBtn.click();
      await page.waitForTimeout(500);
      const copiedText = await page.$('button:has-text("Copied!")');
      if (copiedText) {
        console.log("  ✅ Share button shows 'Copied!' feedback");
      } else {
        console.log("  ⚠️ Share button feedback not visible (may use native share)");
      }
      await shot("forum_share_copied_feedback");
    }

    // Create a test post, interact with it (comment, like, share), then delete
    const newPostBtn2 = await page.$('a:has-text("New post")');
    if (newPostBtn2) {
      await newPostBtn2.click();
      await page.waitForTimeout(2000);
      const titleInput2 = await page.$('form input.input');
      const bodyInput2 = await page.$('form textarea.input');
      if (titleInput2 && bodyInput2) {
        await titleInput2.fill("Test post for interaction — please ignore");
        await bodyInput2.fill("This post tests share, like, and delete features.");
        const submitBtn = await page.$('button[type="submit"]');
        if (submitBtn) {
          await submitBtn.click();
          await page.waitForTimeout(4000);
          console.log("  ✅ Test post created");

          // Now on post detail page — test post-level Like
          const postLikeBtn = await page.$('article button:has-text("Like")');
          if (postLikeBtn) {
            await postLikeBtn.click();
            await page.waitForTimeout(1500);
            const postLikedStyle = await postLikeBtn.getAttribute("class");
            if (postLikedStyle && postLikedStyle.includes("text-seal")) {
              console.log("  ✅ Post Like button works (turns active)");
            } else {
              console.log("  ⚠️ Post Like clicked but style not updated");
            }
            await shot("forum_post_liked");
          }

          // Test post-level Share
          const postShareBtn = await page.$('article button:has-text("Share")');
          if (postShareBtn) {
            await postShareBtn.click();
            await page.waitForTimeout(500);
            const copiedPost = await page.$('article button:has-text("Copied!")');
            if (copiedPost) {
              console.log("  ✅ Post Share button shows 'Copied!' feedback");
            } else {
              console.log("  ⚠️ Post Share feedback not visible");
            }
            await shot("forum_post_share_copied");
          }

          // Add a comment
          const commentBox2 = await page.$('#comment-box');
          if (commentBox2) {
            await commentBox2.fill("Temporary comment for interaction test");
            const postCommentBtn = await page.$('button:has-text("Post")');
            if (postCommentBtn) {
              await postCommentBtn.click();
              await page.waitForTimeout(3000);
              console.log("  ✅ Test comment added");

              // Test Like on the comment
              const commentLikeBtns = await page.$$('div[id^="comment-"] button:has-text("Like")');
              if (commentLikeBtns.length > 0) {
                const lastCommentLike = commentLikeBtns[commentLikeBtns.length - 1];
                await lastCommentLike.click();
                await page.waitForTimeout(1500);
                const likedStyle = await lastCommentLike.getAttribute("class");
                if (likedStyle && likedStyle.includes("text-seal")) {
                  console.log("  ✅ Comment Like button works (turns active)");
                } else {
                  console.log("  ⚠️ Comment Like clicked but style not updated");
                }
                await shot("forum_comment_liked");
              }

              // Test Share on the comment
              const commentShareBtns = await page.$$('div[id^="comment-"] button:has-text("Share")');
              if (commentShareBtns.length > 0) {
                const lastCommentShare = commentShareBtns[commentShareBtns.length - 1];
                await lastCommentShare.click();
                await page.waitForTimeout(500);
                const copiedComment = await page.$('div[id^="comment-"] button:has-text("Copied!")');
                if (copiedComment) {
                  console.log("  ✅ Comment Share button shows 'Copied!' feedback");
                } else {
                  console.log("  ⚠️ Comment Share feedback not visible");
                }
                await shot("forum_comment_shared");
              }

              // Delete the comment
              const deleteCommentBtn = await page.$('button[title="Delete comment"]');
              if (deleteCommentBtn) {
                const commentBlock = await page.$('.group\\/comment');
                if (commentBlock) await commentBlock.hover();
                await page.waitForTimeout(300);
                page.once("dialog", (dialog) => dialog.accept());
                await deleteCommentBtn.click();
                await page.waitForTimeout(3000);
                console.log("  ✅ Comment deleted successfully");
                await shot("forum_comment_deleted");
              }
            }
          }

          // Delete the post
          const deletePostBtn = await page.$('button[title="Delete post"]');
          if (deletePostBtn) {
            page.once("dialog", (dialog) => dialog.accept());
            await deletePostBtn.click();
            await page.waitForTimeout(3000);
            console.log("  ✅ Post deleted successfully");
            await shot("forum_post_deleted");
          }
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 10. DELETE/REMOVE ACTIONS ACROSS DASHBOARD
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n═══ 10. DELETE/REMOVE ACTIONS ═══");

  // 10a. Bookings — navigate to booking detail
  await page.goto(`${BASE}/bookings`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);
  await shot("student_bookings_list");
  // Check cancel button is present on booking items
  const cancelBookingBtn = await page.$('button:has-text("Cancel")');
  if (cancelBookingBtn) {
    console.log("  ✅ Cancel booking button present on bookings page");
  }

  // 10b. Requests — check cancel button on pending requests
  await page.goto(`${BASE}/requests`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);
  const cancelRequestBtn = await page.$('button:has-text("Cancel")');
  if (cancelRequestBtn) {
    console.log("  ✅ Cancel request button present on requests list");
    await shot("student_requests_with_cancel");
  } else {
    console.log("  ℹ️ No pending requests to cancel");
    await shot("student_requests_no_pending");
  }

  // 10c. Favorites — check remove button
  await page.goto(`${BASE}/favorites`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);
  const removeFavBtn = await page.$('button:has-text("Remove")');
  if (removeFavBtn) {
    console.log("  ✅ Remove favorite button present");
    await shot("student_favorites_with_remove");
  } else {
    console.log("  ℹ️ No favorites to remove");
    await shot("student_favorites_empty");
  }

  // 10d. Seller listings (teacher) — check delete and archive buttons
  await logout();
  await login(TEACHER.email, TEACHER.pass, "Teacher (delete actions)");
  await page.goto(`${BASE}/seller/listings`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);
  const archiveBtn = await page.$('button:has-text("Archive")');
  const deleteListingBtn = await page.$('button:has-text("Delete")');
  if (archiveBtn) console.log("  ✅ Archive listing button present");
  if (deleteListingBtn) console.log("  ✅ Delete listing button present");
  await shot("teacher_seller_listings_actions");

  // 10e. Calendar peek — test clicking View booking (click-to-open)
  await logout();
  await login(STUDENT.email, STUDENT.pass, "Student (calendar peek test)");
  await page.goto(`${BASE}/calendar`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  const calPill = await page.$('.relative.cursor-pointer > div[class*="rounded border"]');
  if (calPill) {
    await calPill.click();
    await page.waitForTimeout(800);
    const viewBookingLink = await page.$('a:has-text("View booking")');
    if (viewBookingLink) {
      const stillVisible = await viewBookingLink.isVisible();
      if (stillVisible) {
        console.log("  ✅ Calendar peek popover stays open (click-based)");
        await shot("calendar_peek_click_open");
        await viewBookingLink.click();
        await page.waitForTimeout(3000);
        const url = page.url();
        if (url.includes("/bookings/")) {
          console.log("  ✅ Navigated to specific booking detail page");
          await shot("booking_detail_from_calendar");
        } else {
          console.log("  ⚠️ Did not navigate to booking detail page, URL: " + url);
        }
      } else {
        console.log("  ❌ Calendar peek popover not visible after click");
      }
    } else {
      console.log("  ⚠️ No 'View booking' link found in peek");
    }
  } else {
    console.log("  ⚠️ No calendar pills found");
  }

  // ═══════════════════════════════════════════════════════════════════
  console.log("\n═══ FINAL STUDENT VIEWS ═══");
  await logout();
  await login(STUDENT.email, STUDENT.pass, "Student (final)");

  await page.goto(`${BASE}/mailbox`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("final_student_mailbox");

  const finalThread = await page.$('a[href*="/mailbox/"]');
  if (finalThread) {
    await finalThread.click();
    await page.waitForTimeout(3000);
    // Thread — viewport only to avoid sticky header
    await shot("final_student_thread_with_replies", { fullPage: false });
  }

  await page.goto(`${BASE}/notifications`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("final_student_notifications");

  await page.goto(`${BASE}/favorites`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("final_student_favorites");

  await page.goto(`${BASE}/grades`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("final_student_grades");

  await page.goto(`${BASE}/requests`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("final_student_requests");

  await page.goto(`${BASE}/calendar`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("final_student_calendar");

  // Test calendar peek view — click on a session pill
  const sessionPill = await page.$('.relative.cursor-pointer > div[class*="rounded border"]');
  if (sessionPill) {
    await sessionPill.click();
    await page.waitForTimeout(800);
    console.log("  ✅ Calendar peek view opened on click");
    await shot("final_student_calendar_peek", { fullPage: false });
  } else {
    console.log("  ⚠️ No session pills found for peek test");
  }

  await page.goto(`${BASE}/orders`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("final_student_orders");

  await page.goto(`${BASE}/events`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  await shot("final_student_events");

  console.log(`\n✅ Real data E2E complete: ${shotN} screenshots`);
  await browser.close();
})();
