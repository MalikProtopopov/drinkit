"use client";
/** ВРЕМЕННЫЙ переключатель цветовых концептов (для показа заказчику).
 *  Удаление: убрать <ThemeSwitcher/> из app/layout.tsx + этот файл + lib/themePresets.ts.
 *  Выбранный концепт хранится в localStorage и применяется ко всему публичному сайту. */
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { PRESETS, THEMABLE_VARS } from "@/lib/themePresets";

const KEY = "jooz-theme-preview";

function applyPreset(presetKey: string) {
  const root = document.documentElement;
  THEMABLE_VARS.forEach((v) => root.style.removeProperty(v)); // сброс к globals.css
  const p = PRESETS.find((x) => x.key === presetKey);
  if (p) Object.entries(p.vars).forEach(([k, val]) => root.style.setProperty(k, val));
}

export function ThemeSwitcher() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("default");

  useEffect(() => {
    const saved = (typeof localStorage !== "undefined" && localStorage.getItem(KEY)) || "default";
    setActive(saved);
    applyPreset(saved);
  }, []);

  if (pathname?.startsWith("/admin")) return null;

  const choose = (key: string) => {
    setActive(key);
    applyPreset(key);
    try { localStorage.setItem(KEY, key); } catch { /* ignore */ }
  };

  return (
    <div style={{ position: "fixed", left: 16, bottom: 16, zIndex: 9999 }}>
      {open && (
        <div style={{
          position: "absolute", bottom: 56, left: 0, width: 232, maxHeight: "70vh", overflowY: "auto",
          background: "#fff", color: "#15171c", borderRadius: 16, padding: 8,
          boxShadow: "0 18px 50px -12px rgba(0,0,0,.35), 0 0 0 1px rgba(0,0,0,.06)",
        }} dir="ltr">
          <div style={{ fontSize: 11, fontWeight: 800, opacity: .55, padding: "6px 8px 8px", letterSpacing: ".04em", textTransform: "uppercase" }}>
            Концепт цветов (превью)
          </div>
          {PRESETS.map((p) => {
            const sel = p.key === active;
            return (
              <button key={p.key} onClick={() => choose(p.key)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
                  padding: "9px 10px", borderRadius: 10, marginBottom: 2, cursor: "pointer",
                  background: sel ? "#f1f1f5" : "transparent",
                  border: sel ? "1.5px solid #15171c" : "1.5px solid transparent",
                }}>
                <span style={{ width: 20, height: 20, borderRadius: 6, flex: "none", background: p.swatch,
                               boxShadow: "inset 0 0 0 1px rgba(0,0,0,.12)" }} />
                <span style={{ fontSize: 13, fontWeight: 700 }}>{p.label}</span>
                {sel && <span style={{ marginLeft: "auto", fontSize: 13 }}>✓</span>}
              </button>
            );
          })}
        </div>
      )}
      <button onClick={() => setOpen((v) => !v)} aria-label="Сменить цветовой концепт"
        style={{
          width: 48, height: 48, borderRadius: "50%", border: "none", cursor: "pointer",
          background: "#15171c", color: "#fff", fontSize: 22, lineHeight: 1,
          boxShadow: "0 10px 28px -8px rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center",
        }}>🎨</button>
    </div>
  );
}
