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
import { stripe, computePlatformFeeCents, MIN_PRICE_CENTS } from "../lib/stripe.js";
import { env } from "../env.js";
import { notify } from "../lib/notifications.js";

export const marketplaceRoutes = new Hono();

const s3 = new S3Client({ region: env.region });

const listQuery = z.object({
  subject: z.string().trim().min(1).max(100).optional(),
  minPriceCents: z.coerce.number().int().nonnegative().optional(),
  maxPriceCents: z.coerce.number().int().nonnegative().optional(),
  sellerId: z.string().min(1).optional(),
  // Scan-based browse with post-filter: DDB's Limit caps items EXAMINED per
  // page (not returned). Other entities share the table, so a low limit can
  // return fewer matches than you'd expect. 200 is enough for MVP volume;
  // proper cursor-based pagination is the next upgrade.
  limit: z.coerce.number().int().min(1).max(200).default(200),
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

// /listings/mine must be registered before /listings/:listingId so "mine"
// isn't swallowed by the param route.
marketplaceRoutes.use("/listings/mine", requireAuth);
marketplaceRoutes.get("/listings/mine", async (c) => {
  const { sub } = c.get("auth");
  const result = await ListingEntity.query
    .bySeller({ sellerId: sub })
    .go({ limit: 50, order: "desc" });
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
marketplaceRoutes.use("/listings/:listingId/upload-url", requireAuth);
marketplaceRoutes.use("/listings/:listingId/download-url", requireAuth);
marketplaceRoutes.use("/orders/*", requireAuth);

const createListingSchema = z.object({
  kind: z.enum(["digital", "physical"]).default("digital"),
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(4000).optional(),
  subjects: z.array(z.string().trim().min(1).max(100)).max(10).default([]),
  priceCents: z.number().int().min(MIN_PRICE_CENTS, {
    message: `priceCents below platform minimum of ${MIN_PRICE_CENTS}`,
  }),
  currency: z.string().length(3).default("TND"),
  // Physical-only fields. inStockCount defaults to 1 for a just-created
  // physical listing so sellers don't accidentally publish with 0 stock.
  // shippingCostCents defaults to 0 (free shipping) rather than forcing
  // sellers to think about logistics before their first listing goes live.
  inStockCount: z.number().int().min(0).max(100_000).optional(),
  shippingCostCents: z.number().int().min(0).max(1_000_00).optional(),
  shipsFrom: z.string().trim().length(2).optional(),
  weightGrams: z.number().int().min(1).max(100_000).optional(),
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
    // Physical listings default to 1 in stock + free shipping if unspecified.
    // Digital listings ignore both fields entirely.
    inStockCount:
      body.kind === "physical" ? (body.inStockCount ?? 1) : undefined,
    shippingCostCents:
      body.kind === "physical" ? (body.shippingCostCents ?? 0) : undefined,
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
  priceCents: z
    .number()
    .int()
    .min(MIN_PRICE_CENTS, { message: `priceCents below platform minimum of ${MIN_PRICE_CENTS}` })
    .optional(),
  // Sellers can restock or adjust shipping/freight cost on an active physical
  // listing. Both remain optional so digital listings are unaffected.
  inStockCount: z.number().int().min(0).max(100_000).optional(),
  shippingCostCents: z.number().int().min(0).max(1_000_00).optional(),
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
    // Activation gate differs by kind. Digital listings must have a file
    // uploaded; physical listings must have non-zero stock.
    if (body.status === "active") {
      if (listing.data.kind === "physical") {
        const nextStock = body.inStockCount ?? listing.data.inStockCount ?? 0;
        if (nextStock < 1) return c.json({ error: "out_of_stock" }, 409);
      } else if (!listing.data.fileS3Key) {
        return c.json({ error: "file_not_uploaded" }, 409);
      }
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

    const orders = await OrderEntity.query
      .bySeller({ sellerId: sub })
      .where(({ listingId: lid, status }, { eq }) =>
        `${eq(lid, listingId)} AND (${eq(status, "paid")} OR ${eq(status, "pending")})`,
      )
      .go({ limit: 200 });

    let ordersRefunded = 0;
    for (const order of orders.data) {
      if (order.status === "paid") {
        const payments = await PaymentEntity.query
          .byBooking({ bookingId: order.orderId })
          .go({ limit: 5 });
        const succeeded = payments.data.find((p) => p.status === "succeeded");
        if (succeeded?.providerPaymentId) {
          try {
            await stripe().refunds.create({ payment_intent: succeeded.providerPaymentId });
            await PaymentEntity.patch({ paymentId: succeeded.paymentId })
              .set({ status: "refunded" })
              .go();
          } catch (err) {
            console.error(`listing.delete: refund failed order=${order.orderId}`, err);
          }
        }
        if (listing.data.kind === "physical") {
          try {
            const currentListing = await ListingEntity.get({ listingId }).go();
            if (currentListing.data) {
              await ListingEntity.patch({ listingId })
                .set({ inStockCount: (currentListing.data.inStockCount ?? 0) + 1 })
                .go();
            }
          } catch { /* non-fatal */ }
        }
      }
      await OrderEntity.patch({ orderId: order.orderId })
        .set({ status: "refunded" })
        .go();
      try {
        await notify({
          userId: order.buyerId,
          type: "booking_refunded",
          title: "Order refunded",
          body: `"${listing.data.title}" has been removed by the seller. Your payment has been refunded.`,
          linkPath: `/orders`,
        });
      } catch { /* non-fatal */ }
      ordersRefunded++;
    }

    await ListingEntity.patch({ listingId }).set({ status: "archived" }).go();
    return c.json({ ok: true, ordersRefunded });
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
    // Physical listings have no file to download — reject early with a
    // semantic error so the buyer UI can swap to tracking info instead.
    if (listing.data.kind === "physical") {
      return c.json({ error: "physical_no_download" }, 400);
    }
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
const shippingAddressSchema = z.object({
  name: z.string().trim().min(1).max(120),
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().max(100).optional(),
  postalCode: z.string().trim().min(1).max(20),
  country: z.string().trim().length(2).toUpperCase(),
  phone: z.string().trim().max(30).optional(),
});

const createOrderSchema = z.object({
  listingId: z.string().min(1),
  // Physical orders must supply a shipping address. Digital orders can
  // simply omit it. We re-validate the presence of the address below once
  // the listing kind is known.
  shippingAddress: shippingAddressSchema.optional(),
});

marketplaceRoutes.post("/orders", requireAuth, zValidator("json", createOrderSchema), async (c) => {
  const { sub, email } = c.get("auth");
  const { listingId, shippingAddress } = c.req.valid("json");

  const listing = await ListingEntity.get({ listingId }).go();
  if (!listing.data) return c.json({ error: "listing_not_found" }, 404);
  if (listing.data.status !== "active") return c.json({ error: "not_available" }, 409);
  if (listing.data.sellerId === sub) return c.json({ error: "cannot_buy_own" }, 400);

  const isPhysical = listing.data.kind === "physical";
  if (isPhysical) {
    if (!shippingAddress) return c.json({ error: "shipping_address_required" }, 400);
    if ((listing.data.inStockCount ?? 0) < 1) {
      return c.json({ error: "out_of_stock" }, 409);
    }
  }

  // Digital listings allow one paid order per buyer (lets them re-download).
  // Physical listings DON'T dedup: the same buyer could want multiple copies
  // of a printed tutorial, one per friend. Stock decrement + separate orderId
  // keep the trail clean.
  if (!isPhysical) {
    const prior = await OrderEntity.query
      .byBuyer({ buyerId: sub })
      .where(({ listingId: lid, status }, { eq }) =>
        `${eq(lid, listingId)} AND ${eq(status, "paid")}`,
      )
      .go({ limit: 1 });
    if (prior.data[0]) {
      return c.json({ error: "already_purchased", orderId: prior.data[0].orderId }, 409);
    }
  }

  const shippingCostCents = isPhysical ? (listing.data.shippingCostCents ?? 0) : 0;
  const totalCents = listing.data.priceCents + shippingCostCents;

  const orderId = makeOrderId();
  // Stripe init happens lazily inside stripe(); if STRIPE_SECRET_KEY isn't
  // wired (dev environments before the secret is set, or a misconfigured
  // deploy) we want to return a structured 503 instead of leaking a stack
  // trace. Same handling on PaymentIntent creation in case Stripe rejects
  // the request (bad price ID, account-suspended, etc.).
  let intent: Awaited<ReturnType<ReturnType<typeof stripe>["paymentIntents"]["create"]>>;
  try {
    intent = await stripe().paymentIntents.create({
      amount: totalCents,
      currency: (listing.data.currency ?? "TND").toLowerCase(),
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
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    console.error("marketplace order: Stripe call failed", msg);
    if (msg.includes("STRIPE_SECRET_KEY not set")) {
      return c.json(
        { error: "payments_not_configured", detail: "Stripe is not wired in this environment." },
        503,
      );
    }
    return c.json({ error: "payment_intent_failed", detail: msg }, 502);
  }

  const order = await OrderEntity.create({
    orderId,
    listingId,
    buyerId: sub,
    sellerId: listing.data.sellerId,
    priceCents: totalCents,
    platformFeeCents: computePlatformFeeCents(totalCents),
    currency: listing.data.currency,
    status: "pending",
    stripePaymentIntentId: intent.id,
    kind: isPhysical ? "physical" : "digital",
    shippingCostCents: isPhysical ? shippingCostCents : undefined,
    shippingStatus: isPhysical ? "awaiting_ship" : undefined,
    shippingAddress: isPhysical ? shippingAddress : undefined,
  }).go();

  // Decrement stock optimistically. If payment later fails, the webhook
  // restores it on payment_intent.payment_failed.
  if (isPhysical) {
    await ListingEntity.patch({ listingId })
      .set({ inStockCount: (listing.data.inStockCount ?? 1) - 1 })
      .go();
  }

  return c.json({ order: order.data, clientSecret: intent.client_secret }, 201);
});

// Seller marks a physical order shipped with tracking. Flips shippingStatus
// from awaiting_ship to shipped. Digital orders don't touch this endpoint.
const shipSchema = z.object({
  shippingCarrier: z.string().trim().min(1).max(60),
  trackingNumber: z.string().trim().min(1).max(120),
});

marketplaceRoutes.post(
  "/orders/:orderId/ship",
  zValidator("param", z.object({ orderId: z.string().min(1) })),
  zValidator("json", shipSchema),
  async (c) => {
    const { sub } = c.get("auth");
    const { orderId } = c.req.valid("param");
    const body = c.req.valid("json");
    const order = await OrderEntity.get({ orderId }).go();
    if (!order.data) return c.json({ error: "not_found" }, 404);
    if (order.data.sellerId !== sub) return c.json({ error: "forbidden" }, 403);
    if (order.data.kind !== "physical") {
      return c.json({ error: "not_a_physical_order" }, 400);
    }
    if (order.data.status !== "paid") return c.json({ error: "not_paid" }, 409);
    if (order.data.shippingStatus === "shipped" || order.data.shippingStatus === "delivered") {
      return c.json({ error: "already_shipped" }, 409);
    }
    await OrderEntity.patch({ orderId })
      .set({
        shippingStatus: "shipped",
        shippingCarrier: body.shippingCarrier,
        trackingNumber: body.trackingNumber,
        shippedAt: new Date().toISOString(),
      })
      .go();
    return c.json({ ok: true });
  },
);

// Buyer confirms delivery. Optional signal — some buyers never bother. The
// shipping carrier is authoritative; this endpoint just flips the UI state
// so the buyer's orders page stops showing a "In transit" label.
marketplaceRoutes.post(
  "/orders/:orderId/mark-delivered",
  zValidator("param", z.object({ orderId: z.string().min(1) })),
  async (c) => {
    const { sub } = c.get("auth");
    const { orderId } = c.req.valid("param");
    const order = await OrderEntity.get({ orderId }).go();
    if (!order.data) return c.json({ error: "not_found" }, 404);
    if (order.data.buyerId !== sub) return c.json({ error: "forbidden" }, 403);
    if (order.data.kind !== "physical") {
      return c.json({ error: "not_a_physical_order" }, 400);
    }
    if (order.data.shippingStatus !== "shipped") {
      return c.json({ error: "not_yet_shipped" }, 409);
    }
    await OrderEntity.patch({ orderId })
      .set({
        shippingStatus: "delivered",
        deliveredAt: new Date().toISOString(),
      })
      .go();
    return c.json({ ok: true });
  },
);

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
    // Physical orders flip the "consumed" signal: once the seller marks it
    // shipped, auto-refund is off the table and the buyer must go through
    // dispute (the seller has already incurred shipping cost). Not-yet-shipped
    // physical orders remain auto-refundable like digital ones.
    const isPhysical = order.data.kind === "physical";
    const physicalAutoOk =
      isPhysical &&
      (!order.data.shippingStatus ||
        order.data.shippingStatus === "awaiting_ship");

    if (withinWindow && (isPhysical ? physicalAutoOk : notDownloaded)) {
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
      await OrderEntity.patch({ orderId })
        .set({
          status: "refunded",
          ...(isPhysical ? { shippingStatus: "cancelled" as const } : {}),
        })
        .go();
      // Physical auto-refund before shipment — restore stock so the listing
      // can sell the unit again.
      if (isPhysical) {
        try {
          const listing = await ListingEntity.get({ listingId: order.data.listingId }).go();
          if (listing.data) {
            await ListingEntity.patch({ listingId: order.data.listingId })
              .set({ inStockCount: (listing.data.inStockCount ?? 0) + 1 })
              .go();
          }
        } catch (err) {
          console.error("order.refund: stock restore failed (non-fatal)", err);
        }
      }
      return c.json({ outcome: "auto_refunded" });
    }

    // Outside window or already shipped/downloaded — route to dispute system.
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
    const escalationReason = isPhysical
      ? order.data.shippingStatus === "shipped" ||
        order.data.shippingStatus === "delivered"
        ? `order already ${order.data.shippingStatus}`
        : `physical order older than ${ORDER_AUTO_REFUND_WINDOW_HOURS}h`
      : !notDownloaded
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
