import Link from "next/link";

type FAQ = { q: string; a: string };

const GENERAL: FAQ[] = [
  {
    q: "What is EduBoost?",
    a: "EduBoost is a trusted platform that connects students and parents with qualified tutors for 1-on-1 and group sessions, delivered online with built-in video classrooms, recordings, and chat.",
  },
  {
    q: "How do payments work?",
    a: "All payments go through EduBoost upfront. When you book, your card is charged; the teacher is paid after the session is completed. A 15% platform fee covers payment processing, the classroom infrastructure, and platform operations.",
  },
  {
    q: "Can I try a session before committing?",
    a: "Many teachers offer a free or discounted trial session. Look for the \"Trial\" badge on the teacher browse page.",
  },
  {
    q: "What if a session doesn't meet my expectations?",
    a: "File a dispute via Support & disputes on your dashboard. Link the booking to the ticket and describe the issue. Our team will review within 2 business days.",
  },
];

const FOR_STUDENTS: FAQ[] = [
  {
    q: "Do I need to install anything for the classroom?",
    a: "No. The classroom runs in your browser. Make sure you allow camera and microphone access when prompted.",
  },
  {
    q: "Will my sessions be recorded?",
    a: "Recordings are optional and started by the teacher. When recording is on, you'll see a red \"Stop recording\" indicator. Recordings are stored securely and retained per our Terms.",
  },
  {
    q: "Can I message my teacher between sessions?",
    a: "Yes. Use Direct messages from the teacher's profile or the classroom chat for class-wide messages.",
  },
];

const FOR_TEACHERS: FAQ[] = [
  {
    q: "How do I get paid?",
    a: "After a session is completed, funds are released to your payout account. Go to Edit your profile to set your hourly rate.",
  },
  {
    q: "Can I teach groups?",
    a: "Yes. Enable \"Offer group sessions\" in your profile. Students will then be able to book group formats with you.",
  },
  {
    q: "What happens if a student is abusive?",
    a: "File an abuse report via Support & disputes. Our team can warn, suspend, or ban repeat offenders.",
  },
];

const REFUND_POLICY: FAQ[] = [
  {
    q: "Can I cancel a booking and get a refund?",
    a: "Yes. Cancel from My bookings. If the session is more than 24 hours away (or no session has been scheduled yet), the refund is issued automatically to your original payment method. Closer than 24h we open a support ticket so a human can review the circumstances.",
  },
  {
    q: "What about marketplace purchases?",
    a: "You can request a refund from My orders. Refunds are automatic if you ask within 1 hour of purchase AND haven't downloaded the file yet. After either of those, we open a support ticket and an admin will work with the seller on a case-by-case basis.",
  },
  {
    q: "How long do refunds take to land in my bank?",
    a: "Stripe typically returns funds to the original card within 5–10 business days. You can track the refund status on the linked payment in Payment history.",
  },
];

const CONTACT = [
  { label: "Email", value: "support@eduboost.com", href: "mailto:support@eduboost.com" },
  { label: "WhatsApp", value: "+353 1 000 0000", href: "https://wa.me/35310000000" },
  { label: "Phone", value: "+353 1 000 0000", href: "tel:+35310000000" },
];

export const metadata = {
  title: "FAQ & Contact — EduBoost",
  description: "Frequently asked questions and contact channels for EduBoost users.",
};

export default function FaqPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-16">
      <p className="eyebrow">Help</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">FAQ & Contact</h1>
      <p className="mt-2 text-ink-soft">
        Quick answers, and how to reach us if you need more help.
      </p>

      <Section title="General">
        {GENERAL.map((f) => (
          <Item key={f.q} {...f} />
        ))}
      </Section>

      <Section title="For students and parents">
        {FOR_STUDENTS.map((f) => (
          <Item key={f.q} {...f} />
        ))}
      </Section>

      <Section title="For teachers">
        {FOR_TEACHERS.map((f) => (
          <Item key={f.q} {...f} />
        ))}
      </Section>

      <Section title="Refunds & money-back guarantee">
        {REFUND_POLICY.map((f) => (
          <Item key={f.q} {...f} />
        ))}
      </Section>

      <section className="mt-12">
        <h2 className="font-display text-xl text-ink">Still need help?</h2>
        <p className="mt-2 text-sm text-ink-soft">
          For payment, booking, or account issues the fastest route is{" "}
          <Link href="/support/new" className="underline">
            opening a support ticket
          </Link>{" "}
          — it reaches our team directly and we can link it to your booking. For general questions you can
          also reach us at:
        </p>
        <dl className="card mt-4 divide-y divide-ink-faded/30">
          {CONTACT.map((c) => (
            <div key={c.label} className="flex items-center justify-between p-3 text-sm">
              <dt className="font-medium text-ink">{c.label}</dt>
              <dd>
                <a href={c.href} className="underline">
                  {c.value}
                </a>
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-ink-faded">
          Office hours: Mon–Fri, 09:00–17:00 Ireland time. Response time within 2 business days.
        </p>
      </section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-xl text-ink">{title}</h2>
      <div className="card mt-4 divide-y divide-ink-faded/30">{children}</div>
    </section>
  );
}

function Item({ q, a }: FAQ) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer items-center justify-between gap-2 p-4 text-sm font-medium text-ink">
        <span>{q}</span>
        <span className="text-ink-faded transition group-open:rotate-45">+</span>
      </summary>
      <p className="px-4 pb-4 text-sm leading-relaxed text-ink-soft">{a}</p>
    </details>
  );
}
