import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { nanoid } from "nanoid";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  StudyMaterialEntity,
  STUDY_MATERIAL_KINDS,
  SubscriptionEntity,
  makeMaterialId,
} from "@eduboost/db";
import { requireAuth } from "../middleware/auth.js";
import { env } from "../env.js";

export const studyMaterialRoutes = new Hono();

const s3 = new S3Client({ region: env.region });

const listQuery = z.object({
  kind: z.enum(STUDY_MATERIAL_KINDS).optional(),
  subject: z.string().trim().min(1).max(100).optional(),
  // Same scan-Limit caveat as /teachers and /marketplace — DDB's Limit is
  // pre-filter, so a low value can hide real matches.
  limit: z.coerce.number().int().min(1).max(200).default(200),
});

// Public browse, matching the marketplace pattern. Peer-shared materials are
// free so there's no private data to gate — anyone can see that `exam`s exist.
studyMaterialRoutes.get("/", zValidator("query", listQuery), async (c) => {
  const q = c.req.valid("query");
  if (q.kind) {
    const result = await StudyMaterialEntity.query
      .byKind({ kind: q.kind })
      .where(({ subject }, { eq }) =>
        q.subject ? eq(subject, q.subject) : "",
      )
      .go({ limit: q.limit, order: "desc" });
    return c.json({ items: result.data });
  }
  const scan = StudyMaterialEntity.scan.where((attr, op) => {
    if (q.subject) return op.eq(attr.subject, q.subject);
    return "";
  });
  const result = await scan.go({ limit: q.limit });
  return c.json({ items: result.data });
});

studyMaterialRoutes.get(
  "/:materialId",
  zValidator("param", z.object({ materialId: z.string().min(1) })),
  async (c) => {
    const { materialId } = c.req.valid("param");
    const r = await StudyMaterialEntity.get({ materialId }).go();
    if (!r.data) return c.json({ error: "not_found" }, 404);
    return c.json(r.data);
  },
);

studyMaterialRoutes.use("/mine", requireAuth);
studyMaterialRoutes.use("*/upload-url", requireAuth);
studyMaterialRoutes.use("*/download-url", requireAuth);

studyMaterialRoutes.get("/mine", async (c) => {
  const { sub } = c.get("auth");
  const result = await StudyMaterialEntity.query
    .byAuthor({ authorId: sub })
    .go({ limit: 100, order: "desc" });
  return c.json({ items: result.data });
});

const createSchema = z.object({
  kind: z.enum(STUDY_MATERIAL_KINDS),
  title: z.string().trim().min(3).max(200),
  subject: z.string().trim().min(1).max(100),
  description: z.string().trim().max(2000).optional(),
  premium: z.boolean().default(false),
});

studyMaterialRoutes.post(
  "/",
  requireAuth,
  zValidator("json", createSchema),
  async (c) => {
    const { sub } = c.get("auth");
    const body = c.req.valid("json");
    const materialId = makeMaterialId();
    const row = await StudyMaterialEntity.create({
      materialId,
      authorId: sub,
      ...body,
    }).go();
    return c.json(row.data, 201);
  },
);

studyMaterialRoutes.delete(
  "/:materialId",
  requireAuth,
  zValidator("param", z.object({ materialId: z.string().min(1) })),
  async (c) => {
    const { sub, groups } = c.get("auth");
    const { materialId } = c.req.valid("param");
    const r = await StudyMaterialEntity.get({ materialId }).go();
    if (!r.data) return c.json({ error: "not_found" }, 404);
    const isAdmin = groups.includes("admin");
    if (!isAdmin && r.data.authorId !== sub) {
      return c.json({ error: "forbidden" }, 403);
    }
    await StudyMaterialEntity.delete({ materialId }).go();
    return c.json({ ok: true });
  },
);

const uploadSchema = z.object({
  mimeType: z.string().min(1).max(200),
  sizeBytes: z.number().int().min(1).max(50 * 1024 * 1024),
});

studyMaterialRoutes.post(
  "/:materialId/upload-url",
  zValidator("param", z.object({ materialId: z.string().min(1) })),
  zValidator("json", uploadSchema),
  async (c) => {
    const { sub } = c.get("auth");
    const { materialId } = c.req.valid("param");
    const { mimeType, sizeBytes } = c.req.valid("json");
    const r = await StudyMaterialEntity.get({ materialId }).go();
    if (!r.data) return c.json({ error: "not_found" }, 404);
    if (r.data.authorId !== sub) return c.json({ error: "forbidden" }, 403);
    const key = `study-materials/${materialId}/${nanoid(10)}`;
    const cmd = new PutObjectCommand({
      Bucket: env.uploadsBucket,
      Key: key,
      ContentType: mimeType,
      ContentLength: sizeBytes,
    });
    const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 900 });
    await StudyMaterialEntity.patch({ materialId })
      .set({ fileS3Key: key, fileMimeType: mimeType, fileSizeBytes: sizeBytes })
      .go();
    return c.json({ uploadUrl, key });
  },
);

studyMaterialRoutes.get(
  "/:materialId/download-url",
  zValidator("param", z.object({ materialId: z.string().min(1) })),
  async (c) => {
    const { sub, groups } = c.get("auth");
    const { materialId } = c.req.valid("param");
    const r = await StudyMaterialEntity.get({ materialId }).go();
    if (!r.data) return c.json({ error: "not_found" }, 404);
    if (!r.data.fileS3Key) return c.json({ error: "no_file" }, 404);

    // Gate premium materials behind an active student_premium membership.
    // Authors + admins bypass the paywall so they can audit their own or
    // platform content. Active = Stripe subscription in "active" or "trialing".
    if (r.data.premium) {
      const isAuthor = r.data.authorId === sub;
      const isAdmin = groups.includes("admin");
      if (!isAuthor && !isAdmin) {
        const sub$ = await SubscriptionEntity.get({ userId: sub }).go();
        // Accept both "active" and "trialing" so free-trial subscribers aren't
        // blocked at the paywall during their Stripe-managed trial window.
        const ok =
          sub$.data?.planId === "student_premium" &&
          (sub$.data.status === "active" || sub$.data.status === "trialing");
        if (!ok) return c.json({ error: "premium_required" }, 402);
      }
    }

    const cmd = new GetObjectCommand({
      Bucket: env.uploadsBucket,
      Key: r.data.fileS3Key,
    });
    const downloadUrl = await getSignedUrl(s3, cmd, { expiresIn: 600 });
    return c.json({ downloadUrl });
  },
);
