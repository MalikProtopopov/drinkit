/**
 * Decorative icons for addon groups (and individual addons inside the sheet).
 * Small set of self-contained inline SVGs — no emoji, no external assets.
 */
type Props = { name: string; size?: number };

const GROUP_ICONS: Record<string, (s: number) => React.ReactElement> = {
  // Полезные добавки — leaf
  supplements: (s) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <path d="M6 26 C 8 14, 18 6, 26 6 C 26 14, 22 22, 14 26 C 11 27, 8 27, 6 26 Z" fill="#5FA85B" />
      <path d="M6 26 C 12 20, 20 14, 26 6" stroke="#3F7E3E" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  // Пенки и муссы — foam wave
  foam: (s) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <circle cx="11" cy="13" r="6" fill="#FFF" stroke="#E8DCD0" strokeWidth="1" />
      <circle cx="21" cy="15" r="6" fill="#FFF" stroke="#E8DCD0" strokeWidth="1" />
      <circle cx="16" cy="20" r="5" fill="#FFF" stroke="#E8DCD0" strokeWidth="1" />
    </svg>
  ),
  // Сливки — splash
  cream: (s) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <path
        d="M16 4 Q 22 10, 24 16 Q 26 22, 22 26 Q 16 30, 10 26 Q 6 22, 8 16 Q 10 10, 16 4 Z"
        fill="#FFFFFF"
        stroke="#D6CFC4"
        strokeWidth="1"
      />
      <ellipse cx="13" cy="14" rx="2" ry="3" fill="#F4F0E8" opacity="0.8" />
    </svg>
  ),
  // Молоко альтернативное — milk drop
  "alt-milk": (s) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <path d="M16 4 C 22 12, 26 18, 26 22 C 26 27, 21 30, 16 30 C 11 30, 6 27, 6 22 C 6 18, 10 12, 16 4 Z" fill="#F4F0E8" stroke="#D6CFC4" strokeWidth="1" />
    </svg>
  ),
  // Эспрессо — coffee bean
  espresso: (s) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <ellipse cx="16" cy="16" rx="9" ry="12" fill="#5C2F1A" transform="rotate(-22 16 16)" />
      <path d="M11 8 Q 16 16, 11 24" stroke="#3A1A0E" strokeWidth="2" strokeLinecap="round" fill="none" transform="rotate(-22 16 16)" />
    </svg>
  ),
  // Тапиока — bubbles
  tapioca: (s) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <circle cx="10" cy="22" r="4" fill="#3D2A20" />
      <circle cx="18" cy="20" r="4" fill="#3D2A20" />
      <circle cx="14" cy="14" r="4" fill="#3D2A20" />
      <circle cx="22" cy="14" r="3.5" fill="#3D2A20" />
    </svg>
  ),
  // Посыпки — sprinkles
  toppings: (s) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none" stroke="none">
      <rect x="6" y="14" width="6" height="2" rx="1" fill="#E26A5C" transform="rotate(20 9 15)" />
      <rect x="14" y="10" width="6" height="2" rx="1" fill="#F2B441" transform="rotate(-15 17 11)" />
      <rect x="20" y="16" width="6" height="2" rx="1" fill="#7CB87A" transform="rotate(35 23 17)" />
      <rect x="10" y="22" width="6" height="2" rx="1" fill="#9F7AE8" transform="rotate(-25 13 23)" />
      <rect x="18" y="22" width="6" height="2" rx="1" fill="#E26A5C" transform="rotate(10 21 23)" />
    </svg>
  ),
  // Сахар — sugar cube
  sugar: (s) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <rect x="8" y="8" width="16" height="16" rx="3" fill="#FFFFFF" stroke="#D8D0C2" strokeWidth="1.5" />
      <path d="M14 12 L 14 20 M 18 12 L 18 20 M 10 14 L 22 14 M 10 18 L 22 18" stroke="#E2D6BE" strokeWidth="1" />
    </svg>
  ),
  // Сиропы — bottle
  syrups: (s) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <rect x="13" y="4" width="6" height="4" rx="1" fill="#3A3A3A" />
      <path d="M11 10 L 21 10 L 22 14 Q 24 16, 24 20 L 24 26 Q 24 28, 22 28 L 10 28 Q 8 28, 8 26 L 8 20 Q 8 16, 10 14 Z" fill="#C53A4A" />
      <rect x="10" y="18" width="12" height="6" rx="1" fill="#F4E8DC" opacity="0.85" />
    </svg>
  ),
  // Цитрусовые — orange slice
  citrus: (s) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="12" fill="#F4A02B" />
      <circle cx="16" cy="16" r="9" fill="#FFD78A" />
      <g stroke="#F4A02B" strokeWidth="1.5">
        <line x1="16" y1="7" x2="16" y2="25" />
        <line x1="7" y1="16" x2="25" y2="16" />
        <line x1="10" y1="10" x2="22" y2="22" />
        <line x1="22" y1="10" x2="10" y2="22" />
      </g>
    </svg>
  ),
  // Протеин — scoop
  protein: (s) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <path d="M10 4 L 22 4 L 23 8 L 9 8 Z" fill="#3A3A3A" />
      <path d="M9 8 L 23 8 L 24 26 Q 24 28, 22 28 L 10 28 Q 8 28, 8 26 Z" fill="#5A8FE2" />
      <ellipse cx="16" cy="18" rx="6" ry="3" fill="#F4F0E8" />
    </svg>
  ),
  // Коллаген — capsule
  collagen: (s) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <rect x="4" y="12" width="24" height="8" rx="4" fill="#F2C4C4" />
      <rect x="4" y="12" width="12" height="8" rx="4" fill="#E27A7A" />
    </svg>
  ),
};

/** Per-addon overrides — fall through to the group icon if not listed. */
const ADDON_ICONS: Record<string, (s: number) => React.ReactElement> = {
  // espresso group
  shot: (s) => GROUP_ICONS.espresso(s),
  "shot-decaf": (s) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <ellipse cx="11" cy="16" rx="6" ry="8" fill="#5C2F1A" transform="rotate(-20 11 16)" />
      <path d="M9 10 Q 12 16, 9 22" stroke="#3A1A0E" strokeWidth="1.6" strokeLinecap="round" fill="none" transform="rotate(-20 11 16)" />
      <ellipse cx="21" cy="16" rx="6" ry="8" fill="#5C2F1A" transform="rotate(20 21 16)" />
      <path d="M19 10 Q 22 16, 19 22" stroke="#3A1A0E" strokeWidth="1.6" strokeLinecap="round" fill="none" transform="rotate(20 21 16)" />
    </svg>
  ),
  // supplements
  ginger: (s) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <path d="M8 22 Q 6 16, 10 12 Q 14 8, 20 10 Q 26 12, 24 18 Q 22 24, 16 25 Q 10 26, 8 22 Z" fill="#E8A05C" />
      <path d="M10 16 Q 16 14, 22 17" stroke="#B57339" strokeWidth="1.4" strokeLinecap="round" fill="none" />
    </svg>
  ),
  turmeric: (s) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <ellipse cx="16" cy="16" rx="11" ry="8" fill="#F0A028" />
      <path d="M7 14 Q 16 12, 25 14" stroke="#C77512" strokeWidth="1.2" fill="none" />
    </svg>
  ),
  spirulina: (s) => GROUP_ICONS.supplements(s),
  chia: (s) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <circle cx="10" cy="12" r="2" fill="#3A3A3A" />
      <circle cx="16" cy="10" r="2" fill="#3A3A3A" />
      <circle cx="22" cy="14" r="2" fill="#3A3A3A" />
      <circle cx="12" cy="20" r="2" fill="#3A3A3A" />
      <circle cx="20" cy="22" r="2" fill="#3A3A3A" />
      <circle cx="15" cy="16" r="2" fill="#3A3A3A" />
    </svg>
  ),
  // foam
  "milk-foam": (s) => GROUP_ICONS.foam(s),
  "berry-mousse": (s) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <circle cx="11" cy="14" r="5" fill="#E26A8B" />
      <circle cx="21" cy="15" r="5" fill="#E26A8B" />
      <circle cx="16" cy="20" r="5" fill="#E26A8B" />
    </svg>
  ),
  "vanilla-cream": (s) => GROUP_ICONS.cream(s),
  // cream group items
  oat: (s) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <ellipse cx="16" cy="10" rx="3" ry="4" fill="#D8B574" />
      <ellipse cx="11" cy="16" rx="3" ry="4" fill="#D8B574" />
      <ellipse cx="21" cy="16" rx="3" ry="4" fill="#D8B574" />
      <ellipse cx="16" cy="22" rx="3" ry="4" fill="#D8B574" />
    </svg>
  ),
  coconut: (s) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="11" fill="#5C3520" />
      <circle cx="16" cy="16" r="7" fill="#F4E8D8" />
      <circle cx="13" cy="14" r="1" fill="#5C3520" />
      <circle cx="19" cy="14" r="1" fill="#5C3520" />
      <circle cx="16" cy="18" r="1" fill="#5C3520" />
    </svg>
  ),
  almond: (s) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <ellipse cx="16" cy="16" rx="6" ry="11" fill="#E8C088" />
      <path d="M16 6 Q 20 16, 16 26" stroke="#B5894A" strokeWidth="1" fill="none" />
    </svg>
  ),
  // tapioca
  "boba-classic": (s) => GROUP_ICONS.tapioca(s),
  "boba-mango": (s) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <circle cx="10" cy="22" r="4" fill="#F2B441" />
      <circle cx="18" cy="20" r="4" fill="#F2B441" />
      <circle cx="14" cy="14" r="4" fill="#F2B441" />
      <circle cx="22" cy="14" r="3.5" fill="#F2B441" />
    </svg>
  ),
  // toppings
  chocolate: (s) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <rect x="6" y="8" width="20" height="16" rx="2" fill="#5C2F1A" />
      <path
        d="M6 12 L 26 12 M 6 16 L 26 16 M 6 20 L 26 20 M 12 8 L 12 24 M 20 8 L 20 24"
        stroke="#3A1A0E"
        strokeWidth="1"
      />
    </svg>
  ),
  "coconut-flakes": (s) => GROUP_ICONS.toppings(s),
  nuts: (s) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <ellipse cx="11" cy="14" rx="4" ry="5" fill="#A8784A" />
      <ellipse cx="20" cy="14" rx="4" ry="5" fill="#A8784A" />
      <ellipse cx="15" cy="22" rx="4" ry="5" fill="#A8784A" />
      <path d="M11 12 Q 11 16, 11 16 M 20 12 Q 20 16, 20 16" stroke="#6E4A26" strokeWidth="1" />
    </svg>
  ),
  // sugar
  "no-sugar": (s) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <rect x="8" y="8" width="16" height="16" rx="3" fill="#FFFFFF" stroke="#D8D0C2" strokeWidth="1.5" />
      <line x1="8" y1="8" x2="24" y2="24" stroke="#E26A6A" strokeWidth="2.4" />
    </svg>
  ),
  "sugar-1": (s) => GROUP_ICONS.sugar(s),
  "sugar-2": (s) => GROUP_ICONS.sugar(s),
  stevia: (s) => GROUP_ICONS.supplements(s),
  // syrups
  vanilla: (s) => GROUP_ICONS.syrups(s),
  caramel: (s) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <rect x="13" y="4" width="6" height="4" rx="1" fill="#3A3A3A" />
      <path d="M11 10 L 21 10 L 22 14 Q 24 16, 24 20 L 24 26 Q 24 28, 22 28 L 10 28 Q 8 28, 8 26 L 8 20 Q 8 16, 10 14 Z" fill="#C58B3A" />
      <rect x="10" y="18" width="12" height="6" rx="1" fill="#F4E8DC" opacity="0.85" />
    </svg>
  ),
  hazelnut: (s) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <rect x="13" y="4" width="6" height="4" rx="1" fill="#3A3A3A" />
      <path d="M11 10 L 21 10 L 22 14 Q 24 16, 24 20 L 24 26 Q 24 28, 22 28 L 10 28 Q 8 28, 8 26 L 8 20 Q 8 16, 10 14 Z" fill="#7E4A2E" />
      <rect x="10" y="18" width="12" height="6" rx="1" fill="#F4E8DC" opacity="0.85" />
    </svg>
  ),
  // protein
  "protein-whey": (s) => GROUP_ICONS.protein(s),
  "protein-plant": (s) => GROUP_ICONS.protein(s),
};

export function AddonIcon({ name, size = 32 }: Props) {
  const Icon = ADDON_ICONS[name] ?? GROUP_ICONS[name];
  if (Icon) return Icon(size);
  // Fallback subtle dot
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="8" fill="#D8C8E0" opacity="0.6" />
    </svg>
  );
}
