import Link from "next/link";
import { API_URL } from "@/lib/api";
import { BrandDivider } from "@/components/BrandDivider";

/** Главная GRABZI (по референсу): настоящий логотип, TODAY'S LIMIT, ORDER NOW, теглайн, футер. RSC. */
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

export default async function HomePage() {
  const lim = await todaysLimit();
  return (
    <main style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", paddingInline: 20 }}>
      {/* настоящий логотип grabzi.ae */}
      <section style={{ textAlign: "center", paddingBlock: 32, width: "100%", maxWidth: 460 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo.png" alt="GRABZI" style={{ width: "100%", maxWidth: 360, height: "auto", margin: "0 auto" }} />
      </section>

      <div style={{ width: "100%", maxWidth: 560 }}><BrandDivider /></div>

      {/* TODAY'S LIMIT */}
      <section style={{ textAlign: "center", paddingBlock: 24 }}>
        <div className="limit-title">TODAY&apos;S LIMIT</div>
        <div className="limit-value" style={{ fontSize: 38 }}>{lim ? `${lim.sold} / ${lim.limit ?? "∞"}` : "—"}</div>
        <Link href="/locations" style={{ display: "inline-block", marginBlockStart: 16 }}>
          <button className="btn-primary">ORDER NOW</button>
        </Link>
      </section>

      <div style={{ width: "100%", maxWidth: 560 }}><BrandDivider /></div>

      {/* теглайн (брендовая картинка) */}
      <section style={{ textAlign: "center", paddingBlock: 28, maxWidth: 460, width: "100%" }}>
        <p className="display" style={{ fontSize: 24, marginBlockEnd: 12 }}>
          Only Ice <span style={{ color: "var(--color-brand-press)" }}>V60</span>
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/tagline.png" alt="Come early, we don't make more!!" style={{ width: "100%", maxWidth: 340, height: "auto", margin: "0 auto" }} />
      </section>

      <div style={{ flex: 1 }} />
      {/* зелёная рука с напитком в углу (как на референсе) */}
      <div style={{ width: "100%", maxWidth: 720, display: "flex", justifyContent: "flex-end" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/hand.png" alt="" aria-hidden style={{ width: 120, height: 120, objectFit: "contain", opacity: 0.9 }} />
      </div>
      <footer className="footer">
        <div style={{ fontSize: 18 }}>📷</div>
        © 2026 GRABZI
      </footer>
    </main>
  );
}
