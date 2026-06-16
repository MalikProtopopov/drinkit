"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { TopBrand } from "@/components/TopBrand";
import { Icon } from "@/components/Icon";

/** Деталка напитка — опциональный модуль (план Р3.2). Просмотр → выбор точки → заказ. */
type Drink = { id: number; name: string; description: string | null; basePrice: number; kcal: number | null };

export default function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [drink, setDrink] = useState<Drink | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    api.drink(slug).then(setDrink).catch(() => setErr(true));
  }, [slug]);

  if (err) {
    return (
      <main style={wrap}>
        <TopBrand />
        <div style={center}>
          <div className="card" style={{ textAlign: "center", display: "grid", gap: 16, placeItems: "center", paddingBlock: 32, width: "100%" }}>
            <div className="tile" style={{ width: 96, height: 96 }}><Icon name="info" size={40} /></div>
            <h1 className="display" style={{ fontSize: 28 }}>Drink not found</h1>
            <p style={{ color: "var(--color-muted)" }}>This drink isn&apos;t on the menu anymore.</p>
            <Link href="/menu"><button className="btn-primary">Back to menu</button></Link>
          </div>
        </div>
      </main>
    );
  }

  if (!drink) {
    return (
      <main style={wrap}>
        <TopBrand />
        <div style={{ ...center, gap: 16 }}>
          <div className="skeleton" style={{ width: 220, height: 220, borderRadius: "var(--radius-card)" }} />
          <div className="skeleton" style={{ height: 34, width: "60%" }} />
          <div className="skeleton" style={{ height: 60, width: "90%" }} />
          <div className="skeleton" style={{ height: 30, width: "40%" }} />
        </div>
      </main>
    );
  }

  return (
    <main style={wrap}>
      <TopBrand />

      <div style={center}>
        <div className="tile" style={{ width: 220, height: 220, marginBlockEnd: 24 }}>
          <Icon name="cup" size={72} />
        </div>

        <h1 className="display" style={{ fontSize: 38, marginBlockEnd: 12 }}>{drink.name}</h1>

        {drink.description && (
          <p style={{ color: "var(--color-ink)", lineHeight: 1.55, marginBlockEnd: 20, maxWidth: 420 }}>{drink.description}</p>
        )}

        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBlockEnd: 28, justifyContent: "center" }}>
          <span className="display" style={{ fontSize: 30, color: "var(--color-brand-press)" }}>
            AED {drink.basePrice.toFixed(2)}
          </span>
          {drink.kcal !== null && (
            <span style={{ color: "var(--color-muted)", fontWeight: 700 }}>{drink.kcal} kcal</span>
          )}
        </div>

        <Link href="/locations" style={{ width: "100%", maxWidth: 360 }}>
          <button className="btn-primary btn-block">Order now</button>
        </Link>
      </div>
    </main>
  );
}

const wrap: React.CSSProperties = {
  maxWidth: 560, margin: "0 auto", padding: 20, minHeight: "100dvh",
  display: "flex", flexDirection: "column",
};
// центрируем контент по вертикали и горизонтали под шапкой
const center: React.CSSProperties = {
  flex: 1, width: "100%", display: "flex", flexDirection: "column",
  justifyContent: "center", alignItems: "center", textAlign: "center", paddingBlock: 24,
};
