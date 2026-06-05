"use client";

export function Counter({
  value,
  onChange,
  min = 0,
  max = 99,
  size = "md",
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  size?: "sm" | "md";
}) {
  const s = size === "sm" ? "h-8 w-8 text-base" : "h-10 w-10 text-lg";
  return (
    <div className="inline-flex items-center gap-3">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className={`${s} rounded-full bg-white shadow-sm border border-[var(--color-border)] flex items-center justify-center font-semibold disabled:opacity-40`}
        disabled={value <= min}
      >
        −
      </button>
      <span className={`min-w-[20px] text-center font-semibold ${size === "sm" ? "text-base" : "text-lg"}`}>
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        className={`${s} rounded-full bg-white shadow-sm border border-[var(--color-border)] flex items-center justify-center font-semibold disabled:opacity-40`}
        disabled={value >= max}
      >
        +
      </button>
    </div>
  );
}
