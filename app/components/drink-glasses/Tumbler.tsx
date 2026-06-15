import { shade } from "@/lib/drink-art/color";

export function Tumbler({ uid, liquid }: { uid: string; liquid: string }) {
  const liqId = `tum-liq-${uid}`;
  return (
    <g>
      <defs>
        <linearGradient id={liqId} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor={shade(liquid, -22)} />
          <stop offset="55%" stopColor={liquid} />
          <stop offset="100%" stopColor={shade(liquid, 18)} />
        </linearGradient>
      </defs>
      {/* Body */}
      <path
        d="M 75 130 L 78 205 Q 80 215 92 215 L 108 215 Q 120 215 122 205 L 125 130 Z"
        fill={`url(#${liqId})`}
      />
      <ellipse cx="100" cy="130" rx="25" ry="4" fill={shade(liquid, -30)} />
      <ellipse cx="100" cy="129" rx="25" ry="3" fill={liquid} />
      {/* highlight */}
      <rect x="80" y="138" width="4" height="65" rx="2" fill="rgba(255,255,255,0.25)" />
    </g>
  );
}
