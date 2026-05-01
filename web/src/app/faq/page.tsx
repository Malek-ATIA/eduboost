import Link from "next/link";
import { FAQ_GENERAL, FAQ_STUDENTS, FAQ_TEACHERS, FAQ_REFUNDS } from "@/lib/faq-data";
import type { FAQ } from "@/lib/faq-data";

const CONTACT = [
  { label: "Email", value: "support@eduboost.tn", href: "mailto:support@eduboost.tn" },
  { label: "WhatsApp", value: "+216 55 555 555", href: "https://wa.me/21655555555" },
  { label: "Phone", value: "+216 70 555 555", href: "tel:+21670555555" },
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
        {FAQ_GENERAL.map((f) => (
          <Item key={f.q} {...f} />
        ))}
      </Section>

      <Section title="For students and parents">
        {FAQ_STUDENTS.map((f) => (
          <Item key={f.q} {...f} />
        ))}
      </Section>

      <Section title="For teachers">
        {FAQ_TEACHERS.map((f) => (
          <Item key={f.q} {...f} />
        ))}
      </Section>

      <Section title="Refunds & money-back guarantee">
        {FAQ_REFUNDS.map((f) => (
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
          Office hours: Mon–Fri, 09:00–17:00 Tunis time (GMT+1). Response time within 2 business days.
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
