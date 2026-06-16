import Link from "next/link";
import { IconStrip } from "@/components/IconStrip";

/**
 * Брендовая 404 GRABZI. Next отдаёт этот экран с HTTP-статусом 404 для несуществующих
 * маршрутов — это и есть корректный SEO-сигнал (никаких soft-404 с кодом 200):
 * краулеры не индексируют 404 и убирают URL из выдачи. Плюс meta robots noindex.
 */
export const metadata = {
  title: "404 — page not found · GRABZI",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <main style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingInline: 20, textAlign: "center" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logo.png" alt="GRABZI" style={{ width: "100%", maxWidth: 190, height: "auto" }} />

      <h1 className="display" style={{ fontSize: "clamp(64px,18vw,120px)", color: "var(--color-brand)", lineHeight: 0.9, marginBlockStart: 6 }}>404</h1>
      <p className="display" style={{ fontSize: 24, marginBlockStart: 2 }}>This cup slipped away</p>
      <p style={{ color: "var(--color-muted)", marginBlockStart: 10, maxWidth: 360, fontSize: 15 }}>
        The page you&apos;re after isn&apos;t on the menu. Let&apos;s get you back to the good stuff.
      </p>

      <div style={{ display: "flex", gap: 12, marginBlockStart: 24, flexWrap: "wrap", justifyContent: "center" }}>
        <Link href="/locations" className="btn-primary" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          Order now
        </Link>
        <Link href="/" className="btn-ghost" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          Home
        </Link>
      </div>

      <div style={{ width: "100vw", marginBlockStart: 36 }}>
        <IconStrip />
      </div>
    </main>
  );
}
