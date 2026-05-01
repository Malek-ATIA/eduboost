import { Entity } from "electrodb";
import { ddbDoc, TABLE_NAME } from "../client.js";
import { SERVICE } from "../table-schema.js";

export const LISTING_KINDS = ["digital", "physical"] as const;
export type ListingKind = (typeof LISTING_KINDS)[number];

export const SHIPPING_STATUSES = [
  "awaiting_ship",
  "shipped",
  "delivered",
  "cancelled",
] as const;
export type ShippingStatus = (typeof SHIPPING_STATUSES)[number];

export const LISTING_STATUSES = ["draft", "active", "archived"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const ListingEntity = new Entity(
  {
    model: { entity: "listing", version: "1", service: SERVICE },
    attributes: {
      listingId: { type: "string", required: true },
      sellerId: { type: "string", required: true },
      // Optional attribution to a commercial organization. When set, the org is
      // the "brand" seller even though payouts still flow to the sellerId's
      // Stripe account; UI surfaces display the org name next to the listing.
      sellerOrgId: { type: "string" },
      kind: { type: LISTING_KINDS, default: "digital" },
      title: { type: "string", required: true },
      description: { type: "string" },
      subjects: { type: "list", items: { type: "string" }, default: [] },
      priceCents: { type: "number", required: true },
      currency: { type: "string", default: "TND" },
      fileS3Key: { type: "string" },
      fileMimeType: { type: "string" },
      fileSizeBytes: { type: "number" },
      // Physical-goods fields — only populated when kind === "physical".
      // inStockCount is decremented on successful order; sellers must top it
      // up manually. shippingCostCents is added to the buyer's total at
      // order time. shipsFrom is informational (ISO country code).
      inStockCount: { type: "number" },
      shippingCostCents: { type: "number" },
      shipsFrom: { type: "string" },
      weightGrams: { type: "number" },
      status: { type: LISTING_STATUSES, default: "draft" },
      createdAt: { type: "string", default: () => new Date().toISOString(), readOnly: true },
      updatedAt: { type: "string", watch: "*", set: () => new Date().toISOString() },
    },
    indexes: {
      primary: {
        pk: { field: "pk", composite: ["listingId"] },
        sk: { field: "sk", composite: [] },
      },
      bySeller: {
        index: "gsi1",
        pk: { field: "gsi1pk", composite: ["sellerId"] },
        sk: { field: "gsi1sk", composite: ["createdAt"] },
      },
      byStatus: {
        index: "gsi2",
        pk: { field: "gsi2pk", composite: ["status"] },
        sk: { field: "gsi2sk", composite: ["createdAt"] },
      },
    },
  },
  { client: ddbDoc, table: TABLE_NAME },
);

export const ORDER_STATUSES = ["pending", "paid", "refunded", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const OrderEntity = new Entity(
  {
    model: { entity: "order", version: "1", service: SERVICE },
    attributes: {
      orderId: { type: "string", required: true },
      listingId: { type: "string", required: true },
      buyerId: { type: "string", required: true },
      sellerId: { type: "string", required: true },
      priceCents: { type: "number", required: true },
      platformFeeCents: { type: "number", default: 0 },
      currency: { type: "string", default: "TND" },
      status: { type: ORDER_STATUSES, default: "pending" },
      stripePaymentIntentId: { type: "string" },
      // Set the first time the buyer's client fetches a presigned download URL.
      // Used to gate the 1-hour auto-refund window so an admin can tell whether
      // the buyer actually consumed the file before asking for a refund.
      firstDownloadedAt: { type: "string" },
      // Physical-order fields — only populated when the underlying listing
      // was `kind: "physical"`. shippingCostCents is rolled into priceCents at
      // order time but preserved separately for reporting. shippingAddress
      // captures the snapshot at checkout so a later address change on the
      // user profile doesn't retroactively alter historical shipments.
      kind: { type: ["digital", "physical"] as const },
      shippingCostCents: { type: "number" },
      shippingStatus: { type: SHIPPING_STATUSES },
      shippingAddress: {
        type: "map",
        properties: {
          name: { type: "string", required: true },
          line1: { type: "string", required: true },
          line2: { type: "string" },
          city: { type: "string", required: true },
          state: { type: "string" },
          postalCode: { type: "string", required: true },
          country: { type: "string", required: true },
          phone: { type: "string" },
        },
      },
      shippingCarrier: { type: "string" },
      trackingNumber: { type: "string" },
      shippedAt: { type: "string" },
      deliveredAt: { type: "string" },
      createdAt: { type: "string", default: () => new Date().toISOString(), readOnly: true },
      updatedAt: { type: "string", watch: "*", set: () => new Date().toISOString() },
    },
    indexes: {
      primary: {
        pk: { field: "pk", composite: ["orderId"] },
        sk: { field: "sk", composite: [] },
      },
      byListing: {
        index: "gsi1",
        pk: { field: "gsi1pk", composite: ["listingId"] },
        sk: { field: "gsi1sk", composite: ["createdAt"] },
      },
      byBuyer: {
        index: "gsi2",
        pk: { field: "gsi2pk", composite: ["buyerId"] },
        sk: { field: "gsi2sk", composite: ["createdAt"] },
      },
      bySeller: {
        index: "gsi3",
        pk: { field: "gsi3pk", composite: ["sellerId"] },
        sk: { field: "gsi3sk", composite: ["createdAt"] },
      },
    },
  },
  { client: ddbDoc, table: TABLE_NAME },
);

export function makeListingId(): string {
  return `lst_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function makeOrderId(): string {
  return `ord_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
