#!/usr/bin/env ts-node
/**
 * Demo-data seeder for EduBoost's live DynamoDB table.
 *
 *  Usage:
 *    AWS_PROFILE=malek.atia2 AWS_REGION=eu-west-1 \
 *    TABLE_NAME=eduboost-dev \
 *    npx ts-node scripts/seed-demo.ts
 *
 *  What it writes (Tunisia-themed, ~30 rows total):
 *    - 1 admin, 3 teachers, 2 parents, 3 students (UserEntity)
 *    - 3 teacher profiles (Mathematics / Physics / French), all verified
 *    - 1 classroom ("Baccalauréat revision — Mathematics")
 *    - 3 classroom memberships (teacher + two students)
 *    - 2 confirmed bookings
 *    - 1 forum post with an upvote and a comment
 *    - 1 teacher wall post
 *    - 1 active digital marketplace listing + 1 physical listing
 *    - 1 published event (Tunis workshop)
 *    - 1 published MCQ assessment + 1 student attempt
 *    - 1 study material (free notes)
 *    - 1 support ticket + one admin reply
 *
 *  Notes:
 *    - These rows are INDEPENDENT of Cognito. They'll make the browse surfaces
 *      (teachers list, forum, marketplace, events, assessments) look populated,
 *      but you can't log in *as* these users — they're seed data for read-only
 *      UX testing. To actually sign in, create a real account via /signup.
 *    - All money amounts are in the smallest currency unit (millimes for TND).
 *    - Safe to run multiple times: every create() is wrapped in try/catch so
 *      an existing row (ConditionalCheckFailed) is logged and skipped.
 */
import {
  UserEntity,
  TeacherProfileEntity,
  ClassroomEntity,
  ClassroomMembershipEntity,
  BookingEntity,
  ForumPostEntity,
  ForumCommentEntity,
  ForumVoteEntity,
  WallPostEntity,
  ListingEntity,
  EventEntity,
  AssessmentEntity,
  AssessmentAttemptEntity,
  StudyMaterialEntity,
  SupportTicketEntity,
  TicketMessageEntity,
  makePostId,
  makeCommentId,
  makeListingId,
  makeEventId,
  makeExamId,
  makeMaterialId,
  makeTicketId,
  makeTicketMessageId,
  makeWallPostId,
} from "@eduboost/db";

const now = () => new Date().toISOString();
const futureHours = (h: number) =>
  new Date(Date.now() + h * 3600 * 1000).toISOString();

// Use stable pseudo-Cognito-sub IDs so a re-run is idempotent per row.
const U = {
  admin: "seed_admin",
  teacher_math: "seed_teacher_leila",
  teacher_physics: "seed_teacher_ahmed",
  teacher_french: "seed_teacher_sana",
  parent_1: "seed_parent_mohamed",
  parent_2: "seed_parent_fatma",
  student_1: "seed_student_yassine",
  student_2: "seed_student_amira",
  student_3: "seed_student_rayan",
};

async function tryCreate(label: string, op: () => Promise<unknown>): Promise<void> {
  try {
    await op();
    console.log(`  ✓ ${label}`);
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    if (
      msg.includes("already exists") ||
      msg.includes("ConditionalCheckFailed") ||
      msg.includes("conditional request failed")
    ) {
      console.log(`  · ${label} (exists, skipped)`);
    } else {
      console.error(`  ✗ ${label} — ${msg}`);
    }
  }
}

async function seed() {
  console.log("Seeding EduBoost demo data (Tunisia)…\n");

  console.log("1) Users");
  const users: Array<[string, string, string, "admin" | "teacher" | "parent" | "student"]> = [
    [U.admin, "Admin Demo", "admin.demo@eduboost.tn", "admin"],
    [U.teacher_math, "Leila Ben Ali", "leila.benali@eduboost.tn", "teacher"],
    [U.teacher_physics, "Ahmed Trabelsi", "ahmed.trabelsi@eduboost.tn", "teacher"],
    [U.teacher_french, "Sana Gharbi", "sana.gharbi@eduboost.tn", "teacher"],
    [U.parent_1, "Mohamed Jelassi", "mohamed.jelassi@eduboost.tn", "parent"],
    [U.parent_2, "Fatma Chaabane", "fatma.chaabane@eduboost.tn", "parent"],
    [U.student_1, "Yassine Jelassi", "yassine.jelassi@eduboost.tn", "student"],
    [U.student_2, "Amira Chaabane", "amira.chaabane@eduboost.tn", "student"],
    [U.student_3, "Rayan Ben Youssef", "rayan.benyoussef@eduboost.tn", "student"],
    // Directory teachers — exist so /teachers feels populated with realistic
    // variety across cities, subjects, experience levels, and price points.
    ["seed_teacher_mehdi", "Mehdi Chaabouni", "mehdi.chaabouni@eduboost.tn", "teacher"],
    ["seed_teacher_nadia", "Nadia Khemiri", "nadia.khemiri@eduboost.tn", "teacher"],
    ["seed_teacher_karim", "Karim Hamdi", "karim.hamdi@eduboost.tn", "teacher"],
    ["seed_teacher_ines", "Ines Mansouri", "ines.mansouri@eduboost.tn", "teacher"],
    ["seed_teacher_omar", "Omar Ben Romdhane", "omar.benromdhane@eduboost.tn", "teacher"],
    ["seed_teacher_rim", "Rim Belhadj", "rim.belhadj@eduboost.tn", "teacher"],
    ["seed_teacher_youssef", "Youssef Saidi", "youssef.saidi@eduboost.tn", "teacher"],
    ["seed_teacher_dorra", "Dorra Jemli", "dorra.jemli@eduboost.tn", "teacher"],
    ["seed_teacher_hichem", "Hichem Ayari", "hichem.ayari@eduboost.tn", "teacher"],
    ["seed_teacher_salma", "Salma Ben Abdallah", "salma.benabdallah@eduboost.tn", "teacher"],
    ["seed_teacher_tarek", "Tarek Hammami", "tarek.hammami@eduboost.tn", "teacher"],
    ["seed_teacher_amina", "Amina Bouazizi", "amina.bouazizi@eduboost.tn", "teacher"],
  ];
  for (const [userId, displayName, email, role] of users) {
    // cognitoSub is required on UserEntity. For seed rows we reuse the userId
    // — these aren't real Cognito users, just demo placeholders the browse
    // surfaces can join against for display purposes.
    await tryCreate(`user ${displayName} (${role})`, () =>
      UserEntity.create({ userId, cognitoSub: userId, displayName, email, role }).go(),
    );
  }

  console.log("\n2) Teacher profiles");
  type ProfileSeed = {
    userId: string;
    bio: string;
    subjects: string[];
    languages: string[];
    years: number;
    rateMillimes: number;
    city: string;
    country: string;
    trial: boolean;
    individual: boolean;
    group: boolean;
    ratingAvg: number;
    ratingCount: number;
    verificationStatus?: "verified" | "pending";
  };
  const profiles: ProfileSeed[] = [
    {
      userId: U.teacher_math,
      bio: "Professeur agrégée de mathématiques. Préparation du Baccalauréat section sciences.",
      subjects: ["Mathematics", "Algebra", "Calculus"],
      languages: ["Arabic", "French", "English"],
      years: 12,
      rateMillimes: 45000,
      city: "Tunis",
      country: "TN",
      trial: true,
      individual: true,
      group: true,
      ratingAvg: 4.7,
      ratingCount: 12,
    },
    {
      userId: U.teacher_physics,
      bio: "Docteur en physique, enseignant en préparatoire. Sciences physiques et chimie.",
      subjects: ["Physics", "Chemistry", "Science"],
      languages: ["Arabic", "French"],
      years: 8,
      rateMillimes: 50000,
      city: "Sfax",
      country: "TN",
      trial: true,
      individual: true,
      group: false,
      ratingAvg: 4.8,
      ratingCount: 9,
    },
    {
      userId: U.teacher_french,
      bio: "Professeure de français — niveaux collège et lycée, préparation DELF.",
      subjects: ["French", "Literature"],
      languages: ["French", "Arabic"],
      years: 15,
      rateMillimes: 40000,
      city: "Sousse",
      country: "TN",
      trial: true,
      individual: true,
      group: true,
      ratingAvg: 4.6,
      ratingCount: 18,
    },
    {
      userId: "seed_teacher_mehdi",
      bio: "Ingénieur logiciel et enseignant d'informatique. Python, algorithmique et préparation concours.",
      subjects: ["Computer Science", "Python", "Algorithms"],
      languages: ["Arabic", "French", "English"],
      years: 6,
      rateMillimes: 55000,
      city: "Tunis",
      country: "TN",
      trial: true,
      individual: true,
      group: false,
      ratingAvg: 4.9,
      ratingCount: 8,
    },
    {
      userId: "seed_teacher_nadia",
      bio: "Cambridge-certified English tutor. IELTS, TOEFL and conversational English for teens and adults.",
      subjects: ["English", "TOEFL", "IELTS"],
      languages: ["English", "Arabic", "French"],
      years: 10,
      rateMillimes: 60000,
      city: "Ariana",
      country: "TN",
      trial: true,
      individual: true,
      group: true,
      ratingAvg: 4.8,
      ratingCount: 15,
    },
    {
      userId: "seed_teacher_karim",
      bio: "18 ans d'expérience. Ancien enseignant à l'IPEIS Sfax. Maths + physique niveau bac et prépa.",
      subjects: ["Mathematics", "Physics"],
      languages: ["Arabic", "French"],
      years: 18,
      rateMillimes: 55000,
      city: "Sfax",
      country: "TN",
      trial: false,
      individual: true,
      group: true,
      ratingAvg: 4.9,
      ratingCount: 22,
    },
    {
      userId: "seed_teacher_ines",
      bio: "Pharmacienne et prof de SVT. Biologie, chimie et préparation au concours de médecine.",
      subjects: ["Biology", "Chemistry"],
      languages: ["French", "Arabic"],
      years: 7,
      rateMillimes: 40000,
      city: "Monastir",
      country: "TN",
      trial: true,
      individual: true,
      group: false,
      ratingAvg: 4.5,
      ratingCount: 6,
    },
    {
      userId: "seed_teacher_omar",
      bio: "أستاذ لغة عربية وأدب، خبرة ٢٠ سنة في التعليم الثانوي. تحضير للباكالوريا.",
      subjects: ["Arabic", "Literature"],
      languages: ["Arabic"],
      years: 20,
      rateMillimes: 35000,
      city: "Kairouan",
      country: "TN",
      trial: true,
      individual: true,
      group: true,
      ratingAvg: 4.6,
      ratingCount: 9,
    },
    {
      userId: "seed_teacher_rim",
      bio: "Professeure d'histoire-géographie. Méthodologie, dissertation et étude de documents.",
      subjects: ["History", "Geography"],
      languages: ["French", "Arabic"],
      years: 5,
      rateMillimes: 30000,
      city: "Nabeul",
      country: "TN",
      trial: true,
      individual: true,
      group: true,
      ratingAvg: 4.4,
      ratingCount: 4,
    },
    {
      userId: "seed_teacher_youssef",
      bio: "Expert-comptable. Économie, comptabilité et gestion — sections éco + licences.",
      subjects: ["Economics", "Accounting"],
      languages: ["French", "Arabic", "English"],
      years: 11,
      rateMillimes: 50000,
      city: "Tunis",
      country: "TN",
      trial: false,
      individual: true,
      group: false,
      ratingAvg: 4.7,
      ratingCount: 11,
    },
    {
      userId: "seed_teacher_dorra",
      bio: "Agrégée de lettres. Français, philosophie et méthodologie de la dissertation.",
      subjects: ["French", "Philosophy"],
      languages: ["French", "Arabic"],
      years: 14,
      rateMillimes: 45000,
      city: "Sousse",
      country: "TN",
      trial: true,
      individual: true,
      group: true,
      ratingAvg: 4.8,
      ratingCount: 14,
    },
    {
      userId: "seed_teacher_hichem",
      bio: "Étudiant doctorant en informatique. Tarifs étudiants, maths + info niveau lycée.",
      subjects: ["Computer Science", "Mathematics"],
      languages: ["Arabic", "French"],
      years: 3,
      rateMillimes: 25000,
      city: "Bizerte",
      country: "TN",
      trial: true,
      individual: true,
      group: false,
      ratingAvg: 4.3,
      ratingCount: 3,
    },
    {
      userId: "seed_teacher_salma",
      bio: "Fresh English teacher — building up my EduBoost profile! Conversational English, beginner-friendly.",
      subjects: ["English"],
      languages: ["English", "Arabic"],
      years: 2,
      rateMillimes: 20000,
      city: "Gabes",
      country: "TN",
      trial: true,
      individual: true,
      group: false,
      ratingAvg: 0,
      ratingCount: 0,
    },
    {
      userId: "seed_teacher_tarek",
      bio: "Prof de maths-physique, lycée pilote de Mahdia. Cours en ligne ou à domicile.",
      subjects: ["Mathematics", "Physics"],
      languages: ["Arabic", "French"],
      years: 9,
      rateMillimes: 42000,
      city: "Mahdia",
      country: "TN",
      trial: true,
      individual: true,
      group: true,
      ratingAvg: 4.6,
      ratingCount: 7,
    },
    {
      userId: "seed_teacher_amina",
      bio: "Enseignante de SVT. Cours de biologie pour collège et lycée, sections scientifiques.",
      subjects: ["Biology"],
      languages: ["French", "Arabic"],
      years: 4,
      rateMillimes: 28000,
      city: "Gafsa",
      country: "TN",
      trial: true,
      individual: true,
      group: false,
      ratingAvg: 4.5,
      ratingCount: 5,
      verificationStatus: "pending",
    },
  ];
  for (const p of profiles) {
    const status = p.verificationStatus ?? "verified";
    await tryCreate(`profile ${p.userId} (${p.city}, ${p.subjects[0]})`, () =>
      TeacherProfileEntity.create({
        userId: p.userId,
        bio: p.bio,
        subjects: p.subjects,
        languages: p.languages,
        yearsExperience: p.years,
        hourlyRateCents: p.rateMillimes,
        currency: "TND",
        ratingAvg: p.ratingAvg,
        ratingCount: p.ratingCount,
        verificationStatus: status,
        verifiedAt: status === "verified" ? now() : undefined,
        verifiedBy: status === "verified" ? U.admin : undefined,
        trialSession: p.trial,
        individualSessions: p.individual,
        groupSessions: p.group,
        city: p.city,
        country: p.country,
      }).go(),
    );
  }

  console.log("\n3) Classroom + memberships");
  const classroomId = "cls_seed_bac_math_2026";
  await tryCreate(`classroom ${classroomId}`, () =>
    ClassroomEntity.create({
      classroomId,
      teacherId: U.teacher_math,
      title: "Baccalauréat revision — Mathematics",
      subject: "Mathematics",
      description: "Weekly revision group for Tunisian bac students. Taught in French + Arabic.",
      maxStudents: 8,
      status: "active",
    }).go(),
  );
  for (const [userId, role] of [
    [U.teacher_math, "teacher"],
    [U.student_1, "student"],
    [U.student_2, "student"],
  ] as const) {
    await tryCreate(`membership ${userId}`, () =>
      ClassroomMembershipEntity.create({
        classroomId,
        userId,
        role,
      }).go(),
    );
  }

  console.log("\n4) Bookings");
  const bookings = [
    {
      bookingId: "bk_seed_yassine_math_trial",
      studentId: U.student_1,
      teacherId: U.teacher_math,
      type: "trial" as const,
      amountCents: 0,
      status: "confirmed" as const,
    },
    {
      bookingId: "bk_seed_amira_physics_single",
      studentId: U.student_2,
      teacherId: U.teacher_physics,
      type: "single" as const,
      amountCents: 50000, // 50 TND
      status: "confirmed" as const,
    },
  ];
  for (const b of bookings) {
    await tryCreate(`booking ${b.bookingId}`, () =>
      BookingEntity.create({
        ...b,
        currency: "TND",
        stripePaymentIntentId: `pi_seed_${b.bookingId}`,
      }).go(),
    );
  }

  console.log("\n5) Forum — Reddit-like threads across channels");

  // Every post keeps its id stable so a re-run is idempotent. Voter/commenter
  // ids cycle through seed users; we pre-increment upvotes/downvotes on the
  // post row to match the vote rows we write, since the backend normally
  // aggregates these as users vote in real time.
  type SeedPost = {
    postId: string;
    channelId: string;
    author: string;
    title: string;
    body: string;
    upvotes: number;
    downvotes?: number;
    comments: { commentId: string; author: string; body: string }[];
    voters?: { user: string; direction: "up" | "down" }[];
  };

  const U_ROTATION = [
    U.teacher_math,
    U.teacher_physics,
    U.teacher_french,
    "seed_teacher_nadia",
    "seed_teacher_mehdi",
    "seed_teacher_karim",
    U.student_1,
    U.student_2,
    U.student_3,
    U.parent_1,
    U.parent_2,
  ];

  const forumPosts: SeedPost[] = [
    {
      postId: "post_seed_tips_bac",
      channelId: "test-prep",
      author: U.teacher_math,
      title: "Tips for the 2026 Maths Bac — last-week revision plan",
      body:
        "Sharing what worked with my cohort last year:\n\n1. One full past paper per day, timed.\n2. One hour of corrigé after, no notes.\n3. Cards for the formulas you STILL get wrong.\n\nWhat topics do you think will come up this year? Last year was heavy on probability + suites.",
      upvotes: 24,
      comments: [
        { commentId: "cmt_seed_bac_1", author: U.student_1, body: "Probability got me last year too. Focusing on suites arithmético-géométriques this round." },
        { commentId: "cmt_seed_bac_2", author: "seed_teacher_karim", body: "+1 to timing. Doing papers without the clock is how I wasted my first year of prépa." },
        { commentId: "cmt_seed_bac_3", author: U.student_2, body: "Any specific past paper you'd recommend starting with? Bac 2021 or 2022?" },
      ],
      voters: [
        { user: U.student_1, direction: "up" },
        { user: U.student_2, direction: "up" },
        { user: U.student_3, direction: "up" },
        { user: U.parent_1, direction: "up" },
      ],
    },
    {
      postId: "post_seed_integration_by_parts",
      channelId: "mathematics",
      author: "seed_teacher_karim",
      title: "The only integration-by-parts mnemonic you need: LIATE",
      body:
        "Stuck picking u and dv? Go down this list — the first type that matches is your u:\n\n- **L**ogarithmic (ln x)\n- **I**nverse trig (arctan x)\n- **A**lgebraic (x², 3x + 1)\n- **T**rig (sin x, cos x)\n- **E**xponential (e^x)\n\nWorks ~95% of the time at bac / prépa level. Edge cases: products of two exponentials, or when integrating by parts twice to get back to the original.",
      upvotes: 38,
      comments: [
        { commentId: "cmt_seed_liate_1", author: U.student_1, body: "Mind. Blown. Why has no one taught me this before." },
        { commentId: "cmt_seed_liate_2", author: "seed_teacher_mehdi", body: "I use this for my CS students doing calculus — saves a chunk of time on exam day." },
        { commentId: "cmt_seed_liate_3", author: U.teacher_physics, body: "Works for physics integrals too (electric field, moments of inertia)." },
        { commentId: "cmt_seed_liate_4", author: U.student_2, body: "Tried it on 3 problems from last year's bac — worked on all of them. Thank you!" },
      ],
      voters: [
        { user: U.student_1, direction: "up" },
        { user: U.student_2, direction: "up" },
        { user: U.teacher_physics, direction: "up" },
        { user: "seed_teacher_mehdi", direction: "up" },
      ],
    },
    {
      postId: "post_seed_derivative_sin",
      channelId: "mathematics",
      author: U.student_3,
      title: "Why is the derivative of sin(x) equal to cos(x)? Visual intuition",
      body:
        "My teacher just handed me the formula. Is there a visual reason? Looking for an intuition pump before the bac, not a proof with limits and h→0.",
      upvotes: 12,
      comments: [
        { commentId: "cmt_seed_deriv_1", author: U.teacher_math, body: "Think of a point on the unit circle moving at constant speed. sin(x) is its height. How fast the height changes depends on how vertical the motion is at that moment — which is exactly cos(x)." },
        { commentId: "cmt_seed_deriv_2", author: "seed_teacher_karim", body: "Draw sin(x). At x=0 the curve is steepest going up → slope 1 = cos(0). At x=π/2 the curve is flat → slope 0 = cos(π/2). Same at every x." },
      ],
    },
    {
      postId: "post_seed_ohm_kirchhoff",
      channelId: "sciences",
      author: U.teacher_physics,
      title: "Ohm vs Kirchhoff — how I teach the difference in one sentence",
      body:
        "Ohm's law = the relationship across a single component: V = IR.\nKirchhoff's laws = what happens when you wire several components together (currents sum at a node, voltages sum around a loop).\n\nIf your students keep mixing the two, show them a single resistor (Ohm) then the same resistor inside a loop with a battery and a second resistor (Kirchhoff). It clicks fast.",
      upvotes: 19,
      comments: [
        { commentId: "cmt_seed_ohm_1", author: "seed_teacher_karim", body: "Good framing. I also get them to always label the current direction on the diagram before writing any law — half the errors are sign errors." },
      ],
    },
    {
      postId: "post_seed_english_irregulars",
      channelId: "languages",
      author: "seed_teacher_nadia",
      title: "Fastest way to memorize English irregular verbs — group by pattern, not alphabetically",
      body:
        "Most textbooks list them A-Z. Terrible. Group them by past-tense pattern:\n\n- **i → a → u**: begin / began / begun, swim / swam / swum\n- **-ought**: buy / bought / bought, think / thought / thought\n- **no change**: cut / cut / cut, hit / hit / hit\n\n40 verbs collapse to ~8 patterns. Students can name the pattern before conjugating.",
      upvotes: 27,
      comments: [
        { commentId: "cmt_seed_eng_1", author: U.student_2, body: "I always forgot 'flee / fled / fled' because it's not with anything else in the book. The pattern view helps." },
        { commentId: "cmt_seed_eng_2", author: U.student_3, body: "Any app you recommend for drilling these? Anki?" },
        { commentId: "cmt_seed_eng_3", author: "seed_teacher_nadia", body: "Anki works. I give students a deck grouped by pattern — DM me if you want it." },
      ],
    },
    {
      postId: "post_seed_dissertation_plan",
      channelId: "languages",
      author: U.teacher_french,
      title: "Plan de dissertation : thèse / antithèse / synthèse n'est PAS toujours la réponse",
      body:
        "Le plan dialectique est un réflexe, mais il ne marche que sur les sujets qui invitent un débat. Si le sujet vous demande d'analyser un mécanisme ou une oeuvre, le plan analytique (constat → causes → conséquences) tombe plus juste.\n\nCheck-list avant de choisir :\n- Le sujet oppose deux idées ? → dialectique\n- Le sujet demande 'comment' ou 'pourquoi' ? → analytique\n- Le sujet est une citation à commenter ? → thématique",
      upvotes: 14,
      comments: [
        { commentId: "cmt_seed_diss_1", author: U.student_2, body: "On m'avait toujours dit dialectique par défaut. Je sais ce que je rate maintenant." },
      ],
    },
    {
      postId: "post_seed_ielts_6_to_7",
      channelId: "test-prep",
      author: U.student_1,
      title: "Went from IELTS Speaking 6 to 7.5 in 6 weeks — here's what I did",
      body:
        "Was stuck at 6 because of fluency (too many 'um', 'you know'). Three things fixed it:\n\n1. Recorded myself daily on part-2 topics. Listened back. Counted filler words.\n2. Replaced fillers with deliberate pauses. 2 seconds of silence > 2 seconds of 'uhhh'.\n3. Expanded answers by 1 extra sentence each — going from 3-sentence answers to 4 pushed me over.\n\nAMA if you're stuck at 6 / 6.5.",
      upvotes: 42,
      comments: [
        { commentId: "cmt_seed_ielts_1", author: "seed_teacher_nadia", body: "Great breakdown. The 'replace filler with pause' tip is underrated — examiners mark fluency, not speed." },
        { commentId: "cmt_seed_ielts_2", author: U.student_3, body: "Currently at 6.5 on speaking. Going to try recording daily. Any topic generator you'd recommend?" },
        { commentId: "cmt_seed_ielts_3", author: U.student_1, body: "Reply to ^: the free Cambridge part-2 cue cards are enough. Don't bother with paid generators." },
      ],
      voters: [
        { user: U.student_2, direction: "up" },
        { user: U.student_3, direction: "up" },
        { user: "seed_teacher_nadia", direction: "up" },
        { user: U.parent_1, direction: "up" },
      ],
    },
    {
      postId: "post_seed_no_shows",
      channelId: "teachers-lounge",
      author: U.teacher_math,
      title: "How do you handle student no-shows? I'm done eating the cost",
      body:
        "Had 4 no-shows this month. No reply to reminders. Half my tolerance has evaporated.\n\nThinking of:\n- 24h cancellation window (no refund inside it)\n- Half-refund if they reschedule > 12h out\n- Full ban after 2 unexplained no-shows\n\nHow do other teachers handle this? The EduBoost platform currently refunds 24h out automatically which is already close to what I want — I just need a signal for repeat offenders.",
      upvotes: 31,
      comments: [
        { commentId: "cmt_seed_noshow_1", author: U.teacher_physics, body: "Do the 24h window. Nobody argues with a written policy. I also keep a personal 'don't rebook' list — not a ban, just I don't accept requests from the same student twice." },
        { commentId: "cmt_seed_noshow_2", author: U.teacher_french, body: "Two no-shows = I stop teaching them. Not worth the emotional hit." },
        { commentId: "cmt_seed_noshow_3", author: "seed_teacher_karim", body: "Send the reminder 3 hours before, not 24. 24h out they forget; 3h out they remember because their phone just pinged." },
      ],
      voters: [
        { user: U.teacher_physics, direction: "up" },
        { user: U.teacher_french, direction: "up" },
        { user: "seed_teacher_karim", direction: "up" },
        { user: "seed_teacher_nadia", direction: "up" },
      ],
    },
    {
      postId: "post_seed_group_pricing",
      channelId: "teachers-lounge",
      author: "seed_teacher_mehdi",
      title: "Group session pricing — what's fair for 4 students in Tunis?",
      body:
        "Currently charging 55 TND/hr individual. A parent asked about a group of 4. My instinct is 30 TND/hr/student = 120 TND/hr total (> individual, less per-student). But maybe that's too cheap?\n\nWhat's the norm in Tunis right now?",
      upvotes: 8,
      comments: [
        { commentId: "cmt_seed_grp_1", author: U.teacher_math, body: "I do 60% of my individual rate per student once the group hits 3+. So 33 TND/student at your rates. Slightly higher than what you suggested, still a discount." },
        { commentId: "cmt_seed_grp_2", author: U.parent_1, body: "As a parent — anything under 35/student for a proper teacher feels like a steal in Tunis. You're leaving money on the table at 30." },
      ],
    },
    {
      postId: "post_seed_best_teacher",
      channelId: "general",
      author: U.student_2,
      title: "Who's the best teacher you've worked with on EduBoost? (drop names)",
      body:
        "Dropping my vote: Leila Ben Ali for maths — went from 12/20 to 17/20 on the bac blanc in 8 weeks. Worth every millime.\n\nWho else should people know about?",
      upvotes: 16,
      comments: [
        { commentId: "cmt_seed_best_1", author: U.student_3, body: "Karim Hamdi in Sfax for physics + maths together. Intense, but the results speak." },
        { commentId: "cmt_seed_best_2", author: U.student_1, body: "Nadia Khemiri for IELTS. Got me from 6 to 7.5 (see my other post)." },
        { commentId: "cmt_seed_best_3", author: U.parent_2, body: "Sana Gharbi for French DELF — my daughter's first teacher who actually made her enjoy dissertation." },
      ],
      voters: [
        { user: U.student_3, direction: "up" },
        { user: U.parent_1, direction: "up" },
        { user: U.parent_2, direction: "up" },
      ],
    },
    {
      postId: "post_seed_parent_stress",
      channelId: "general",
      author: U.parent_2,
      title: "How do you keep your kid calm in the month before the bac?",
      body:
        "My daughter is spiraling. Every day is tears at some point. I've tried: more sleep, less phone, a revision plan, talking to her teacher. Nothing sticks.\n\nOther parents — what actually worked?",
      upvotes: 22,
      comments: [
        { commentId: "cmt_seed_stress_1", author: U.parent_1, body: "We moved revision to the park. Sounds dumb, but she studies better outside and we stopped fighting about the house being a mess." },
        { commentId: "cmt_seed_stress_2", author: U.teacher_french, body: "Speaking as a teacher — a short walk between revision blocks, not phone breaks. Phone breaks ADD stress." },
        { commentId: "cmt_seed_stress_3", author: "seed_teacher_nadia", body: "Worth booking a 30-min session with a teacher she likes just to talk through the timetable. Externalising the plan helps." },
      ],
      voters: [
        { user: U.parent_1, direction: "up" },
        { user: U.teacher_french, direction: "up" },
        { user: U.student_2, direction: "up" },
      ],
    },
    {
      postId: "post_seed_private_rate",
      channelId: "general",
      author: "seed_teacher_hichem",
      title: "First year teaching privately — how much should I charge?",
      body:
        "Doctoral student in CS, tutoring on the side. Tried 25 TND/hr and booked solid. Now debating whether to go to 35 or stay competitive.\n\nWhat did you charge in your first year? What signals should I use to raise the rate?",
      upvotes: 11,
      comments: [
        { commentId: "cmt_seed_rate_1", author: U.teacher_math, body: "If you're booked solid, raise. Your rate is a signal to students — too cheap reads as 'not serious'." },
        { commentId: "cmt_seed_rate_2", author: "seed_teacher_mehdi", body: "Went from 30 to 45 in 18 months. Nobody churned; the ones who would have churned at 45 are not the ones you want anyway." },
      ],
    },
  ];

  for (const p of forumPosts) {
    await tryCreate(`forum post ${p.postId}`, () =>
      ForumPostEntity.create({
        postId: p.postId,
        authorId: p.author,
        channelId: p.channelId,
        title: p.title,
        body: p.body,
        upvotes: p.upvotes,
        downvotes: p.downvotes ?? 0,
        score: p.upvotes - (p.downvotes ?? 0),
        commentCount: p.comments.length,
      }).go(),
    );
    for (const c of p.comments) {
      await tryCreate(`forum comment ${c.commentId}`, () =>
        ForumCommentEntity.create({
          postId: p.postId,
          commentId: c.commentId,
          authorId: c.author,
          body: c.body,
        }).go(),
      );
    }
    for (const v of p.voters ?? []) {
      await tryCreate(`forum vote ${p.postId}/${v.user}`, () =>
        ForumVoteEntity.create({
          targetId: p.postId,
          userId: v.user,
          targetType: "post",
          direction: v.direction,
        }).go(),
      );
    }
  }

  // Silence unused-local-const warnings from the helper rotation list when
  // the demo data doesn't use it directly — kept around for future seeding.
  void U_ROTATION;

  console.log("\n6) Wall post");
  await tryCreate("wall post", () =>
    WallPostEntity.create({
      postId: makeWallPostId(),
      teacherId: U.teacher_math,
      body: "Welcome to my EduBoost wall! Summer intensive booking is now open — 20% off until April 30.",
      commentCount: 0,
    }).go(),
  );

  console.log("\n7) Marketplace listings");
  await tryCreate("digital listing (Bac maths past papers)", () =>
    ListingEntity.create({
      listingId: "lst_seed_bac_math_papers",
      sellerId: U.teacher_math,
      kind: "digital",
      title: "Baccalauréat Mathematics — 10 years of past papers with solutions",
      description: "PDF pack: 2015–2025 bac maths papers with step-by-step solutions in French and Arabic.",
      subjects: ["Mathematics", "Algebra"],
      priceCents: 15000, // 15 TND
      currency: "TND",
      fileS3Key: "marketplace/lst_seed_bac_math_papers/file",
      fileMimeType: "application/pdf",
      fileSizeBytes: 4_200_000,
      status: "active",
    }).go(),
  );
  await tryCreate("physical listing (printed workbook)", () =>
    ListingEntity.create({
      listingId: "lst_seed_physics_workbook",
      sellerId: U.teacher_physics,
      kind: "physical",
      title: "Physics workbook — Tunisian Bac, printed edition",
      description: "400-page spiral-bound workbook covering mechanics, electricity, and optics. Shipped from Sfax.",
      subjects: ["Physics"],
      priceCents: 35000, // 35 TND
      currency: "TND",
      inStockCount: 20,
      shippingCostCents: 7000, // 7 TND delivery
      shipsFrom: "TN",
      weightGrams: 800,
      status: "active",
    }).go(),
  );

  console.log("\n8) Event");
  const eventId = makeEventId();
  await tryCreate("event (Tunis workshop)", () =>
    EventEntity.create({
      eventId,
      organizerId: U.teacher_math,
      title: "Atelier révision — Maths Bac, Tunis Centre-ville",
      description: "3-hour intensive revision on integrals and complex numbers. Snacks included.",
      venue: "Centre Culturel Ibn Rachiq, Tunis",
      startsAt: futureHours(24 * 14),
      endsAt: futureHours(24 * 14 + 3),
      capacity: 30,
      priceCents: 25000, // 25 TND
      currency: "TND",
      status: "published",
    }).go(),
  );

  console.log("\n9) Assessment + attempt");
  const examId = makeExamId();
  await tryCreate("assessment (derivatives MCQ)", () =>
    AssessmentEntity.create({
      examId,
      teacherId: U.teacher_math,
      title: "Quiz — Derivatives (Bac prep)",
      description: "5 MCQ on single-variable differentiation.",
      status: "published",
      questions: [
        {
          kind: "mcq",
          prompt: "d/dx of sin(x) equals…",
          options: ["cos(x)", "-cos(x)", "-sin(x)", "tan(x)"],
          correctIndex: 0,
        },
        {
          kind: "mcq",
          prompt: "d/dx of x² equals…",
          options: ["2x", "x", "x²/2", "2"],
          correctIndex: 0,
        },
        {
          kind: "short",
          prompt: "Briefly state the chain rule.",
        },
      ],
    }).go(),
  );
  await tryCreate("assessment attempt", () =>
    AssessmentAttemptEntity.create({
      examId,
      studentId: U.student_1,
      answers: [0, 0, "If y = f(g(x)) then dy/dx = f'(g(x)) * g'(x)."],
      autoScore: 2,
      maxMcqScore: 2,
    }).go(),
  );

  console.log("\n10) Study material");
  await tryCreate("study material (French notes)", () =>
    StudyMaterialEntity.create({
      materialId: makeMaterialId(),
      authorId: U.teacher_french,
      kind: "notes",
      title: "Fiches de révision — Candide (Voltaire)",
      subject: "French",
      description: "Summary sheets + key quotes for the bac literature programme.",
      fileS3Key: "study-materials/seed-french-notes/file",
      fileMimeType: "application/pdf",
      fileSizeBytes: 1_100_000,
    }).go(),
  );

  console.log("\n11) Support ticket + admin reply");
  const ticketId = makeTicketId();
  await tryCreate(`support ticket ${ticketId}`, () =>
    SupportTicketEntity.create({
      ticketId,
      userId: U.parent_1,
      subject: "Question about payment receipts (TND)",
      category: "payment_dispute",
      priority: "normal",
      status: "in_review",
      slaDeadline: futureHours(48),
    }).go(),
  );
  await tryCreate("user initial message", () =>
    TicketMessageEntity.create({
      ticketId,
      messageId: makeTicketMessageId(),
      authorId: U.parent_1,
      authorRole: "user",
      body: "Bonjour, j'ai payé une séance d'essai pour mon fils mais je ne vois pas de facture en ligne. Pouvez-vous m'aider ? Merci.",
      attachments: [],
    }).go(),
  );
  await tryCreate("admin reply", () =>
    TicketMessageEntity.create({
      ticketId,
      messageId: makeTicketMessageId(),
      authorId: U.admin,
      authorRole: "admin",
      body: "Bonjour Monsieur Jelassi — la séance d'essai était offerte, donc aucun paiement n'a été prélevé. Vous trouverez les factures de vos prochains paiements dans l'onglet 'Paiements' du tableau de bord. Cordialement.",
      attachments: [],
    }).go(),
  );

  console.log("\nDone. Refresh the site to see seeded data.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
