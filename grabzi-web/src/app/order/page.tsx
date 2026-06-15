"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError, type Drink, type Location } from "@/lib/api";
import { useOrderDraft } from "@/lib/store";

type Data = { location: Location; drinks: Drink[] };
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
  const [phone, setPhone] = useState("");
  const [car, setCar] = useState("");
  const [paying, setPaying] = useState(false);
  const [overlay, setOverlay] = useState<string | null>(null);

  async function load(id: number) {
    setState({ k: "loading" });
    try {
      const [location, drinks] = await Promise.all([api.location(id), api.drinks(id)]);
      setState({ k: "ok", data: { location, drinks } });
    } catch (e) {
      setState({ k: "error", msg: ERR_COPY[(e as ApiError).code] ?? "Something went wrong." });
    }
  }
  useEffect(() => { if (locationId) load(locationId); }, [locationId]);

  const total = useMemo(() => {
    if (state.k !== "ok") return 0;
    return state.data.drinks.reduce((s, d) => s + d.basePrice * (items[d.id] ?? 0), 0);
  }, [state, items]);
  const totalDrinks = Object.values(items).reduce((a, b) => a + b, 0);

  if (!locationId) {
    return (
      <main style={wrap}>
        <h1 style={{ fontSize: 26, textAlign: "center", marginBlockEnd: 14 }}>Pick a spot first</h1>
        <div style={{ textAlign: "center" }}>
          <Link href="/locations"><button className="btn-primary">Choose location</button></Link>
        </div>
      </main>
    );
  }

  async function pay() {
    if (state.k !== "ok") return;
    const { location } = state.data;
    if (location.remaining !== null && totalDrinks > location.remaining) {
      setOverlay(`Only ${location.remaining} left here. Reduce your order.`); return;
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
    } finally { setPaying(false); }
  }

  return (
    <main style={wrap}>
      {/* шапка: тающий лёд (брендовая иконка) + ICE V'60 */}
      <header style={{ textAlign: "center", paddingBlock: 8 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/ice.png" alt="" aria-hidden style={{ width: 56, height: 56, objectFit: "contain", margin: "0 auto" }} />
        <h1 className="display" style={{ fontSize: 38, letterSpacing: ".02em" }}>ICE V&apos;60</h1>
      </header>

      {/* TODAY'S LIMIT */}
      {state.k === "ok" && (
        <div className="limit-card" style={{ marginBlock: 16 }}>
          <div className="limit-title">TODAY&apos;S LIMIT</div>
          <div className="limit-value">
            {state.data.location.dailyDrinkLimit === null
              ? `${state.data.location.soldToday} · No limit`
              : `${state.data.location.soldToday} / ${state.data.location.dailyDrinkLimit}`}
          </div>
        </div>
      )}

      {state.k === "loading" && (
        <div style={{ display: "grid", gap: 10 }}>
          {[0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton" style={{ height: 64 }} />)}
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
          {/* белый список напитков со степперами */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {state.data.drinks.map((d, idx) => {
              const qty = items[d.id] ?? 0;
              return (
                <div key={d.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                  padding: "16px 18px",
                  borderBlockStart: idx ? "1px solid var(--color-border)" : "none",
                  opacity: d.soldOut ? 0.5 : 1,
                }}>
                  <div>
                    <div className="display" style={{ fontSize: 18, textTransform: "uppercase" }}>{d.name}</div>
                    <div style={{ color: "var(--color-brand)", fontStyle: "italic", fontWeight: 700, fontSize: 13 }}>
                      {d.basePrice} AED
                    </div>
                  </div>
                  {d.soldOut ? (
                    <span className="badge badge--out">Sold out</span>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <button aria-label="minus" onClick={() => setQty(d.id, qty - 1)}
                        style={{ ...step, background: qty > 0 ? "var(--color-cream-yellow)" : "var(--color-paper)" }}>−</button>
                      <span style={{ minWidth: 28, textAlign: "center" }}
                        className="display">{qty}</span>
                      <button aria-label="plus" onClick={() => setQty(d.id, qty + 1)}
                        style={{ ...step, background: "var(--color-paper)" }}>+</button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* поля контактов внутри карточки (как на референсе) */}
            <div style={{ padding: 18, display: "grid", gap: 14, borderBlockStart: "1px solid var(--color-border)" }}>
              <div>
                <label className="field-label">CAR NUMBER *</label>
                <input className="field-input" value={car} onChange={(e) => setCar(e.target.value)}
                  placeholder="DUBAI A 12345" style={{ marginBlockStart: 6 }} />
              </div>
              <div>
                <label className="field-label">PHONE NUMBER *</label>
                <input className="field-input" value={phone} onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel" placeholder="+9715X XXX XXXX" style={{ marginBlockStart: 6 }} />
              </div>
              <button className="btn-block" disabled={totalDrinks === 0 || paying} onClick={pay}>
                {paying ? "Creating order…" : totalDrinks === 0 ? "Pick a drink"
                  : `Proceed to Payment · AED ${total}`}
              </button>
            </div>
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

const wrap: React.CSSProperties = { maxWidth: 640, margin: "0 auto", padding: 20, paddingBlockEnd: 40 };
const step: React.CSSProperties = {
  inlineSize: 40, blockSize: 40, borderRadius: 12, border: "1px solid var(--color-border)",
  color: "var(--color-brand)", fontSize: 22, fontWeight: 800, lineHeight: 1,
};
const modalBg: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex",
  alignItems: "center", justifyContent: "center", padding: 24, zIndex: 50,
};
