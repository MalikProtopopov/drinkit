import Link from "next/link";
import { API_URL } from "@/lib/api";

type Block = { key: string; title: string; body: string };

/** Объединённая инфо-страница (план §6): Story / Contact / часы — контент из info_blocks. RSC. */
async function getBlocks(): Promise<Block[]> {
  try {
    const res = await fetch(`${API_URL}/api/content?locale=en`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export default async function InfoPage() {
  const blocks = await getBlocks();
  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 30, marginBlockEnd: 20 }}>GRABZI</h1>
      {blocks.length === 0 && (
        <div className="card">
          <h2 style={{ fontSize: 20 }}>Our Story</h2>
          <p style={{ color: "var(--color-muted)" }}>Coming soon.</p>
          <h2 style={{ fontSize: 20, marginBlockStart: 16 }}>Contact</h2>
          <p style={{ color: "var(--color-muted)" }}>grabzi150@gmail.com · +971 55 667 6679</p>
        </div>
      )}
      {blocks.map((b) => (
        <section key={b.key} className="card" style={{ marginBlockEnd: 16 }}>
          <h2 style={{ fontSize: 20, marginBlockEnd: 8 }}>{b.title}</h2>
          <p style={{ color: "var(--color-muted)", whiteSpace: "pre-wrap" }}>{b.body}</p>
        </section>
      ))}
      <div style={{ marginBlockStart: 20 }}>
        <Link href="/" style={{ color: "var(--color-muted)" }}>← Home</Link>
      </div>
    </main>
  );
}
