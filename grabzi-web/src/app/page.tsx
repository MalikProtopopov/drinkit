import Link from "next/link";
import { API_URL } from "@/lib/api";
import { IconStrip } from "@/components/IconStrip";

/**
 * Главная GRABZI — по референсу grabzi.ae: фирменный маскот-логотип, бегущие иконки-разделители,
 * живой TODAY'S LIMIT, контурная кнопка ORDER NOW, брендовый слоган. RSC.
 */
type OutletLimit = { name: string; sold: number; limit: number | null };
/** Сегодняшний лимит ВСЕХ активных точек (не одной) — иначе главная вводит в заблуждение. */
async function outletLimits(): Promise<OutletLimit[]> {
  try {
    const res = await fetch(`${API_URL}/api/outlets?locale=en`, { next: { revalidate: 30 } });
    if (!res.ok) return [];
    const locs = (await res.json()) as Array<{ name: string; soldToday: number; dailyDrinkLimit: number | null }>;
    return locs.map((l) => ({ name: l.name, sold: l.soldToday, limit: l.dailyDrinkLimit }));
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const limits = await outletLimits();
  return (
    <main style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", paddingInline: 20 }}>
      {/* фирменный маскот-логотип GRABZI (как на grabzi.ae) */}
      <section style={{ textAlign: "center", paddingBlockStart: 24, paddingBlockEnd: 4, width: "100%", maxWidth: 500 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="hero-logo" src="/brand/logo.png" alt="GRABZI" width={1019} height={942} />
        <p style={{ marginBlockStart: 6, color: "var(--color-muted)", fontSize: 14.5 }}>
          Drive-through pickup — order by your car plate
        </p>
      </section>

      {/* бегущая брендовая полоска-разделитель */}
      <div style={{ width: "100vw", marginInline: -20, marginBlock: 18 }}>
        <IconStrip />
      </div>

      {/* TODAY'S LIMIT (live, по КАЖДОЙ точке) + контурная ORDER NOW */}
      <section style={{ textAlign: "center", paddingBlock: 8, width: "100%", maxWidth: 380 }}>
        <div className="limit-title">TODAY&apos;S LIMIT</div>

        {limits.length === 0 && (
          <div className="limit-value" style={{ fontSize: 46, marginBlockStart: 2 }}>—</div>
        )}

        {limits.length === 1 && (
          <div className="limit-value" style={{ fontSize: 46, marginBlockStart: 2 }}>
            {limits[0].sold} / {limits[0].limit ?? "∞"}
          </div>
        )}

        {limits.length > 1 && (
          <div style={{ display: "grid", gap: 13, marginBlockStart: 12, width: "100%" }}>
            {limits.map((o) => {
              const pct = o.limit ? Math.min(100, Math.round((o.sold / o.limit) * 100)) : 0;
              return (
                <div key={o.name} style={{ textAlign: "start" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBlockEnd: 5, gap: 12 }}>
                    <span className="display" style={{ fontSize: 16, textTransform: "uppercase", color: "var(--color-ink)" }}>{o.name}</span>
                    <span className="display" style={{ fontSize: 18, color: "var(--color-lime)", whiteSpace: "nowrap" }}>
                      {o.sold}<span style={{ opacity: 0.5, fontSize: 13 }}> / {o.limit ?? "∞"}</span>
                    </span>
                  </div>
                  {o.limit !== null && (
                    <div style={{ height: 7, background: "#efe3cf", borderRadius: 9999, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: "var(--color-lime)", borderRadius: 9999 }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <Link href="/locations" className="btn-ghost"
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", marginBlockStart: 18 }}>
          ORDER NOW
        </Link>
      </section>

      {/* вторая полоска */}
      <div style={{ width: "100vw", marginInline: -20, marginBlock: 18 }}>
        <IconStrip />
      </div>

      {/* брендовый слоган (фирменные лого-локапы grabzi.ae) */}
      <section style={{ textAlign: "center", paddingBlock: 8, width: "100%", maxWidth: 460 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/only-ice-v60.png" alt="Only Ice V60" width={675} height={150}
          style={{ width: "auto", maxWidth: 210, height: "auto", margin: "0 auto", display: "block" }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/tagline.png" alt="Come early — we don't make more!!" width={2296} height={205}
          style={{ width: "100%", maxWidth: 320, height: "auto", margin: "12px auto 0", display: "block" }} />
      </section>

      {/* тихий ряд ссылок — путь к меню/инфо без навбара (главная не должна быть тупиком) */}
      <nav style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap", marginBlockStart: 18 }}>
        <Link className="nav-link" href="/menu">Menu</Link>
        <span style={{ color: "var(--color-border)" }}>·</span>
        <Link className="nav-link" href="/info">Hours &amp; contact</Link>
      </nav>

      <div style={{ flex: 1, minHeight: 16 }} />
      <footer className="footer">© 2026 GRABZI</footer>
    </main>
  );
}
