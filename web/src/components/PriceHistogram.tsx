"use client";

import { useMemo } from "react";

type Props = {
  prices: number[];
  min: number;
  max: number;
  range: [number, number];
  buckets?: number;
};

export function PriceHistogram({
  prices,
  min,
  max,
  range,
  buckets = 20,
}: Props) {
  const bars = useMemo(() => {
    const step = (max - min) / buckets;
    const counts = new Array(buckets).fill(0) as number[];
    for (const p of prices) {
      const idx = Math.min(Math.floor((p - min) / step), buckets - 1);
      if (idx >= 0) counts[idx]++;
    }
    const peak = Math.max(...counts, 1);
    return counts.map((c, i) => {
      const bucketStart = min + i * step;
      const bucketEnd = bucketStart + step;
      const inRange = bucketEnd > range[0] && bucketStart < range[1];
      return { height: (c / peak) * 100, inRange, count: c };
    });
  }, [prices, min, max, range, buckets]);

  if (prices.length === 0) return null;

  return (
    <div className="flex h-16 items-end gap-px" aria-hidden>
      {bars.map((bar, i) => (
        <div
          key={i}
          className={`flex-1 rounded-t-sm transition-colors ${
            bar.inRange ? "bg-ink/60" : "bg-ink-faded/20"
          }`}
          style={{ height: `${Math.max(bar.height, 2)}%` }}
          title={`${bar.count}`}
        />
      ))}
    </div>
  );
}
