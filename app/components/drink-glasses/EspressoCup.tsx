import { shade } from "@/lib/drink-art/color";

export function EspressoCup({ liquid, foam }: { liquid: string; foam?: string }) {
  const liquidDark = shade(liquid, -25);
  return (
    <g>
      {/* Saucer */}
      <ellipse cx="100" cy="205" rx="65" ry="9" fill="#F4EAE0" />
      <ellipse cx="100" cy="201" rx="60" ry="7" fill="#FFFFFF" />
      <ellipse cx="100" cy="201" rx="48" ry="4" fill="#EFE3D5" />

      {/* Handle */}
      <path
        d="M 148 135 Q 175 138 175 158 Q 175 178 148 180"
        stroke="#FFFFFF"
        strokeWidth="9"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M 148 142 Q 168 145 168 158 Q 168 172 148 174"
        stroke="#F0E2CD"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />

      {/* Cup body */}
      <path
        d="M 55 125 L 60 195 Q 62 202 70 202 L 130 202 Q 138 202 140 195 L 145 125 Z"
        fill="#FFFFFF"
      />
      {/* Cup right shadow */}
      <path
        d="M 130 130 L 138 195 Q 137 200 132 200 L 124 200 Z"
        fill="#F0E4D2"
      />

      {/* Coffee liquid (top view) */}
      <ellipse cx="100" cy="125" rx="45" ry="8" fill={liquidDark} />
      <ellipse cx="100" cy="123" rx="44" ry="7" fill={liquid} />

      {/* Foam ring on top */}
      {foam && (
        <>
          <ellipse cx="100" cy="121" rx="38" ry="6" fill={foam} />
          <ellipse cx="100" cy="121" rx="28" ry="4" fill={shade(foam, 15)} />
        </>
      )}
    </g>
  );
}
