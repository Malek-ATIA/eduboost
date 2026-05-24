import React from "react";

export function PageHead({
  eyebrow,
  title,
  sub,
  right,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  sub?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6 border-b border-rule px-8 pb-6 pt-8">
      <div className="min-w-0 flex-1">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="mt-2 font-serif text-[clamp(28px,3vw,40px)] tracking-tight">{title}</h1>
        {sub && <p className="mt-2 max-w-[640px] text-[14.5px] text-ink-soft">{sub}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

export function Section({
  title,
  sub,
  action,
  children,
}: {
  title: React.ReactNode;
  sub?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="px-8 pt-7">
      <div className="flex items-end justify-between gap-2 pb-3.5">
        <div>
          <h2 className="font-serif text-[22px] tracking-tight">{title}</h2>
          {sub && <div className="mt-1 text-[12.5px] text-ink-faded">{sub}</div>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="card p-[18px]">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-faded">
        {label}
      </div>
      <div className="mt-1.5 font-serif text-[34px] leading-none tracking-tight">{value}</div>
      {sub && (
        <div className={`mt-1.5 text-[12.5px] ${accent ? "text-accent-deep" : "text-ink-soft"}`}>
          {sub}
        </div>
      )}
    </div>
  );
}
