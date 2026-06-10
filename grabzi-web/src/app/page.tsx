import Link from "next/link";
import { API_URL } from "@/lib/api";

/** Главная GRABZI (по референсу): вордмарк, TODAY'S LIMIT, ORDER NOW, теглайн, футер. RSC. */
async function todaysLimit(): Promise<{ sold: number; limit: number | null } | null> {
  try {
    const res = await fetch(`${API_URL}/api/locations?locale=en`, { next: { revalidate: 30 } });
    if (!res.ok) return null;
    const locs = await res.json();
    const open = locs.find((l: { isOpen: boolean }) => l.isOpen) ?? locs[0];
    return open ? { sold: open.soldToday, limit: open.dailyDrinkLimit } : null;
  } catch {
    return null;
  }
}

const ROW = "🥤 🧊 🍒 ☕ 🍫 🍉 ⚡ 🥥 🧊 🍒 ☕ 🍫 🍉 ⚡ 🥤 🧊";

export default async function HomePage() {
  const lim = await todaysLimit();
  return (
    <main style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", paddingInline: 20 }}>
      {/* вордмарк */}
      <section style={{ textAlign: "center", paddingBlock: 40 }}>
        <div style={{ fontSize: 56 }} aria-hidden>🥤✋</div>
        <h1 className="display" style={{ fontSize: 64, letterSpacing: "-0.01em" }}>GRABZI≡</h1>
      </section>

      <div className="divider" aria-hidden>{ROW}</div>

      {/* TODAY'S LIMIT */}
      <section style={{ textAlign: "center", paddingBlock: 28 }}>
        <div className="limit-title">TODAY&apos;S LIMIT</div>
        <div className="limit-value">{lim ? `${lim.sold} / ${lim.limit ?? "∞"}` : "—"}</div>
        <Link href="/locations" style={{ display: "inline-block", marginBlockStart: 14 }}>
          <button className="btn-primary" style={{ borderColor: "var(--color-brand)" }}>ORDER NOW</button>
        </Link>
      </section>

      <div className="divider" aria-hidden>{ROW}</div>

      {/* теглайн */}
      <section style={{ textAlign: "center", paddingBlock: 24, maxWidth: 420 }}>
        <p className="display" style={{ fontSize: 22 }}>
          Only Ice <span style={{ color: "var(--color-brand-press)" }}>V60</span>
        </p>
        <p style={{ color: "var(--color-brand)", fontStyle: "italic", fontWeight: 600 }}>
          Come early, we don&apos;t make more!!
        </p>
      </section>

      <div style={{ flex: 1 }} />
      <footer className="footer">
        <div style={{ fontSize: 18 }}>📷</div>
        © 2026 GRABZI
      </footer>
    </main>
  );
}
