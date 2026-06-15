import { shade } from "@/lib/drink-art/color";

export function TallGlass({
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
  const liquidDark = shade(liquid, -30);
  const liquidLight = shade(liquid, 25);
  const liqId = `tg-liq-${uid}`;
  const clipId = `tg-clip-${uid}`;
  return (
    <g>
      <defs>
        <linearGradient id={liqId} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor={liquidDark} />
          <stop offset="55%" stopColor={liquid} />
          <stop offset="100%" stopColor={liquidLight} />
        </linearGradient>
        <clipPath id={clipId}>
          <path d="M 60 55 L 60 200 Q 60 215 76 215 L 124 215 Q 140 215 140 200 L 140 55 Z" />
        </clipPath>
      </defs>

      {/* Liquid body */}
      <path
        d="M 60 55 L 60 200 Q 60 215 76 215 L 124 215 Q 140 215 140 200 L 140 55 Z"
        fill={`url(#${liqId})`}
      />

      {/* Inner highlight strip (glass-like sheen) */}
      <rect
        x="65"
        y="68"
        width="6"
        height="135"
        rx="3"
        fill="rgba(255,255,255,0.18)"
        clipPath={`url(#${clipId})`}
      />

      {/* Top rim ellipse showing thickness of glass */}
      <ellipse cx="100" cy="55" rx="40" ry="6" fill={liquidDark} />
      <ellipse cx="100" cy="54" rx="40" ry="4" fill={shade(liquid, -10)} />

      {/* Foam */}
      {foam && (
        <>
          <ellipse cx="100" cy="50" rx="42" ry="10" fill={foam} />
          <ellipse cx="94" cy="47" rx="28" ry="5" fill={shade(foam, 18)} />
        </>
      )}

      {/* Straw */}
      {straw && (
        <g>
          <rect
            x="106"
            y="20"
            width="8"
            height="48"
            rx="3"
            fill="#E45F5F"
            transform="rotate(-8 110 44)"
          />
          <rect
            x="107"
            y="20"
            width="3"
            height="48"
            rx="1.5"
            fill="rgba(255,255,255,0.4)"
            transform="rotate(-8 110 44)"
          />
        </g>
      )}
    </g>
  );
}
