"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type Drink } from "@/lib/api";
import { TopBrand } from "@/components/TopBrand";
import { Icon } from "@/components/Icon";

/** Меню (browse) — по референсу: line-art стакан-плейсхолдер, имена, AED XX.XX, ORDER NOW. */
function cleanName(name: string): string {
  return name.replace(/\p{Emoji}/gu, "").trim();
}

export default function MenuPage() {
  const [drinks, setDrinks] = useState<Drink[] | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => { api.drinks().then(setDrinks).catch(() => setErr(true)); }, []);

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: 20 }}>
      <TopBrand />
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
            <Link key={d.id} href={`/product/${d.slug}`} style={{ textAlign: "center", display: "block" }}>
              <div className="tile" style={{ width: 120, height: 120, margin: "0 auto", display: "grid", placeItems: "center", color: "var(--color-brand)" }}>
                <Icon name="cup" size={44} />
              </div>
              <div className="display" style={{ fontSize: 26, textTransform: "uppercase", marginBlockStart: 8 }}>
                {cleanName(d.name)}
              </div>
              <div className="display" style={{ fontSize: 18, color: "var(--color-brand-press)" }}>
                AED {d.basePrice.toFixed(2)}
              </div>
            </Link>
          ))}
        </div>
      )}

      <div style={{ textAlign: "center", paddingBlock: 40 }}>
        <Link href="/locations"><button className="btn-primary">ORDER NOW</button></Link>
      </div>
      <footer className="footer"><Icon name="cup" size={18} />© 2026 GRABZI</footer>
    </main>
  );
}
