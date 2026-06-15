"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type Drink } from "@/lib/api";

/** Меню (browse) — по референсу: крупные эмодзи-иллюстрации, имена, DHS. XX.XX, ORDER NOW. */
function bigEmoji(name: string): string {
  const m = name.match(/\p{Emoji}+/u);
  return m ? m[0] : "🧊";
}
function cleanName(name: string): string {
  return name.replace(/\p{Emoji}/gu, "").trim();
}

export default function MenuPage() {
  const [drinks, setDrinks] = useState<Drink[] | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => { api.drinks().then(setDrinks).catch(() => setErr(true)); }, []);

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: 20 }}>
      <h1 className="display" style={{ fontSize: 52, marginBlockEnd: 8 }}>Menu</h1>
      <div style={{ height: 2, background: "var(--color-brand)", opacity: .4, marginBlockEnd: 24 }} />

      {err && <div className="card" style={{ textAlign: "center" }}>Couldn&apos;t load the menu.</div>}
      {!drinks && !err && (
        <div style={{ display: "grid", gap: 28 }}>
          {[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 200 }} />)}
        </div>
      )}

      {drinks && (
        <div style={{ display: "grid", gap: 44 }}>
          {drinks.map((d) => (
            <div key={d.id} style={{ textAlign: "center" }}>
              {d.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={d.previewUrl} alt={cleanName(d.name)}
                  style={{ width: 150, height: 150, objectFit: "contain", margin: "0 auto" }} />
              ) : (
                <div style={{ fontSize: 92, lineHeight: 1 }} aria-hidden>{bigEmoji(d.name)}</div>
              )}
              <div className="display" style={{ fontSize: 26, textTransform: "uppercase", marginBlockStart: 8 }}>
                {cleanName(d.name)}
              </div>
              <div className="display" style={{ fontSize: 18, color: "var(--color-brand-press)" }}>
                DHS. {d.basePrice.toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ textAlign: "center", paddingBlock: 40 }}>
        <Link href="/locations"><button className="btn-primary">ORDER NOW</button></Link>
      </div>
      <footer className="footer"><div style={{ fontSize: 18 }}>📷</div>© 2026 GRABZI</footer>
    </main>
  );
}
