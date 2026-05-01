import { Hono } from "hono";
import { PaymentEntity, UserEntity } from "@eduboost/db";
import { requireAuth } from "../middleware/auth.js";

export const reportRoutes = new Hono();

reportRoutes.use("*", requireAuth);

type Totals = { gross: number; fee: number; net: number; count: number };
type Breakdown = { booking: Totals; marketplace: Totals };

function zero(): Totals {
  return { gross: 0, fee: 0, net: 0, count: 0 };
}

function addTo(t: Totals, gross: number, fee: number) {
  t.gross += gross;
  t.fee += fee;
  t.net += gross - fee;
  t.count += 1;
}

function isMarketplace(bookingId: string): boolean {
  return bookingId.startsWith("ord_");
}

reportRoutes.get("/teacher/summary", async (c) => {
  const { sub } = c.get("auth");
  const user = await UserEntity.get({ userId: sub }).go();
  if (!user.data || user.data.role !== "teacher") {
    return c.json({ error: "only_teachers" }, 403);
  }

  const all = await PaymentEntity.query
    .byPayee({ payeeId: sub })
    .go({ limit: 1000, order: "desc" });

  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const startOfPrevMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString();
  const endOfPrevMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1)).toISOString();

  const buckets = {
    allTime: { booking: zero(), marketplace: zero() } as Breakdown,
    ytd: { booking: zero(), marketplace: zero() } as Breakdown,
    thisMonth: { booking: zero(), marketplace: zero() } as Breakdown,
    prevMonth: { booking: zero(), marketplace: zero() } as Breakdown,
  };

  let currency = "TND";

  for (const p of all.data) {
    if (p.status !== "succeeded") continue;
    if (p.currency) currency = p.currency;
    const createdAt = p.createdAt ?? "";
    const fee = p.platformFeeCents ?? 0;
    const bucket = isMarketplace(p.bookingId) ? "marketplace" : "booking";
    const target: (keyof typeof buckets)[] = ["allTime"];
    if (createdAt >= startOfYear) target.push("ytd");
    if (createdAt >= startOfMonth) target.push("thisMonth");
    if (createdAt >= startOfPrevMonth && createdAt < endOfPrevMonth) target.push("prevMonth");
    for (const t of target) addTo(buckets[t][bucket], p.amountCents, fee);
  }

  return c.json({
    currency,
    buckets,
    paymentCount: all.data.length,
    generatedAt: now.toISOString(),
  });
});

reportRoutes.get("/teacher/export.csv", async (c) => {
  const { sub } = c.get("auth");
  const user = await UserEntity.get({ userId: sub }).go();
  if (!user.data || user.data.role !== "teacher") {
    return c.json({ error: "only_teachers" }, 403);
  }

  const all = await PaymentEntity.query
    .byPayee({ payeeId: sub })
    .go({ limit: 1000, order: "desc" });

  const rows: string[] = [
    "paymentId,bookingOrOrderId,kind,createdAt,currency,grossCents,platformFeeCents,netCents,status,providerPaymentId",
  ];
  for (const p of all.data) {
    const kind = isMarketplace(p.bookingId) ? "marketplace" : "booking";
    const fee = p.platformFeeCents ?? 0;
    const net = p.amountCents - fee;
    rows.push(
      [
        csv(p.paymentId),
        csv(p.bookingId),
        csv(kind),
        csv(p.createdAt ?? ""),
        csv(p.currency ?? "TND"),
        String(p.amountCents),
        String(fee),
        String(net),
        csv(p.status ?? ""),
        csv(p.providerPaymentId ?? ""),
      ].join(","),
    );
  }

  const body = rows.join("\n");
  c.header("Content-Type", "text/csv; charset=utf-8");
  c.header(
    "Content-Disposition",
    `attachment; filename="eduboost-earnings-${new Date().toISOString().slice(0, 10)}.csv"`,
  );
  return c.body(body);
});

function csv(v: string): string {
  if (/[",\n\r]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}
