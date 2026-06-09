import Link from "next/link";

/** Главная (фронт-спека §5): hero + CTA «Create order» → выбор локации. RSC, статика. */
export default function HomePage() {
  return (
    <main style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <section
        style={{
          flex: 1, display: "flex", flexDirection: "column", justifyContent: "center",
          alignItems: "center", textAlign: "center", paddingInline: 24, paddingBlock: 48,
          gap: 20,
        }}
      >
        <div style={{ fontSize: 64 }}>🧊</div>
        <h1 style={{ fontSize: 44, letterSpacing: "-0.02em" }}>GRABZI</h1>
        <p style={{ fontSize: 18, color: "var(--color-muted)", maxWidth: 360 }}>
          Premium iced V&apos;60 coffee 🍒💣 🧊 — fast drive-through pickup.
        </p>
        <Link href="/locations" style={{ marginBlockStart: 12 }}>
          <button className="btn-primary">Create order ▶</button>
        </Link>
        <nav style={{ display: "flex", gap: 20, marginBlockStart: 24, fontSize: 15, color: "var(--color-muted)" }}>
          <Link href="/locations">Menu</Link>
          <Link href="/orders">My orders</Link>
          <Link href="/info">Info</Link>
        </nav>
      </section>
    </main>
  );
}
