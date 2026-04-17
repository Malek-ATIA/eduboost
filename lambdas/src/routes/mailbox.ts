import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  MailboxThreadEntity,
  MailboxMessageEntity,
  UserEntity,
  dmThreadId,
  makeMailboxMessageId,
} from "@eduboost/db";
import { requireAuth } from "../middleware/auth.js";
import { notify } from "../lib/notifications.js";

export const mailboxRoutes = new Hono();

mailboxRoutes.use("*", requireAuth);

// Threaded async inbox — pair-keyed (deterministic threadId from sorted user
// pair) so the same two users never end up with duplicate threads. Participants
// are stored as (participantA, participantB) in sorted order; each has its own
// GSI so the list view works in one partition read regardless of who you are.

async function getOrCreateThread(
  a: string,
  b: string,
  subject: string,
): Promise<string> {
  const [x, y] = [a, b].sort();
  const threadId = dmThreadId(a, b);
  const existing = await MailboxThreadEntity.get({ threadId }).go();
  if (existing.data) return threadId;
  await MailboxThreadEntity.create({
    threadId,
    participantA: x!,
    participantB: y!,
    subject,
    lastMessageAt: new Date().toISOString(),
  }).go();
  return threadId;
}

const createSchema = z.object({
  recipientId: z.string().min(1),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10_000),
});

mailboxRoutes.post("/threads", zValidator("json", createSchema), async (c) => {
  const { sub } = c.get("auth");
  const { recipientId, subject, body } = c.req.valid("json");
  if (recipientId === sub) return c.json({ error: "cannot_message_self" }, 400);

  // Verify recipient exists BEFORE creating the thread, otherwise we'd leave
  // behind an orphan thread pointing to a non-existent user.
  const recipient = await UserEntity.get({ userId: recipientId }).go();
  if (!recipient.data) return c.json({ error: "recipient_not_found" }, 404);

  const threadId = await getOrCreateThread(sub, recipientId, subject);
  const messageId = makeMailboxMessageId();
  const now = new Date().toISOString();
  await Promise.all([
    MailboxMessageEntity.create({
      threadId,
      messageId,
      authorId: sub,
      body,
    }).go(),
    MailboxThreadEntity.patch({ threadId })
      .set({
        lastMessageAt: now,
        lastMessageBody: body.slice(0, 200),
        lastMessageAuthorId: sub,
      })
      .go(),
  ]);

  try {
    await notify({
      userId: recipientId,
      type: "new_dm",
      title: `New mailbox: ${subject}`,
      body: body.slice(0, 200),
      linkPath: `/mailbox/${threadId}`,
    });
  } catch (err) {
    console.error("mailbox.post: notify failed (non-fatal)", err);
  }

  return c.json({ threadId }, 201);
});

mailboxRoutes.get("/threads/mine", async (c) => {
  const { sub } = c.get("auth");
  const [asA, asB] = await Promise.all([
    MailboxThreadEntity.query
      .byParticipantA({ participantA: sub })
      .go({ limit: 100, order: "desc" }),
    MailboxThreadEntity.query
      .byParticipantB({ participantB: sub })
      .go({ limit: 100, order: "desc" }),
  ]);
  const byId = new Map<string, (typeof asA.data)[number]>();
  for (const t of [...asA.data, ...asB.data]) byId.set(t.threadId, t);
  const items = [...byId.values()].sort(
    (x, y) => (y.lastMessageAt ?? "").localeCompare(x.lastMessageAt ?? ""),
  );
  return c.json({ items });
});

mailboxRoutes.get(
  "/threads/:threadId",
  zValidator("param", z.object({ threadId: z.string().min(1) })),
  async (c) => {
    const { sub } = c.get("auth");
    const { threadId } = c.req.valid("param");
    const thread = await MailboxThreadEntity.get({ threadId }).go();
    if (!thread.data) return c.json({ error: "not_found" }, 404);
    if (thread.data.participantA !== sub && thread.data.participantB !== sub) {
      return c.json({ error: "forbidden" }, 403);
    }
    const messages = await MailboxMessageEntity.query
      .primary({ threadId })
      .go({ limit: 500 });
    return c.json({ thread: thread.data, messages: messages.data });
  },
);

mailboxRoutes.post(
  "/threads/:threadId/messages",
  zValidator("param", z.object({ threadId: z.string().min(1) })),
  zValidator(
    "json",
    z.object({ body: z.string().trim().min(1).max(10_000) }),
  ),
  async (c) => {
    const { sub } = c.get("auth");
    const { threadId } = c.req.valid("param");
    const { body } = c.req.valid("json");
    const thread = await MailboxThreadEntity.get({ threadId }).go();
    if (!thread.data) return c.json({ error: "not_found" }, 404);
    if (thread.data.participantA !== sub && thread.data.participantB !== sub) {
      return c.json({ error: "forbidden" }, 403);
    }
    const messageId = makeMailboxMessageId();
    const now = new Date().toISOString();
    await Promise.all([
      MailboxMessageEntity.create({
        threadId,
        messageId,
        authorId: sub,
        body,
      }).go(),
      MailboxThreadEntity.patch({ threadId })
        .set({
          lastMessageAt: now,
          lastMessageBody: body.slice(0, 200),
          lastMessageAuthorId: sub,
        })
        .go(),
    ]);

    const counterpartyId =
      thread.data.participantA === sub
        ? thread.data.participantB
        : thread.data.participantA;
    try {
      await notify({
        userId: counterpartyId,
        type: "new_dm",
        title: `Mailbox reply: ${thread.data.subject}`,
        body: body.slice(0, 200),
        linkPath: `/mailbox/${threadId}`,
      });
    } catch (err) {
      console.error("mailbox.reply: notify failed (non-fatal)", err);
    }

    return c.json({ ok: true, messageId }, 201);
  },
);
