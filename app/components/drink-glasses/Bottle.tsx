import { shade } from "@/lib/drink-art/color";

export function Bottle({ liquid }: { liquid: string }) {
  const liquidDark = shade(liquid, -25);
  return (
    <g>
      {/* Cap */}
      <rect x="86" y="28" width="28" height="22" rx="2" fill="#444A55" />
      <rect x="86" y="42" width="28" height="2" fill="#2A2F38" />
      {/* Neck */}
      <rect x="88" y="50" width="24" height="18" fill="#D9E4DE" opacity="0.6" />
      {/* Shoulder + body */}
      <path
        d="M 88 68 Q 70 80 64 105 L 64 200 Q 64 215 80 215 L 120 215 Q 136 215 136 200 L 136 105 Q 130 80 112 68 Z"
        fill={liquid}
      />
      {/* highlight */}
      <path
        d="M 72 110 Q 70 150 73 200"
        stroke="rgba(255,255,255,0.32)"
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
      />
      {/* Label */}
      <rect x="74" y="130" width="52" height="50" rx="4" fill="#FFFFFF" opacity="0.9" />
      <rect x="80" y="138" width="40" height="3" rx="1.5" fill={liquidDark} opacity="0.4" />
      <rect x="80" y="146" width="32" height="2.5" rx="1.5" fill={liquidDark} opacity="0.3" />
      <rect x="80" y="160" width="40" height="8" rx="2" fill={liquidDark} />
    </g>
  );
}
