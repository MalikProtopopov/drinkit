import type { GlassType, GarnishType } from "@/components/DrinkArt";

export function Garnish({
  type,
  glass,
}: {
  type: GarnishType;
  glass: GlassType;
}) {
  // Position garnish based on glass type
  const onRim = ["tall", "smoothie", "mug", "tumbler"].includes(glass);
  const cx = 100;
  const cy = glass === "mug" ? 100 : glass === "tumbler" ? 130 : 55;

  if (type === "orange-slice") {
    return (
      <g transform={`translate(${cx + 18}, ${cy - 4}) rotate(15)`}>
        <circle cx="0" cy="0" r="15" fill="#FF9742" />
        <circle cx="0" cy="0" r="12" fill="#FFC373" />
        <g stroke="#FF9742" strokeWidth="1.5">
          <line x1="-12" y1="0" x2="12" y2="0" />
          <line x1="0" y1="-12" x2="0" y2="12" />
          <line x1="-9" y1="-9" x2="9" y2="9" />
          <line x1="-9" y1="9" x2="9" y2="-9" />
        </g>
        <circle cx="0" cy="0" r="2" fill="#FF9742" />
      </g>
    );
  }
  if (type === "lemon-slice") {
    return (
      <g transform={`translate(${cx + 16}, ${cy - 2}) rotate(20)`}>
        <circle cx="0" cy="0" r="14" fill="#F0CE3A" />
        <circle cx="0" cy="0" r="11" fill="#F8E48A" />
        <g stroke="#F0CE3A" strokeWidth="1.4">
          <line x1="-11" y1="0" x2="11" y2="0" />
          <line x1="0" y1="-11" x2="0" y2="11" />
          <line x1="-8" y1="-8" x2="8" y2="8" />
          <line x1="-8" y1="8" x2="8" y2="-8" />
        </g>
        <circle cx="0" cy="0" r="2" fill="#F0CE3A" />
      </g>
    );
  }
  if (type === "mint") {
    return (
      <g transform={`translate(${cx + 4}, ${onRim ? cy - 12 : 30})`}>
        <path d="M 0 0 Q -10 -14 -2 -22 Q 8 -14 0 0 Z" fill="#3A8C4B" />
        <path d="M 0 0 Q -10 -14 -2 -22" stroke="#256B30" strokeWidth="1" fill="none" />
        <path d="M 5 -3 Q 18 -8 18 -20 Q 5 -16 5 -3 Z" fill="#4DA463" />
        <path d="M 5 -3 Q 18 -8 18 -20" stroke="#2D7B3C" strokeWidth="1" fill="none" />
      </g>
    );
  }
  if (type === "leaf") {
    return (
      <g transform={`translate(${cx + 8}, ${onRim ? cy - 6 : 38}) rotate(-20)`}>
        <path d="M 0 0 Q -8 -12 0 -22 Q 8 -12 0 0 Z" fill="#5DA86B" />
        <line x1="0" y1="0" x2="0" y2="-22" stroke="#2F6E3C" strokeWidth="1.4" />
      </g>
    );
  }
  if (type === "pineapple-leaf") {
    return (
      <g transform={`translate(${cx - 6}, ${cy - 4})`}>
        <path d="M -10 0 Q -12 -22 -2 -28" stroke="#3A8C4B" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M 0 0 Q 0 -28 6 -34" stroke="#4DA463" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M 10 0 Q 14 -22 22 -28" stroke="#3A8C4B" strokeWidth="3" fill="none" strokeLinecap="round" />
      </g>
    );
  }
  if (type === "berry") {
    return (
      <g transform={`translate(${cx + 14}, ${onRim ? cy - 10 : 38})`}>
        <circle cx="0" cy="0" r="6" fill="#C13453" />
        <circle cx="-2" cy="-2" r="2" fill="rgba(255,255,255,0.4)" />
        <circle cx="9" cy="3" r="5" fill="#8E2541" />
        <path d="M 0 -6 L -2 -10 M 0 -6 L 2 -10" stroke="#2F6E3C" strokeWidth="1.4" strokeLinecap="round" />
      </g>
    );
  }
  if (type === "cocoa") {
    return (
      <g transform={`translate(${cx - 28}, ${cy - 8})`}>
        <circle cx="0" cy="0" r="1.4" fill="#5B3E2A" />
        <circle cx="6" cy="3" r="1.2" fill="#5B3E2A" />
        <circle cx="14" cy="-2" r="1.6" fill="#5B3E2A" />
        <circle cx="22" cy="5" r="1.2" fill="#5B3E2A" />
        <circle cx="30" cy="0" r="1.6" fill="#5B3E2A" />
        <circle cx="42" cy="3" r="1.3" fill="#5B3E2A" />
        <circle cx="50" cy="-2" r="1.5" fill="#5B3E2A" />
      </g>
    );
  }
  if (type === "cinnamon") {
    return (
      <g transform={`translate(${cx + 12}, ${cy - 8}) rotate(-12)`}>
        <rect x="-3" y="-22" width="6" height="34" rx="2" fill="#8B5A2B" />
        <rect x="-3" y="-22" width="2" height="34" fill="#6B3E16" />
        <path d="M -3 -22 Q 0 -25 3 -22" stroke="#6B3E16" strokeWidth="1" fill="none" />
      </g>
    );
  }
  if (type === "flower") {
    return (
      <g transform={`translate(${cx - 10}, ${cy - 8})`}>
        <circle cx="0" cy="-4" r="4" fill="#B679C8" />
        <circle cx="6" cy="0" r="4" fill="#A664BA" />
        <circle cx="-6" cy="0" r="4" fill="#A664BA" />
        <circle cx="3" cy="-8" r="3.5" fill="#C58CD2" />
        <circle cx="-3" cy="-8" r="3.5" fill="#C58CD2" />
        <circle cx="0" cy="-3" r="2" fill="#FFE15E" />
      </g>
    );
  }
  if (type === "whipped") {
    return (
      <g>
        <ellipse cx={cx} cy={cy - 6} rx="38" ry="14" fill="#FFFFFF" />
        <ellipse cx={cx - 6} cy={cy - 14} rx="14" ry="10" fill="#FFFFFF" />
        <ellipse cx={cx + 8} cy={cy - 16} rx="10" ry="8" fill="#FFFFFF" />
        <ellipse cx={cx + 12} cy={cy - 22} rx="6" ry="5" fill="#FFFFFF" />
        <circle cx={cx + 12} cy={cy - 28} r="3" fill="#C13453" />
      </g>
    );
  }
  if (type === "nuts") {
    return (
      <g transform={`translate(${cx - 24}, ${cy - 6})`}>
        <ellipse cx="0" cy="0" rx="4" ry="3" fill="#A87142" transform="rotate(15)" />
        <ellipse cx="12" cy="3" rx="4" ry="3" fill="#B98453" transform="rotate(-20)" />
        <ellipse cx="22" cy="-2" rx="4" ry="3" fill="#955F2E" transform="rotate(35)" />
        <ellipse cx="36" cy="2" rx="4" ry="3" fill="#A87142" transform="rotate(-10)" />
        <ellipse cx="48" cy="-1" rx="4" ry="3" fill="#B98453" transform="rotate(20)" />
      </g>
    );
  }
  return null;
}
