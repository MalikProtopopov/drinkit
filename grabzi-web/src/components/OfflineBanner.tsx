"use client";
import { useEffect, useState } from "react";

/** Оффлайн-баннер (фронт-спека §5): авто-показ при потере сети, авто-скрытие при возврате. */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    setOffline(typeof navigator !== "undefined" && !navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  if (!offline) return null;
  return (
    <div style={{
      position: "fixed", insetInline: 0, insetBlockStart: 0, zIndex: 100,
      background: "var(--color-outofstock)", color: "#333", textAlign: "center",
      padding: 8, fontSize: 14, fontWeight: 600,
    }}>
      You&apos;re offline. We&apos;ll reload when you&apos;re back.
    </div>
  );
}
