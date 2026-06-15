/* Декоративный разделитель из брендовых иконок grabzi.ae (ряд line-art значков). */
const ICONS = ["/brand/ice.png", "/brand/hand.png", "/brand/v60.png", "/brand/cup.png", "/brand/ice-lime.png"];

export function BrandDivider() {
  const row = Array.from({ length: 14 }, (_, i) => ICONS[i % ICONS.length]);
  return (
    <div
      aria-hidden
      style={{
        display: "flex", gap: 18, justifyContent: "center", alignItems: "center",
        overflow: "hidden", opacity: 0.85, paddingBlock: 8,
      }}
    >
      {row.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={i} src={src} alt="" style={{ width: 26, height: 26, objectFit: "contain", flexShrink: 0 }} />
      ))}
    </div>
  );
}
