"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { Flag } from "@/components/Flag";
import { useStore, getOutlet } from "@/lib/store";
import { api, getToken } from "@/lib/api";
import { emirates } from "@/lib/data";

export default function ProfilePage() {
  const router = useRouter();
  const user = useStore((s) => s.user);
  const setUser = useStore((s) => s.setUser);
  const logout = useStore((s) => s.logout);
  const outletId = useStore((s) => s.selectedOutletId);
  const outlet = getOutlet(outletId);

  // A1: число заказов берём из бэкенда (GET /api/orders), а не из локального стора
  const [orderCount, setOrderCount] = useState<number | null>(null);
  useEffect(() => {
    if (!getToken()) { setOrderCount(0); return; }
    api.myOrders().then((o) => setOrderCount(o.length)).catch(() => setOrderCount(0));
  }, []);

  const [editing, setEditing] = useState(false);
  const [plate, setPlate] = useState(user.defaultCarPlate ?? "");
  const [emirate, setEmirate] = useState(user.defaultEmirate ?? "Dubai");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(user.name ?? "");

  const saveName = async () => {
    const n = nameDraft.trim();
    if (!n) return;
    setUser({ name: n });
    setEditingName(false);
    try {
      const { api } = await import("@/lib/api");
      await api.updateMe({ name: n });
    } catch {}
  };

  if (!user.phone) {
    return (
      <div className="flex-1 flex flex-col">
        <TopBar title="Профиль" />
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <div className="text-6xl mb-4">👋</div>
          <div className="text-h2 mb-2">Войди в Juicy</div>
          <div className="muted text-body mb-6">
            Сохраняй любимые напитки, повторяй заказы в один тап
          </div>
          <Link href="/auth/phone" className="btn-pill btn-primary w-full">
            Войти по телефону
          </Link>
          {/* PUB-A-09 AC1: язык доступен и гостю; выбор сохранится и зафиксируется при регистрации */}
          <div className="grid grid-cols-2 gap-2 w-full mt-6">
            {(["ru", "ar"] as const).map((code) => (
              <button key={code}
                onClick={() => setUser({ preferredLocale: code })}
                className={`h-12 rounded-2xl text-caption font-semibold flex items-center justify-center gap-2 ${
                  user.preferredLocale === code ? "bg-[var(--color-text)] text-white" : "bg-[#F4F4F7]"
                }`}>
                <Flag code={code === "ru" ? "ru" : "ae"} size={20} />
                {code === "ru" ? "Русский" : "العربية"}
              </button>
            ))}
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  const initials = (user.name || "Г")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const save = async () => {
    setUser({ defaultCarPlate: plate, defaultEmirate: emirate });
    setEditing(false);
    try {
      const { api } = await import("@/lib/api");
      await api.updateMe({ carPlate: plate, emirate });
    } catch {}
  };

  const setLocale = async (code: "ru" | "ar") => {
    setUser({ preferredLocale: code });
    try {
      const { api } = await import("@/lib/api");
      await api.updateMe({ locale: code }); // PUB-A-09 AC5: язык хранится в профиле
    } catch {}
  };

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Профиль" />

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {/* Avatar + name */}
        <div className="flex items-center gap-4 py-4">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-h1 font-bold text-white"
            style={{ background: "var(--color-primary-500)" }}
          >
            {initials}
          </div>
          <div className="flex-1">
            {editingName ? (
              <div className="flex gap-2 items-center">
                <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} autoFocus
                       className="flex-1 h-10 px-3 rounded-xl bg-[#F4F4F7] outline-none text-h3" />
                <button onClick={saveName} className="btn-pill btn-primary btn-sm px-4">OK</button>
              </div>
            ) : (
              <button onClick={() => { setNameDraft(user.name ?? ""); setEditingName(true); }}
                      className="text-left">
                <div className="text-h2">{user.name || "Гость"}</div>
                <div className="text-tiny muted">тап чтобы изменить имя</div>
              </button>
            )}
            <div className="text-caption muted">{user.phone}</div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Stat label="Заказов" value={orderCount === null ? "…" : orderCount} icon={<ReceiptIcon />} />
          <Stat
            label="Любимая точка"
            value={outlet?.name ?? "—"}
            icon={<PinIcon />}
            small
          />
        </div>

        {/* Car */}
        <Section title="Машина">
          {editing ? (
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_2fr] gap-2">
                <div className="relative">
                  <select
                    value={emirate}
                    onChange={(e) => setEmirate(e.target.value)}
                    className="appearance-none w-full h-12 rounded-2xl bg-[#F4F4F7] pl-3 pr-9 text-body font-medium outline-none"
                  >
                    {emirates.map((em) => (
                      <option key={em}>{em}</option>
                    ))}
                  </select>
                  <svg
                    aria-hidden
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </div>
                <input
                  value={plate}
                  onChange={(e) =>
                    setPlate(
                      // Keep only Latin letters, digits and spaces, then uppercase
                      e.target.value.replace(/[^a-zA-Z0-9 ]/g, "").toUpperCase()
                    )
                  }
                  placeholder="F 88888"
                  inputMode="text"
                  autoCapitalize="characters"
                  className="min-w-0 h-12 rounded-2xl bg-[#F4F4F7] px-4 text-h3 font-semibold outline-none tracking-wider"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditing(false)}
                  className="btn-pill btn-soft btn-sm flex-1"
                >
                  Отмена
                </button>
                <button onClick={save} className="btn-pill btn-primary btn-sm flex-1">
                  Сохранить
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="w-full rounded-2xl bg-[#F4F4F7] px-4 h-14 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <CarIcon />
                <div className="text-left">
                  {user.defaultCarPlate ? (
                    <>
                      <div className="text-body font-semibold">
                        {user.defaultEmirate} {user.defaultCarPlate}
                      </div>
                      <div className="text-tiny muted">тап чтобы изменить</div>
                    </>
                  ) : (
                    <div className="text-body muted">Добавить номер</div>
                  )}
                </div>
              </div>
              <Chevron />
            </button>
          )}
        </Section>

        <Section title="Язык">
          {/* PUB-A-09: RU/AR, выбор сохраняется в профиле и применяется при следующем входе */}
          <div className="grid grid-cols-2 gap-2">
            {(["ru", "ar"] as const).map((code) => {
              const active = user.preferredLocale === code;
              return (
                <button
                  key={code}
                  onClick={() => setLocale(code)}
                  className={`h-12 rounded-2xl text-caption font-semibold flex items-center justify-center gap-2 ${
                    active ? "bg-[var(--color-text)] text-white" : "bg-[#F4F4F7]"
                  }`}
                >
                  <Flag code={code === "ru" ? "ru" : "ae"} size={20} />
                  {code === "ru" ? "Русский" : "العربية"}
                </button>
              );
            })}
          </div>
        </Section>

        <CouponsSection />

        <button
          onClick={() => {
            logout();
            router.replace("/");
          }}
          className="w-full text-[var(--color-error)] text-body font-semibold py-4 mt-4"
        >
          Выйти
        </button>
      </div>

      <BottomNav />
    </div>
  );
}

function CouponsSection() {
  // PUB-A-04 AC7: купоны видны клиенту в профиле
  const [coupons, setCoupons] = useState<{ id: number; status: string }[]>([]);
  useEffect(() => {
    import("@/lib/api").then(({ api }) =>
      api.coupons().then(setCoupons).catch(() => {})
    );
  }, []);
  const active = coupons.filter((c) => c.status === "active");
  if (active.length === 0) return null;
  return (
    <Section title="Купоны">
      {active.map((c) => (
        <div key={c.id}
             className="rounded-2xl px-4 h-14 flex items-center gap-3 mb-2"
             style={{ background: "var(--color-primary-100, #EAEcfd)" }}>
          <span className="text-xl">🎁</span>
          <div className="flex-1">
            <div className="text-body font-semibold">Бесплатный напиток</div>
            <div className="text-tiny muted">применится при оформлении заказа</div>
          </div>
        </div>
      ))}
    </Section>
  );
}

function Stat({
  label,
  value,
  icon,
  small,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  small?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-[#F4F4F7] p-4">
      <div className="mb-2 text-[var(--color-primary-500)]">{icon}</div>
      <div className={small ? "text-body font-semibold leading-tight" : "text-h2"}>
        {value}
      </div>
      <div className="text-caption muted">{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <div className="text-caption font-semibold muted uppercase tracking-wide mb-2 px-1">
        {title}
      </div>
      {children}
    </div>
  );
}

function LinkRow({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <button className="w-full px-4 h-14 flex items-center gap-3">
      <span className="text-[var(--color-text-muted)]">{icon}</span>
      <span className="text-body flex-1 text-left">{label}</span>
      <Chevron />
    </button>
  );
}

function Chevron() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function ReceiptIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
      <path d="M4 4h16v18l-3-2-3 2-3-2-3 2-4-2z" />
      <path d="M8 9h8M8 13h8M8 17h5" />
    </svg>
  );
}
function PinIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
      <path d="M12 22s8-7.5 8-13a8 8 0 1 0-16 0c0 5.5 8 13 8 13z" />
      <circle cx="12" cy="9" r="3" />
    </svg>
  );
}
function CarIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
      <path d="M3 14l1.5-5.2A2 2 0 0 1 6.4 7h11.2a2 2 0 0 1 1.9 1.8L21 14M3 14h18M3 14v4h2v-1h14v1h2v-4" />
      <circle cx="7.5" cy="17" r="1.5" fill="currentColor" />
      <circle cx="16.5" cy="17" r="1.5" fill="currentColor" />
    </svg>
  );
}
function DocIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M9 13h6M9 17h6" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M7 11V8a5 5 0 1 1 10 0v3" />
    </svg>
  );
}
function ChatIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
      <path d="M21 12a8 8 0 0 1-11.5 7L4 21l1.6-4.5A8 8 0 1 1 21 12z" />
    </svg>
  );
}
