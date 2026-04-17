import { env } from "../env.js";

type SendArgs = {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
};

const DEFAULT_FROM = "EduBoost <noreply@eduboost.com>";

export async function sendEmail(args: SendArgs): Promise<{ id: string } | null> {
  if (!env.resendApiKey) {
    console.warn("resend: RESEND_API_KEY not set, skipping send", { to: args.to, subject: args.subject });
    return null;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.resendApiKey}`,
    },
    body: JSON.stringify({
      from: args.from ?? DEFAULT_FROM,
      to: args.to,
      subject: args.subject,
      html: args.html,
      reply_to: args.replyTo,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`resend ${res.status}: ${body}`);
  }
  return (await res.json()) as { id: string };
}

export const emailTemplates = {
  welcome: (displayName: string) => ({
    subject: "Welcome to EduBoost",
    html: `<p>Hi ${escape(displayName)},</p>
<p>Welcome to EduBoost — your account is ready. Pick a teacher, book a trial session, and start learning.</p>
<p><a href="https://eduboost.com/dashboard">Go to your dashboard</a></p>`,
  }),
  bookingConfirmed: (displayName: string, teacherName: string, startsAt: string) => ({
    subject: "Booking confirmed",
    html: `<p>Hi ${escape(displayName)},</p>
<p>Your session with <strong>${escape(teacherName)}</strong> on ${escape(startsAt)} is confirmed.</p>`,
  }),
};

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
