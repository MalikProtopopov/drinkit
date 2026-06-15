export function Sandwich() {
  return (
    <g>
      {/* Top bread */}
      <path
        d="M 35 100 Q 35 80 100 75 Q 165 80 165 100 L 165 115 L 35 115 Z"
        fill="#E5C18A"
      />
      <path d="M 35 100 Q 100 90 165 100" stroke="#C9A370" strokeWidth="1.5" fill="none" />
      {/* Lettuce */}
      <path
        d="M 30 115 Q 50 130 80 120 Q 110 130 140 120 Q 165 130 170 122 L 170 130 L 30 130 Z"
        fill="#7FB970"
      />
      {/* Cheese */}
      <rect x="30" y="130" width="140" height="14" fill="#F5D060" />
      {/* Meat */}
      <path
        d="M 30 144 L 170 144 L 170 158 Q 100 165 30 158 Z"
        fill="#C8615A"
      />
      {/* Bottom bread */}
      <path
        d="M 35 158 L 165 158 L 165 178 Q 165 195 100 198 Q 35 195 35 178 Z"
        fill="#D9B373"
      />
    </g>
  );
}
