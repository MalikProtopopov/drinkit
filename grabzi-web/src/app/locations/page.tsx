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

function statusBadge(loc: Location) {
  if (loc.status === "paused") return <span className="badge badge--paused">Paused</span>;
  if (loc.status === "closed")
    return (
      <span className="badge badge--closed">
        Closed{loc.nextOpenAt ? ` · opens ${new Date(loc.nextOpenAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : ""}
      </span>
    );
  if (loc.isSoldOut) return <span className="badge badge--out">Sold out today</span>;
  if (loc.remaining !== null && loc.remaining <= 5)
    return <span className="badge badge--low">Only {loc.remaining} left today</span>;
  return <span className="badge badge--open">Open now</span>;
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
    if (!loc.isOpen) return; // disabled — нельзя выбрать закрытую/паузнутую/распроданную
    setLocation(loc.id);
    router.push("/order");
  }

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: 20 }}>
      <h1 style={{ fontSize: 28, marginBlockEnd: 16 }}>Pick a spot</h1>

      {state.k === "loading" && (
        <div style={{ display: "grid", gap: 12 }}>
          {[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 88 }} />)}
        </div>
      )}

      {state.k === "error" && (
        <div className="card" style={{ textAlign: "center" }}>
          <p>Can&apos;t reach GRABZI. Check your connection.</p>
          <button className="btn-primary" onClick={load} style={{ marginBlockStart: 12 }}>Try again</button>
        </div>
      )}

      {state.k === "empty" && (
        <div className="card" style={{ textAlign: "center" }}>No locations yet.</div>
      )}

      {state.k === "ok" && (
        <div style={{ display: "grid", gap: 12 }}>
          {state.items.map((loc) => (
            <button
              key={loc.id}
              onClick={() => choose(loc)}
              disabled={!loc.isOpen}
              className="card"
              style={{
                textAlign: "start", display: "flex", justifyContent: "space-between",
                alignItems: "center", gap: 12, opacity: loc.isOpen ? 1 : 0.6,
                cursor: loc.isOpen ? "pointer" : "not-allowed",
              }}
            >
              <div>
                <div style={{ fontWeight: 800, fontSize: 17 }}>{loc.name}</div>
                <div style={{ color: "var(--color-muted)", fontSize: 14 }}>{loc.address}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                {statusBadge(loc)}
                {loc.isOpen && loc.remaining !== null && (
                  <span style={{ fontSize: 12, color: "var(--color-muted)" }}>
                    {loc.remaining} / {loc.dailyDrinkLimit} drinks
                  </span>
                )}
                {loc.isOpen && loc.remaining === null && (
                  <span style={{ fontSize: 12, color: "var(--color-muted)" }}>No limit</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </main>
  );
}
