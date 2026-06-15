export function PaperCup({ liquid, foam }: { liquid: string; foam?: string }) {
  return (
    <g>
      {/* Cup body (trapezoid) */}
      <path
        d="M 60 70 L 70 210 Q 72 215 78 215 L 122 215 Q 128 215 130 210 L 140 70 Z"
        fill="#F1E7D8"
      />
      {/* shadow */}
      <path
        d="M 122 73 L 130 210 Q 129 213 124 213 L 116 213 Z"
        fill="#E5D6BF"
      />
      {/* sleeve */}
      <rect x="62" y="120" width="78" height="34" fill="#C29870" />
      <rect x="62" y="120" width="78" height="3" fill="#A87B52" />
      <rect x="62" y="151" width="78" height="3" fill="#A87B52" />
      <text
        x="100"
        y="143"
        textAnchor="middle"
        fill="#FFF"
        fontSize="10"
        fontWeight="700"
        fontFamily="ui-sans-serif"
      >
        juicy
      </text>

      {/* Lid */}
      <ellipse cx="100" cy="70" rx="42" ry="8" fill="#FFFFFF" />
      <path
        d="M 58 70 Q 58 55 100 55 Q 142 55 142 70"
        fill="#FFFFFF"
        stroke="#E8DCC8"
        strokeWidth="0.8"
      />
      {/* sip hole */}
      <ellipse cx="100" cy="58" rx="9" ry="3" fill={liquid} opacity="0.8" />

      {/* small liquid hint at sip */}
      {foam && <ellipse cx="100" cy="57" rx="6" ry="1.5" fill={foam} />}
    </g>
  );
}
