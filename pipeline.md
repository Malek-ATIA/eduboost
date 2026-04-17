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

Items from the spec that are intentionally NOT in MVP scope. Must be listed here to avoid being flagged as gaps. Entries that were initially deferred but have since shipped are listed under `### Shipped in later phases` below so the pruning history isn't lost.

- Event planning services (venue, dates, ticketing, organization) — distinct from the marketplace-for-goods which is shipped
- Note-keeping of key learning points (per-session structured notes UI)
- Integrations beyond Google Calendar: Google Drive/Docs/Slides, WhatsApp, social media, other external educational tools
- Suggested T&Os (paid advertisements)
- Quiz on teacher's performance
- Non-AI assessment exams (graded + timed tests — AI grading of free-text submissions is shipped as 2F.1)
- Review session between teachers and students/parents (structured post-course retrospective meetings — distinct from the star-review system)
- Money-back guarantee policy (UX flow + automated refund logic — manual admin refunds shipped as 2F.4)
- Minimum wage enforcement for teachers (price floors on listings/bookings)
- Study materials portal with exam sharing (peer-to-peer exam bank — distinct from marketplace digital goods)
- Mailbox (parent↔teacher async inbox with a threaded UI beyond DM)

### Shipped in later phases (previously deferred)

These rows were in the deferred list earlier in the project and have since landed; kept here for audit-trail continuity.

- Marketplace (digital/printed tutorials, goods) — shipped 2C.1; commercial-org marketplace shipped 2F.7
- Forum (Reddit-style posts, comments, votes, channels) — shipped 2D
- Invite-a-friend rewards — shipped as referrals 2E.3
- Profile checking by team (manual verification workflow) — shipped 2E.1 (admin verifications console)
- Membership plans / paid extras — shipped 2C.2
- Financial reporting dashboards for teachers — shipped 2C.3 (`/teacher/earnings`)
- Teacher wall (posts + comments) — shipped 2D
- Grades — shipped 2F.1 (AI grading via Bedrock)
- Attendance tracking — shipped 2B
- Invoice download (PDF) — shipped 2B
- Calendar UI + reminders — shipped 2B
- Lesson-request flow (distinct from booking) — shipped 2A
- Scheduled session reminders (EventBridge scheduler) — shipped 2B
- Google Calendar integration — shipped 2E.5
- Private educational organization team admin — shipped 2F.6
- Parent/student analytics space — shipped 2F.5
- Comprehensive dispute system — shipped 2F.4
- Whiteboard — shipped 2F.3
- Breakout rooms — shipped 2F.2

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
| 18 | SMS notifications (AWS SNS, phone verify + opt-in) | **signed off** | 2026-04-17 |

## Audit log

### 2026-04-17 — Phase 2F #7 pass (Commercial-org marketplace)

**Commercial organizations can sell marketplace listings under the org's name** — signed off
- `ListingEntity` gains an optional `sellerOrgId?: string` attribute in `db/src/entities/marketplace.ts`. Existing individual-seller listings are unaffected (attribute simply absent).
- `POST /marketplace/listings` (in `lambdas/src/routes/marketplace.ts`) accepts the optional `sellerOrgId` in the create schema. When present, the route independently fetches the org and the caller's membership, and rejects with: `org_not_found` (404), `not_a_commercial_org` (400 — educational orgs can't sell), `not_an_org_member` (403), or `not_org_admin` (403 — role must be `owner` or `admin`). `sellerId` remains the teacher's `sub` so payouts still route to the teacher's Stripe account.
- New `GET /marketplace/orgs/:orgId/listings` returns active listings filtered by `sellerOrgId === orgId`. Public read, matching the existing `/listings` and `/listings/:listingId` surface — all rows returned have `status === "active"`, so no private data to gate on.
- UI: `web/src/app/seller/listings/new/page.tsx` fetches `/orgs/mine` on mount, filters to `kind === "commercial"` with `myRole ∈ {owner, admin}`, and renders a "Sell as" dropdown only when at least one such org exists. `sellerOrgId` state starts empty (default option "Myself (individual seller)") and is sent as `undefined` when empty so the backend treats the create as an individual listing. `/orgs/mine` failures are swallowed so a user with no orgs never sees an error.
- UI: `web/src/app/orgs/[orgId]/page.tsx` grew a "Marketplace listings" section rendered only when `org.kind === "commercial"`. Section calls `/marketplace/orgs/${orgId}/listings` in the same `Promise.all` as the existing org/classroom loads, shows an empty-state copy, and owner/admin members see an "Add listing →" shortcut.
- Auditor's blocker 1 (confirmed by Verifier reading `lambdas/src/routes/marketplace.ts`): the comment above `GET /orgs/:orgId/listings` said "Open to any authenticated user" but the route has no `requireAuth` guard. Matches the pattern of `GET /listings` (line 36) and `GET /listings/:listingId` (line 50), both of which are public reads. The code is correct — the comment was misleading.
- Verifier fix: rewrote the comment to "Public read, matching the existing /listings and /listings/:listingId endpoints — all rows returned are filtered to status === 'active', so there is no private data to gate on." Did NOT add `requireAuth` — would have broken consistency with the rest of the marketplace browse surface.
- Auditor's blocker 2 (confirmed by Verifier reading `web/src/app/orgs/[orgId]/page.tsx` and `web/src/app/marketplace/listings/[listingId]/page.tsx`): the listing `<Link>` in the org detail page pointed at `/marketplace/${l.listingId}`, but the actual detail page lives at `/marketplace/listings/[listingId]`. The wrong href would 404.
- Verifier fix: changed the href to `/marketplace/listings/${l.listingId}` so the link resolves to the existing detail route.
- Auditor's should-fix #3 (accepted): `PATCH /listings/:listingId` does not allow updating `sellerOrgId`. Intentional for MVP — a teacher can't re-attribute an existing listing to a different org after creation. Added a one-line code comment above the PATCH handler documenting the design intent; behaviour unchanged.
- Independent Verifier checks (beyond the Auditor):
  - Confirmed the "Sell as" dropdown defaults to `<option value="">Myself (individual seller)</option>` and `sellerOrgId` is initialized to `""` in state. The submit builds the POST body with `sellerOrgId: sellerOrgId || undefined`, so an empty string is coerced to omitted — the backend's optional schema then treats it as an individual-seller listing.
  - Confirmed the `/orgs/mine` call is wrapped in `try/catch` with a silent fallback comment — 403/404 on orgs never surfaces an error to the user; the dropdown simply stays hidden.
  - Grepped `sellerOrgId` across the repo: appears only in `db/src/entities/marketplace.ts` (entity), `lambdas/src/routes/marketplace.ts` (create validation + authz), and `web/src/app/seller/listings/new/page.tsx` (form). No other route or UI references the field — including `GET /listings` (the general browse), which does not yet surface an org badge. Flagged only: a future pass could render the commercial-org name next to listings in the marketplace browse so buyers see the seller org. Not required for this phase.
- MVP trade-offs (deferred): no `byOrg` GSI on `ListingEntity`, so `GET /orgs/:orgId/listings` uses a scan — acceptable since the existing `GET /listings` browse uses scan too, and will be revisited when the marketplace grows; payouts are still individual (listing's `sellerId` is the teacher's `sub`, not the org) — a commercial-org Stripe Connect model is a separate phase; `sellerOrgId` is intentionally not patchable in MVP — re-attribution requires deleting and recreating the listing; no org badge on the main `/marketplace` browse yet.
- **Typecheck status:** db / lambdas / web / cdk all PASS.

### 2026-04-17 — Phase 2F #6 pass (Organization team admin)

**Private educational organization team admin: orgs, memberships, linked classrooms** — signed off
- New `OrganizationEntity` (pk=orgId; attrs `name`, `ownerId`, `createdAt`) and `OrganizationMembershipEntity` (pk=orgId, sk=userId; `role ∈ {owner, admin, teacher, student}`, `joinedAt`) in `db/src/entities/organization.ts`; both exported from `db/src/entities/index.ts`. `ClassroomEntity` gains an optional `orgId` attribute (unset for existing non-org classrooms, patched on link).
- `lambdas/src/routes/organizations.ts` mounted at `/organizations` in `app.ts`, file-level `requireAuth`. Routes:
  - `POST /` (teacher-only): creates org + owner membership atomically via `makeOrgId()`.
  - `GET /` (any auth): lists orgs the caller is a member of (query membership byUser GSI, fan out OrganizationEntity.get per orgId).
  - `GET /:orgId`: member-only detail view, includes membership list hydrated with user display names.
  - `POST /:orgId/members` (owner/admin): add by email, resolves to userId via UserEntity byEmail GSI, rejects unknown emails with `user_not_found` (no pending-invite flow in MVP).
  - `DELETE /:orgId/members/:userId`: self-leave is always allowed; owner removal blocked with `cannot_remove_owner`; admin-removing-admin blocked with `admin_cannot_remove_admin` via secondary fetch of target membership.
  - `POST /:orgId/classrooms/:classroomId` (owner/admin OR cognito `admin` group): links an existing classroom to the org. Requires the classroom's teacher to be a member of the org, and rejects re-linking if the classroom already has a different `orgId`.
  - `GET /:orgId/classrooms`: lists linked classrooms — teachers get their own rooms filtered to this orgId; owner/admin fans out across all teacher members.
- UI: `/orgs` (list + create CTA), `/orgs/new` (name form), `/orgs/[orgId]` (detail with members table, add-member form, linked classrooms list). Teacher-only "Organizations" link added at `web/src/app/dashboard/page.tsx` line 96.
- Role hierarchy: owner > admin > teacher > student. Owner is the single creator and cannot be removed; admins manage members and link classrooms but cannot remove other admins (prevents lateral admin-nuking from a compromised admin). Teachers/students are passive members.
- Classroom linking constraints: a classroom's teacher MUST already be an org member before it can be linked (so owners can't silently claim someone else's room); a classroom can only be owned by ONE org (re-link to a different org is rejected with 409 `classroom_in_other_org`); the existing teacher-owner check still gates every classroom action — `orgId` is additive, never a back-door.
- Auditor's should-fix (confirmed by Verifier reading `web/src/app/orgs/[orgId]/page.tsx` line 188): the Remove-member guard was `{(canManage || m.userId === org.ownerId) && m.userId !== org.ownerId && ...}` — the `|| m.userId === org.ownerId` disjunct was dead code because the outer `&& m.userId !== org.ownerId` always fails when that disjunct is true. Harmless but misleading.
- Verifier fix: simplified the JSX to `{canManage && m.userId !== org.ownerId && ...}` at `web/src/app/orgs/[orgId]/page.tsx:188`. Same behaviour, no more dead branch.
- Independent Verifier checks (beyond the Auditor):
  - Re-verified the `admin_cannot_remove_admin` gate in `lambdas/src/routes/organizations.ts` lines 188-193: the actor's role is `mine.role` (already fetched at line 176); when the actor is admin AND removing someone other than themselves, the route fetches the TARGET membership via `OrganizationMembershipEntity.get({ orgId, userId })` and returns 403 if `target.data?.role === "admin"`. Optional-chaining on `.data?` cleanly handles a target who isn't even a member (which would be a no-op delete anyway). Gate is correct.
  - Grepped `orgId` across `lambdas/src/` — only `organizations.ts` touches `classroom.orgId` (read at line 236 for the `classroom_in_other_org` check, write at line 240 via patch). No other route reads the field, so existing non-org classrooms with `orgId === undefined` are unaffected by this change.
  - Grepped `.orgId` repo-wide — outside `organizations.ts` only the new UI pages (`/orgs/page.tsx`, `/orgs/new/page.tsx`) reference it, confirming no other surface tries to enforce org ownership on a classroom.
  - Dashboard wiring: `/orgs` link is inside the `role === "teacher"` block (line 96), so students/parents never see it. Owner-only UI actions on `/orgs/[orgId]` are gated by `canManage = mine?.role === "owner" || mine?.role === "admin"`.
- MVP trade-offs (deferred): no ownership-transfer endpoint — once ownerId is set it's permanent until the org is deleted (out of scope); no `byOrg` GSI on ClassroomEntity, so `GET /:orgId/classrooms` for an owner/admin fans out per teacher-member (fine at MVP scale, will need a GSI before large orgs); no pending-invite flow — adding a member requires that user to already have an EduBoost account (returns `user_not_found` otherwise); no commercial-marketplace integration yet (commercial orgs remain under the Deferred list); no per-classroom student assignment UI yet — the linking endpoint adopts the classroom as-is with its existing teacher/student relationships intact.
- **Typecheck status:** db / lambdas / web / cdk all PASS.

### 2026-04-17 — Phase 2F #5 pass (Parent/student analytics)

**Parent/student analytics space: spend, attendance, grades, and activity aggregated per user and per household** — signed off
- New `lambdas/src/routes/analytics.ts` mounted at `/analytics` in `app.ts` (line 71), file-level `requireAuth`.
- Shared `metricsFor(userId)` computes in one Promise.all fan-out: `sessionsAttended` (present+late), `attendanceRate` ((present+late)/marked, null on no marks), `totalHoursAttended` (attended count, 1h-per-session approximation), `totalSpentCents` (sum of `status === "succeeded"` payments, refunded rows excluded), `currency` (first succeeded row, EUR fallback), `bookingCount`, `reviewsLeft`, `aiGradeAvg` ((score/maxScore)*100 averaged, filtered to `maxScore > 0`), `aiGradeCount`, plus `displayName` from UserEntity. Each entity read uses its byUser / byPayer / byStudent / byReviewer GSI with `limit: 1000`.
- `GET /analytics/student` (role ∈ {student, parent}): returns the caller's own `UserMetrics`. Parents are allowed so they can see their personal activity alone — redundant with the `self` block on `/parent`, but the endpoint is useful for per-role testing and a future student-only view.
- `GET /analytics/parent` (role === parent): queries `ParentChildLinkEntity.query.primary({ parentId })` with `limit: 50`, filters to `status === "accepted"` (IDOR-safe — no user-supplied childId), fans out `metricsFor` across accepted children + self, returns `{ self, children, summary }`. `summary.totalSpentCents` and `summary.sessionsAttended` sum across `self + children`; `summary.currency` mirrors `self.currency`.
- UI: `web/src/app/analytics/page.tsx` — role-gated (redirects non-student/parent to `/dashboard`), calls `/analytics/parent` or `/analytics/student` based on role, renders `MetricsGrid` sections (own stats for student; household summary + self + per-child for parent) with loading/error states and an empty-children CTA linking to `/parent/children`. Dashboard link added at `web/src/app/dashboard/page.tsx` line 67 inside the `student || parent` block.
- Auditor's should-fix (confirmed by Verifier reading `lambdas/src/routes/analytics.ts`): the `/parent` 403 payload was `{ error: "only_parents" }` (line 109) while `/student`'s 403 used `{ error: "not_available_for_role" }` (line 96). Two payloads for the same job — frontend never discriminates on the exact string, but consumers should see one shape.
- Verifier fix: changed the `/parent` 403 to `{ error: "not_available_for_role" }` so both endpoints return the same shape on role rejection. Grepped `only_parents` across the repo before changing — no UI/test/client code depended on the string. Also applied the nit: removed the dead `g.maxScore ?? 1` guard (dead because `gradedValid` is already filtered to `maxScore > 0`), simplified to `g.score / g.maxScore!` with a comment flagging why the non-null assertion is safe.
- Independent Verifier checks (beyond the Auditor):
  - Grepped `aiGradeAvg` across the repo: only `lambdas/src/routes/analytics.ts` (server computation) and `web/src/app/analytics/page.tsx` (display) reference it, and the UI already nil-guards via `m.aiGradeAvg === null ? "—" : ...`. No other surface needs updating.
  - Confirmed the frontend's role branch in `analytics/page.tsx` lines 50-56 calls `/analytics/parent` when `r === "parent"` and `/analytics/student` otherwise — parents never hit `/student` from the UI, so allowing parents on `/student` is an unused-but-harmless capability, not a redundant double call.
  - `metricsFor` on the parent's own `sub`: `AttendanceEntity.query.byUser` and `ReviewEntity.query.byReviewer` will typically be empty for parents (they don't attend or review), which cleanly yields `attendanceRate: null`, `reviewsLeft: 0`, etc. `PaymentEntity.query.byPayer` correctly picks up parent-funded bookings, so `self.totalSpentCents` is meaningful. No logic hazard.
- MVP trade-offs: `totalHoursAttended` is an attended-session count, not real duration (avoids N SessionEntity lookups per user); `summary.currency` shows only the first succeeded payment's currency — mixed-currency households surface just one symbol until a multi-currency aggregator is designed; no teacher-facing view (teachers' earnings already live under `/teacher/earnings`).
- **Typecheck status:** db / lambdas / web / cdk all PASS.

### 2026-04-17 — Phase 2F #4 pass (Dispute system with SLAs)

**Comprehensive dispute system for payments and reviews with SLA deadlines and admin resolution workflow** — signed off
- Extends the existing support ticket system (`SupportTicketEntity`) with dispute-specific fields: `priority` (urgent/high/normal/low), `slaDeadline` (ISO), `relatedPaymentId`, `relatedReviewId`, `resolvedAt`, `resolvedBy`, `resolution`, `resolutionNote`. `TICKET_RESOLUTIONS = ["refund_full","refund_partial","review_removed","no_action","warning_issued"]` exported from `db/src/entities/index.ts`.
- SLA windows (in `lambdas/src/routes/support.ts`): urgent=4h, high=24h, normal=48h, low=168h. `computeSlaDeadline(priority)` is called once at ticket creation; not recomputed on priority changes (MVP).
- `POST /tickets`: accepts `relatedPaymentId`/`relatedReviewId` and validates the caller is a party — payment disputes require the caller is payer OR payee; review disputes require the caller is the subject teacher OR the reviewer. Prevents noisy third-party reports.
- `POST /tickets/:ticketId/resolve` (admin-only via `groups.includes("admin")`): zod-validated structured outcome with `.refine()` forcing `refundCents` present for `refund_partial`. Idempotency via 409 `already_resolved`. Side effects execute before the ticket is marked resolved — a Stripe failure returns 502 and the ticket stays open so admins can retry.
  - `refund_full` / `refund_partial`: calls `stripe().refunds.create({ payment_intent, amount })` with either the full `payment.amountCents` or the partial value. On full refund, also patches the `PaymentEntity.status` to `"refunded"`. 409 `already_refunded` if the payment row is already refunded.
  - `review_removed`: sets `hiddenAt`/`hiddenBy`/`hiddenReason` on the `ReviewEntity` and recomputes the teacher's visible rating aggregate inline (filters `!r.hiddenAt`, writes `ratingAvg`/`ratingCount` to `TeacherProfileEntity`). The recompute mirrors `reviewRoutes::recomputeTeacherRating` to avoid a cross-route import cycle.
  - `no_action` / `warning_issued`: annotation-only, no side effects.
- A `system`-role message is appended to the ticket thread after side effects succeed, summarising the resolution + admin note. The in-app `notify()` call at the end is wrapped in try/catch and non-fatal.
- `GET /tickets/overdue` (admin-only via `requireAdmin`): returns tickets whose `slaDeadline < now` and `status ∉ {resolved, closed}`, capped at `limit`. For the overdue list UI.
- `GET /reviews/teachers/:teacherId` filters `!r.hiddenAt` on the public list and `recomputeTeacherRating` filters hidden rows on every write, so a takedown immediately reflects in both the visible list and the star average.
- Auditor's should-fix (confirmed by Verifier reading `lambdas/src/routes/support.ts` lines 293-320): the refund branch capped `refundCents` at 100_000_00 (100k) via zod but did NOT check `refundCents <= payment.data.amountCents`. An admin typoing a too-large partial refund would hit Stripe and get a 502 — misleading because it isn't a Stripe failure, it's a validation failure on our side. The route already fetched the `payment` row, so the check is a free comparison.
- Verifier fix (`lambdas/src/routes/support.ts` right after the `already_refunded` 409 check, before the `stripe().refunds.create(...)` call):
  ```
  if (resolution === "refund_partial" && refundCents! > payment.data.amountCents) {
    return c.json({ error: "refund_exceeds_payment_amount" }, 400);
  }
  ```
- Independent Verifier checks (beyond the Auditor):
  - Confirmed `TICKET_RESOLUTIONS` is exported from `db/src/entities/index.ts` (line 29) and imported in `support.ts` (line 21); the zod `resolution` enum binds to the same tuple.
  - Grepped `hiddenAt` across the repo — only three files reference it: `db/src/entities/review.ts` (attribute), `lambdas/src/routes/support.ts` (takedown writer), `lambdas/src/routes/reviews.ts` (public list + aggregate filter). No booking-detail or review-by-id endpoint surfaces reviews, so takedown propagation is complete.
  - `ratingAvg`/`ratingCount` are DDB attributes on `TeacherProfileEntity` — they are recomputed on every write and are not cached in any external store (Redis, CloudFront, etc.). Grep of `ratingAvg`/`ratingCount` confirms only web pages reading from the DDB row, no cache layer.
  - `DELETE /reviews/:reviewId`: does NOT check `hiddenAt` before deleting — intentionally fine. Deletion of an already-hidden review is destructive but harmless; `recomputeTeacherRating` is called afterwards and filters hidden anyway, so the aggregate stays correct whether the deleted row was hidden or not.
- MVP trade-offs (deferred): no partial-refund accumulation check — if two `refund_partial` resolutions fire against the same payment, we only block refunds exceeding the full original amount, not the remaining amount after prior partials (Stripe itself will reject over-refunds so the worst case is a 502). No auto-escalation on SLA breach (overdue endpoint is pull-based, not push). No reviewer notification on takedown (they can see it in their own reviews list). `refundCents` zod ceiling of 100_000_00 (100k USD) is a belt-and-suspenders sanity cap above the `<= payment.amountCents` check.
- **Typecheck status:** db / lambdas / web / cdk all PASS.

### 2026-04-17 — Phase 2F #3 pass (Shared whiteboard)

**Per-classroom shared whiteboard** — signed off
- New `WhiteboardEntity` (pk=classroomId, sk=empty) holds `strokes: list<any>`, `version: number`, plus `updatedAt`/`createdAt`. Each stored stroke is `{ points: [[x,y], ...], color, width, authorId, at }`. Canvas coordinate space is a fixed 10000×5625 grid rendered to a 1000×562 DOM canvas, so stored points are resolution-independent.
- Three routes on `lambdas/src/routes/whiteboard.ts` mounted at `/whiteboard` (all auth-gated via `requireAuth`):
  - `GET /classroom/:classroomId` (teacher OR classroom member): returns `{ classroomId, strokes, version }` — empty list + version 0 if the board hasn't been touched yet.
  - `POST /classroom/:classroomId/strokes` (teacher OR classroom member): validates via zod (`points` tuple of ints 0..10000, 6-hex color, width 1..40) and appends.
  - `DELETE /classroom/:classroomId` (teacher-only): clears the list and bumps version.
- UI: `/whiteboard/[classroomId]` page with 6-color palette + width slider, pointer-event drawing with optimistic rendering, and a 2.5s poll that merges server strokes. `/classroom/[sessionId]` links to the whiteboard via a new-tab button.
- Auditor blockers — both confirmed by Verifier after reading `db/src/entities/whiteboard.ts` and `lambdas/src/routes/whiteboard.ts`:
  - **DDB 400KB item-size math was wrong.** Route capped `MAX_STROKES=200` with the stroke zod schema allowing `.max(500)` points. Worst case ≈ 200 strokes × 500 points × ~20 bytes/point ≈ 2MB, 5× over DDB's 400KB cap.
  - **Lost-update race on concurrent writes.** POST /strokes did a read → in-memory append → patch write, so two clients posting at the same moment would clobber each other's stroke.
- Verifier fixes:
  - `MAX_STROKES` reduced to 50 and a new `MAX_POINTS_PER_STROKE = 250` constant gates both the zod `points.max(...)` and the client's in-flight-stroke drop cutoff. Worst case is now 50 × 250 × ~20 bytes ≈ 250KB — comfortable margin under 400KB. Comment in `whiteboard.ts` rewritten to reflect the real math.
  - Hot path rewritten to use ElectroDB's atomic `.upsert().append({ strokes: [newStroke] }).add({ version: 1 }).go()` — this compiles to a single DDB `UpdateItem` with `list_append` + `ADD` (verified against `node_modules/electrodb@3.7.5/README.md` lines 60-115, and the `append`/`add` clauses on `UpsertRecordOperationOptions` in `index.d.ts`). Two concurrent clients now both land their strokes; neither read-modifies-over the other.
- ElectroDB atomic-append verdict: **supported**. `.append({ listAttr: [item] })` is exposed on both `.update()` and `.upsert()` and translates to `SET #attr = list_append(#attr, :val)`. `.add({ numAttr: N })` is the corresponding atomic numeric increment on a number attribute.
- MVP trade-off: the `MAX_STROKES` trim still requires a read-modify-write because DDB can't express "append then keep last N" in one expression. That path only fires when the board already has 50+ strokes (the cap), so normal-case writes are fully atomic. Strokes dropped to a concurrent writer during the trim boundary is an acceptable MVP gap — the same board would hit the cap again anyway.
- Should-fix items: client-side `disabled` on the Clear button for non-teachers (now fetches `/classrooms/:classroomId` on mount, compares `teacherId` with the Cognito `sub`, gates the button and also adds a title hover tooltip for clarity); the `(s.width * DISPLAY_W / CANVAS_W) * 10` line-width formula that algebraically reduced to `s.width * 1` was collapsed to `s.width` with a comment noting widths are stored in display pixels in this MVP.
- Nit: client refresh `r.version >= versionRef.current` was redundant-rerendering on identical-version polls; tightened to `>`.
- Independent Verifier checks:
  - Confirmed `app.ts` mounts `/whiteboard` (line 69) and `canAccess()` correctly uses `ClassroomEntity` + `ClassroomMembershipEntity` keyed by `{classroomId, userId}`.
  - Confirmed `GET /classrooms/:classroomId` in `classrooms.ts` returns the full row (including `teacherId`) for any authenticated caller — sufficient for the client-side isTeacher check.
  - `MAX_POINTS_PER_STROKE` is enforced by zod on the server AND by the client's onPointerMove drop cutoff, so a misbehaving client can't push the server cap above 250 points per stroke.
- **Typecheck status:** db / lambdas / web / cdk all PASS.

### 2026-04-17 — Phase 2F #2 pass (Breakout rooms via Chime sub-meetings)

**Breakout rooms (split rooms within a classroom session)** — signed off
- New `BreakoutRoomEntity` keyed by `pk=sessionId, sk=breakoutId` (primary index only). Attributes: `label`, `chimeMeetingId`, `createdBy`, `assignedUserIds` (list, default `[]`, cap 50), `createdAt` (default ISO now, readOnly). `makeBreakoutId()` produces `brk_<ts36><rand36>`.
- Four routes on `lambdas/src/routes/chime.ts` under `/sessions/:sessionId/breakouts*`, all behind the file-level `requireAuth` middleware:
  - `POST /breakouts` (teacher-only): zod-validated `label` 1-60, `assignedUserIds` cap 50; creates a child Chime meeting with `ClientRequestToken: nanoid()` and `ExternalMeetingId: ${sessionId}#brk#${nanoid(8)}` so the namespace is scoped to the parent session.
  - `GET /breakouts` (teacher OR classroom member): `BreakoutRoomEntity.query.primary({ sessionId }).go({ limit: 50 })`.
  - `POST /breakouts/:breakoutId/join` (teacher always; student only if in `assignedUserIds`): returns `{ MeetingId, MediaRegion }` + the attendee credential. IDOR guard is an explicit `not_assigned` 403 — classroom membership alone is insufficient by design.
  - `DELETE /breakouts/:breakoutId` (teacher-only): best-effort `DeleteMeetingCommand`, then delete the DDB row. 404-on-delete is treated as a no-op success.
- UI: `/classroom/[sessionId]` gets a breakouts panel (teacher-only create + end buttons, conditional join link for assigned students); `/breakout/[sessionId]/[breakoutId]` is the join page.
- Auditor blocker (confirmed by Verifier reading `chime.ts` lines 107-162): `POST /chime/sessions/:sessionId/end` deleted the parent Chime meeting, cancelled reminders, and cleaned up Google Calendar events — but did NOT iterate/delete child breakouts, so child Chime meetings and DDB rows would leak after the parent session completed.
- Verifier fix: after `cancelReminders` and before Google Calendar cleanup, iterate `BreakoutRoomEntity.query.primary({ sessionId }).go({ limit: 50 })` and for each breakout call `DeleteMeetingCommand` (non-fatal on failure, `console.warn`) + `BreakoutRoomEntity.delete({ sessionId, breakoutId }).go()`. The whole block is wrapped in try/catch with `console.error` — matching the existing non-fatal-cleanup pattern for Google Calendar. Breakout cleanup failures do not block the end-of-session response.
- Independent Verifier checks:
  - Confirmed `BreakoutRoomEntity.query.primary({ sessionId })` is the correct access pattern (the only index declared is `primary` with `pk=sessionId, sk=breakoutId`).
  - Grepped `breakout`/`BreakoutRoom` across `lambdas/src` and `db/src`: only references are `chime.ts`, `breakout.ts`, and the `entities/index.ts` re-export. No `AttendanceEntity` or other entity holds a breakout FK that could orphan.
  - Spot-checked the `not_assigned` authz on POST /join: `isTeacher = session.data.teacherId === sub`; `isAssigned = (breakout.data.assignedUserIds ?? []).includes(sub)`; 403 when neither is true — correct.
  - Classroom UI breakout panel continues to fetch the list endpoint; after the parent session ends the teacher typically navigates away, so a transiently stale list (showing breakouts whose Chime meetings have been deleted) is not a live user-facing hazard — flagged as acceptable.
- Auditor nit (documentation): "Split rooms (breakout rooms within classroom)" was still listed under `## Deferred (explicit)` (now removed) and 2F #2 was missing from the audit log (this entry).
- **Typecheck status:** db / lambdas / web all PASS after the cleanup fix.
- MVP tradeoffs (deferred): broadcast-move (teacher moves everyone in/out), timer-based auto-close, audio bridge between breakouts, reassignment UI after a breakout is created, metrics on breakout attendance, rate limiting on create.

### 2026-04-17 — Phase 2F #1 pass (AI grading via Bedrock)

**AI grading with Claude on Bedrock** — signed off
- AiGradeEntity (gradeId pk, byStudent gsi1, byTeacher gsi2) persists score/feedback/modelId plus a 500-char submission excerpt (full submission not stored to avoid DDB item-size growth).
- `lambdas/src/lib/ai-grader.ts` wraps `@aws-sdk/client-bedrock-runtime` InvokeModel against `anthropic.claude-haiku-4-5-20251001-v1:0` (overridable via `BEDROCK_GRADING_MODEL_ID`); system prompt forces JSON-only output; `extractJson` strips ``` fences defensively.
- Routes (`/ai-grades`, all auth-gated): POST (teacher-only, classroom-membership check when classroomId supplied), GET /student/mine, GET /teacher/mine, GET /:gradeId (participant-only).
- CDK: `BEDROCK_GRADING_MODEL_ID` env var + `bedrock:InvokeModel` IAM scoped to `arn:aws:bedrock:<region>::foundation-model/anthropic.*` and regional inference profiles.
- UI: /teacher/grader compose form + /grades list (role-aware endpoint pick); dashboard links (`/teacher/grader` teacher-only, `/grades` for all roles).
- Auditor claims — all confirmed by Verifier reading the files:
  - `@aws-sdk/client-bedrock-runtime` was missing from `lambdas/package.json` (imported in `ai-grader.ts:1`). Added at `^3.700.0` matching the other AWS SDK v3 packages.
  - `NOTIFICATION_TYPES` was missing `"new_grade"`; `ai-grades.ts:79` used `"review_posted"` as a workaround (misleading because that type is semantically for teacher-profile reviews). Added `"new_grade"` to the tuple and switched the notify() call; comment about "reuse generic type — new_grade is deferred" removed. Confirmed `reviews.ts:75` still uses `review_posted` legitimately and was untouched.
- Verifier catch (missed by the Auditor): `extractJson` in `lambdas/src/lib/ai-grader.ts` dereferenced `fenceMatch[1]` (typed `string | undefined` under `noUncheckedIndexedAccess`), so `ai-grader.ts` itself wouldn't typecheck even after the dep/notification fixes. Changed to `fenceMatch?.[1] ?? text`.
- Independent checks the Verifier ran:
  - `ClassroomMembershipEntity` primary key is `pk=classroomId, sk=userId` — `ai-grades.ts:38–44` passes `{classroomId, userId}`, correct key order.
  - `byStudent`/`byTeacher` confirmed on `AiGradeEntity` (gsi1/gsi2).
  - CDK already wires `BEDROCK_GRADING_MODEL_ID` into ApiHandler env (api-stack.ts:117) AND grants `bedrock:InvokeModel` IAM (api-stack.ts:175-185) — no additional blocker there.
  - Dashboard links verified: `/teacher/grader` teacher-only; `/grades` in both student/parent and teacher link arrays (parent gets it via the student/parent bucket).
- **Typecheck status:** db/lambdas/web/cdk all PASS after this pass.
- Cleanup fixes bundled in this pass (pre-existing bugs from earlier phases uncovered during 2F #1 verifier run):
  - `lambdas/src/lib/stripe.ts` — bumped `apiVersion` to `2025-02-24.acacia` to match installed `stripe@17.7.0` types.
  - `lambdas/src/routes/payments.ts` — defaulted optional ElectroDB-defaulted fields (`createdAt`, `currency`, `platformFeeCents`) in the invoice call; replaced Hono `c.body(Buffer)` with `new Response(new Uint8Array(pdf))` to satisfy the pdfkit Buffer typing.
  - `lambdas/src/routes/marketplace.ts` — `listing.data.currency ?? "EUR"` before `.toLowerCase()`.
  - `lambdas/src/routes/reports.ts` — defaulted optional `platformFeeCents`/`createdAt`/`currency`/`status` in both the summary loop and the CSV export.
  - `lambdas/src/routes/webhooks.ts` — defaulted `booking.data.createdAt` in the bookingConfirmed email template.
  - `web/src/app/referrals/page.tsx` — added `rewardedAt?: string | null` to the local `ReferralRow` type.
- MVP tradeoffs (deferred): rate limiting on POST /ai-grades (Bedrock cost abuse), retries on transient Bedrock throttling, streaming long responses, storing full submission in S3 rather than 500-char excerpt.

### 2026-04-17 — Phase 2E #5 pass (Google Calendar integration)

**Google Calendar OAuth + session sync** — signed off
- GoogleIntegrationEntity (userId pk) + GoogleCalendarEventEntity (sessionId + userId pk/sk, byUser gsi1) track per-user OAuth tokens and per-session calendar event IDs so reschedules/cancels/session-ends can patch or delete the right events.
- OAuth Authorization Code flow with `access_type=offline&prompt=consent`; state is HMAC-SHA256 signed (GOOGLE_STATE_SECRET) with a 10-minute expiry and `timingSafeEqual` verification. Public CDK route for GET /google/callback; authorization is carried inside the signed state param.
- `getFreshAccessToken` refreshes with a 60s grace window and patches the row; Google API helpers (`createCalendarEvent`, `patchCalendarEvent`, `deleteCalendarEvent`) all return gracefully if the integration is missing or the refresh token is revoked.
- Wired into the session lifecycle: POST /sessions pushes events to every classroom member's connected Google, PATCH reschedule/cancel patches or deletes those events, and /chime/sessions/:id/end also cleans them up.
- `/google/disconnect` revokes at Google best-effort (non-fatal) and deletes the local integration.
- UI: Suspense-wrapped /settings/google with connect/disconnect, showing connected email + calendar ID and mapping `?status=connected|denied|error` back from the callback redirect.
- Verifier catch: /connect-url env-presence check omitted `googleClientSecret`, so a misconfigured deployment would fail only at token exchange time. Now fast-fails with 503 google_not_configured.
- MVP tradeoffs (deferred): retries on Google API failures, UI signal when a refresh token has been revoked at Google, dedup for concurrent duplicate scheduling, state-replay single-use enforcement (captured state within 10 min is idempotent via upsert), Drive/Docs/Slides scopes, attendee invites on Calendar events, at-rest KMS envelope for stored tokens, per-Google-call fetch timeouts.

### 2026-04-17 — Phase 2E #4 pass (SMS notifications via AWS SNS)

**SMS notifications** — signed off
- UserEntity extended with `phoneNumber`, `phoneVerifiedAt`, `smsOptIn`, `smsVerifyCodeHash`, `smsVerifyExpiresAt`.
- `lambdas/src/lib/sms.ts`: E.164 validation (`/^\+[1-9]\d{7,15}$/`, lenient upper bound with AWS SNS as the authoritative rejector), 6-digit `generateOtp` via `crypto.randomInt`, SHA-256 `hashOtp`, and thin `sendSms` wrapper around `SNSClient.PublishCommand` with `AWS.SNS.SMS.SMSType=Transactional`.
- Routes (`/sms/*`, all auth-gated): `GET /me` (phone state), `POST /phone` (sets hash + 10-min expiry, clears prior `phoneVerifiedAt`, sends OTP; 502 on SNS failure), `POST /verify` (hash-compare, sets `phoneVerifiedAt` + auto-opts-in, wipes verify fields), `POST /opt-out`, `POST /opt-in` (requires verified phone).
- `notifications.ts` loads the user once per notify() and conditionally SMSes when the type is in `SMS_NOTIFICATION_TYPES` AND `smsOptIn` AND `phoneVerifiedAt` AND `phoneNumber`. SMS body capped at 300 chars (≈2 SMS segments). SMS send is non-fatal (logged, never throws out of notify).
- IAM: both ApiHandler and ReminderHandler granted `sns:Publish`.
- UI: `/settings/sms` 3-step flow (enter phone → verify code → toggle opt-in) with error mapping for `E.164`/`sms_send_failed`/`wrong_code`/`code_expired`/`no_pending_verification`. Dashboard link added.
- Verifier catches:
  - Misleading `hashOtp` comment claimed brute force was "deterred by attempt rate limiting at the verify endpoint" — no such rate limit exists. Rewrote the comment to accurately describe the real defenses (1M OTP space, 10-min expiry, single-use wipe on verify, server-only hash) and to explicitly flag the missing rate limit as a documented MVP gap.
  - Comment/code mismatch in `notifications.ts` claimed "well under 160 chars" but sliced to 300. Updated comment to reflect the 300-char / two-segment policy (which is correct for transactional SMS).
  - Confirmed `/settings/sms` uses no `useSearchParams`, so no Next `<Suspense>` boundary needed.
  - Confirmed `sms.ts` imports (`randomInt`, `createHash`, `SNSClient`, `PublishCommand`) are all used.
  - Confirmed verify-success path chains `.remove(["smsVerifyCodeHash","smsVerifyExpiresAt"])` so a replayed or reused code can't match.
- MVP tradeoffs (deferred): rate limiting on `POST /sms/phone` (SMS-send abuse / cost), rate limiting on `POST /sms/verify` (OTP brute-force), SNS SMS sandbox-to-production account move (deployment/environmental, not code).

### 2026-04-17 — Phase 2E #3 pass (Referrals — invite a friend)

**Referral tracking** — signed off
- UserEntity extended with `referralCode` + `referredByCode`; new byReferralCode GSI on gsi3.
- ReferralEntity (pk=referrerId + sk=referredId, byReferred gsi1) records each claim pairing with a stub `rewardedAt` field for future reward hooks.
- `makeReferralCode()` generates 8-char codes with an unambiguous alphabet (no 0/O/1/I).
- Routes: `GET /referrals/mine` (lazy code generation with 5-retry collision handling against the byReferralCode GSI), `POST /referrals/claim` (one-time, case-normalized, blocks self-referral), `GET /referrals/list` (referrer-scoped enrichment of invitee display names).
- UI: /referrals page with copy-to-clipboard share link, one-time claim form (hidden after claim), invitees list showing reward status.
- Verifier catch: the signup share link's `?ref=` param was being dropped. Fixed by having `/signup` stash the code in `sessionStorage["eduboost_pending_ref"]` and `/dashboard` auto-POST to `/referrals/claim` on first load, best-effort (silently swallows already_claimed / unknown_code / self-referral). sessionStorage survives the signup → confirm → login → dashboard flow within a single tab; cross-tab flows still fall back to manual paste on /referrals.
- MVP tradeoffs (deferred): rare-collision GSI uniqueness (1-in-1-trillion, mitigated by limit(1) in claim), reward mechanics (rewardedAt stub never set), rate limiting, fraud revocation.

### 2026-04-17 — Phase 2E #2 pass (Support ticket attachments)

**Ticket attachments** — signed off
- TicketMessageEntity extended with `attachments: list<map>` (s3Key + filename + optional mimeType/sizeBytes).
- POST /support/tickets/:id/attachment-url issues a presigned PUT scoped to `support/${ticketId}/` with ContentType + ContentLength signed; 15-min expiry. Owner-or-admin authz.
- GET /support/attachments/:ticketId/:s3Key{.+} issues a presigned GET with `ResponseContentDisposition: attachment` (RFC 5987 filename encoding) so HTML/SVG uploads can't render inline. Key reconstruction forces the `support/${ticketId}/` prefix so clients can't pivot to other tickets' files.
- Hono regex param `:s3Key{.+}` verified against Hono v4 docs (same pattern as the Hono `/posts/:filename{.+\\.png}` example).
- Reply flow uploads before POSTing the message. New-ticket flow can't upload before the ticket exists (presigned endpoint requires a ticketId), so a new `POST /support/tickets/:id/initial-attachments` endpoint backfills the initial message — owner-only, refuses if attachments are already populated (409 attachments_already_set). Frontend /support/new now wires this as a three-step flow (create ticket → upload → backfill).
- Defense-in-depth: every message-create path now rejects s3Keys that don't start with `support/${ticketId}/` (400 bad_attachment_key), even though download-time key reconstruction already made cross-ticket reads impossible.
- MVP tradeoffs (deferred): MIME whitelist, attachment cleanup on ticket retention, virus scanning.

### 2026-04-17 — Phase 2E #1 pass (Teacher profile verification)

**Teacher profile verification workflow** — signed off
- TeacherProfileEntity extended: `verificationStatus` (unsubmitted/pending/verified/rejected, default unsubmitted), `verificationNotes`, `verifiedBy`, plus existing `verifiedAt`. New `byVerificationStatus` GSI on gsi2 (pk=status, sk=updatedAt).
- New notification types: `profile_verified`, `profile_rejected`.
- Teacher submit: `POST /teachers/me/submit-verification` transitions unsubmitted|rejected → pending (409 if already pending or verified).
- Admin routes: `GET /admin/verifications?status=…` (queue with user hydration), `POST /admin/verifications/:id/approve` (notes optional; blocks re-approval), `POST /admin/verifications/:id/reject` (notes min 10 chars; blocks re-rejection of already-rejected; clears `verifiedAt` when revoking a previously-verified profile). Both fire notifications to the teacher.
- UI: verification panel on /teacher/profile (status badge + submit/resubmit button + visible reject notes); "✓ Verified" badge on public /teachers/[userId]; /admin/verifications queue page with filter + approve/reject actions (prompt-based notes).
- Verifier catches:
  - NOTIFICATION_TYPES didn't include profile_verified/profile_rejected — would fail TS typecheck. Added.
  - Re-reject idempotency bug (admin could spam reject overwriting history and firing duplicate notifications) — fixed with 409 `already_rejected` guard. Verified→rejected (revoke) still allowed.
  - Stale `verifiedAt` after reject-of-verified — chained `.remove(["verifiedAt"])` when prior status was "verified" so the timestamp doesn't leak.
- Intentional (documented inline): admin approve from "unsubmitted" is allowed as an out-of-band fast-track. Legacy profiles created before this change have undefined verificationStatus until their next upsert — MVP acceptable; backfill in a later phase.

### 2026-04-17 — Phase 2D #2 pass (Teacher wall)

**Teacher wall (posts + comment section)** — signed off
- WallPostEntity (byTeacher gsi1 by createdAt) + WallCommentEntity (pk=postId + sk=commentId, byAuthor gsi1). Cached commentCount best-effort.
- Public reads: GET /wall/:teacherId (list) + GET /wall/posts/:postId (hydrated with author names for post and commenters).
- Authenticated writes: POST /wall/posts (teacher-only, on own wall), POST /wall/posts/:id/comments (any authenticated user), DELETE post (owner-only), DELETE comment (author OR wall owner for moderation).
- UI: inline Wall section on /teachers/[userId] with owner-only compose form + link to /wall/posts/[postId] detail page with comment thread and delete controls.
- **Critical verifier catch**: `wallRoutes.use("/posts/:postId/comments", requireAuth)` is a PARAMETRIC segment-count match — it does NOT match the 4-segment `/posts/:postId/comments/:commentId` DELETE path. The DELETE comment handler was reachable WITHOUT Hono's requireAuth middleware running (still protected by API Gateway JWT, but `c.get("auth")` would crash with 500 on a real request). Fixed by switching to a `/posts/*` wildcard, matching the same pattern used in marketplace.ts for `/orders/*`. Same-class bug that any future route file with nested paths should watch for.
- MVP tradeoffs (deferred): post/comment editing, media attachments, notifications on new comments, rate limiting, orphaned-comment cleanup after post delete, soft-delete.

### 2026-04-17 — Phase 2D #1 pass (Forum)

**Forum (Reddit-style posts/comments/votes)** — signed off
- Three new entities: `ForumPostEntity` (primary + byChannel gsi1 + byAuthor gsi2, cached `upvotes`/`downvotes`/`score`/`commentCount`), `ForumCommentEntity` (pk=postId + sk=commentId, byAuthor gsi1), `ForumVoteEntity` (pk=targetId + sk=userId, direction + targetType).
- 6 hardcoded channels (general, mathematics, sciences, languages, test-prep, teachers-lounge) in `lambdas/src/lib/forum-channels.ts`; admin-managed channels deferred.
- Public routes (no auth): `GET /forum/channels`, `GET /forum/channels/:id/posts?sort=new|top`, `GET /forum/posts/:id`, `GET /forum/posts/:id/hydrated` (enriches post + comments with authorName).
- Authenticated routes: `POST /forum/posts`, `POST /forum/posts/:id/comments`, `POST /forum/posts/:id/vote`, `POST /forum/comments/:id/vote?postId=…`, `GET /forum/my-votes?ids=…` (hydrate UI vote state for up to 100 targets).
- Vote arithmetic verified across six cases (new up/down, retract same, switch). `castVote` uses a single `.add()` on the cached post/comment counters (upvotes/downvotes/score) to stay atomic.
- UI: /forum channel list, /forum/[channelId] post list with new/top toggle, /forum/posts/[postId] with VoteCol arrows + inline comment form, /forum/posts/new Suspense-wrapped form; dashboard link for all roles.
- Verifier catches:
  - `/forum/posts/:id/hydrated` was not in the CDK public route list — guests hit the auth wall even though the data is public. Added explicit public `GET /forum/posts/{postId}/hydrated` route.
  - Double-click race on `castVote.create()` threw a ConditionalCheckFailed which bubbled to 500. Wrapped in try/catch that re-reads the vote on conflict and routes through the idempotent retract/switch branches.
- MVP tradeoffs (deferred): admin-managed channels, post/comment editing and deletion, report-for-moderation, media uploads, threading / nested comments, full-text search, hot-score ranking.

### 2026-04-17 — Phase 2C #3 pass (Teacher financial reporting)

**Teacher earnings + CSV export** — signed off
- GET /reports/teacher/summary aggregates PaymentEntity.byPayee into thisMonth/prevMonth/YTD/allTime buckets, split by kind (booking vs marketplace via the `ord_` prefix on bookingId), counting only status=succeeded payments.
- GET /reports/teacher/export.csv streams a CSV with paymentId, bookingOrOrderId, kind, timestamps, currency, gross/fee/net, status, providerPaymentId; proper CSV escaping + Content-Disposition attachment.
- UI: /teacher/earnings page with four bucket cards (sessions + marketplace breakdown under each) and authenticated blob-download button for CSV. Dashboard link.
- Verifier catch: month/year boundaries were using local-time `new Date(y, m, d)` which would shift bucket edges in non-UTC runtimes. Fixed with `new Date(Date.UTC(y, m, d))` + `getUTCFullYear()`/`getUTCMonth()`.
- MVP tradeoffs (deferred): pagination beyond 1000 payments, per-currency breakdown, Stripe Connect payouts, charts.

### 2026-04-17 — Phase 2C #2 pass (Membership plans)

**Membership plans (Stripe subscriptions)** — signed off
- SubscriptionEntity keyed by userId, with `byStripeSubscription` (gsi1) and `byStripeCustomer` (gsi2) for webhook reverse-lookups when metadata is missing.
- Hardcoded plans in `lambdas/src/lib/plans.ts`: `student_premium` (EUR 9.99/mo, audience="student" — student or parent can buy) and `teacher_pro` (EUR 29/mo, audience="teacher").
- Public `GET /memberships/plans` for a pricing page; authenticated `GET /me`, `POST /checkout` (Stripe Checkout subscription mode with metadata propagation), `POST /cancel` (cancel_at_period_end).
- Stripe webhook handlers for `customer.subscription.{created,updated,deleted}` + fallback via `byStripeSubscription` GSI when metadata.userId is missing (e.g. created from Stripe dashboard).
- CDK: new public `GET /memberships/plans` route; env vars `STRIPE_STUDENT_PREMIUM_PRICE_ID`, `STRIPE_TEACHER_PRO_PRICE_ID`, `WEB_BASE_URL`.
- UI: `/membership` page (Suspense-wrapped) with role-filtered plan grid, current-plan display + cancel CTA, and checkout-return status handling via `?status=success|cancelled`.
- Verifier catches:
  - **Critical**: `membershipRoutes` had not been mounted in `lambdas/src/app.ts` — all `/memberships/*` would 404. Fixed.
  - **Real bug**: webhook `planId` was cast from `s.metadata?.planId` without runtime validation, so a dashboard-created subscription with malformed metadata would write an invalid `planId` into DDB and fail ElectroDB's enum at write-time with a cryptic error. Now validated against `PLAN_IDS` before the cast, bail+warn on miss.
  - `Plan.audience` type was widened to `"student"|"parent"|"teacher"` but only `"student"` and `"teacher"` are constructed; narrowed backend + frontend types.
- MVP tradeoffs accepted:
  - No feature gating on classroom size (teacher_pro declares "up to 25 students" but nothing enforces it).
  - No proration on plan swap — users must cancel+resubscribe.
  - No Stripe Billing Portal self-serve payment management.
  - No webhook deduplication (upsert idempotency covers normal retries).
  - Stripe SDK v17 current_period_end is top-level; SDK v18 moves it under `items` — revisit on upgrade.

### 2026-04-17 — Phase 2C #1 pass (Marketplace v0)

**Marketplace v0 (digital tutorials only)** — signed off
- ListingEntity (bySeller gsi1, byStatus gsi2) + OrderEntity (byListing gsi1, byBuyer gsi2, bySeller gsi3); new listing_sold notification type.
- Routes: public GET /marketplace/listings (filter: subject/price/seller); public GET /marketplace/listings/:id; authenticated POST/PATCH/DELETE /marketplace/listings (teacher role + sellerId authz); GET /marketplace/listings/mine; presigned PUT /marketplace/listings/:id/upload-url (max 100MB, stores fileS3Key+mimeType+sizeBytes); presigned GET /marketplace/listings/:id/download-url (seller always; buyer must have paid order); POST /marketplace/orders (Stripe PaymentIntent with kind=marketplace_order metadata; blocks self-purchase + double-purchase); GET /marketplace/orders/mine + /as-seller + /:id.
- Webhook discriminator: onPaymentSucceeded routes marketplace_order → onMarketplacePaid (patches order=paid, creates PaymentEntity, notifies seller); onPaymentFailed and onRefund branch on kind.
- CDK: public GET /marketplace/listings and /marketplace/listings/{listingId} (single-segment parametric so sub-paths like /mine, /upload-url, /download-url still route through the authenticated /{proxy+} catch-all). Hono static-beats-parametric handles /listings/mine correctly both at API Gateway and at the Hono router layer.
- UI: /marketplace browse + filter, /marketplace/listings/[id] detail, /marketplace/buy/[id] Stripe Elements checkout, /orders buyer history with download buttons, /seller/listings manage + publish/archive toggle, /seller/listings/new 3-step flow (create draft → presigned PUT → PATCH active), /seller/orders sales; dashboard links per role.
- Verifier catches:
  - Unused `notify` import in marketplace.ts removed.
  - **Real integration bug**: `PaymentEntity.bookingId` was being reused to store `orderId` for marketplace payments, so GET /payments/:id/invoice broke for marketplace buyers (BookingEntity lookup returned 404). Fixed with a short-circuit: if `payment.bookingId.startsWith("ord_")` the invoice route returns 409 `marketplace_invoice_not_supported` with a hint pointing to /orders for the file download. Documented inline as MVP tradeoff; post-MVP should add `kind` discriminator to PaymentEntity.
- MVP tradeoffs: concurrent duplicate pending orders (only first paid wins); archived-during-pending still delivers file (intentional); no Stripe Connect payout yet; physical goods/events/reviews/commercial-org selling explicitly deferred.



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

### 2026-04-17 — Phase 2B pass (Session scheduling + Reminders + Invoice PDFs + Attendance)

**Attendance tracking** — signed off
- AttendanceEntity with pk=sessionId + sk=userId (teacher per-session list) and byUser gsi1 (student history).
- POST /attendance/sessions/:id (teacher-only, entries filtered to classroom members, rejects returned in response), GET /attendance/sessions/:id (teacher sees all hydrated, non-teacher sees only their own), GET /attendance/mine (student history via byUser, desc by markedAt).
- Auto-mark "present" on Chime join for non-teachers if no prior record exists; teacher overrides survive via existence check; non-fatal on DDB failure.
- UI: teacher-only attendance panel on /classroom/[sessionId] with status dropdown per student; /attendance page for student history; dashboard link for student/parent. Recording button correctly gated behind isTeacher.
- Verifier catch: local `type Record = {...}` shadowed the global TypeScript `Record<K,V>` utility in `web/src/app/attendance/page.tsx`, breaking the `STATUS_COLORS` mapped type under strict mode — renamed to `AttendanceRecord`.
- Deferred: parent views child's attendance (needs parent-child data-sharing model in Phase 3); bulk marking UI; notes input.



**Session scheduling + calendar** — signed off
- Closes a hidden MVP gap: confirmed bookings now have an explicit path to a scheduled session with startsAt/endsAt.
- POST /sessions (teacher only; from bookingId or classroomId); GET /sessions/upcoming (unions teacher's sessions + classroom-membership sessions, dedupes, sorts).
- PATCH /sessions/:id supports reschedule + cancel with merged-field validation (single-field updates can't invert startsAt/endsAt).
- Ad-hoc classroom created on the fly for 1:1 bookings with no existing classroom; student added as member; booking.classroomId backfilled.
- New `session_scheduled` notification to all non-teacher members.
- UI: /calendar (grouped by day, Today/Tomorrow labels, Join CTA), /teacher/bookings (Schedule CTA on confirmed bookings), /sessions/new (Suspense + datetime-local → UTC round-trip).
- Auditor caught 2 minor issues (cryptic ad-hoc title, single-field PATCH inversion); Verifier fixed both + removed dead CreatedSession type.
- MVP tradeoffs: no overlap check on same classroom; orphaned ad-hoc classrooms on concurrent double-schedule.

**Scheduled session reminders (EventBridge Scheduler)** — signed off
- 24h + 1h reminders per session via `aws-sdk/client-scheduler` with `ActionAfterCompletion: DELETE` for auto-cleanup.
- Dedicated Reminder Lambda (ARM64, 256MB) bundled via CDK NodejsFunction; scheduler role scoped with SourceAccount condition; API Lambda granted scheduler:* on the group ARN + iam:PassRole constrained to scheduler.amazonaws.com.
- POST /sessions creates both schedules; PATCH reschedules (startsAt change) or cancels (status=cancelled); /chime/sessions/:id/end also cancels reminders on meeting completion.
- Reminder Lambda defensively skips if session is already cancelled/completed (belt-and-braces).
- Past-time reminders (fire < now + 60s) are silently skipped so short-lead sessions get 1h-only reminders.
- Auditor found all 3 integration calls were initially missing; Verifier confirmed and added them (plus /chime/end cleanup).
- New `session_reminder` notification type; email body uses Europe/Dublin timezone.

**Invoice PDFs + payment history** — signed off
- pdfkit-based A4 invoice: EduBoost header, billed-to/paid-to, line item, subtotal/platform fee/teacher-net totals, support footer.
- GET /payments/mine (payer), GET /payments/received (payee, new byPayee gsi3 on PaymentEntity), GET /payments/:id (authz: payer or payee), GET /payments/:id/invoice (only when status=succeeded; Hono returns Buffer with application/pdf + Content-Disposition=attachment; aws-lambda adapter base64-encodes binary).
- UI: role-aware /payments page (students see "Payment history", teachers see "Payments received"); authenticated blob download flow.
- CDK: pdfkit moved to externalModules + nodeModules so fonts load from Lambda's real node_modules/pdfkit/js/data/*.afm; build.mjs mirrors.
- Auditor caught 3 real gaps: pdfkit bundling, missing byPayee GSI, missing teacher dashboard link. Verifier fixed all 3 + made the UI role-aware.

**Files added/modified in Phase 2B pass:**
- db/src/entities/session.ts (unchanged), notification.ts (+ session_scheduled, session_reminder), payment.ts (+ byPayee gsi3)
- lambdas/src/routes/sessions.ts (POST + PATCH + upcoming; wiring to scheduler), bookings.ts (+ /as-teacher), chime.ts (+ cancelReminders on /end), payments.ts (new)
- lambdas/src/lib/scheduler.ts (new — EventBridge Scheduler upsert/delete helpers), invoice.ts (new — pdfkit renderer)
- lambdas/src/handlers/reminder.ts (new — reminder Lambda)
- lambdas/src/env.ts (+ reminderLambdaArn/schedulerRoleArn/scheduleGroupName)
- lambdas/src/app.ts (mounted /payments); package.json (+ @aws-sdk/client-scheduler, pdfkit, @types/pdfkit); build.mjs (pdfkit external)
- cdk/lib/api-stack.ts (reminder Lambda + scheduler group + invoker role + scheduler IAM + pdfkit externals/nodeModules)
- web/src/app/calendar/page.tsx, teacher/bookings/page.tsx, sessions/new/page.tsx, payments/page.tsx (new); dashboard links per role

### 2026-04-17 — Phase 2A pass (Reviews + Lesson requests + Parent-child CRUD)

**Phase 2A brings EduBoost from MVP to "trustworthy marketplace" by adding the trust/onboarding features deferred from Phase 1.**

**Reviews & ratings** (2026-04-17) — signed off
- ReviewEntity with primary/byTeacher/byReviewer/byBooking indexes
- POST /reviews (requires confirmed/completed booking owned by reviewer; one-per-booking)
- GET /reviews/teachers/:id (public, via CDK public route)
- DELETE /reviews/:id (author or admin)
- `recomputeTeacherRating` keeps TeacherProfileEntity.ratingAvg/ratingCount in sync
- `review_posted` notification
- UI: star-picker form at /reviews/new, "Review" CTA on /bookings, reviews section on teacher detail with delete button for author/admin
- Fixes from verifier: UserEntity.get cascade wrapped in try/catch; 409 mapped to friendly messages; teacher profile refetched after delete so the header updates
- MVP tradeoffs: one-review-per-booking race (low risk), eventual-consistent aggregate (last-write-wins), 1000-review aggregate cap

**Lesson-request flow** (2026-04-17) — signed off
- LessonRequestEntity with status machine (pending/accepted/rejected/cancelled/expired); byStudent + byTeacher GSIs
- POST /lesson-requests (blocks self-request, validates teacher role)
- GET /lesson-requests/mine (student outbox), GET /inbox (teacher inbox), GET /:id (gated to participants)
- POST /:id/accept, /:id/reject (teacher), /:id/cancel (student)
- 3 notification types (created/accepted/rejected) → correct audiences
- UI: Request CTA on teacher detail, /requests role-aware list, /requests/[id] detail with accept/reject/cancel actions and post-accept "Book a session" CTA
- Audited with TWO separate agents (user correction — no collapsed pipeline). Verifier caught unguarded UserEntity.get cascade in respond() and wrapped it; conditional patchAttrs pattern adopted to avoid explicit-undefined hazard
- MVP tradeoffs: concurrent accept/reject race (dup notifications), admin sees empty mine list

**Parent ↔ child CRUD** (2026-04-17) — signed off
- ParentChildLinkEntity extended with status (pending/accepted/rejected), respondedAt, watched updatedAt; PARENT_CHILD_LINK_STATUSES exported
- POST /family/children (parent invites by email; validates role, blocks self-link, requires student role, prevents duplicates)
- GET /family/children (parent's children with hydrated user data), PATCH /children/:childId (update relationship, 400 if empty body), DELETE /children/:childId
- GET /family/parents (child's parents), POST /family/parents/:parentId/accept|reject (child responds, status-guarded)
- 3 notification types (child_link_requested/accepted/rejected)
- UI: /parent/children (gated to parent role) list + invite form + error mapping + remove; /student/parents (gated) list + accept/reject for pending
- Audited with TWO separate agents. Verifier fixed brittle Parameters<...> type (replaced with Context import) and added empty-PATCH guard
- MVP tradeoffs: GSI eventual consistency on parent-create → child-read, read endpoints fan-out Promise.all rejection on single failure, re-invite after rejection requires delete-then-create

**Files added/modified in Phase 2A pass:**
- db/src/entities/review.ts (new), lesson-request.ts (new); parent.ts (status + respondedAt + updatedAt)
- db/src/entities/index.ts (re-exports); notification.ts (7 new notification types total across reviews + lesson-requests + parent-child)
- lambdas/src/routes/reviews.ts, lesson-requests.ts, family.ts (new)
- lambdas/src/app.ts (mounted /reviews, /lesson-requests, /family)
- cdk/lib/api-stack.ts (public GET /reviews/teachers/{proxy+} route)
- web/src/app/reviews/new/page.tsx (new); /bookings/page.tsx, /teachers/[userId]/page.tsx (Review CTA, reviews section w/ delete)
- web/src/app/requests/ (new: new, list, [requestId] detail); teachers/[userId] CTA; dashboard links
- web/src/app/parent/children/page.tsx, /student/parents/page.tsx (new); dashboard links

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
