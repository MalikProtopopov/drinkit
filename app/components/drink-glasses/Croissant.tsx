export function Croissant({ uid }: { uid: string }) {
  const grId = `croi-${uid}`;
  return (
    <g>
      <defs>
        <linearGradient id={grId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#E8B567" />
          <stop offset="60%" stopColor="#C48B3B" />
          <stop offset="100%" stopColor="#8E5C20" />
        </linearGradient>
      </defs>
      {/* Crescent body */}
      <path
        d="M 40 130 Q 30 100 70 90 Q 100 86 130 90 Q 170 100 160 130 Q 155 160 130 165 Q 100 168 70 165 Q 45 160 40 130 Z"
        fill={`url(#${grId})`}
      />
      {/* Ridges */}
      <path d="M 70 100 Q 75 130 75 158" stroke="#8E5C20" strokeWidth="2" fill="none" opacity="0.55" />
      <path d="M 90 95 Q 95 130 92 162" stroke="#8E5C20" strokeWidth="2" fill="none" opacity="0.55" />
      <path d="M 110 95 Q 108 130 108 162" stroke="#8E5C20" strokeWidth="2" fill="none" opacity="0.55" />
      <path d="M 130 100 Q 128 130 128 160" stroke="#8E5C20" strokeWidth="2" fill="none" opacity="0.55" />
      {/* Highlights */}
      <path d="M 60 110 Q 80 100 100 100" stroke="#F2C681" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.7" />
    </g>
  );
}
