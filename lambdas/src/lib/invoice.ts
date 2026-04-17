import PDFDocument from "pdfkit";

export type InvoiceInput = {
  paymentId: string;
  createdAt: string;
  bookingId: string;
  bookingType: string;
  currency: string;
  amountCents: number;
  platformFeeCents: number;
  payer: { displayName: string; email: string };
  payee: { displayName: string; email: string };
};

export async function renderInvoicePdf(data: InvoiceInput): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const amount = (data.amountCents / 100).toFixed(2);
  const fee = (data.platformFeeCents / 100).toFixed(2);
  const net = ((data.amountCents - data.platformFeeCents) / 100).toFixed(2);
  const dateStr = new Date(data.createdAt).toLocaleDateString("en-IE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  doc.fontSize(24).text("EduBoost", { continued: false });
  doc.fontSize(10).fillColor("#666").text("Tutoring platform", { align: "left" });
  doc.moveDown(1.5);

  doc.fillColor("#000").fontSize(20).text("Invoice", { align: "right" });
  doc.fontSize(10).fillColor("#666").text(`#${data.paymentId}`, { align: "right" });
  doc.text(dateStr, { align: "right" });
  doc.moveDown(2);

  doc.fillColor("#000").fontSize(11);
  const tableTop = doc.y;
  doc.font("Helvetica-Bold").text("Billed to", 50, tableTop);
  doc.font("Helvetica-Bold").text("Paid to", 300, tableTop);
  doc.font("Helvetica");
  doc.text(data.payer.displayName, 50, tableTop + 15);
  doc.text(data.payer.email, 50, tableTop + 30);
  doc.text(data.payee.displayName, 300, tableTop + 15);
  doc.text(data.payee.email, 300, tableTop + 30);
  doc.moveDown(4);

  const lineY = doc.y + 10;
  doc.moveTo(50, lineY).lineTo(545, lineY).strokeColor("#ddd").stroke();
  doc.moveDown(1);

  const itemY = doc.y;
  doc.font("Helvetica-Bold").text("Description", 50, itemY);
  doc.text("Amount", 450, itemY, { align: "right", width: 95 });
  doc.font("Helvetica");
  const descY = itemY + 20;
  doc.text(
    `${capitalize(data.bookingType)} session (booking ${data.bookingId})`,
    50,
    descY,
  );
  doc.text(`${data.currency} ${amount}`, 450, descY, { align: "right", width: 95 });
  doc.moveDown(2);

  const totalsX = 350;
  doc.text("Subtotal", totalsX, doc.y);
  doc.text(`${data.currency} ${amount}`, 450, doc.y - 12, { align: "right", width: 95 });
  doc.text(`Platform fee`, totalsX);
  doc.text(`-${data.currency} ${fee}`, 450, doc.y - 12, { align: "right", width: 95 });
  doc.moveDown(0.5);
  doc.font("Helvetica-Bold");
  doc.text("Teacher receives", totalsX);
  doc.text(`${data.currency} ${net}`, 450, doc.y - 12, { align: "right", width: 95 });
  doc.font("Helvetica");
  doc.moveDown(2);

  doc.fontSize(9).fillColor("#666");
  doc.text(
    "Payments are processed by Stripe on behalf of EduBoost. Questions: support@eduboost.com",
    50,
    780,
    { align: "center", width: 495 },
  );

  doc.end();
  return done;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
