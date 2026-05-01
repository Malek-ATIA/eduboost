import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { nanoid } from "nanoid";
import {
  ChatMessageEntity,
  ClassroomEntity,
  ClassroomMembershipEntity,
  UserEntity,
  dmChannelId,
  classroomChannelId,
} from "@eduboost/db";
import { requireAuth } from "../middleware/auth.js";
import { notify } from "../lib/notifications.js";

export const chatRoutes = new Hono();

chatRoutes.use("*", requireAuth);

function makeMessageId(): string {
  return `${new Date().toISOString()}#${nanoid(8)}`;
}

const sendSchema = z.object({ body: z.string().min(1).max(4000) });

chatRoutes.get("/dm/:otherUserId", async (c) => {
  const { sub } = c.get("auth");
  const otherUserId = c.req.param("otherUserId");
  const channelId = dmChannelId(sub, otherUserId);
  const result = await ChatMessageEntity.query
    .primary({ channelId })
    .go({ limit: 100, order: "desc" });
  return c.json({ channelId, items: result.data });
});

chatRoutes.post("/dm/:otherUserId", zValidator("json", sendSchema), async (c) => {
  const { sub } = c.get("auth");
  const otherUserId = c.req.param("otherUserId");
  const { body } = c.req.valid("json");
  const channelId = dmChannelId(sub, otherUserId);
  const message = await ChatMessageEntity.create({
    channelId,
    messageId: makeMessageId(),
    senderId: sub,
    body,
    kind: "text",
  }).go();

  const sender = await UserEntity.get({ userId: sub }).go();
  if (sender.data) {
    await notify({
      userId: otherUserId,
      type: "new_dm",
      title: `New message from ${sender.data.displayName}`,
      body: body.slice(0, 200),
      linkPath: `/chat/${sub}`,
    });
  }

  return c.json(message.data, 201);
});

chatRoutes.get("/classroom/:classroomId", async (c) => {
  const { sub } = c.get("auth");
  const classroomId = c.req.param("classroomId");
  const membership = await ClassroomMembershipEntity.get({ classroomId, userId: sub }).go();
  if (!membership.data) return c.json({ error: "forbidden" }, 403);
  const channelId = classroomChannelId(classroomId);
  const result = await ChatMessageEntity.query
    .primary({ channelId })
    .go({ limit: 100, order: "desc" });
  return c.json({ channelId, items: result.data });
});

chatRoutes.post("/classroom/:classroomId", zValidator("json", sendSchema), async (c) => {
  const { sub } = c.get("auth");
  const classroomId = c.req.param("classroomId");
  const { body } = c.req.valid("json");
  const membership = await ClassroomMembershipEntity.get({ classroomId, userId: sub }).go();
  if (!membership.data) return c.json({ error: "forbidden" }, 403);
  // Classroom group chat can be turned off by the teacher. When disabled
  // members can still READ historical messages but can't post new ones.
  const cls = await ClassroomEntity.get({ classroomId }).go();
  if (cls.data && cls.data.chatEnabled === false) {
    return c.json({ error: "chat_disabled" }, 403);
  }
  const channelId = classroomChannelId(classroomId);
  const message = await ChatMessageEntity.create({
    channelId,
    messageId: makeMessageId(),
    senderId: sub,
    body,
    kind: "text",
  }).go();

  try {
    const [sender, allMembers] = await Promise.all([
      UserEntity.get({ userId: sub }).go(),
      ClassroomMembershipEntity.query.primary({ classroomId }).go({ limit: 250 }),
    ]);
    const senderName = sender.data?.displayName ?? "Someone";
    await Promise.all(
      allMembers.data
        .filter((m) => m.userId !== sub)
        .map((m) =>
          notify({
            userId: m.userId,
            type: "new_classroom_message",
            title: `New message in classroom`,
            body: `${senderName}: ${body.slice(0, 160)}`,
            linkPath: `/classroom-chat/${classroomId}`,
          }),
        ),
    );
  } catch (err) {
    console.error("classroom chat notify failed (non-fatal)", err);
  }

  return c.json(message.data, 201);
});

// Delete a classroom chat message. Teacher (classroom.teacherId) can delete
// any message; any author can delete their own. DMs are NOT moderated — if
// you want to delete a DM, handle it through support tickets.
chatRoutes.delete("/classroom/:classroomId/:messageId", async (c) => {
  const { sub } = c.get("auth");
  const classroomId = c.req.param("classroomId");
  const messageId = c.req.param("messageId");
  const channelId = classroomChannelId(classroomId);

  const [cls, existing] = await Promise.all([
    ClassroomEntity.get({ classroomId }).go(),
    ChatMessageEntity.get({ channelId, messageId }).go(),
  ]);
  if (!cls.data) return c.json({ error: "not_found" }, 404);
  if (!existing.data) return c.json({ error: "not_found" }, 404);

  const isTeacher = cls.data.teacherId === sub;
  const isAuthor = existing.data.senderId === sub;
  if (!isTeacher && !isAuthor) return c.json({ error: "forbidden" }, 403);

  await ChatMessageEntity.delete({ channelId, messageId }).go();
  return c.json({ ok: true });
});
