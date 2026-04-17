import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  ListingEntity,
  OrderEntity,
  UserEntity,
  OrganizationEntity,
  OrganizationMembershipEntity,
  PaymentEntity,
  SupportTicketEntity,
  TicketMessageEntity,
  LISTING_STATUSES,
  makeListingId,
  makeOrderId,
  makeTicketId,
  makeTicketMessageId,
} from "@eduboost/db";
import { requireAuth } from "../middleware/auth.js";
import { stripe, computePlatformFeeCents } from "../lib/stripe.js";
import { env } from "../env.js";

export const marketplaceRoutes = new Hono();

const s3 = new S3Client({ region: env.region });

const listQuery = z.object({
  subject: z.string().trim().min(1).max(100).optional(),
  minPriceCents: z.coerce.number().int().nonnegative().optional(),
  maxPriceCents: z.coerce.number().int().nonnegative().optional(),
  sellerId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

marketplaceRoutes.get("/listings", zValidator("query", listQuery), async (c) => {
  const q = c.req.valid("query");
  const scan = ListingEntity.scan.where((attr, op) => {
    const parts: string[] = [op.eq(attr.status, "active")];
    if (q.subject) parts.push(op.contains(attr.subjects, q.subject));
    if (q.sellerId) parts.push(op.eq(attr.sellerId, q.sellerId));
    if (q.minPriceCents !== undefined) parts.push(op.gte(attr.priceCents, q.minPriceCents));
    if (q.maxPriceCents !== undefined) parts.push(op.lte(attr.priceCents, q.maxPriceCents));
    return parts.join(" AND ");
  });
  const result = await scan.go({ limit: q.limit });
  return c.json({ items: result.data });
});

marketplaceRoutes.get(
  "/listings/:listingId",
  zValidator("param", z.object({ listingId: z.string().min(1) })),
  async (c) => {
    const { listingId } = c.req.valid("param");
    const result = await ListingEntity.get({ listingId }).go();
    if (!result.data) return c.json({ error: "not_found" }, 404);
    if (result.data.status !== "active") return c.json({ error: "not_available" }, 404);
    return c.json(result.data);
  },
);

// All routes below require auth.
marketplaceRoutes.use("/listings/mine", requireAuth);
marketplaceRoutes.use("/listings/:listingId/upload-url", requireAuth);
marketplaceRoutes.use("/listings/:listingId/download-url", requireAuth);
marketplaceRoutes.use("/orders/*", requireAuth);

marketplaceRoutes.get("/listings/mine", async (c) => {
  const { sub } = c.get("auth");
  const result = await ListingEntity.query
    .bySeller({ sellerId: sub })
    .go({ limit: 50, order: "desc" });
  return c.json({ items: result.data });
});

const createListingSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(4000).optional(),
  subjects: z.array(z.string().trim().min(1).max(100)).max(10).default([]),
  priceCents: z.number().int().min(50),
  currency: z.string().length(3).default("EUR"),
  // Optional commercial-org attribution. When present, caller must be
  // owner/admin of a commercial org; the listing displays the org as seller
  // while payouts still route to the caller's Stripe account.
  sellerOrgId: z.string().trim().min(1).optional(),
});

marketplaceRoutes.post("/listings", requireAuth, zValidator("json", createListingSchema), async (c) => {
  const { sub } = c.get("auth");
  const body = c.req.valid("json");
  const user = await UserEntity.get({ userId: sub }).go();
  if (!user.data) return c.json({ error: "user_not_found" }, 404);
  if (user.data.role !== "teacher") return c.json({ error: "only_teachers_can_sell" }, 403);

  if (body.sellerOrgId) {
    const [org, membership] = await Promise.all([
      OrganizationEntity.get({ orgId: body.sellerOrgId }).go(),
      OrganizationMembershipEntity.get({
        orgId: body.sellerOrgId,
        userId: sub,
      }).go(),
    ]);
    if (!org.data) return c.json({ error: "org_not_found" }, 404);
    if (org.data.kind !== "commercial") {
      return c.json({ error: "not_a_commercial_org" }, 400);
    }
    if (!membership.data) return c.json({ error: "not_an_org_member" }, 403);
    if (membership.data.role !== "owner" && membership.data.role !== "admin") {
      return c.json({ error: "not_org_admin" }, 403);
    }
  }

  const listingId = makeListingId();
  const listing = await ListingEntity.create({
    listingId,
    sellerId: sub,
    ...body,
    status: "draft",
  }).go();
  return c.json(listing.data, 201);
});

// Org-scoped listing feed. Public read, matching the existing /listings and
// /listings/:listingId endpoints — all rows returned are filtered to
// status === "active", so there is no private data to gate on.
marketplaceRoutes.get(
  "/orgs/:orgId/listings",
  zValidator("param", z.object({ orgId: z.string().min(1) })),
  async (c) => {
    const { orgId } = c.req.valid("param");
    const result = await ListingEntity.scan
      .where((attr, op) => `${op.eq(attr.sellerOrgId, orgId)} AND ${op.eq(attr.status, "active")}`)
      .go({ limit: 100 });
    return c.json({ items: result.data });
  },
);

const patchListingSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().max(4000).optional(),
  subjects: z.array(z.string().trim().min(1).max(100)).max(10).optional(),
  priceCents: z.number().int().min(50).optional(),
  status: z.enum(LISTING_STATUSES).optional(),
});

// Note: `sellerOrgId` is intentionally not patchable in MVP — a teacher
// cannot re-attribute an existing listing to a different org after creation.
marketplaceRoutes.patch(
  "/listings/:listingId",
  requireAuth,
  zValidator("param", z.object({ listingId: z.string().min(1) })),
  zValidator("json", patchListingSchema),
  async (c) => {
    const { sub } = c.get("auth");
    const { listingId } = c.req.valid("param");
    const body = c.req.valid("json");
    const listing = await ListingEntity.get({ listingId }).go();
    if (!listing.data) return c.json({ error: "not_found" }, 404);
    if (listing.data.sellerId !== sub) return c.json({ error: "forbidden" }, 403);
    if (Object.keys(body).length === 0) return c.json({ error: "no_fields" }, 400);
    // If activating, require a fileS3Key.
    if (body.status === "active" && !listing.data.fileS3Key) {
      return c.json({ error: "file_not_uploaded" }, 409);
    }
    await ListingEntity.patch({ listingId }).set(body).go();
    return c.json({ ok: true });
  },
);

marketplaceRoutes.delete(
  "/listings/:listingId",
  requireAuth,
  zValidator("param", z.object({ listingId: z.string().min(1) })),
  async (c) => {
    const { sub } = c.get("auth");
    const { listingId } = c.req.valid("param");
    const listing = await ListingEntity.get({ listingId }).go();
    if (!listing.data) return c.json({ error: "not_found" }, 404);
    if (listing.data.sellerId !== sub) return c.json({ error: "forbidden" }, 403);
    await ListingEntity.patch({ listingId }).set({ status: "archived" }).go();
    return c.json({ ok: true });
  },
);

const uploadUrlSchema = z.object({
  mimeType: z.string().min(1).max(200),
  sizeBytes: z.number().int().min(1).max(100 * 1024 * 1024),
});

marketplaceRoutes.post(
  "/listings/:listingId/upload-url",
  zValidator("param", z.object({ listingId: z.string().min(1) })),
  zValidator("json", uploadUrlSchema),
  async (c) => {
    const { sub } = c.get("auth");
    const { listingId } = c.req.valid("param");
    const { mimeType, sizeBytes } = c.req.valid("json");

    const listing = await ListingEntity.get({ listingId }).go();
    if (!listing.data) return c.json({ error: "not_found" }, 404);
    if (listing.data.sellerId !== sub) return c.json({ error: "forbidden" }, 403);

    const key = `marketplace/${listingId}/file`;
    const cmd = new PutObjectCommand({
      Bucket: env.uploadsBucket,
      Key: key,
      ContentType: mimeType,
      ContentLength: sizeBytes,
    });
    const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 900 });

    await ListingEntity.patch({ listingId })
      .set({ fileS3Key: key, fileMimeType: mimeType, fileSizeBytes: sizeBytes })
      .go();

    return c.json({ uploadUrl, key });
  },
);

marketplaceRoutes.get(
  "/listings/:listingId/download-url",
  zValidator("param", z.object({ listingId: z.string().min(1) })),
  async (c) => {
    const { sub } = c.get("auth");
    const { listingId } = c.req.valid("param");

    const listing = await ListingEntity.get({ listingId }).go();
    if (!listing.data) return c.json({ error: "not_found" }, 404);
    if (!listing.data.fileS3Key) return c.json({ error: "no_file" }, 404);

    // Seller can always download their own file; buyer needs a paid order.
    let buyerOrder: { orderId: string; firstDownloadedAt?: string } | null = null;
    if (listing.data.sellerId !== sub) {
      const orders = await OrderEntity.query
        .byBuyer({ buyerId: sub })
        .where(({ listingId: lid, status }, { eq }) =>
          `${eq(lid, listingId)} AND ${eq(status, "paid")}`,
        )
        .go({ limit: 1 });
      if (!orders.data[0]) return c.json({ error: "not_purchased" }, 403);
      buyerOrder = orders.data[0];
    }

    const cmd = new GetObjectCommand({
      Bucket: env.uploadsBucket,
      Key: listing.data.fileS3Key,
    });
    const downloadUrl = await getSignedUrl(s3, cmd, { expiresIn: 900 });

    // Stamp the first-download timestamp so the refund window can detect
    // consumed files. Non-fatal — a failed stamp must not block the download.
    if (buyerOrder && !buyerOrder.firstDownloadedAt) {
      try {
        await OrderEntity.patch({ orderId: buyerOrder.orderId })
          .set({ firstDownloadedAt: new Date().toISOString() })
          .go();
      } catch (err) {
        console.error("download: first-download stamp failed (non-fatal)", err);
      }
    }

    return c.json({ downloadUrl });
  },
);

// Orders
const createOrderSchema = z.object({ listingId: z.string().min(1) });

marketplaceRoutes.post("/orders", requireAuth, zValidator("json", createOrderSchema), async (c) => {
  const { sub, email } = c.get("auth");
  const { listingId } = c.req.valid("json");

  const listing = await ListingEntity.get({ listingId }).go();
  if (!listing.data) return c.json({ error: "listing_not_found" }, 404);
  if (listing.data.status !== "active") return c.json({ error: "not_available" }, 409);
  if (listing.data.sellerId === sub) return c.json({ error: "cannot_buy_own" }, 400);

  // Prevent duplicate paid orders for the same buyer+listing.
  const prior = await OrderEntity.query
    .byBuyer({ buyerId: sub })
    .where(({ listingId: lid, status }, { eq }) =>
      `${eq(lid, listingId)} AND ${eq(status, "paid")}`,
    )
    .go({ limit: 1 });
  if (prior.data[0]) {
    return c.json({ error: "already_purchased", orderId: prior.data[0].orderId }, 409);
  }

  const orderId = makeOrderId();
  const intent = await stripe().paymentIntents.create({
    amount: listing.data.priceCents,
    currency: (listing.data.currency ?? "EUR").toLowerCase(),
    automatic_payment_methods: { enabled: true },
    metadata: {
      kind: "marketplace_order",
      orderId,
      listingId,
      buyerId: sub,
      sellerId: listing.data.sellerId,
    },
    receipt_email: email,
    description: `EduBoost marketplace: ${listing.data.title}`,
  });

  const order = await OrderEntity.create({
    orderId,
    listingId,
    buyerId: sub,
    sellerId: listing.data.sellerId,
    priceCents: listing.data.priceCents,
    platformFeeCents: computePlatformFeeCents(listing.data.priceCents),
    currency: listing.data.currency,
    status: "pending",
    stripePaymentIntentId: intent.id,
  }).go();

  return c.json({ order: order.data, clientSecret: intent.client_secret }, 201);
});

marketplaceRoutes.get("/orders/mine", async (c) => {
  const { sub } = c.get("auth");
  const result = await OrderEntity.query
    .byBuyer({ buyerId: sub })
    .go({ limit: 50, order: "desc" });
  return c.json({ items: result.data });
});

marketplaceRoutes.get("/orders/as-seller", async (c) => {
  const { sub } = c.get("auth");
  const result = await OrderEntity.query
    .bySeller({ sellerId: sub })
    .go({ limit: 50, order: "desc" });
  return c.json({ items: result.data });
});

marketplaceRoutes.get(
  "/orders/:orderId",
  zValidator("param", z.object({ orderId: z.string().min(1) })),
  async (c) => {
    const { sub } = c.get("auth");
    const { orderId } = c.req.valid("param");
    const order = await OrderEntity.get({ orderId }).go();
    if (!order.data) return c.json({ error: "not_found" }, 404);
    if (order.data.buyerId !== sub && order.data.sellerId !== sub) {
      return c.json({ error: "forbidden" }, 403);
    }
    return c.json(order.data);
  },
);

// Money-back guarantee for marketplace orders. Auto-refunds when:
//   - the order was paid within the last hour, AND
//   - the buyer has not yet fetched a presigned download URL (firstDownloadedAt
//     is unset — the file hasn't been consumed yet).
// Otherwise a dispute ticket is opened so the seller + admin can review.
const ORDER_AUTO_REFUND_WINDOW_HOURS = 1;

marketplaceRoutes.post(
  "/orders/:orderId/refund-request",
  zValidator("param", z.object({ orderId: z.string().min(1) })),
  zValidator("json", z.object({ reason: z.string().trim().min(10).max(1000) })),
  async (c) => {
    const { sub } = c.get("auth");
    const { orderId } = c.req.valid("param");
    const { reason } = c.req.valid("json");

    const order = await OrderEntity.get({ orderId }).go();
    if (!order.data) return c.json({ error: "not_found" }, 404);
    if (order.data.buyerId !== sub) return c.json({ error: "not_your_order" }, 403);
    if (order.data.status !== "paid") return c.json({ error: "not_paid" }, 409);

    const createdMs = order.data.createdAt ? new Date(order.data.createdAt).getTime() : 0;
    const withinWindow =
      Date.now() - createdMs < ORDER_AUTO_REFUND_WINDOW_HOURS * 3600 * 1000;
    const notDownloaded = !order.data.firstDownloadedAt;

    if (withinWindow && notDownloaded) {
      // Marketplace payments stored PaymentEntity.bookingId = orderId (prefix
      // "ord_") when the webhook recorded them. Find by that shared id.
      const payments = await PaymentEntity.query
        .byBooking({ bookingId: orderId })
        .go({ limit: 5 });
      const succeeded = payments.data.find((p) => p.status === "succeeded");
      if (succeeded?.providerPaymentId) {
        try {
          await stripe().refunds.create({
            payment_intent: succeeded.providerPaymentId,
          });
          await PaymentEntity.patch({ paymentId: succeeded.paymentId })
            .set({ status: "refunded" })
            .go();
        } catch (err) {
          console.error("order.refund: stripe refund failed", err);
          return c.json({ error: "refund_failed", message: (err as Error).message }, 502);
        }
      }
      await OrderEntity.patch({ orderId }).set({ status: "refunded" }).go();
      return c.json({ outcome: "auto_refunded" });
    }

    // Outside window or already downloaded — route to dispute system.
    const payments = await PaymentEntity.query
      .byBooking({ bookingId: orderId })
      .go({ limit: 5 });
    const relatedPaymentId = payments.data.find((p) => p.status === "succeeded")?.paymentId;
    const ticketId = makeTicketId();
    const slaDeadline = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    await SupportTicketEntity.create({
      ticketId,
      userId: sub,
      subject: `Refund request for order ${orderId}`,
      category: "payment_dispute",
      priority: "normal",
      bookingId: orderId,
      relatedPaymentId,
      slaDeadline,
      status: "open",
    }).go();
    const escalationReason = !notDownloaded
      ? "buyer already downloaded the file"
      : `order is older than ${ORDER_AUTO_REFUND_WINDOW_HOURS}h`;
    await TicketMessageEntity.create({
      ticketId,
      messageId: makeTicketMessageId(),
      authorId: sub,
      authorRole: "user",
      body: `Auto-escalated from order refund request (${escalationReason}). Buyer reason:\n\n${reason}`,
      attachments: [],
    }).go();
    return c.json({ outcome: "dispute_created", ticketId });
  },
);
