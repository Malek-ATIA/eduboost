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
import { UserEntity } from "@eduboost/db";
import { requireAuth } from "../middleware/auth.js";
import { env } from "../env.js";

export const userRoutes = new Hono();

const s3 = new S3Client({ region: env.region });

// Avatar upload/get URLs need to be callable both on own profile (via
// `requireAuth`) AND anonymously when rendering teacher cards. We mount the
// auth middleware below on everything EXCEPT the public GET /avatar-url.

const AVATAR_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
// 5 MB ceiling — plenty for a 1024x1024 JPEG/PNG. Stops a client from pushing
// the uploads bucket full of 50 MB RAW images.
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

// Public read: return a short-lived signed GET URL for any user's avatar.
// The stored value in `avatarUrl` is actually the S3 key (we reuse the
// column name; it's been a string all along so no migration needed).
// Browsers cache the returned image via the signed URL; if you want the URL
// to survive longer than 1h, request it again.
userRoutes.get(
  "/:userId/avatar-url",
  zValidator("param", z.object({ userId: z.string().min(1) })),
  async (c) => {
    const { userId } = c.req.valid("param");
    const user = await UserEntity.get({ userId }).go();
    if (!user.data?.avatarUrl) return c.json({ error: "no_avatar" }, 404);
    const cmd = new GetObjectCommand({
      Bucket: env.uploadsBucket,
      Key: user.data.avatarUrl,
    });
    const url = await getSignedUrl(s3, cmd, { expiresIn: 3600 });
    return c.json({ url });
  },
);

userRoutes.use("*", requireAuth);

userRoutes.get("/me", async (c) => {
  const { sub } = c.get("auth");
  const user = await UserEntity.get({ userId: sub }).go();
  if (!user.data) return c.json({ error: "not found" }, 404);
  return c.json(user.data);
});

const upsertSchema = z.object({
  email: z.string().email(),
  role: z.enum(["parent", "student", "teacher", "org_admin", "admin"]),
  displayName: z.string().min(1).max(100),
  avatarUrl: z.string().optional(),
});

userRoutes.post("/me", zValidator("json", upsertSchema), async (c) => {
  const { sub } = c.get("auth");
  const body = c.req.valid("json");
  const result = await UserEntity.upsert({
    userId: sub,
    cognitoSub: sub,
    ...body,
  }).go();
  return c.json(result.data);
});

// Partial profile update — lets any authenticated user patch just their own
// displayName and/or avatarUrl without needing to resubmit email+role. The
// avatar picker on the frontend hits this directly after uploading to S3.
const patchSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  avatarUrl: z.string().max(500).optional(),
});

userRoutes.patch("/me", zValidator("json", patchSchema), async (c) => {
  const { sub } = c.get("auth");
  const body = c.req.valid("json");
  const setPayload: { displayName?: string; avatarUrl?: string } = {};
  if (body.displayName !== undefined) setPayload.displayName = body.displayName;
  if (body.avatarUrl !== undefined) setPayload.avatarUrl = body.avatarUrl;
  if (Object.keys(setPayload).length === 0) {
    return c.json({ error: "no_fields_to_update" }, 400);
  }
  const result = await UserEntity.patch({ userId: sub })
    .set(setPayload)
    .go({ response: "all_new" });
  return c.json(result.data);
});

const avatarUploadSchema = z.object({
  mimeType: z.enum(AVATAR_MIME_TYPES),
  sizeBytes: z.number().int().min(1).max(MAX_AVATAR_BYTES),
});

userRoutes.post(
  "/me/avatar-upload-url",
  zValidator("json", avatarUploadSchema),
  async (c) => {
    const { sub } = c.get("auth");
    const { mimeType, sizeBytes } = c.req.valid("json");
    // Random suffix prevents CloudFront edge caching from serving a stale
    // avatar after replacement (signed URLs change anyway, but the key path
    // is also fresh so browser-side caches don't linger either).
    const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
    const key = `avatars/${sub}/${nanoid(10)}.${ext}`;
    const cmd = new PutObjectCommand({
      Bucket: env.uploadsBucket,
      Key: key,
      ContentType: mimeType,
      ContentLength: sizeBytes,
    });
    const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 900 });
    return c.json({ uploadUrl, key });
  },
);
