"use client";

import { useCallback } from "react";

type Props = {
  min: number;
  max: number;
  step?: number;
  value: [number, number];
  onChange: (range: [number, number]) => void;
  label: string;
  formatValue?: (v: number) => string;
};

export function RangeSlider({
  min,
  max,
  step = 1,
  value,
  onChange,
  label,
  formatValue = String,
}: Props) {
  const [lo, hi] = value;

  const onLo = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = Number(e.target.value);
      onChange([Math.min(v, hi), hi]);
    },
    [hi, onChange],
  );

  const onHi = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = Number(e.target.value);
      onChange([lo, Math.max(v, lo)]);
    },
    [lo, onChange],
  );

  const loPercent = ((lo - min) / (max - min)) * 100;
  const hiPercent = ((hi - min) / (max - min)) * 100;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="label text-xs">{label}</span>
        <span className="text-xs text-ink-soft">
          {formatValue(lo)} – {formatValue(hi)}
        </span>
      </div>
      <div className="range-slider relative h-6">
        <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-ink-faded/20" />
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-seal/60"
          style={{ left: `${loPercent}%`, width: `${hiPercent - loPercent}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={lo}
          onChange={onLo}
          aria-label={`${label} minimum`}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={lo}
          className="range-thumb absolute top-0 h-6 w-full appearance-none bg-transparent"
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={hi}
          onChange={onHi}
          aria-label={`${label} maximum`}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={hi}
          className="range-thumb absolute top-0 h-6 w-full appearance-none bg-transparent"
        />
      </div>
    </div>
  );
}
