import { type ApiAddon } from "@/lib/api";

/** Иконка добавки: реальная картинка из API либо буквенный кружок-фолбэк. */
export function AddonGlyph({ addon, size, className = "" }: { addon: ApiAddon; size: number; className?: string }) {
  if (addon.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={addon.imageUrl} alt="" className={`object-contain ${className}`}
           style={{ width: size, height: size, filter: "drop-shadow(0 6px 10px rgba(40,25,8,.3))" }} />
    );
  }
  return (
    <div className={`rounded-full flex items-center justify-center font-black ${className}`}
         style={{ width: size, height: size, fontSize: size * 0.4, background: "rgba(255,255,255,.85)", color: "var(--jooz-ink-2)" }}>
      {addon.name.slice(0, 1)}
    </div>
  );
}
