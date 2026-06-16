"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { api, ApiError, type Drink, type Location } from "@/lib/api";
import { useOrderDraft } from "@/lib/store";
import { maskName, maskPhoneUAE, maskPlate, normalizePhoneUAE, isPhoneComplete } from "@/lib/masks";
import { Icon } from "@/components/Icon";
import { TopBrand } from "@/components/TopBrand";
import { type WeekHours, todayHours, weeklyHours } from "@/lib/hours";
import { statusBadge, statusInfo, themeFor } from "@/lib/outletStatus";
import { useReveal } from "@/lib/useReveal";

/** Число количества с GSAP-«пружинкой» при изменении (snappy back.out). */
function QtyNum({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    gsap.fromTo(ref.current, { scale: 1.45 }, { scale: 1, duration: 0.35, ease: "back.out(3)" });
  }, [value]);
  return (
    <span ref={ref} className="display" style={{ minWidth: 28, textAlign: "center", display: "inline-block" }}>
      {value}
    </span>
  );
}

type Data = { location: Location; drinks: Drink[]; outlets: Location[] };
type State = { k: "loading" } | { k: "error"; msg: string } | { k: "ok"; data: Data };

const ERR_COPY: Record<string, string> = {
  // реальные коды бэкенда (C1/X2: понятное сообщение про недоступный напиток)
  DRINK_NOT_AVAILABLE: "A drink in your cart isn't available at this spot. We've removed it — review and pay again.",
  ADDON_NOT_AVAILABLE: "An add-on isn't available at this spot.",
  OUTLET_CLOSED: "This spot just closed for orders.",
  OUTLET_REQUIRED: "Choose a spot first.",
  OUTLET_INVALID: "This spot is unavailable right now.",
  CAR_PLATE_REQUIRED: "Add your car plate so we can find you.",
  COUPON_ALREADY_RESERVED: "Your coupon is held on another unpaid order.",
  COUPON_INVALID: "This coupon can't be used.",
  ALREADY_PAID: "This order is already paid.",
  ORDER_NUMBER_CONFLICT: "We're busy right now — tap Pay again.",
  // легаси/совместимость
  LOCATION_CLOSED: "This spot is closed now.",
  LOCATION_PAUSED: "This spot paused new orders.",
  LOCATION_LIMIT_REACHED: "Sold out for today at this spot.",
  LOCATION_SOLD_OUT: "Sold out for today.",
  DRINK_UNAVAILABLE_AT_LOCATION: "A drink just sold out here.",
  STOCK_LESS_THAN_ORDER: "Only a few left — reduce the quantity.",
  NETWORK: "Can't reach GRABZI. Check your connection.",
};

/** Карточка выбранной точки в стиле .loc (как на /locations): цветовая тема, метр LEFT TODAY
 *  с прогресс-баром, статус с точкой, часы работы (сегодня/неделя) + переключатель точек. */
function SelectedLocationCard({ loc, outlets, onSwitch }: {
  loc: Location; outlets: Location[]; onSwitch: (id: number) => void;
}) {
  const [showHours, setShowHours] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [fillW, setFillW] = useState(0);
  const wh = (loc.workingHours ?? {}) as WeekHours;
  const idx = Math.max(0, outlets.findIndex((o) => o.id === loc.id));
  const theme = themeFor(idx);
  const others = outlets.filter((o) => o.id !== loc.id);
  const limited = loc.dailyDrinkLimit !== null && loc.remaining !== null;
  const pct = limited ? Math.max(0, Math.min(100, Math.round((loc.remaining! / loc.dailyDrinkLimit!) * 100))) : 100;
  const st = statusInfo(loc);

  // анимация заливки прогресс-бара (как на /locations): 0 → pct после монтирования
  useEffect(() => {
    const id = setTimeout(() => setFillW(pct), 90);
    return () => clearTimeout(id);
  }, [pct]);

  return (
    <div className="loc rise" style={{ ...theme, marginBlock: 16 }}>
      {st.soldOut && <span className="loc__ribbon">SOLD OUT</span>}

      <div className="loc__top">
        <div>
          <div className="loc__name">{loc.name}</div>
          {loc.address && <div className="loc__city">{loc.address}</div>}
        </div>
        {others.length > 0 && (
          <button className="loc__go" onClick={() => setSwitchOpen((v) => !v)}
            style={{ background: "transparent", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}>
            Change
            <Icon name="chevron-right" size={14} stroke={2.6}
              style={{ transform: `rotate(${switchOpen ? -90 : 90}deg)`, transition: "transform .15s" }} />
          </button>
        )}
      </div>

      <div className="loc__meter">
        <div className="loc__meterhead">
          <span className="loc__label">{limited ? "LEFT TODAY" : "MADE TODAY"}</span>
          <span className="loc__count">
            <b>{limited ? loc.remaining : loc.soldToday}</b>
            {limited && <span className="slash"> / {loc.dailyDrinkLimit}</span>}
          </span>
        </div>
        {limited && <div className="loc__bar"><div className="loc__fill" style={{ width: `${fillW}%` }} /></div>}
        <div className="loc__status">
          <span className="loc__dot" />
          <span>{limited ? st.msg : "No daily limit — always pouring"}</span>
        </div>
      </div>

      {/* переключатель точек (раскрывается из «Change») */}
      {switchOpen && others.length > 0 && (
        <div style={{ marginBlockStart: 14, display: "grid", gap: 8 }}>
          {others.map((o) => {
            const [oLabel, oCls] = statusBadge(o);
            return (
              <button key={o.id} onClick={() => onSwitch(o.id)}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
                  background: "var(--color-cream-yellow)", border: "1px solid var(--color-border)", borderRadius: 14, padding: "12px 14px", textAlign: "start" }}>
                <span style={{ display: "grid", minWidth: 0 }}>
                  <span className="display" style={{ fontSize: 16, textTransform: "uppercase", color: "var(--color-ink)" }}>{o.name}</span>
                  {o.address && <span style={{ color: "var(--color-muted)", fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.address}</span>}
                </span>
                <span style={{ display: "inline-flex", gap: 8, alignItems: "center", whiteSpace: "nowrap" }}>
                  <span className={`badge ${oCls}`} style={{ fontSize: 11 }}>{oLabel}</span>
                  <Icon name="chevron-right" size={16} stroke={2.4} style={{ color: "var(--color-brand)" }} />
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* часы работы (сегодня + неделя) — как на карточке /locations */}
      <div className="loc__hours">
        <button className="loc__hourstoggle" onClick={() => setShowHours((v) => !v)}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
            <Icon name="clock" size={16} stroke={2} /> Today {todayHours(wh, loc.timezone ?? undefined)}
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

export default function OrderPage() {
  const locationId = useOrderDraft((s) => s.locationId);
  const items = useOrderDraft((s) => s.items);
  const setQty = useOrderDraft((s) => s.setQty);
  const clear = useOrderDraft((s) => s.clear);
  const pruneItems = useOrderDraft((s) => s.pruneItems);
  const setLocation = useOrderDraft((s) => s.setLocation);
  const router = useRouter();

  const [state, setState] = useState<State>({ k: "loading" });
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [car, setCar] = useState("");
  const [paying, setPaying] = useState(false);
  const [overlay, setOverlay] = useState<string | null>(null);
  // ошибки полей — инлайн под каждым полем, без блокирующей модалки
  const [fieldErr, setFieldErr] = useState<{ name?: string; phone?: string; car?: string }>({});
  // GSAP-появление списка напитков + формы (на загрузке и при смене точки)
  const drinksReveal = useReveal<HTMLDivElement>([state.k === "ok"]);

  async function load(id: number) {
    setState({ k: "loading" });
    try {
      const [outlets, drinks] = await Promise.all([api.locations(), api.drinks(id)]);
      const location = outlets.find((o) => o.id === id);
      if (!location) { setState({ k: "error", msg: "This spot is unavailable right now." }); return; }
      // C1/X2: после смены точки в корзине могли остаться напитки, которых нет в её меню
      // (стоп-лист точки) — убираем их, чтобы оплата не падала с непонятной ошибкой.
      pruneItems(drinks.map((d) => d.id));
      setState({ k: "ok", data: { location, drinks, outlets } });
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
    // WEB-2: точка должна принимать заказы (paused/closed/sold-out/!acceptingOrders → стоп)
    const info = statusInfo(location);
    if (!info.orderable) { setOverlay(info.msg); return; }
    // гард по остатку — остаётся модалкой (это не ошибка поля)
    if (location.remaining !== null && totalDrinks > location.remaining) {
      setOverlay(`Only ${location.remaining} left here. Reduce your order.`); return;
    }
    // валидация полей — инлайн под каждым полем, не блокирующая модалка
    const errs: { name?: string; phone?: string; car?: string } = {};
    if (!name.trim()) errs.name = "Enter your name.";
    if (!isPhoneComplete(phone)) errs.phone = "Enter a valid UAE phone number (9 digits).";
    // PLATE-2: нужен реальный номер — минимум 2 цифры (раньше проходила «12» и пустой код)
    if ((car.match(/\d/g) ?? []).length < 2) errs.car = "Add a valid car plate (e.g. A 12345).";
    setFieldErr(errs);
    if (errs.name || errs.phone || errs.car) return;
    setPaying(true);
    try {
      await api.login(normalizePhoneUAE(phone), name.trim() || undefined);
      const order = await api.createOrder({
        locationId: location.id,
        items: Object.entries(items).map(([id, q]) => ({ drinkId: Number(id), quantity: q })),
        carPlate: car.trim(),
        customerName: name.trim() || undefined,
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
      <TopBrand />
      {/* шапка: тающий лёд (брендовая иконка) + ICE V'60 */}
      <header style={{ textAlign: "center", paddingBlock: 8 }}>
        <Icon name="cup" size={48} style={{ color: "var(--color-brand)" }} />
        <h1 className="display" style={{ fontSize: 38, letterSpacing: ".02em" }}>ICE V&apos;60</h1>
      </header>

      {/* выбранная точка: статус + часы работы + переключатель точек (key → сброс раскрытий при смене) */}
      {state.k === "ok" && (
        <SelectedLocationCard key={state.data.location.id}
          loc={state.data.location} outlets={state.data.outlets}
          onSwitch={(id) => setLocation(id)} />
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
          <div ref={drinksReveal} className="card" style={{ padding: 0, overflow: "hidden" }}>
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
                      <QtyNum value={qty} />
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
                <label className="field-label">YOUR NAME *</label>
                <input className="field-input" value={name}
                  onChange={(e) => { setName(maskName(e.target.value)); setFieldErr((p) => ({ ...p, name: undefined })); }}
                  autoComplete="name" placeholder="Your name" aria-invalid={!!fieldErr.name}
                  style={{ marginBlockStart: 6 }} />
                {fieldErr.name && <p style={fieldErrText}>{fieldErr.name}</p>}
              </div>
              <div>
                <label className="field-label">CAR NUMBER *</label>
                {/* маска номера авто ОАЭ: 0–2 буквы + до 5 цифр → «A 12345» */}
                <input className="field-input" value={car}
                  onChange={(e) => { setCar(maskPlate(e.target.value)); setFieldErr((p) => ({ ...p, car: undefined })); }}
                  autoComplete="off" placeholder="A 12345" aria-invalid={!!fieldErr.car}
                  style={{ marginBlockStart: 6, letterSpacing: ".04em" }} />
                {fieldErr.car && <p style={fieldErrText}>{fieldErr.car}</p>}
              </div>
              <div>
                <label className="field-label">PHONE NUMBER *</label>
                {/* маска ОАЭ: показываем «+971 50 123 4567», на бэк уходит +9715XXXXXXXX */}
                <input className="field-input" value={phone}
                  onChange={(e) => { setPhone(maskPhoneUAE(e.target.value)); setFieldErr((p) => ({ ...p, phone: undefined })); }}
                  inputMode="tel" autoComplete="tel" placeholder="+971 50 123 4567" aria-invalid={!!fieldErr.phone}
                  style={{ marginBlockStart: 6 }} />
                {fieldErr.phone && <p style={fieldErrText}>{fieldErr.phone}</p>}
              </div>
              <button className="btn-block"
                disabled={totalDrinks === 0 || paying || !statusInfo(state.data.location).orderable}
                onClick={pay}>
                {paying ? "Creating order…"
                  : !statusInfo(state.data.location).orderable ? statusInfo(state.data.location).msg
                  : totalDrinks === 0 ? "Pick a drink"
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
// инлайн-ошибка поля: мелкий красный текст под инпутом
const fieldErrText: React.CSSProperties = {
  color: "var(--color-danger)", fontSize: 12.5, fontWeight: 600, marginBlockStart: 6,
};
