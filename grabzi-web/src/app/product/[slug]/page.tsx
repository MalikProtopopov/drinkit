import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { API_URL } from "@/lib/api";
import { TopBrand } from "@/components/TopBrand";
import { Icon } from "@/components/Icon";

/** Деталка напитка — серверный компонент: для несуществующего slug отдаём настоящий
 *  HTTP 404 + брендовую not-found (с noindex), а не soft-200 (C4/SEO). */
type Drink = { id: number; name: string; description: string | null; basePrice: number; kcal: number | null };

async function getDrink(slug: string): Promise<Drink | null> {
  try {
    const res = await fetch(`${API_URL}/api/drinks/${encodeURIComponent(slug)}?locale=en`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as Drink;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const drink = await getDrink(slug);
  if (!drink) return { title: "Drink not found — GRABZI", robots: { index: false, follow: true } };
  return { title: `${drink.name} — GRABZI`, description: drink.description ?? undefined };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const drink = await getDrink(slug);
  if (!drink) notFound(); // C4: реальный 404 (рендерит not-found.tsx с meta noindex), не soft-200

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
