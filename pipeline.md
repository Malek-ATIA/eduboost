# EduBoost Implementation Audit Pipeline

## Purpose

After every implementation step (feature, group of features, or refactor), two agents run in sequence. The goal is **zero loose ends**: every line of the product spec is either (a) implemented and verified, (b) deliberately deferred with a tracked marker in `pipeline.md §Deferred`, or (c) surfaced as a gap to fix immediately.

Claude is responsible for implementation. Audit agents are responsible for catching what Claude missed.

## Roles

### 1. Auditor Agent — read-only

- Subagent type: **Explore** (no write tools)
- Input: feature(s) to audit + spec section references
- Output: structured gap report (Markdown)
- Scope: what's in code vs. what the spec demands
- Strictly: does not edit files, does not assume a gap is fixed — only reports

### 2. Verifier Agent — edit-capable

- Subagent type: **general-purpose** (full tools including Edit, Write)
- Input: auditor report + the feature's implementation files
- Output: list of fixes applied + list of gaps that require a decision
- Scope:
  - Independently verify each finding in the auditor's report (trust but verify — read the actual code)
  - Find additional issues the auditor missed (security, correctness, integration, type errors)
  - FIX every gap that is within the feature's scope and does not require a product decision
  - For gaps requiring product decisions, document clearly with options

## Pipeline (per step)

```
[Claude implements feature X]
        ↓
[Auditor Agent: audit feature X against spec]
        ↓  auditor report
[Verifier Agent: verify report + fix gaps]
        ↓  fixes applied + decisions needed
[Claude integrates decisions, moves on to feature X+1]
```

**Rule:** Claude does not declare a feature done until the Verifier reports "no remaining gaps" or all remaining gaps are explicitly marked Deferred in this file.

## Spec (source of truth)

The spec is the user's original agenda. Copied verbatim so agents have a single source.

---

### EduBoost.com — Specification

**Agenda**

Timeline and features of the MVP (Minimum Viable Product):
- Features highlighted in blue
- 3 months

**Action points for the next Meeting**

- Final name of the service: EduBoost
- Finish Phase 1 (Ideation):
  - Gather feedback of potential users (target 7 users each)
  - Validation of the product
  - Final problem statement of the product
  - Integration: user domain, Google (drive, slide, docs, calendar…) SMTP, SMS, educational tools, Social media, whiteboard …

**Discussion Points**

**Service:**
- Professional platform for tutoring with all required features
- Trustworthy go-to platform for students and their parents to find good teachers for all subjects (payment, rating other users' feedback, profile checking by team, money back guaranteed, trial sessions, assessment exams, review session between teachers and students/parents, Quiz on teacher's performance, comprehensive dispute system for payments and reviews …)
- Trustworthy go-to platform for teachers and organizations: reliable payments, high-quality teaching tools, good financial reporting, minimum wage, rating and reviews credibility, comprehensive dispute system for payments and reviews, marketplace, AI grading system ?…
- Marketplace for digital and printed tutorials (individuals, organizations), goods, events
- Event planning services: venue, dates, ticketing, organization

**Users:**
- Students and parents, teachers and trainers, private educational institutions (schools, training centers …), commercial institutions (bookstores, school materials …), other professionals (education experts, children psychologists ….)?

**Features:**

**Generic features:**
- Search functionality
- Filtering options per subject, experience, rating, location, trial sessions, individual / group sessions …
- Profile viewing
- Register / sign in
- FAQ, Contact (email, WhatsApp, phone …)
- Management of bills and payments

**Classroom:**
- Group chats per classroom moderated by the teacher (optional)
- Group whiteboard
- Split rooms
- Note keeping of key learning points
- Recording of sessions
- Notifications: accept meet-up sessions, lesson requests …
- Forum (Reddit style): posts, shared experiences, questions, comments, votes, channels …
- Terms and conditions, Teaching/Learning Code of Conduct
- AI grading system (to check instadeep model)
- Inter-users chat (based on invitation)
- Ban students / parents

**Parent Space:**
- Profile of parent
- Save preferred profiles of T&Os
- CRUD for children: create, remove, update, delete
- Communication with T&Os: chatting, request meet-up sessions, request lessons
- Relationships can be adjusted on requests and acceptance
- My calendar
- Reminders (platform and personalized)
- Communication with website: File dispute, support tickets
- Payments: make payment, payment history, download invoices …
- Analytics space (shared with T&Os)
- (tbd) suggested T&Os (for paid advertisements)
- Invite a friend and get rewarded

**Student Space:**
- Profile of student: my exams, courses, teachers
- Save preferred profiles of T&Os
- Communication with T&Os: chatting, request meet-up sessions, request lessons
- Accept Relationship requests
- Classrooms and sessions
- My calendar
- Exams, quizzes, mailbox (from teacher)
- Payments: make payment, payment history, download invoices
- Analytics space (shared with T&Os)
- Reminders
- (tbd) suggested T&Os (for paid advertisements)
- Invite a friend and get rewarded
- Extra study materials (for paid memberships)
- Communication with website: File dispute, support tickets

**Teacher Space:**
- Profile of teacher: wall (Posts and updates of activities and achievements with comment section)
- Study materials portal:
  - Sharing prepared exams with students
  - Overview of previous exams, results
  - Integrated platforms (see above)
  - Preparation of used materials (exams, quizzes, documents …)
- Classroom portal:
  - Manage courses
  - Assignment of students to classrooms
  - Students (Parent) Portal:
    - (Children)
    - Grades and assessments
    - Analytics
    - Classrooms
    - Attendance
    - Payments
    - Chatbox
- Marketplace
- Payments: make/accept payment, payment history, download invoices, refunds
- Analytics space
- My calendar
- Reminders (platform and personalized)
- Communication with website: File dispute, support tickets
- Invite a user and get rewarded?

**For private educational organizations:**
- Team
  - Teachers: Same educational features as other teachers
  - Administration: Assign students per classroom per teacher, payments, signups

**For commercial organizations:**
- Marketplace

**Membership and payments plan:**
- Payments upfront occur via the platform
- T&Os: Packages depending on classroom size and offered extra features
- S&Ps: basic account for free, paid extra features (monthly, one-time)
- Marketplace: x% of every sold product
- Ads (tbd)

---

## Platform constraints (locked)

- Region: **eu-west-1**, AWS profile `malek.atia2`
- IaC: AWS CDK (TypeScript)
- DB: DynamoDB single-table (ElectroDB). Switch to hybrid pre-launch possible while tables empty.
- API: API Gateway HTTP API + single Lambda (Hono)
- Auth: Cognito
- Email: Resend (not SES)
- Video: Amazon Chime SDK
- Frontend: Next.js 15 via OpenNext → CloudFront + Lambda

## Auditor Agent — Prompt Template

Copy-paste this into the Agent tool, subagent_type = `Explore`:

```
You are the Auditor Agent for the EduBoost project. Read-only.

Your job: compare the code in /Users/malek/Downloads/medicalApp/eduboost against the EduBoost specification in /Users/malek/Downloads/medicalApp/eduboost/pipeline.md (§ Spec) and produce a thorough gap report.

SCOPE FOR THIS RUN: {{feature_or_features}}

WHAT TO CHECK (for the scoped features only):

1. FEATURE COVERAGE — For each bullet in the spec that falls under the scope:
   - Is it implemented? Name the file + symbol.
   - Is it partially implemented? What's missing?
   - Is it absent? Explicit "not implemented."

2. INTEGRATION CORRECTNESS — For each implementation:
   - Is the DB entity schema consistent across db/, lambdas/, web/?
   - Are API routes wired in app.ts? Is auth middleware applied where required?
   - Are CDK permissions sufficient (IAM policies, bucket policies, Cognito triggers)?
   - Are Lambda env vars declared in CDK AND consumed in lambdas/src/env.ts AND referenced in code?
   - Frontend: does the page call an API route that actually exists with the right shape?

3. SECURITY — Spot-check:
   - Public routes (no Cognito authorizer): /health, /webhooks/{proxy+} ONLY. Anything else public is a gap.
   - Stripe webhook: verifies signature using raw body? Returns 400 on bad sig?
   - Input validation: zod schemas on every mutating endpoint?
   - IDOR: does each endpoint check the caller owns the resource?
   - Secrets: no hardcoded keys. All come from env/SSM.
   - CORS: not overly permissive for authenticated routes in prod (acceptable in MVP).

4. TYPE / BUILD SANITY:
   - Do imports resolve? (e.g. @eduboost/db paths are correct)
   - Are Hono routes mounted before the /{proxy+} catch-all in the right order?
   - Do ElectroDB entities match the DynamoDB table schema (pk/sk + gsi1/2/3)?
   - Are Next.js pages marked "use client" when they use hooks/state?

5. SPEC LITERAL CHECK — Read the spec verbatim. List every bullet that is NOT implemented, regardless of scope, so Claude sees the full outstanding backlog.

OUTPUT FORMAT (strict):

## Audit Report: {{feature}}
Date: <today>

### Summary
- Features implemented: N
- Partial: N
- Missing (in scope): N
- Missing (out of scope but flagged): N
- Security issues: N
- Integration bugs: N

### Implemented ✓
- <feature bullet> → <file:line>

### Partial ⚠
- <feature bullet> → <file:line>
  - What's missing: ...

### Missing ✗
- <feature bullet> (in-scope / out-of-scope)

### Security findings
1. <severity> — <file:line> — <description>

### Integration bugs
1. <file:line> — <description>

### Type / build issues
1. <file:line> — <description>

### Spec bullets not addressed anywhere in the codebase
- list each

DO NOT EDIT ANY FILES. Only read and report. Be specific — cite file:line for every claim.
```

## Verifier Agent — Prompt Template

Copy-paste this into the Agent tool, subagent_type = `general-purpose`:

```
You are the Verifier Agent for the EduBoost project. You have full edit tools.

INPUTS:
- Auditor report: {{paste_auditor_report_here}}
- Scope: {{feature_or_features}}

YOUR JOB:

1. VERIFY EACH AUDITOR FINDING
   For every item in the auditor report:
   - Open the file at the cited path. Confirm or disprove the finding.
   - If disproved: note "false positive — <why>".
   - If confirmed: proceed to step 2.

2. FIND WHAT THE AUDITOR MISSED
   The auditor is good but not perfect. Independently scan the feature's files for:
   - Unhandled error paths (missing try/catch on Stripe/Chime/DDB calls that can throw)
   - Broken promise chains (missing await)
   - Typos in env var names between CDK and lambdas/src/env.ts
   - Routes declared but not mounted in app.ts
   - ElectroDB entity fields referenced in code but not in the schema
   - IAM policies missing actions the code uses (e.g. chime:CreateMediaCapturePipeline)
   - Frontend pages that call endpoints with wrong method, path, or body shape
   - Missing "use client" on files using hooks
   - Unused imports/variables that indicate half-finished work

3. FIX EVERY GAP YOU CAN
   For confirmed gaps within the feature's scope:
   - Edit/Write files to fix the issue
   - Keep changes minimal — do not refactor unrelated code
   - Preserve existing patterns (ElectroDB, Hono, Tailwind, etc.)
   - Do not add new dependencies without strong reason
   - Do not touch files outside the feature's blast radius

4. LIST DECISIONS FOR CLAUDE
   For gaps that require a product/architecture decision (not mechanical fix), document:
   - What the gap is
   - 2–3 options with tradeoffs
   - Your recommendation

5. FINAL SANITY CHECK
   After fixes, re-read the touched files. Confirm:
   - No new syntax errors
   - All imports resolve
   - Route mounting order preserved
   - No new hardcoded secrets

OUTPUT FORMAT (strict):

## Verifier Report: {{feature}}
Date: <today>

### Auditor findings — verified
- <finding> — confirmed / false positive (why)

### Additional issues found
1. <file:line> — <description>

### Fixes applied
1. <file> — <what was changed and why>

### Decisions required from Claude
1. <gap> — options: A/B/C — recommendation: A

### Files modified
- <list>

### Verification status
- Remaining in-scope gaps: 0 / N
- Feature ready for sign-off: yes / no
```

## Deferred (explicit)

Items from the spec that are intentionally NOT in MVP scope. Must be listed here to avoid being flagged as gaps.

- Marketplace (digital/printed tutorials, goods, events)
- Event planning services (venue, dates, ticketing, organization)
- Forum (Reddit-style posts, comments, votes, channels)
- AI grading system (instadeep model integration)
- Whiteboard
- Split rooms (breakout rooms within classroom)
- Note-keeping of key learning points
- SMS notifications
- Integrations: Google Drive/Docs/Slides/Calendar, WhatsApp, social media, external educational tools
- Suggested T&Os (paid advertisements)
- Invite-a-friend rewards
- Quiz on teacher's performance
- Assessment exams
- Review session between teachers and students/parents
- Profile checking by team (manual verification workflow)
- Money-back guarantee policy (UX + backend)
- Comprehensive dispute system for payments and reviews
- Private educational organization team admin (assign students per classroom)
- Commercial organization marketplace
- Membership plans / paid extras
- Financial reporting dashboards for teachers
- Minimum wage enforcement for teachers
- Parent/student analytics space
- Teacher wall (posts + comments)
- Study materials portal with exam sharing
- Mailbox (parent↔teacher async inbox beyond DM)
- Grades and assessments
- Attendance tracking
- Invoice download (PDF)
- Calendar UI + reminders
- Lesson-request flow as distinct from booking (accept/reject, request/response states)
- Scheduled session reminders (requires EventBridge scheduler or equivalent)
- Lesson-request flow as distinct from booking (accept/reject, request/response states)
- Scheduled session reminders (requires EventBridge scheduler or equivalent)

## In-scope MVP features (must pass audit)

| # | Feature | Status | Last audited |
|---|---|---|---|
| 1 | Cognito auth w/ role groups (parent/student/teacher) | **signed off** | 2026-04-16 |
| 2 | Post-confirmation → DDB user row + welcome email | **signed off** | 2026-04-16 |
| 3 | Teacher profile create/edit (API + UI) | **signed off** | 2026-04-16 |
| 4 | Teacher browse + detail (API + UI) | partial — only country filter | 2026-04-16 |
| 5 | Booking + Stripe PaymentIntent (API + UI) | **signed off** | 2026-04-16 |
| 6 | Stripe webhook → booking confirmed + Payment row + email | **signed off** | 2026-04-16 |
| 7 | Bookings list (API + UI) | **signed off** | 2026-04-16 |
| 8 | Classroom: Chime SDK meeting join/end (w/ authz) | **signed off** | 2026-04-16 |
| 9 | Classroom: MediaPipelines recording start/stop (w/ authz) | **signed off** | 2026-04-16 |
| 10 | Classroom: ephemeral in-meeting chat + persistence | **signed off** | 2026-04-16 |
| 11 | Persistent chat: DM + classroom channels in DDB | **signed off** | 2026-04-16 |
| 12 | Terms & Conditions / Code of Conduct (display + acceptance on signup) | **signed off** | 2026-04-16 |
| 13 | FAQ + Contact page | **signed off** | 2026-04-17 |
| 14 | Search + filters (subject, experience, rating, location, trial, individual, group) | **signed off** | 2026-04-16 |
| 15 | Ban student/parent (admin tool) | **signed off** | 2026-04-17 |
| 16 | Support ticket (file dispute, contact website) | **signed off** | 2026-04-17 |
| 17 | Notifications (in-app bell + page, triggers on booking/chat events) | **signed off** | 2026-04-16 |

## Audit log

### 2026-04-16 — first retrospective pass (features 1–12)

**Auditor findings:**
- False positives (disproved by Verifier):
  - Route ordering in `cdk/lib/api-stack.ts` — HTTP API routes match by specificity, not declaration order, so `/health` and `/webhooks/{proxy+}` correctly win over `/{proxy+}`.
  - DM IDOR in `lambdas/src/routes/chat.ts` — `dmChannelId(sub, otherUserId)` always includes the caller's own `sub`, so a caller cannot construct a channelId for a DM they are not part of.
  - AWS_REGION env — Lambda runtime injects it automatically; benign.
- Confirmed gaps, all fixed:
  - Classroom chat was ephemeral-only; now persists to `/chat/classroom/:classroomId` alongside Chime data messages.
  - Signup form now enforces T&C acceptance via checkbox and writes `custom:tos_accepted_at` Cognito attribute.
- Additional issues found by Verifier and fixed:
  - `SessionEntity.patch().set({ field: undefined })` silently no-ops in ElectroDB — replaced with `.remove()` for `chimePipelineId` clearing in `chime.ts`.
  - Dead `/teacher/classrooms` link in dashboard — removed.
  - Booking schema allowed empty `teacherId` and zero `amountCents` — tightened to `min(1)` and `min(50)` (Stripe floor).
  - Chime endpoints (join/end/recording start/stop) had no authorization — `join` now requires classroom membership or teacher; `end` and recording endpoints now require caller to be the session's teacher.
  - Booking creation did not verify `teacherId` corresponds to a user with `role: "teacher"` — now fetched and checked.
  - Next.js 15 async `params` — dynamic pages now use `use(params)` from React and typed as `Promise<{...}>`.
- Deferred (tracked):
  - Search filters beyond country — row 14 remains "partial".
  - Stripe charge.refunded fallback to PaymentIntent metadata — LOW severity, acceptable for MVP.
  - CORS origin `*` — acceptable for MVP, lock to CloudFront domain before production.

### 2026-04-17 — Features 13 + 15 pass (FAQ/Contact + admin ban tool)

**Auditor + Verifier findings:**
- Feature 13: FAQ sections (general / students-parents / teachers) + contact channels (email, WhatsApp, phone) + link to `/support/new` — accessible anonymously, SSR, semantic HTML. Clean.
- Feature 15 confirmed end-to-end: `bannedAt`/`banReason` on UserEntity, middleware ban check (fail-open on DDB error — documented inline), `requireAdmin` alias, admin routes (list by role/scan, by-email lookup, detail, ban/unban, tickets), Cognito AdminDisableUser/AdminEnableUser IAM scoped to user pool ARN, admin UI pages gated by `isAdmin(session)` on `cognito:groups`.
- No bugs found. Three MVP tradeoffs (N+1 DDB read on auth, fail-open on DDB error, group-vs-role split) documented inline in `auth.ts`. Banned-user frontend UX tradeoff documented in `web/src/lib/api.ts`.
- Cognito group (not DDB role) is the source of truth for admin access. DDB `role="admin"` is defence-in-depth only.

**Files modified in Features 13 + 15 pass:**
- `web/src/app/faq/page.tsx` — new
- `web/src/app/page.tsx`, `web/src/app/dashboard/page.tsx` — FAQ links + admin card
- `db/src/entities/user.ts` — `bannedAt`, `banReason`
- `lambdas/src/middleware/auth.ts` — ban check, `requireAdmin` alias, tradeoff docs
- `lambdas/src/routes/admin.ts` — new admin routes
- `lambdas/src/app.ts` — mount `/admin`
- `lambdas/src/lib/resend.ts` — `accountBanned` + `accountRestored` templates
- `cdk/lib/api-stack.ts` — Cognito IAM scoped to user pool ARN
- `web/src/lib/cognito.ts` — `isAdmin`, `currentGroups` helpers
- `web/src/lib/api.ts` — banned-user UX tradeoff doc
- `web/src/app/admin/page.tsx`, `admin/users/page.tsx`, `admin/users/[userId]/page.tsx`, `admin/tickets/page.tsx` — new admin UI

### 2026-04-17 — Feature 16 pass (support tickets)

**Auditor + Verifier findings:**
- All spec bullets (file dispute, support tickets, payment dispute with booking link) implemented.
- Confirmed intentional: new tickets keep `status=open` until first reply — documented inline in `support.ts`.
- Fixed: closed/resolved ticket reply bypass at the API — now returns 409 for non-admins.
- Fixed: unsafe `searchParams.get("category") as Category | null` cast — replaced with `isCategory` type guard.
- Fixed: Next.js 15 `useSearchParams` requires Suspense — `/support/new` body extracted into `NewTicketForm` wrapped in `<Suspense>`.
- Auth middleware correctly reads `cognito:groups` from the access token for admin checks.

**Files modified in Feature 16 pass:**
- `db/src/entities/support.ts` — `SupportTicketEntity`, `TicketMessageEntity`, category/status/priority/role enums
- `db/src/entities/index.ts` — re-exports
- `db/src/entities/notification.ts` — added `support_ticket_reply` type
- `lambdas/src/routes/support.ts` — create / list / detail / reply (with 409 on closed-reply)
- `lambdas/src/app.ts` — mount `/support`
- `web/src/app/support/page.tsx` — my tickets list
- `web/src/app/support/new/page.tsx` — form with Suspense boundary + validated preset category
- `web/src/app/support/[ticketId]/page.tsx` — thread view + reply
- `web/src/app/dashboard/page.tsx` — Support link for all roles

### 2026-04-16 — Feature 17 pass (notifications)

**Auditor findings:**
- All 6 implemented notification types (booking_created, booking_confirmed, booking_cancelled, booking_refunded, new_dm, new_classroom_message) fire from the correct trigger sites.
- Dead links CONFIRMED: `/chat/{senderId}` and `/classroom-chat/{classroomId}` had no corresponding frontend pages — Verifier created both (`web/src/app/chat/[otherUserId]/page.tsx` and `web/src/app/classroom-chat/[classroomId]/page.tsx`).
- Unused enum types CONFIRMED: `lesson_request`, `lesson_accepted`, `session_reminder` — removed from `NOTIFICATION_TYPES` and deferred.
- ElectroDB `response: "all_new"` syntax verified CORRECT.
- Bell polling, notify() error isolation, notifications page linkPath guarding — all confirmed safe.
- Unread-count endpoint capped at 100: documented inline and acceptable for MVP (UI shows "99+").

**Files modified in Feature 17 pass:**
- `db/src/entities/notification.ts` — new entity, enum trimmed to fired types
- `db/src/entities/index.ts` — export helpers
- `lambdas/src/lib/notifications.ts` — shared helper with internal error isolation
- `lambdas/src/routes/notifications.ts` — list / unread-count / mark-read / mark-all
- `lambdas/src/app.ts` — mount `/notifications`
- `lambdas/src/routes/bookings.ts` — booking_created trigger + email to teacher
- `lambdas/src/routes/webhooks.ts` — booking_confirmed / cancelled / refunded triggers
- `lambdas/src/routes/chat.ts` — new_dm + new_classroom_message (broadcast) triggers
- `web/src/components/NotificationBell.tsx` — polling bell with unread badge
- `web/src/app/notifications/page.tsx` — list + mark-read on click + mark-all
- `web/src/app/dashboard/page.tsx` — embeds bell
- `web/src/app/chat/[otherUserId]/page.tsx` — new DM page
- `web/src/app/classroom-chat/[classroomId]/page.tsx` — new standalone classroom chat page

### 2026-04-16 — Feature 14 pass (teacher search + filters)

**Auditor findings:**
- All 6 spec dimensions covered in the API (subject, experience, rating, location, trial, group) with price range as a bonus.
- City filter was missing end-to-end — Verifier added to zod schema, where clause, and UI.
- Individual vs. Group modeling ambiguity — DECIDED (Option B): added `individualSessions: boolean` with default `true` to TeacherProfileEntity, exposed in profile form and search filters.
- Public browse auth gate — DECIDED (Option A): added explicit GET `/teachers` and GET `/teachers/{proxy+}` routes in CDK without authorizer. PUT `/teachers/me` still goes through `/{proxy+}` catch-all with authorizer.

**Files modified in Feature 14 pass:**
- `lambdas/src/routes/teachers.ts` — filter query schema expanded, `individual` dimension added
- `db/src/entities/teacher.ts` — `individualSessions` attribute added (default true)
- `cdk/lib/api-stack.ts` — public GET routes for /teachers and /teachers/{proxy+}
- `web/src/app/teacher/profile/page.tsx` — individualSessions checkbox
- `web/src/app/teachers/page.tsx` — city + individual filter

**Files modified in fix pass:**
- `cdk/lib/auth-stack.ts` — added `custom:tos_accepted_at` attribute
- `lambdas/src/routes/bookings.ts` — tightened schema, verify teacher role
- `lambdas/src/routes/chime.ts` — authorization on all endpoints, use `.remove()` for pipelineId clearing
- `lambdas/src/routes/sessions.ts` — new `GET /sessions/:sessionId` with authz
- `lambdas/src/app.ts` — mount `sessionRoutes`
- `web/src/lib/cognito.ts` — `signUp` accepts `tosAcceptedAt`
- `web/src/app/signup/page.tsx` — T&C checkbox
- `web/src/app/terms/page.tsx` — new placeholder T&C + Code of Conduct
- `web/src/app/classroom/[sessionId]/page.tsx` — fetches session for classroomId, persists chat
- `web/src/app/teachers/[userId]/page.tsx` — async params
- `web/src/app/book/[teacherId]/page.tsx` — async params

## How to run the pipeline

Each entry under "In-scope MVP features" must go through:

1. Claude implements or confirms implementation
2. Run Auditor with scope = that feature
3. Read report; run Verifier with the report
4. Apply Verifier's decisions; update the "Last audited" column and "Status"
5. Move to next row

Retroactive run: first pass audits all 11 rows currently marked "implemented" as a single batch, subsequent passes are per-feature.

## Rules the auditor and verifier must respect

- Never mark a finding "confirmed" without citing file:line evidence.
- Never mark a finding "false positive" without a concrete reason (code + doc reference).
- The Verifier must read the actual file before accepting or rejecting an Auditor claim.
- Fixes must be minimal: do not refactor, do not rename, do not introduce new deps unless justified.
- If a gap requires a product decision, surface it with 2–3 options and a recommendation — do not silently design around it.
- Route ordering in AWS HTTP API is by specificity, NOT registration order. Do not flag route-order bugs unless specificity rules are actually violated.
- ElectroDB `.set({ field: undefined })` does NOT remove the attribute. Use `.remove(["field"])`.
- DM channels use `dmChannelId(a, b)` which sorts the pair — the caller's `sub` is always in the channelId, so cross-user DM reads via this endpoint are impossible by construction.
- Lambda reserves env var names with `AWS_` prefix for runtime-injected values. Custom account ID env var is `ACCOUNT_ID` (not `AWS_ACCOUNT_ID`).
- Next.js 15 page props: `params` is `Promise<T>`; unwrap with `use(params)` in client components.
