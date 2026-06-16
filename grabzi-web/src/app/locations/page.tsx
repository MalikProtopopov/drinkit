"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type Location } from "@/lib/api";
import { useOrderDraft } from "@/lib/store";
import { Icon } from "@/components/Icon";
import { TopBrand } from "@/components/TopBrand";
import { IconStrip } from "@/components/IconStrip";
import { type WeekHours, todayHours, weeklyHours } from "@/lib/hours";
import { statusInfo, themeFor } from "@/lib/outletStatus";
import { useReveal } from "@/lib/useReveal";

type State =
  | { k: "loading" }
  | { k: "error" }
  | { k: "empty" }
  | { k: "ok"; items: Location[] };

function LocationCard({ loc, idx, onChoose }: { loc: Location; idx: number; onChoose: (l: Location) => void }) {
  const [showHours, setShowHours] = useState(false);
  const [fillW, setFillW] = useState(0);

  const wh = (loc.workingHours ?? {}) as WeekHours;
  const today = todayHours(wh, loc.timezone ?? undefined);
  const limited = loc.dailyDrinkLimit !== null && loc.remaining !== null;
  const pct = limited
    ? Math.max(0, Math.min(100, Math.round((loc.remaining! / loc.dailyDrinkLimit!) * 100)))
    : 100;
  const st = statusInfo(loc);
  const theme = themeFor(idx);

  // анимация заливки прогресс-бара (как у заказчика): 0 → pct после монтирования
  useEffect(() => {
    const id = setTimeout(() => setFillW(pct), 90);
    return () => clearTimeout(id);
  }, [pct]);

  const clickProps = st.orderable
    ? {
        role: "button" as const, tabIndex: 0,
        onClick: () => onChoose(loc),
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onChoose(loc); }
        },
      }
    : {};

  return (
    <div
      className={`loc ${st.orderable ? "loc--clickable" : "is-out"}`}
      style={theme as React.CSSProperties}
      {...clickProps}
    >
      {st.soldOut && <span className="loc__ribbon">SOLD OUT</span>}

      <div className="loc__top">
        <div>
          <div className="loc__name">{loc.name}</div>
          {loc.address && <div className="loc__city">{loc.address}</div>}
        </div>
        {st.orderable && <span className="loc__go">ORDER →</span>}
      </div>

      <div className="loc__meter">
        <div className="loc__meterhead">
          <span className="loc__label">{limited ? "LEFT TODAY" : "MADE TODAY"}</span>
          <span className="loc__count">
            <b>{limited ? loc.remaining : loc.soldToday}</b>
            {limited && <span className="slash"> / {loc.dailyDrinkLimit}</span>}
          </span>
        </div>
        {limited && (
          <div className="loc__bar"><div className="loc__fill" style={{ width: `${fillW}%` }} /></div>
        )}
        <div className="loc__status">
          <span className="loc__dot" />
          <span>{limited ? st.msg : "No daily limit — always pouring"}</span>
        </div>
      </div>

      {/* часы работы (наша фича) — компактно, в стиле карточки */}
      <div className="loc__hours">
        <button
          className="loc__hourstoggle"
          onClick={(e) => { e.stopPropagation(); setShowHours((v) => !v); }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
            <Icon name="clock" size={16} stroke={2} /> Today {today}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            {showHours ? "Hide" : "All hours"}
            <Icon name="chevron-right" size={15} stroke={2.4}
              style={{ transform: `rotate(${showHours ? -90 : 90}deg)`, transition: "transform .15s" }} />
          </span>
        </button>
        {showHours && (
          <div className="loc__hoursweek">
            {weeklyHours(wh).map((r, n) => (
              <div key={n} className="loc__hoursrow">
                <span style={{ fontWeight: 800, fontStyle: "italic" }}>{r.range}</span>
                <span style={{ opacity: r.hours === "Closed" ? 0.55 : 0.85 }}>{r.hours}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function LocationsPage() {
  const [state, setState] = useState<State>({ k: "loading" });
  const setLocation = useOrderDraft((s) => s.setLocation);
  const router = useRouter();
  // GSAP-появление карточек точек со stagger
  const grid = useReveal<HTMLDivElement>([state.k === "ok"]);

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
    setLocation(loc.id);
    router.push("/order");
  }

  return (
    <main style={{ maxWidth: 600, margin: "0 auto", paddingBlockEnd: 44 }}>
      <div style={{ paddingInline: 20 }}><TopBrand /></div>

      <section style={{ textAlign: "center", paddingInline: 20 }}>
        <h1 className="display" style={{ fontSize: "clamp(30px,8vw,46px)", lineHeight: 0.95, letterSpacing: ".01em" }}>
          CHOOSE YOUR SPOT
        </h1>
        <p style={{ marginBlockStart: 8, color: "var(--color-muted)", fontStyle: "italic", fontWeight: 600, fontSize: 15 }}>
          Limited cups every day — come early, we don&apos;t make more!!
        </p>
      </section>

      <div style={{ marginBlock: 16 }}><IconStrip /></div>

      <div ref={grid} style={{ paddingInline: 18, display: "grid", gap: 16 }}>
        {state.k === "loading" && [0, 1].map((i) => <div key={i} className="skeleton" style={{ height: 230, borderRadius: 28 }} />)}

        {state.k === "error" && (
          <div className="card" style={{ textAlign: "center" }}>
            <p>Can&apos;t reach GRABZI. Check your connection.</p>
            <button className="btn-primary" onClick={load} style={{ marginBlockStart: 12 }}>Try again</button>
          </div>
        )}

        {state.k === "empty" && <div className="card" style={{ textAlign: "center" }}>No locations yet.</div>}

        {state.k === "ok" && state.items.map((loc, i) => (
          <LocationCard key={loc.id} loc={loc} idx={i} onChoose={choose} />
        ))}
      </div>
    </main>
  );
}
