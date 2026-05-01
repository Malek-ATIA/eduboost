import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  ParentChildLinkEntity,
  UserEntity,
  SessionEntity,
  ClassroomMembershipEntity,
  BookingEntity,
} from "@eduboost/db";
import { requireAuth } from "../middleware/auth.js";
import { notify } from "../lib/notifications.js";

export const familyRoutes = new Hono();

familyRoutes.use("*", requireAuth);

const inviteSchema = z.object({
  childEmail: z.string().email(),
  relationship: z.enum(["mother", "father", "guardian"]),
});

familyRoutes.post("/children", zValidator("json", inviteSchema), async (c) => {
  const { sub } = c.get("auth");
  const { childEmail, relationship } = c.req.valid("json");

  const parent = await UserEntity.get({ userId: sub }).go();
  if (!parent.data) return c.json({ error: "user_not_found" }, 404);
  if (parent.data.role !== "parent") return c.json({ error: "not_a_parent" }, 403);

  const childLookup = await UserEntity.query.byEmail({ email: childEmail }).go({ limit: 1 });
  const child = childLookup.data[0];
  if (!child) return c.json({ error: "child_not_registered" }, 404);
  if (child.role !== "student") return c.json({ error: "not_a_student" }, 400);
  if (child.userId === sub) return c.json({ error: "cannot_link_self" }, 400);

  const existing = await ParentChildLinkEntity.get({ parentId: sub, childId: child.userId }).go();
  if (existing.data) return c.json({ error: "link_exists", status: existing.data.status }, 409);

  const link = await ParentChildLinkEntity.create({
    parentId: sub,
    childId: child.userId,
    relationship,
    status: "pending",
  }).go();

  try {
    await notify({
      userId: child.userId,
      type: "child_link_requested",
      title: "Parent link request",
      body: `${parent.data.displayName} wants to link as your ${relationship}.`,
      linkPath: `/student/parents`,
    });
  } catch (err) {
    console.error("family.children: notify failed (non-fatal)", err);
  }

  return c.json(link.data, 201);
});

familyRoutes.get("/children", async (c) => {
  const { sub } = c.get("auth");
  const links = await ParentChildLinkEntity.query
    .primary({ parentId: sub })
    .go({ limit: 50 });
  const items = await Promise.all(
    links.data.map(async (link) => {
      const user = await UserEntity.get({ userId: link.childId }).go();
      return {
        ...link,
        child: user.data
          ? { userId: user.data.userId, displayName: user.data.displayName, email: user.data.email }
          : null,
      };
    }),
  );
  return c.json({ items });
});

const patchSchema = z.object({
  relationship: z.enum(["mother", "father", "guardian"]).optional(),
});

familyRoutes.patch(
  "/children/:childId",
  zValidator("json", patchSchema),
  async (c) => {
    const { sub } = c.get("auth");
    const childId = c.req.param("childId");
    const body = c.req.valid("json");
    if (!body.relationship) return c.json({ error: "no_fields" }, 400);
    const existing = await ParentChildLinkEntity.get({ parentId: sub, childId }).go();
    if (!existing.data) return c.json({ error: "not_found" }, 404);
    await ParentChildLinkEntity.patch({ parentId: sub, childId })
      .set({ relationship: body.relationship })
      .go();
    return c.json({ ok: true });
  },
);

familyRoutes.delete("/children/:childId", async (c) => {
  const { sub } = c.get("auth");
  const childId = c.req.param("childId");
  const existing = await ParentChildLinkEntity.get({ parentId: sub, childId }).go();
  if (!existing.data) return c.json({ error: "not_found" }, 404);
  await ParentChildLinkEntity.delete({ parentId: sub, childId }).go();
  return c.json({ ok: true });
});

familyRoutes.get("/calendar", async (c) => {
  const { sub } = c.get("auth");
  const links = await ParentChildLinkEntity.query
    .primary({ parentId: sub })
    .go({ limit: 50 });

  const acceptedChildIds = links.data
    .filter((l) => l.status === "accepted")
    .map((l) => l.childId);

  if (acceptedChildIds.length === 0) {
    return c.json({ sessions: [], bookings: [] });
  }

  const now = new Date().toISOString();

  const allSessions: Record<string, unknown>[] = [];
  const allBookings: Record<string, unknown>[] = [];

  const childUsers = await Promise.all(
    acceptedChildIds.map((id) => UserEntity.get({ userId: id }).go()),
  );
  const childNameMap = new Map<string, string>();
  for (const u of childUsers) {
    if (u.data) childNameMap.set(u.data.userId, u.data.displayName ?? u.data.email);
  }

  await Promise.all(
    acceptedChildIds.map(async (childId) => {
      const childName = childNameMap.get(childId) ?? "Child";

      const memberships = await ClassroomMembershipEntity.query
        .byUser({ userId: childId })
        .go({ limit: 100 });

      const sessionResults = await Promise.all(
        memberships.data
          .filter((m) => m.role !== "teacher")
          .map((m) =>
            SessionEntity.query
              .byClassroom({ classroomId: m.classroomId })
              .gte({ startsAt: now })
              .go({ limit: 50 })
              .then((r) => r.data),
          ),
      );

      for (const s of sessionResults.flat()) {
        allSessions.push({ ...s, childId, childName });
      }

      const bookings = await BookingEntity.query
        .byStudent({ studentId: childId })
        .go({ limit: 50 });

      for (const b of bookings.data) {
        if (b.status === "confirmed" || b.status === "completed") {
          allBookings.push({ ...b, childId, childName });
        }
      }
    }),
  );

  const sessionMap = new Map<string, Record<string, unknown>>();
  for (const s of allSessions) sessionMap.set(s.sessionId as string, s);

  return c.json({
    sessions: Array.from(sessionMap.values()),
    bookings: allBookings,
  });
});

familyRoutes.get("/parents", async (c) => {
  const { sub } = c.get("auth");
  const links = await ParentChildLinkEntity.query.byChild({ childId: sub }).go({ limit: 50 });
  const items = await Promise.all(
    links.data.map(async (link) => {
      const user = await UserEntity.get({ userId: link.parentId }).go();
      return {
        ...link,
        parent: user.data
          ? { userId: user.data.userId, displayName: user.data.displayName, email: user.data.email }
          : null,
      };
    }),
  );
  return c.json({ items });
});

async function respondToLink(
  c: Context,
  parentId: string,
  decision: "accepted" | "rejected",
) {
  const { sub } = c.get("auth");
  const existing = await ParentChildLinkEntity.get({ parentId, childId: sub }).go();
  if (!existing.data) return c.json({ error: "not_found" }, 404);
  if (existing.data.status !== "pending") {
    return c.json({ error: "already_resolved", status: existing.data.status }, 409);
  }

  await ParentChildLinkEntity.patch({ parentId, childId: sub })
    .set({ status: decision, respondedAt: new Date().toISOString() })
    .go();

  let childName = "Your child";
  try {
    const child = await UserEntity.get({ userId: sub }).go();
    if (child.data?.displayName) childName = child.data.displayName;
  } catch (err) {
    console.error("family.respondToLink: child lookup failed (non-fatal)", err);
  }

  try {
    await notify({
      userId: parentId,
      type: decision === "accepted" ? "child_link_accepted" : "child_link_rejected",
      title: decision === "accepted" ? "Parent link accepted" : "Parent link declined",
      body:
        decision === "accepted"
          ? `${childName} accepted your parent link.`
          : `${childName} declined your parent link.`,
      linkPath: `/parent/children`,
    });
  } catch (err) {
    console.error("family.respondToLink: notify failed (non-fatal)", err);
  }

  return c.json({ ok: true, status: decision });
}

familyRoutes.post("/parents/:parentId/accept", async (c) => {
  const parentId = c.req.param("parentId");
  return respondToLink(c, parentId, "accepted");
});

familyRoutes.post("/parents/:parentId/reject", async (c) => {
  const parentId = c.req.param("parentId");
  return respondToLink(c, parentId, "rejected");
});
