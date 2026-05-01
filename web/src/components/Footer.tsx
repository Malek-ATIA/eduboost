import Link from "next/link";
import { Mail, Phone, MessageCircle } from "lucide-react";

const COLS = [
  {
    title: "Platform",
    links: [
      { href: "/teachers", label: "Find a teacher" },
      { href: "/marketplace", label: "Marketplace" },
      { href: "/events", label: "Events" },
      { href: "/forum", label: "Forum" },
    ],
  },
  {
    title: "Learn more",
    links: [
      { href: "/faq", label: "FAQ" },
      { href: "/support/new", label: "Contact support" },
      { href: "/support", label: "Support & disputes" },
      { href: "/signup", label: "Create an account" },
      { href: "/login", label: "Log in" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms & conditions" },
      { href: "/privacy", label: "Privacy policy" },
      { href: "/code-of-conduct", label: "Code of conduct" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-24 border-t border-ink-faded/25 bg-white/50">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-seal/40 bg-seal/10 text-base font-bold text-seal"
              >
                E
              </span>
              <span className="text-lg font-bold tracking-tight text-ink">
                EduBoost
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              Verified Tunisian tutors, online and in-person. Book, learn, and pay on a single platform.
            </p>
            <div className="mt-4 space-y-2 text-xs text-ink-faded">
              <a href="mailto:support@eduboost.tn" className="flex items-center gap-2 hover:text-seal">
                <Mail size={14} />
                support@eduboost.tn
              </a>
              <a href="https://wa.me/21655555555" className="flex items-center gap-2 hover:text-seal">
                <MessageCircle size={14} />
                WhatsApp +216 55 555 555
              </a>
              <a href="tel:+21670555555" className="flex items-center gap-2 hover:text-seal">
                <Phone size={14} />
                +216 70 555 555
              </a>
            </div>
          </div>
          {COLS.map((col) => (
            <div key={col.title}>
              <div className="label">{col.title}</div>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href as never}
                      className="text-sm text-ink-soft hover:text-seal"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-ink-faded/20 pt-6 text-xs text-ink-faded sm:flex-row sm:items-center">
          <p>&copy; {new Date().getFullYear()} EduBoost. Made in Tunisia.</p>
          <p className="italic">&ldquo;Learned teachers, diligent students.&rdquo;</p>
        </div>
      </div>
    </footer>
  );
}
