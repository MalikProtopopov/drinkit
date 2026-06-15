import { shade } from "@/lib/drink-art/color";

export function Mug({ liquid, foam }: { liquid: string; foam?: string }) {
  const liquidDark = shade(liquid, -25);
  return (
    <g>
      {/* Handle */}
      <path
        d="M 153 115 Q 180 118 180 145 Q 180 175 153 178"
        stroke={shade(liquid, -45)}
        strokeWidth="11"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M 153 122 Q 172 125 172 145 Q 172 168 153 171"
        stroke={liquid}
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />

      {/* Body */}
      <path
        d="M 52 110 L 56 200 Q 58 212 72 212 L 128 212 Q 142 212 144 200 L 148 110 Z"
        fill={liquid}
      />
      {/* Subtle shadow on right */}
      <path
        d="M 132 115 L 144 198 Q 143 207 136 207 L 124 207 Z"
        fill={shade(liquid, -22)}
      />

      {/* Top rim */}
      <ellipse cx="100" cy="110" rx="48" ry="7" fill={shade(liquid, -35)} />
      <ellipse cx="100" cy="109" rx="48" ry="5" fill={liquidDark} />

      {/* Foam dome */}
      {foam && (
        <>
          <ellipse cx="100" cy="103" rx="46" ry="11" fill={foam} />
          <ellipse cx="100" cy="100" rx="40" ry="7" fill={shade(foam, 22)} />
          <ellipse cx="90" cy="98" rx="20" ry="3" fill="rgba(255,255,255,0.5)" />
        </>
      )}
    </g>
  );
}
