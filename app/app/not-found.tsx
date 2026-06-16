import Link from "next/link";

/**
 * 404 для app/ (админка GRABZI). Отдаётся с HTTP-статусом 404 (корректный SEO-сигнал).
 * Admin-домен и так закрыт от индексации (X-Robots-Tag + robots), здесь — noindex для надёжности.
 */
export const metadata = {
  title: "404 — not found · GRABZI",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div style={{
      minHeight: "100dvh", display: "grid", placeItems: "center",
      padding: 24, textAlign: "center", background: "#fff",
    }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, maxWidth: 380 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="GRABZI" style={{ height: 56, width: "auto" }} />
        <div style={{ fontSize: 72, fontWeight: 900, fontStyle: "italic", color: "#C9432B", lineHeight: 1 }}>404</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#2a1d14" }}>Page not found</div>
        <p style={{ color: "#5A6172", fontSize: 14, margin: 0 }}>
          Эта страница не найдена. Вернитесь в админку.
        </p>
        <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap", justifyContent: "center" }}>
          <Link href="/admin" style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            background: "#C9432B", color: "#fff", fontWeight: 800, fontStyle: "italic",
            padding: "11px 26px", borderRadius: 999, fontSize: 15,
          }}>
            To admin
          </Link>
        </div>
      </div>
    </div>
  );
}
