"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError, type Category, type Drink, type Location } from "@/lib/api";
import { useOrderDraft } from "@/lib/store";

type Data = { location: Location; categories: Category[]; drinks: Drink[] };
type State = { k: "loading" } | { k: "error"; msg: string } | { k: "ok"; data: Data };

const ERR_COPY: Record<string, string> = {
  LOCATION_CLOSED: "This spot is closed now.",
  LOCATION_PAUSED: "This spot paused new orders.",
  LOCATION_LIMIT_REACHED: "Sold out for today at this spot.",
  LOCATION_SOLD_OUT: "Sold out for today.",
  DRINK_UNAVAILABLE_AT_LOCATION: "A drink just sold out here.",
  STOCK_LESS_THAN_ORDER: "Only a few left — reduce the quantity.",
  NETWORK: "Can't reach GRABZI. Check your connection.",
};

export default function OrderPage() {
  const locationId = useOrderDraft((s) => s.locationId);
  const items = useOrderDraft((s) => s.items);
  const setQty = useOrderDraft((s) => s.setQty);
  const clear = useOrderDraft((s) => s.clear);
  const router = useRouter();

  const [state, setState] = useState<State>({ k: "loading" });
  const [cat, setCat] = useState<number | null>(null);
  const [phone, setPhone] = useState("");
  const [car, setCar] = useState("");
  const [paying, setPaying] = useState(false);
  const [overlay, setOverlay] = useState<string | null>(null);

  async function load(id: number) {
    setState({ k: "loading" });
    try {
      const [location, categories, drinks] = await Promise.all([
        api.location(id), api.categories(), api.drinks(id),
      ]);
      setState({ k: "ok", data: { location, categories, drinks } });
      setCat(categories[0]?.id ?? null);
    } catch (e) {
      setState({ k: "error", msg: ERR_COPY[(e as ApiError).code] ?? "Something went wrong." });
    }
  }
  useEffect(() => { if (locationId) load(locationId); }, [locationId]);

  const total = useMemo(() => {
    if (state.k !== "ok") return 0;
    return state.data.drinks.reduce((sum, d) => sum + d.basePrice * (items[d.id] ?? 0), 0);
  }, [state, items]);
  const totalDrinks = Object.values(items).reduce((a, b) => a + b, 0);

  if (!locationId) {
    return (
      <main style={{ maxWidth: 640, margin: "0 auto", padding: 20, textAlign: "center" }}>
        <h1 style={{ fontSize: 26, marginBlockEnd: 12 }}>Pick a spot first</h1>
        <Link href="/locations"><button className="btn-primary">Choose location</button></Link>
      </main>
    );
  }

  async function pay() {
    if (state.k !== "ok") return;
    const { location } = state.data;
    if (location.remaining !== null && totalDrinks > location.remaining) {
      setOverlay(`Only ${location.remaining} left here. Reduce your order.`);
      return;
    }
    if (!/^\+?\d{7,15}$/.test(phone)) { setOverlay("Enter a valid phone number."); return; }
    if (!car.trim()) { setOverlay("Add your car plate so we find you."); return; }
    setPaying(true);
    try {
      await api.login(phone.startsWith("+") ? phone : `+${phone}`);
      const order = await api.createOrder({
        locationId: location.id,
        items: Object.entries(items).map(([id, q]) => ({ drinkId: Number(id), quantity: q })),
        carPlate: car.trim().toUpperCase(),
      });
      const co = await api.checkout(order.id);
      clear();
      if (co.mock) router.push(`/orders/${order.id}?paid=1`);
      else window.location.href = co.checkoutUrl;
    } catch (e) {
      setOverlay(ERR_COPY[(e as ApiError).code] ?? "Payment couldn't start.");
    } finally {
      setPaying(false);
    }
  }

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: 20, paddingBlockEnd: 160 }}>
      {state.k === "loading" && (
        <div style={{ display: "grid", gap: 12 }}>
          {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 72 }} />)}
        </div>
      )}

      {state.k === "error" && (
        <div className="card" style={{ textAlign: "center" }}>
          <p>{state.msg}</p>
          <Link href="/locations"><button className="btn-primary" style={{ marginBlockStart: 12 }}>Change location</button></Link>
        </div>
      )}

      {state.k === "ok" && (
        <>
          <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBlockEnd: 14 }}>
            <h1 style={{ fontSize: 24 }}>{state.data.location.name}</h1>
            <span className="badge badge--open">
              {state.data.location.remaining === null ? "No limit" : `${state.data.location.remaining} left`}
            </span>
          </header>

          <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBlockEnd: 16 }}>
            {state.data.categories.map((c) => (
              <button key={c.id} onClick={() => setCat(c.id)}
                style={{
                  border: "none", borderRadius: 9999, paddingInline: 16, paddingBlock: 8,
                  fontWeight: 700, whiteSpace: "nowrap",
                  background: cat === c.id ? "var(--color-brand)" : "var(--color-cream)",
                  color: cat === c.id ? "#fff" : "var(--color-ink)",
                }}>
                {c.name}
              </button>
            ))}
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            {state.data.drinks.filter((d) => d.categoryId === cat).map((d) => {
              const qty = items[d.id] ?? 0;
              return (
                <div key={d.id} className="card" style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
                  opacity: d.soldOut ? 0.5 : 1,
                }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{d.name}</div>
                    <div style={{ color: "var(--color-muted)" }}>AED {d.basePrice}</div>
                  </div>
                  {d.soldOut ? (
                    <span className="badge badge--out">Sold out</span>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <button aria-label="minus" onClick={() => setQty(d.id, qty - 1)}
                        style={stepBtn}>−</button>
                      <span style={{ minWidth: 20, textAlign: "center", fontWeight: 800 }}>{qty}</span>
                      <button aria-label="plus" onClick={() => setQty(d.id, qty + 1)}
                        style={{ ...stepBtn, background: "var(--color-brand)", color: "#fff" }}>+</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* контакты */}
          <div style={{ display: "grid", gap: 10, marginBlockStart: 20 }}>
            <input placeholder="Phone (+9715X XXX XXXX)" value={phone} onChange={(e) => setPhone(e.target.value)}
              style={input} inputMode="tel" />
            <input placeholder="Car plate (e.g. DUBAI A 12345)" value={car} onChange={(e) => setCar(e.target.value)}
              style={input} />
          </div>

          {/* sticky bar оплаты */}
          <div style={{
            position: "fixed", insetInline: 0, insetBlockEnd: 0, background: "#fff",
            borderBlockStart: "1px solid var(--color-border)", padding: 16,
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
          }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>Total AED {total}</div>
            <button className="btn-primary" disabled={totalDrinks === 0 || paying}
              onClick={pay} style={{ minWidth: 180 }}>
              {paying ? "Creating order…" : totalDrinks === 0 ? "Pick a drink" : `Pay AED ${total} ▶`}
            </button>
          </div>
        </>
      )}

      {overlay && (
        <div onClick={() => setOverlay(null)} style={modalBg}>
          <div className="card" style={{ maxWidth: 320, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <p>{overlay}</p>
            <button className="btn-primary" onClick={() => setOverlay(null)} style={{ marginBlockStart: 12 }}>OK</button>
          </div>
        </div>
      )}
    </main>
  );
}

const stepBtn: React.CSSProperties = {
  inlineSize: 36, blockSize: 36, borderRadius: 9999, border: "1px solid var(--color-border)",
  background: "var(--color-cream)", fontSize: 20, fontWeight: 800, lineHeight: 1,
};
const input: React.CSSProperties = {
  padding: 12, borderRadius: 12, border: "1px solid var(--color-border)", fontSize: 15,
};
const modalBg: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex",
  alignItems: "center", justifyContent: "center", padding: 24, zIndex: 50,
};
