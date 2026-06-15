"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type Location } from "@/lib/api";
import { useOrderDraft } from "@/lib/store";

type State =
  | { k: "loading" }
  | { k: "error" }
  | { k: "empty" }
  | { k: "ok"; items: Location[] };

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const DAY_LABEL: Record<string, string> = {
  mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun",
};

function fmtIvs(ivs: { open: string; close: string }[] | undefined): string {
  if (!ivs || ivs.length === 0) return "Closed";
  return ivs.map((i) => `${i.open}–${i.close}`).join(", ");
}

function todayIdx(): number {
  return (new Date().getDay() + 6) % 7; // JS Sun=0 → наш mon=0
}

/** Группируем подряд идущие дни с одинаковыми часами: «Mon–Sat 05:30–22:00». */
function weeklyHours(wh: Record<string, { open: string; close: string }[]>) {
  const out: { range: string; hours: string }[] = [];
  let i = 0;
  while (i < 7) {
    const h = fmtIvs(wh[DAYS[i]]);
    let j = i;
    while (j + 1 < 7 && fmtIvs(wh[DAYS[j + 1]]) === h) j++;
    const range = i === j ? DAY_LABEL[DAYS[i]] : `${DAY_LABEL[DAYS[i]]}–${DAY_LABEL[DAYS[j]]}`;
    out.push({ range, hours: h });
    i = j + 1;
  }
  return out;
}

function badge(loc: Location) {
  if (loc.status === "paused") return ["Paused", "badge--paused"];
  if (loc.status === "closed") {
    const t = loc.nextOpenAt
      ? ` · opens ${new Date(loc.nextOpenAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
      : "";
    return [`Closed${t}`, "badge--closed"];
  }
  if (loc.isSoldOut) return ["Sold out today", "badge--out"];
  if (loc.remaining !== null && loc.remaining <= 15) return [`Only ${loc.remaining} left`, "badge--low"];
  return ["Open now", "badge--open"];
}

function LocationCard({ loc, onChoose }: { loc: Location; onChoose: (l: Location) => void }) {
  const [showHours, setShowHours] = useState(false);
  const [label, cls] = badge(loc);
  const wh = (loc.workingHours ?? {}) as Record<string, { open: string; close: string }[]>;
  const today = fmtIvs(wh[DAYS[todayIdx()]]);
  const pct = loc.dailyDrinkLimit && loc.remaining !== null
    ? Math.max(0, Math.round((loc.remaining / loc.dailyDrinkLimit) * 100))
    : null;
  const barColor = loc.remaining === 0 ? "var(--color-danger)"
    : loc.remaining !== null && loc.remaining <= 15 ? "var(--color-lowstock)" : "var(--color-instock)";

  return (
    <div className="card" style={{
      padding: 0, overflow: "hidden", position: "relative",
      borderInlineStart: `6px solid ${loc.color || "var(--color-brand)"}`,
    }}>
      <div style={{ padding: "16px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ fontSize: 34 }} aria-hidden>🥤</div>
            <div>
              <div className="display" style={{ fontSize: 21, textTransform: "uppercase" }}>{loc.name}</div>
              <div style={{ color: "var(--color-muted)", fontSize: 14 }}>📍 {loc.address}</div>
            </div>
          </div>
          <span className={`badge ${cls}`}>{label}</span>
        </div>

        {/* часы работы сегодня */}
        <button
          onClick={() => setShowHours((v) => !v)}
          style={{
            marginBlockStart: 12, background: "var(--color-cream-yellow)", border: "1px solid var(--color-border)",
            borderRadius: 12, padding: "8px 12px", width: "100%", display: "flex",
            justifyContent: "space-between", alignItems: "center", color: "var(--color-ink)",
          }}
        >
          <span style={{ fontWeight: 700 }}>🕐 Today {today}</span>
          <span style={{ color: "var(--color-brand)", fontWeight: 800 }}>{showHours ? "Hide hours ▲" : "All hours ▼"}</span>
        </button>
        {showHours && (
          <div style={{ marginBlockStart: 8, display: "grid", gap: 4 }}>
            {weeklyHours(wh).map((r, n) => (
              <div key={n} style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                <span style={{ fontWeight: 700, color: "var(--color-brand)" }}>{r.range}</span>
                <span style={{ color: r.hours === "Closed" ? "var(--color-muted)" : "var(--color-ink)" }}>{r.hours}</span>
              </div>
            ))}
          </div>
        )}

        {/* остаток на сегодня */}
        <div style={{ marginBlockStart: 14 }}>
          {loc.remaining === null ? (
            <div style={{ color: "var(--color-muted)", fontSize: 14 }}>♾️ No daily limit</div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBlockEnd: 6 }}>
                <span style={{ color: "var(--color-muted)" }}>Today&apos;s drinks</span>
                <span style={{ fontWeight: 800, color: barColor }}>{loc.remaining} / {loc.dailyDrinkLimit} left</span>
              </div>
              <div style={{ height: 8, background: "#efe3cf", borderRadius: 9999, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: barColor, transition: "width .4s" }} />
              </div>
            </>
          )}
        </div>

        {/* CTA */}
        <button
          className="btn-block"
          style={{ marginBlockStart: 16 }}
          disabled={!loc.isOpen}
          onClick={() => onChoose(loc)}
        >
          {loc.isOpen ? "Order here ▶"
            : loc.status === "paused" ? "Temporarily paused"
            : loc.isSoldOut ? "Sold out today"
            : "Closed now"}
        </button>
      </div>
    </div>
  );
}

export default function LocationsPage() {
  const [state, setState] = useState<State>({ k: "loading" });
  const setLocation = useOrderDraft((s) => s.setLocation);
  const router = useRouter();

  async function load() {
    setState({ k: "loading" });
    try {
      const items = await api.locations();
      setState(items.length ? { k: "ok", items } : { k: "empty" });
    } catch {
      setState({ k: "error" });
    }
  }
  useEffect(() => { load(); }, []);

  function choose(loc: Location) {
    if (!loc.isOpen) return;
    setLocation(loc.id);
    router.push("/order");
  }

  return (
    <main style={{ maxWidth: 600, margin: "0 auto", padding: 20 }}>
      <h1 className="display" style={{ fontSize: 36, marginBlockEnd: 6 }}>Pick a spot</h1>
      <p style={{ color: "var(--color-muted)", marginBlockEnd: 18 }}>Drive-through · pick up in your car 🚗</p>

      {state.k === "loading" && (
        <div style={{ display: "grid", gap: 14 }}>
          {[0, 1].map((i) => <div key={i} className="skeleton" style={{ height: 200 }} />)}
        </div>
      )}
      {state.k === "error" && (
        <div className="card" style={{ textAlign: "center" }}>
          <p>Can&apos;t reach GRABZI. Check your connection.</p>
          <button className="btn-primary" onClick={load} style={{ marginBlockStart: 12 }}>Try again</button>
        </div>
      )}
      {state.k === "empty" && <div className="card" style={{ textAlign: "center" }}>No locations yet.</div>}
      {state.k === "ok" && (
        <div style={{ display: "grid", gap: 16 }}>
          {state.items.map((loc) => <LocationCard key={loc.id} loc={loc} onChoose={choose} />)}
        </div>
      )}
    </main>
  );
}
