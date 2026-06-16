/**
 * Брендовые line-art иконки GRABZI (inline SVG, без зависимости от картинок).
 * Заменяют эмодзи (главный «AI/шаблон»-маркер). Цвет наследуется через currentColor —
 * ставь color на родителе (терракота/олива/чай по контексту).
 */
type IconName =
  | "cup" | "pin" | "clock" | "car" | "check" | "plus" | "minus"
  | "chevron-right" | "chevron-left" | "info" | "infinity" | "phone" | "mail" | "refresh";

const PATHS: Record<IconName, React.ReactNode> = {
  // стакан тейк-эвей с трубочкой
  cup: (<><path d="M6 8h12l-1.2 11.2a2 2 0 0 1-2 1.8H9.2a2 2 0 0 1-2-1.8L6 8Z" /><path d="M5 8h14" /><path d="M14 3l-1 5" /></>),
  pin: (<><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" /><circle cx="12" cy="10" r="2.6" /></>),
  clock: (<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 1.8" /></>),
  // машина (drive-through)
  car: (<><path d="M3 13l1.8-4.6A2 2 0 0 1 6.7 7h10.6a2 2 0 0 1 1.9 1.4L21 13" /><path d="M3 13h18v4a1 1 0 0 1-1 1h-1.5M3 13v4a1 1 0 0 0 1 1h1.5" /><circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" /></>),
  check: (<path d="M4.5 12.5l5 5 10-11" />),
  plus: (<><path d="M12 5v14" /><path d="M5 12h14" /></>),
  minus: (<path d="M5 12h14" />),
  "chevron-right": (<path d="M9 5l7 7-7 7" />),
  "chevron-left": (<path d="M15 5l-7 7 7 7" />),
  info: (<><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5" /><circle cx="12" cy="7.8" r="0.4" fill="currentColor" /></>),
  infinity: (<path d="M7.5 9.5C5.6 9.5 4 10.6 4 12s1.6 2.5 3.5 2.5c2.6 0 3.4-5 6.5-5 1.9 0 3.5 1.1 3.5 2.5s-1.6 2.5-3.5 2.5c-3.1 0-3.9-5-6.5-5Z" />),
  phone: (<path d="M6.5 4h3l1.4 4-2 1.4a11 11 0 0 0 5.2 5.2L15.5 16l4 1.4v3a1.5 1.5 0 0 1-1.6 1.5C9.9 21.4 2.6 14.1 2 5.6A1.5 1.5 0 0 1 3.5 4h3Z" />),
  mail: (<><rect x="3.5" y="5.5" width="17" height="13" rx="2" /><path d="M4 7l8 6 8-6" /></>),
  refresh: (<><path d="M20 11a8 8 0 0 0-14-4.5L4 8" /><path d="M4 4v4h4" /><path d="M4 13a8 8 0 0 0 14 4.5L20 16" /><path d="M20 20v-4h-4" /></>),
};

export function Icon({ name, size = 22, stroke = 1.8, className, style }: {
  name: IconName; size?: number; stroke?: number; className?: string; style?: React.CSSProperties;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden
      className={className} style={{ flexShrink: 0, ...style }}>
      {PATHS[name]}
    </svg>
  );
}
