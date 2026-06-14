// Аккуратный полноэкранный лоадер: брендовое кольцо + подпись.
export function Loader({ label, dark = false }: { label?: string; dark?: boolean }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 py-20">
      <div className="loader-ring" />
      {label && (
        <div className="text-[14px] font-medium" style={{ color: dark ? "rgba(255,255,255,.7)" : "var(--jooz-muted)" }}>
          {label}
        </div>
      )}
    </div>
  );
}
