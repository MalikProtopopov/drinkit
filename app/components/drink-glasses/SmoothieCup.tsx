import { shade } from "@/lib/drink-art/color";

export function SmoothieCup({
  uid,
  liquid,
  foam,
  straw,
}: {
  uid: string;
  liquid: string;
  foam?: string;
  straw?: boolean;
}) {
  const liquidDark = shade(liquid, -25);
  const liquidLight = shade(liquid, 20);
  const liqId = `sm-liq-${uid}`;
  return (
    <g>
      <defs>
        <linearGradient id={liqId} x1="0" x2="1">
          <stop offset="0%" stopColor={liquidDark} />
          <stop offset="55%" stopColor={liquid} />
          <stop offset="100%" stopColor={liquidLight} />
        </linearGradient>
      </defs>

      {/* Cup body (wider rounded) */}
      <path
        d="M 58 78 L 64 200 Q 66 215 82 215 L 118 215 Q 134 215 136 200 L 142 78 Z"
        fill={`url(#${liqId})`}
      />
      {/* Highlight strip */}
      <rect x="64" y="92" width="6" height="115" rx="3" fill="rgba(255,255,255,0.22)" />

      {/* Top rim */}
      <ellipse cx="100" cy="78" rx="42" ry="7" fill={liquidDark} />
      <ellipse cx="100" cy="77" rx="42" ry="5" fill={liquid} />

      {/* Dome lid */}
      <path
        d="M 58 78 Q 100 30 142 78 Z"
        fill="rgba(220,228,232,0.55)"
        stroke="rgba(120,130,140,0.25)"
        strokeWidth="1"
      />
      <ellipse cx="100" cy="50" rx="24" ry="6" fill="rgba(255,255,255,0.35)" />

      {/* Foam blob visible through lid */}
      {foam && <ellipse cx="100" cy="72" rx="36" ry="7" fill={foam} opacity="0.85" />}

      {/* Straw */}
      {straw !== false && (
        <g>
          <rect
            x="106"
            y="14"
            width="8"
            height="55"
            rx="3"
            fill="#1F1F26"
            transform="rotate(-10 110 42)"
          />
          <rect
            x="107"
            y="14"
            width="3"
            height="55"
            rx="1.5"
            fill="rgba(255,255,255,0.3)"
            transform="rotate(-10 110 42)"
          />
        </g>
      )}
    </g>
  );
}
