"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useOrderDraft } from "@/lib/store";

/** Деталка напитка — опциональный модуль (план Р3.2). Просмотр + количество → в заказ. */
type Drink = { id: number; name: string; description: string | null; previewUrl: string | null; basePrice: number };

export default function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [drink, setDrink] = useState<Drink | null>(null);
  const [err, setErr] = useState(false);
  const [qty, setQty] = useState(1);
  const setQtyStore = useOrderDraft((s) => s.setQty);
  const items = useOrderDraft((s) => s.items);
  const router = useRouter();

  useEffect(() => {
    api.drink(slug).then(setDrink).catch(() => setErr(true));
  }, [slug]);

  if (err) return <main style={{ padding: 24, textAlign: "center" }}><p>Drink not found.</p><Link href="/order"><button className="btn-primary">Back to menu</button></Link></main>;
  if (!drink) return <main style={{ padding: 24 }}><div className="skeleton" style={{ height: 240 }} /></main>;

  function add() {
    if (!drink) return;
    setQtyStore(drink.id, (items[drink.id] ?? 0) + qty);
    router.push("/order");
  }

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: 20 }}>
      <div style={{
        aspectRatio: "1 / 1", background: "var(--color-cream)", borderRadius: "var(--radius-card)",
        display: "grid", placeItems: "center", overflow: "hidden", marginBlockEnd: 16,
      }}>
        {drink.previewUrl
          ? <img src={drink.previewUrl} alt={drink.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <span style={{ fontSize: 80 }}>🧊</span>}
      </div>
      <h1 style={{ fontSize: 26 }}>{drink.name}</h1>
      <p style={{ color: "var(--color-muted)" }}>{drink.description}</p>
      <p style={{ fontWeight: 900, fontSize: 22, marginBlock: 12 }}>AED {drink.basePrice}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBlockEnd: 16 }}>
        <button onClick={() => setQty(Math.max(1, qty - 1))} style={step}>−</button>
        <span style={{ fontWeight: 800, fontSize: 18 }}>{qty}</span>
        <button onClick={() => setQty(qty + 1)} style={{ ...step, background: "var(--color-brand)", color: "#fff" }}>+</button>
      </div>
      <button className="btn-primary" style={{ width: "100%" }} onClick={add}>Add to order ▶</button>
    </main>
  );
}
const step: React.CSSProperties = {
  inlineSize: 44, blockSize: 44, borderRadius: 9999, border: "1px solid var(--color-border)",
  background: "var(--color-cream)", fontSize: 22, fontWeight: 800,
};
