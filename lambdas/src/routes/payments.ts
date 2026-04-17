import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  PaymentEntity,
  BookingEntity,
  UserEntity,
} from "@eduboost/db";
import { requireAuth } from "../middleware/auth.js";
import { renderInvoicePdf } from "../lib/invoice.js";

export const paymentRoutes = new Hono();

paymentRoutes.use("*", requireAuth);

paymentRoutes.get("/mine", async (c) => {
  const { sub } = c.get("auth");
  const result = await PaymentEntity.query
    .byPayer({ payerId: sub })
    .go({ limit: 50, order: "desc" });
  return c.json({ items: result.data });
});

paymentRoutes.get("/received", async (c) => {
  const { sub } = c.get("auth");
  const result = await PaymentEntity.query
    .byPayee({ payeeId: sub })
    .go({ limit: 50, order: "desc" });
  return c.json({ items: result.data });
});

paymentRoutes.get(
  "/:paymentId",
  zValidator("param", z.object({ paymentId: z.string().min(1) })),
  async (c) => {
    const { sub } = c.get("auth");
    const { paymentId } = c.req.valid("param");
    const result = await PaymentEntity.get({ paymentId }).go();
    if (!result.data) return c.json({ error: "not_found" }, 404);
    if (result.data.payerId !== sub && result.data.payeeId !== sub) {
      return c.json({ error: "forbidden" }, 403);
    }
    return c.json(result.data);
  },
);

paymentRoutes.get(
  "/:paymentId/invoice",
  zValidator("param", z.object({ paymentId: z.string().min(1) })),
  async (c) => {
    const { sub } = c.get("auth");
    const { paymentId } = c.req.valid("param");

    const payment = await PaymentEntity.get({ paymentId }).go();
    if (!payment.data) return c.json({ error: "not_found" }, 404);
    if (payment.data.payerId !== sub && payment.data.payeeId !== sub) {
      return c.json({ error: "forbidden" }, 403);
    }
    if (payment.data.status !== "succeeded") {
      return c.json({ error: "payment_not_succeeded" }, 409);
    }

    // Marketplace orders reuse PaymentEntity.bookingId to store the orderId
    // (IDs prefixed "ord_"). Invoice generation for marketplace payments is
    // out of scope for v0 — buyers receive their purchase via the signed
    // download URL from the listing instead. Short-circuit here so we don't
    // mis-fetch a non-existent BookingEntity and return a confusing 404.
    if (payment.data.bookingId.startsWith("ord_")) {
      return c.json(
        {
          error: "marketplace_invoice_not_supported",
          hint: "Download the purchased file from /orders; marketplace invoices are not available in v0.",
        },
        409,
      );
    }

    const [booking, payer, payee] = await Promise.all([
      BookingEntity.get({ bookingId: payment.data.bookingId }).go(),
      UserEntity.get({ userId: payment.data.payerId }).go(),
      UserEntity.get({ userId: payment.data.payeeId }).go(),
    ]);
    if (!booking.data || !payer.data || !payee.data) {
      return c.json({ error: "related_records_missing" }, 404);
    }

    const pdf = await renderInvoicePdf({
      paymentId: payment.data.paymentId,
      createdAt: payment.data.createdAt,
      bookingId: payment.data.bookingId,
      bookingType: booking.data.type,
      currency: payment.data.currency,
      amountCents: payment.data.amountCents,
      platformFeeCents: payment.data.platformFeeCents,
      payer: { displayName: payer.data.displayName, email: payer.data.email },
      payee: { displayName: payee.data.displayName, email: payee.data.email },
    });

    c.header("Content-Type", "application/pdf");
    c.header(
      "Content-Disposition",
      `attachment; filename="eduboost-invoice-${paymentId}.pdf"`,
    );
    c.header("Cache-Control", "private, max-age=300");
    return c.body(pdf);
  },
);
