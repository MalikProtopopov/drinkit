"use client";
import { forwardRef } from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: "plus" | "minus" | "close" | "check";
  size?: number;
  variant?: "neutral" | "primary";
};

/**
 * Round button with a perfectly centered SVG glyph.
 * Text-based "+" / "−" sit below the line-box midline in most fonts;
 * SVG icons avoid the baseline shift entirely.
 */
export const StepperButton = forwardRef<HTMLButtonElement, Props>(function StepperButton(
  { icon, size = 32, variant = "neutral", className = "", style, ...rest },
  ref
) {
  const stroke = variant === "primary" ? "#fff" : "currentColor";
  const bg =
    variant === "primary"
      ? { background: "var(--color-primary-500)", color: "#fff" }
      : { background: "#F2F2F4", color: "#0E0E10" };

  return (
    <button
      ref={ref}
      type="button"
      className={`rounded-full inline-flex items-center justify-center active:scale-95 transition ${className}`}
      style={{ width: size, height: size, ...bg, ...style }}
      {...rest}
    >
      <Glyph icon={icon} stroke={stroke} size={Math.round(size * 0.42)} />
    </button>
  );
});

function Glyph({
  icon,
  stroke,
  size,
}: {
  icon: Props["icon"];
  stroke: string;
  size: number;
}) {
  const sw = 2.6;
  if (icon === "plus") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
    );
  }
  if (icon === "minus") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round">
        <path d="M5 12h14" />
      </svg>
    );
  }
  if (icon === "close") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    );
  }
  // check
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}
