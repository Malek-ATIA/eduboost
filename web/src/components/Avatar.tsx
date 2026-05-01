"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Size = "sm" | "md" | "lg" | "xl";
const SIZE_PX: Record<Size, number> = { sm: 32, md: 48, lg: 96, xl: 128 };

type Props = {
  userId: string;
  size?: Size;
  // Fallback initial when the user has no avatar; if omitted the component
  // falls back to a generic "?" mark.
  initial?: string;
  className?: string;
};

export function Avatar({ userId, size = "md", initial, className = "" }: Props) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    api<{ url: string }>(`/users/${userId}/avatar-url`)
      .then((r) => {
        if (!cancelled) setUrl(r.url);
      })
      .catch(() => {
        // 404 "no_avatar" is the common case — render the initial fallback.
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const px = SIZE_PX[size];

  return (
    <div
      className={`relative overflow-hidden rounded-full border border-ink-faded/30 bg-parchment-dark ${className}`}
      style={{ width: px, height: px }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center font-display text-ink-faded"
          style={{ fontSize: Math.round(px * 0.45) }}
        >
          {initial ? initial.slice(0, 1).toUpperCase() : "?"}
        </div>
      )}
    </div>
  );
}
