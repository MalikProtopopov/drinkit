// Фирменный набор иконок JOOZ: сплошные округлые формы (soft-filled) в духе
// жирного логотипа — намеренно «не дефолтные» тонкие line-иконки.
type IconProps = { size?: number; className?: string; style?: React.CSSProperties };

/** Профиль — собственный аватар-глиф из прототипа JOOZ (голова + плечи, заливка). */
export function IconUser({ size = 22, className = "", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} style={style}>
      <circle cx="12" cy="8" r="4.3" />
      <path d="M4.4 19.2c0-3.7 3.3-6.1 7.6-6.1s7.6 2.4 7.6 6.1c0 1-.6 1.6-1.7 1.6H6.1c-1.1 0-1.7-.6-1.7-1.6z" />
    </svg>
  );
}

/** Корзина — мягкий пакет-стакан с дужкой (soft-filled). */
export function IconBag({ size = 22, className = "", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <path d="M8 8.5V8a4 4 0 0 1 8 0v.5" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
      <path d="M6 8.5h12a1.6 1.6 0 0 1 1.6 1.78l-1 8.4A2.2 2.2 0 0 1 16.42 20.6H7.58a2.2 2.2 0 0 1-2.18-1.92l-1-8.4A1.6 1.6 0 0 1 6 8.5z"
            fill="currentColor" />
    </svg>
  );
}

/** Жирный округлый шеврон «назад». */
export function IconBack({ size = 18, className = "", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

/** Крестик «закрыть» — жирный округлый. */
export function IconClose({ size = 18, className = "", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/** Плюс — жирный округлый, одинаковый по всему приложению. */
export function IconPlus({ size = 20, className = "", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
      <path d="M12 5.5v13M5.5 12h13" />
    </svg>
  );
}

/** Палец вверх — soft-filled. */
export function IconThumbUp({ size = 24, className = "", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} style={style}>
      <path d="M3 10.2A1.4 1.4 0 0 1 4.4 8.8h2.1V20H4.4A1.4 1.4 0 0 1 3 18.6v-8.4z" />
      <path d="M8.3 9.1l3.5-6.1c.3-.55 1-.76 1.6-.5.92.4 1.42 1.4 1.2 2.38L13.7 8.8H19a2.3 2.3 0 0 1 2.25 2.77l-1.2 5.7A2.5 2.5 0 0 1 17.6 20.0H8.3V9.1z" />
    </svg>
  );
}

/** Палец вниз — зеркальный вариант. */
export function IconThumbDown({ size = 24, className = "", style }: IconProps) {
  return <IconThumbUp size={size} className={className} style={{ ...style, transform: `scaleY(-1) ${style?.transform ?? ""}` }} />;
}

/** Телефон — soft-filled трубка. */
export function IconPhone({ size = 18, className = "", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} style={style}>
      <path d="M6.6 3.5c.7 0 1.3.45 1.5 1.12l.86 2.86c.18.6 0 1.25-.47 1.66l-1.2 1.04a11.5 11.5 0 0 0 4.57 4.57l1.04-1.2c.41-.47 1.06-.65 1.66-.47l2.86.86c.67.2 1.12.8 1.12 1.5v2.48c0 .96-.8 1.74-1.76 1.66C9.9 20.97 3.03 14.1 2.44 5.26 2.36 4.3 3.14 3.5 4.1 3.5h2.5z" />
    </svg>
  );
}
