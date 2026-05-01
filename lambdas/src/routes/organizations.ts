import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  OrganizationEntity,
  OrganizationMembershipEntity,
  UserEntity,
  ClassroomEntity,
  ClassroomMembershipEntity,
  ORG_KINDS,
  ORG_MEMBER_ROLES,
  makeOrgId,
} from "@eduboost/db";
import { requireAuth } from "../middleware/auth.js";
import { notify } from "../lib/notifications.js";

export const organizationRoutes = new Hono();

organizationRoutes.use("*", requireAuth);

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  kind: z.enum(ORG_KINDS),
  country: z.string().trim().max(80).optional(),
  description: z.string().trim().max(2000).optional(),
});

// Only teachers and admins can create organizations. Students/parents have no
// workflow for running an org, so the endpoint gates upfront.
organizationRoutes.post("/", zValidator("json", createSchema), async (c) => {
  const { sub, groups } = c.get("auth");
  const body = c.req.valid("json");

  const user = await UserEntity.get({ userId: sub }).go();
  if (!user.data) return c.json({ error: "user_not_found" }, 404);
  const isAdmin = groups.includes("admin");
  if (!isAdmin && user.data.role !== "teacher") {
    return c.json({ error: "only_teachers_or_admins" }, 403);
  }

  const orgId = makeOrgId();
  const [org] = await Promise.all([
    OrganizationEntity.create({
      orgId,
      name: body.name,
      kind: body.kind,
      country: body.country,
      description: body.description,
      ownerId: sub,
    }).go(),
    OrganizationMembershipEntity.create({
      orgId,
      userId: sub,
      role: "owner",
      invitedBy: sub,
    }).go(),
  ]);
  return c.json(org.data, 201);
});

organizationRoutes.get("/mine", async (c) => {
  const { sub } = c.get("auth");
  const memberships = await OrganizationMembershipEntity.query
    .byUser({ userId: sub })
    .go({ limit: 50 });
  const orgs = await Promise.all(
    memberships.data.map(async (m) => {
      try {
        const o = await OrganizationEntity.get({ orgId: m.orgId }).go();
        return o.data ? { ...o.data, myRole: m.role } : null;
      } catch {
        return null;
      }
    }),
  );
  return c.json({ items: orgs.filter((o): o is NonNullable<typeof o> => o !== null) });
});

async function requireMember(
  orgId: string,
  sub: string,
): Promise<{ role: (typeof ORG_MEMBER_ROLES)[number] } | null> {
  const m = await OrganizationMembershipEntity.get({ orgId, userId: sub }).go();
  return m.data ? { role: m.data.role } : null;
}

organizationRoutes.get(
  "/:orgId",
  zValidator("param", z.object({ orgId: z.string().min(1) })),
  async (c) => {
    const { sub } = c.get("auth");
    const { orgId } = c.req.valid("param");
    const org = await OrganizationEntity.get({ orgId }).go();
    if (!org.data) return c.json({ error: "not_found" }, 404);
    const membership = await requireMember(orgId, sub);
    if (!membership) return c.json({ error: "not_a_member" }, 403);
    const members = await OrganizationMembershipEntity.query
      .primary({ orgId })
      .go({ limit: 250 });
    const hydrated = await Promise.all(
      members.data.map(async (m) => {
        try {
          const u = await UserEntity.get({ userId: m.userId }).go();
          return {
            ...m,
            user: u.data
              ? { userId: u.data.userId, displayName: u.data.displayName, email: u.data.email }
              : null,
          };
        } catch {
          return { ...m, user: null };
        }
      }),
    );
    return c.json({ org: { ...org.data, myRole: membership.role }, members: hydrated });
  },
);

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(ORG_MEMBER_ROLES),
});

// Add a member by email. The invited user must already have an EduBoost account;
// we don't surface a signup-magic-link flow in MVP. Roles are scoped so only
// owners/admins can invite, and owner cannot be assigned via invite (protect the
// owner slot). Re-inviting the same user returns 409 so idempotency is the
// caller's responsibility.
organizationRoutes.post(
  "/:orgId/members",
  zValidator("param", z.object({ orgId: z.string().min(1) })),
  zValidator("json", inviteSchema),
  async (c) => {
    const { sub } = c.get("auth");
    const { orgId } = c.req.valid("param");
    const { email, role } = c.req.valid("json");

    const membership = await requireMember(orgId, sub);
    if (!membership) return c.json({ error: "not_a_member" }, 403);
    if (membership.role !== "owner" && membership.role !== "admin") {
      return c.json({ error: "not_authorized" }, 403);
    }
    if (role === "owner") return c.json({ error: "owner_cannot_be_invited" }, 400);

    const lookup = await UserEntity.query.byEmail({ email }).go({ limit: 1 });
    const target = lookup.data[0];
    if (!target) return c.json({ error: "user_not_found" }, 404);

    const existing = await OrganizationMembershipEntity.get({
      orgId,
      userId: target.userId,
    }).go();
    if (existing.data) return c.json({ error: "already_a_member" }, 409);

    const row = await OrganizationMembershipEntity.create({
      orgId,
      userId: target.userId,
      role,
      invitedBy: sub,
    }).go();
    return c.json(row.data, 201);
  },
);

organizationRoutes.delete(
  "/:orgId/members/:userId",
  zValidator(
    "param",
    z.object({ orgId: z.string().min(1), userId: z.string().min(1) }),
  ),
  async (c) => {
    const { sub } = c.get("auth");
    const { orgId, userId } = c.req.valid("param");

    const org = await OrganizationEntity.get({ orgId }).go();
    if (!org.data) return c.json({ error: "not_found" }, 404);

    const mine = await requireMember(orgId, sub);
    if (!mine) return c.json({ error: "not_a_member" }, 403);
    // A member can always remove themselves (leave). Otherwise owner/admin only.
    if (userId !== sub && mine.role !== "owner" && mine.role !== "admin") {
      return c.json({ error: "not_authorized" }, 403);
    }
    // Owner can't be removed — transfer ownership first (not in MVP scope).
    if (org.data.ownerId === userId) {
      return c.json({ error: "cannot_remove_owner" }, 400);
    }
    // Admins can't remove other admins; only owner can. Prevents lateral
    // admin-nuking from a compromised admin account.
    if (mine.role === "admin" && userId !== sub) {
      const target = await OrganizationMembershipEntity.get({ orgId, userId }).go();
      if (target.data?.role === "admin") {
        return c.json({ error: "admin_cannot_remove_admin" }, 403);
      }
    }

    await OrganizationMembershipEntity.delete({ orgId, userId }).go();

    if (userId !== sub) {
      try {
        await notify({
          userId,
          type: "member_removed",
          title: "Removed from organization",
          body: `You have been removed from the organization "${org.data.name}".`,
          linkPath: `/orgs`,
        });
      } catch (err) {
        console.error("orgs.removeMember: notify failed (non-fatal)", err);
      }
    }

    return c.json({ ok: true });
  },
);

// Link an existing classroom to this org. The classroom's teacher must be a
// member of the org (so we don't silently claim someone else's room). The
// caller must be org owner/admin AND the classroom's teacher (or an admin).
organizationRoutes.post(
  "/:orgId/classrooms/:classroomId",
  zValidator(
    "param",
    z.object({ orgId: z.string().min(1), classroomId: z.string().min(1) }),
  ),
  async (c) => {
    const { sub, groups } = c.get("auth");
    const { orgId, classroomId } = c.req.valid("param");
    const isAdmin = groups.includes("admin");

    const [mine, classroom] = await Promise.all([
      requireMember(orgId, sub),
      ClassroomEntity.get({ classroomId }).go(),
    ]);
    if (!classroom.data) return c.json({ error: "classroom_not_found" }, 404);
    if (!mine) return c.json({ error: "not_a_member" }, 403);
    if (mine.role !== "owner" && mine.role !== "admin") {
      return c.json({ error: "not_authorized" }, 403);
    }
    if (!isAdmin && classroom.data.teacherId !== sub) {
      return c.json({ error: "not_your_classroom" }, 403);
    }
    // The classroom's teacher must also be a member of the org so the
    // classroom→org linkage reflects real team membership, not a unilateral
    // claim by the org admin.
    const teacherMember = await OrganizationMembershipEntity.get({
      orgId,
      userId: classroom.data.teacherId,
    }).go();
    if (!teacherMember.data) {
      return c.json({ error: "teacher_not_in_org" }, 409);
    }
    if (classroom.data.orgId && classroom.data.orgId !== orgId) {
      return c.json({ error: "classroom_in_other_org" }, 409);
    }

    await ClassroomEntity.patch({ classroomId }).set({ orgId }).go();
    return c.json({ ok: true });
  },
);

// Bulk-add students to a classroom linked to this org. Closes the spec bullet
// "Administration: Assign students per classroom per teacher" — the org admin
// pastes one or more emails and each resolves to an existing UserEntity via
// the byEmail GSI, then gets a ClassroomMembershipEntity row with role=student.
// Idempotent per-email: already-members don't double-write and unknown emails
// are reported back without blocking the batch.
const assignStudentsSchema = z.object({
  emails: z.array(z.string().email()).min(1).max(50),
});

organizationRoutes.post(
  "/:orgId/classrooms/:classroomId/students",
  zValidator(
    "param",
    z.object({
      orgId: z.string().min(1),
      classroomId: z.string().min(1),
    }),
  ),
  zValidator("json", assignStudentsSchema),
  async (c) => {
    const { sub } = c.get("auth");
    const { orgId, classroomId } = c.req.valid("param");
    const { emails } = c.req.valid("json");

    const [mine, classroom] = await Promise.all([
      requireMember(orgId, sub),
      ClassroomEntity.get({ classroomId }).go(),
    ]);
    if (!mine) return c.json({ error: "not_a_member" }, 403);
    if (mine.role !== "owner" && mine.role !== "admin") {
      return c.json({ error: "not_authorized" }, 403);
    }
    if (!classroom.data) return c.json({ error: "classroom_not_found" }, 404);
    if (classroom.data.orgId !== orgId) {
      return c.json({ error: "classroom_not_in_org" }, 409);
    }

    // Dedup + normalize input so the caller can paste a loose list without
    // tripping the idempotency checks downstream.
    const unique = [...new Set(emails.map((e) => e.toLowerCase().trim()))];

    const added: { userId: string; email: string; displayName: string }[] = [];
    const alreadyMember: { userId: string; email: string }[] = [];
    const notFound: string[] = [];

    await Promise.all(
      unique.map(async (email) => {
        try {
          const lookup = await UserEntity.query.byEmail({ email }).go({ limit: 1 });
          const target = lookup.data[0];
          if (!target) {
            notFound.push(email);
            return;
          }
          const existing = await ClassroomMembershipEntity.get({
            classroomId,
            userId: target.userId,
          }).go();
          if (existing.data) {
            alreadyMember.push({ userId: target.userId, email });
            return;
          }
          await ClassroomMembershipEntity.create({
            classroomId,
            userId: target.userId,
            role: "student",
          }).go();
          added.push({
            userId: target.userId,
            email,
            displayName: target.displayName,
          });
        } catch (err) {
          console.error("bulk assign: failed for", email, err);
          notFound.push(email);
        }
      }),
    );

    return c.json({ added, alreadyMember, notFound });
  },
);

// List the current members of a classroom (org context — admins see who
// belongs). Hydrates user displayName + email for the UI.
organizationRoutes.get(
  "/:orgId/classrooms/:classroomId/students",
  zValidator(
    "param",
    z.object({
      orgId: z.string().min(1),
      classroomId: z.string().min(1),
    }),
  ),
  async (c) => {
    const { sub } = c.get("auth");
    const { orgId, classroomId } = c.req.valid("param");
    const [mine, classroom] = await Promise.all([
      requireMember(orgId, sub),
      ClassroomEntity.get({ classroomId }).go(),
    ]);
    if (!mine) return c.json({ error: "not_a_member" }, 403);
    if (!classroom.data) return c.json({ error: "classroom_not_found" }, 404);
    if (classroom.data.orgId !== orgId) {
      return c.json({ error: "classroom_not_in_org" }, 409);
    }
    const members = await ClassroomMembershipEntity.query
      .primary({ classroomId })
      .go({ limit: 250 });
    const hydrated = await Promise.all(
      members.data.map(async (m) => {
        try {
          const u = await UserEntity.get({ userId: m.userId }).go();
          return {
            ...m,
            user: u.data
              ? { userId: u.data.userId, displayName: u.data.displayName, email: u.data.email }
              : null,
          };
        } catch {
          return { ...m, user: null };
        }
      }),
    );
    return c.json({ items: hydrated });
  },
);

organizationRoutes.get(
  "/:orgId/classrooms",
  zValidator("param", z.object({ orgId: z.string().min(1) })),
  async (c) => {
    const { sub } = c.get("auth");
    const { orgId } = c.req.valid("param");
    const membership = await requireMember(orgId, sub);
    if (!membership) return c.json({ error: "not_a_member" }, 403);

    // No byOrg GSI on ClassroomEntity (adding one would mean a migration on an
    // already-deployed table; defer). Instead iterate org members with role
    // "owner"/"admin"/"teacher" and fan out per teacher. Bounded by member
    // count which is capped at the org level.
    const members = await OrganizationMembershipEntity.query
      .primary({ orgId })
      .go({ limit: 250 });
    const teacherIds = members.data
      .filter((m) => m.role === "owner" || m.role === "admin" || m.role === "teacher")
      .map((m) => m.userId);
    const lists = await Promise.all(
      teacherIds.map((t) =>
        ClassroomEntity.query.byTeacher({ teacherId: t }).go({ limit: 50 }),
      ),
    );
    const items = lists
      .flatMap((l) => l.data)
      .filter((c2) => c2.orgId === orgId);
    return c.json({ items });
  },
);
