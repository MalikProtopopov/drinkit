/** Inline SVG flags — replace inconsistent emoji renderings. */
type Props = { code: "ru" | "gb" | "ae"; size?: number };

export function Flag({ code, size = 20 }: Props) {
  const w = size;
  const h = Math.round(size * 0.7);
  return (
    <svg width={w} height={h} viewBox="0 0 24 18" className="rounded-sm flex-shrink-0">
      {code === "ru" && (
        <>
          <rect width="24" height="6" fill="#FFFFFF" />
          <rect y="6" width="24" height="6" fill="#0033A0" />
          <rect y="12" width="24" height="6" fill="#DA291C" />
        </>
      )}
      {code === "gb" && (
        <>
          <rect width="24" height="18" fill="#012169" />
          {/* white diagonals */}
          <path d="M0 0 L24 18 M24 0 L0 18" stroke="#FFFFFF" strokeWidth="3" />
          {/* red diagonals */}
          <path d="M0 0 L24 18" stroke="#C8102E" strokeWidth="1.5" />
          <path d="M24 0 L0 18" stroke="#C8102E" strokeWidth="1.5" />
          {/* white cross */}
          <rect x="10" width="4" height="18" fill="#FFFFFF" />
          <rect y="7" width="24" height="4" fill="#FFFFFF" />
          {/* red cross */}
          <rect x="11" width="2" height="18" fill="#C8102E" />
          <rect y="8" width="24" height="2" fill="#C8102E" />
        </>
      )}
      {code === "ae" && (
        <>
          <rect width="24" height="18" fill="#FFFFFF" />
          <rect width="24" height="6" fill="#00732F" />
          <rect y="12" width="24" height="6" fill="#0E0E10" />
          <rect width="8" height="18" fill="#D60022" />
        </>
      )}
    </svg>
  );
}
