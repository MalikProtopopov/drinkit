"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell, useAdmin } from "@/components/admin/AdminShell";
import { ConfirmDialog, Modal, Toggle, useToast } from "@/components/admin/AdminUI";
import {
  adminApi, adminOrdersWs, catalogApi, outletApi,
  type AdminAddon, type AdminDrink, type AdminOutlet, type DrinkCat,
  type I18n, type OutletEventRow, type OutletHours, type OutletPriority,
  type OutletStopList, type Staff,
} from "@/lib/adminApi";
import { useLiveReload } from "@/lib/useLiveReload";

type Tab = "main" | "hours" | "staff" | "menu" | "audit";

const TAB_LABEL: Record<Tab, string> = {
  main: "General", hours: "Schedule", staff: "Staff", menu: "Outlet menu", audit: "History",
};

// keys "0".."6" = ÐÐ½..ÐÑ
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const ROLE_LABEL: Record<string, string> = { super_admin: "Super admin", manager: "Manager", screen: "Pickup screen" };
const oName = (n: I18n) => n.en ?? n.ru ?? n.ar ?? "â";
const fmt = (s?: string | null) =>
  s ? new Date(/[Z+]/.test(s) ? s : s + "Z").toLocaleString("en-GB",
    { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "â";
// Ð²ÑÐµÐ¼Ñ Ð² ÑÐ°Ð¹Ð¼Ð·Ð¾Ð½Ðµ ÑÐ¾ÑÐºÐ¸ (Ð° Ð½Ðµ Ð±ÑÐ°ÑÐ·ÐµÑÐ°) â Ð´Ð»Ñ Â«Ð¾ÑÐºÑÐ¾ÐµÑÑÑ/ÑÐ±ÑÐ¾ÑÐ¸ÑÑÑÂ»
const fmtTz = (iso: string | null | undefined, tz: string, withDay = false) =>
  iso ? new Date(iso).toLocaleString("en-GB", {
    timeZone: tz, hour: "2-digit", minute: "2-digit", ...(withDay ? { weekday: "short" } : {}) }) : "";

// ÑÐ°ÑÑÑÐµ ÑÐ°Ð¹Ð¼Ð·Ð¾Ð½Ñ (Ð²Ð¼ÐµÑÑÐ¾ ÑÐ²Ð¾Ð±Ð¾Ð´Ð½Ð¾Ð³Ð¾ Ð²Ð²Ð¾Ð´Ð° â Ð·Ð°ÑÐ¸ÑÐ° Ð¾Ñ Ð¾Ð¿ÐµÑÐ°ÑÐ¾Ðº, Ð»Ð¾Ð¼Ð°ÑÑÐ¸Ñ ÑÐ°ÑÑÑÑ ÑÑÐ°ÑÑÑÐ°)
const TIMEZONES = ["Asia/Dubai", "Asia/Riyadh", "Asia/Qatar", "Asia/Kuwait", "Asia/Muscat",
  "Asia/Bahrain", "Europe/Moscow", "UTC"];

// ÑÐµÐ»Ð¾Ð²ÐµÐºÐ¾ÑÐ¸ÑÐ°ÐµÐ¼ÑÐµ Ð½Ð°Ð·Ð²Ð°Ð½Ð¸Ñ ÑÐ¾Ð±ÑÑÐ¸Ð¹ Ð°ÑÐ´Ð¸ÑÐ°
const EVENT_LABEL: Record<string, string> = {
  activated: "Outlet enabled", deactivated: "Outlet disabled",
  paused: "Paused", resumed: "Resumed",
  hours_changed: "Schedule changed", limit_changed: "Daily limit changed",
  limit_reached: "Daily limit reached",
  staff_attached: "Staff attached", staff_detached: "Staff detached",
  stop_added: "Added to stop list", stop_removed: "Removed from stop list",
};

// Ð¾Ð¿Ð¸ÑÐ°Ð½Ð¸Ðµ Ð´Ð½Ñ ÑÐ°ÑÐ¿Ð¸ÑÐ°Ð½Ð¸Ñ
const describeDay = (iv?: { open: string; close: string }[]) =>
  !iv || iv.length === 0 ? "day off"
  : iv.length === 1 && iv[0].open === "00:00" && iv[0].close === "24:00" ? "24/7"
  : iv.map((x) => `${x.open}â${x.close}`).join(", ");

const ERR_HUMAN: Record<string, string> = {
  OUTLET_HOURS_INVALID: "Invalid hours: closing time must be later than opening time",
  LAST_ACTIVE_OUTLET: "Can't disable the last active outlet",
  MULTIPLE_ACTIVE_NOT_SUPPORTED: "An active outlet already exists â multiple active outlets aren't supported",
  STAFF_NEEDS_OUTLET: "The staff member would have 0 outlets â attach them to another one first",
};

function Inner({ id }: { id: number }) {
  const { staff } = useAdmin();
  const [outlet, setOutlet] = useState<AdminOutlet | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<Tab>("main");

  const reload = useCallback(() => {
    outletApi.get(id).then(setOutlet).catch(() => setNotFound(true));
  }, [id]);
  useEffect(() => { reload(); }, [reload]);

  // realtime: ÑÑÑÑÑÐ¸Ðº Â«Ð½Ð°Ð¿Ð¸ÑÐºÐ¾Ð² ÑÐµÐ³Ð¾Ð´Ð½ÑÂ», ÑÑÐ°ÑÑÑ Ð¸ Ð°Ð²ÑÐ¾-Ð¿Ð°ÑÐ·Ð° Ð¾Ð±Ð½Ð¾Ð²Ð»ÑÑÑÑÑ Ð¿Ð¾ ÑÐ¾Ð±ÑÑÐ¸ÑÐ¼ Ð·Ð°ÐºÐ°Ð·Ð¾Ð²
  // ÑÑÐ¾Ð¹ ÑÐ¾ÑÐºÐ¸ (Ð¾Ð¿Ð»Ð°ÑÐ°/ÑÐ¼ÐµÐ½Ð° ÑÑÐ°ÑÑÑÐ°) â Ð±ÐµÐ· Ð¿Ð¾Ð»Ð»Ð¸Ð½Ð³Ð° Ð¸ ÐºÐ½Ð¾Ð¿ÐºÐ¸ Â«ÐÐ±Ð½Ð¾Ð²Ð¸ÑÑÂ»
  useLiveReload({
    connect: adminOrdersWs,
    onMessage: (m) => {
      const e = m as { outletId?: number | null };
      if (e?.outletId == null || e.outletId === id) reload();
    },
    onSync: reload,
  });

  if (staff?.role !== "super_admin")
    return <div className="admin-panel"><div className="admin-panel-body admin-meta">
      This section is available to super admins only.</div></div>;
  if (notFound) return <div className="admin-meta">Outlet not found</div>;
  if (!outlet) return <div className="admin-meta">Loadingâ¦</div>;

  return (
    <>
      <StatusBanner outlet={outlet} onSaved={setOutlet} onGotoTab={setTab} />

      <div className="admin-tabs">
        {(["main", "hours", "staff", "menu", "audit"] as Tab[]).map((t) => (
          <button key={t} className="admin-tab" data-active={tab === t} onClick={() => setTab(t)}>
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {tab === "main" && <MainTab outlet={outlet} onSaved={setOutlet} />}
      {tab === "hours" && <HoursTab outlet={outlet} onSaved={setOutlet} />}
      {tab === "staff" && <StaffTab outlet={outlet} onChanged={setOutlet} />}
      {tab === "menu" && <MenuTab outletId={id} />}
      {tab === "audit" && <AuditTab outletId={id} />}
    </>
  );
}

/* ---------------- STATUS BANNER (ÐµÐ´Ð¸Ð½ÑÐ¹ Ð±Ð»Ð¾Ðº ÑÐ¾ÑÑÐ¾ÑÐ½Ð¸Ñ) ---------------- */
const STATUS_TONE: Record<AdminOutlet["status"], { bg: string; fg: string; dot: string; label: string }> = {
  open: { bg: "#EAF6EE", fg: "#15803D", dot: "ð¢", label: "Open" },
  paused: { bg: "#FDF4E3", fg: "#B45309", dot: "ð¡", label: "Paused" },
  closed: { bg: "#F1F2F5", fg: "#5A6172", dot: "âª", label: "Closed" },
  inactive: { bg: "#FCEBEA", fg: "#A12822", dot: "ð´", label: "Disabled" },
};

function StatusBanner({ outlet, onSaved, onGotoTab }: {
  outlet: AdminOutlet; onSaved: (o: AdminOutlet) => void; onGotoTab: (t: Tab) => void;
}) {
  const toast = useToast();
  const [confirmDeact, setConfirmDeact] = useState(false);
  const [confirmAct, setConfirmAct] = useState(false);
  const [forceActivate, setForceActivate] = useState(false);
  const [busy, setBusy] = useState(false);
  const tz = outlet.timezone;

  const run = async (fn: () => Promise<AdminOutlet>, ok?: string, tone?: "warn") => {
    setBusy(true);
    try { onSaved(await fn()); if (ok) toast(ok, tone); }
    catch (e) {
      const msg = e instanceof Error ? e.message : "Error";
      if (msg === "MULTIPLE_ACTIVE_NOT_SUPPORTED" && !forceActivate) {
        setForceActivate(true); setConfirmAct(true); return;
      }
      toast(ERR_HUMAN[msg] ?? msg, "warn");
    } finally { setBusy(false); }
  };

  const t = STATUS_TONE[outlet.status];
  // Ð¿ÑÐ¸ÑÐ¸Ð½Ð° + Ð¿Ð¾Ð´ÑÐºÐ°Ð·ÐºÐ° + ÐºÐ½Ð¾Ð¿ÐºÐ°-Ð¸ÑÐ¿ÑÐ°Ð²Ð»ÐµÐ½Ð¸Ðµ Ð¿Ð¾ statusReason (ÐÐ¸Ð»ÑÑÐµÐ½ #1/#9)
  let hint = "";
  let fix: { label: string; on: () => void } | null = null;
  if (outlet.statusReason === "open") {
    hint = outlet.closesAt ? `accepting orders Â· today until ${fmtTz(outlet.closesAt, tz)}`
      : Object.keys(outlet.hours ?? {}).length === 0 ? "accepting orders Â· 24/7 (no schedule set)"
      : "accepting orders Â· 24/7 today";
  } else if (outlet.statusReason === "paused_manual") {
    hint = "orders paused manually";
    fix = { label: "Resume orders",
            on: () => run(() => outletApi.update(outlet.id, { acceptingOrders: true }), "Orders resumed") };
  } else if (outlet.statusReason === "paused_limit") {
    hint = `daily limit reached ${outlet.drinksToday}/${outlet.dailyDrinkLimit}`
      + (outlet.resetsAt ? ` Â· resets at ${fmtTz(outlet.resetsAt, tz)}` : "");
    fix = { label: "Change limit", on: () => onGotoTab("main") };
  } else if (outlet.statusReason === "closed") {
    hint = outlet.opensAt ? `outside working hours Â· opens ${fmtTz(outlet.opensAt, tz, true)}` : "outside working hours";
    fix = { label: "Edit schedule", on: () => onGotoTab("hours") };
  } else {
    hint = "outlet is disabled â hidden from the site and not accepting orders";
    fix = { label: "Enable outlet", on: () => { setForceActivate(false); setConfirmAct(true); } };
  }

  return (
    <div style={{ background: t.bg, borderRadius: 14, padding: 16, marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: "#15171c" }}>{oName(outlet.name)}</div>
          <div style={{ marginTop: 4, color: t.fg, fontWeight: 700 }}>{t.dot} {t.label}</div>
          <div className="admin-meta" style={{ marginTop: 2 }}>{hint}</div>
        </div>
        {fix && (
          <button className="admin-btn sm" onClick={fix.on} disabled={busy} style={{ background: "#FFF", flex: "none" }}>
            {fix.label}
          </button>
        )}
      </div>

      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap",
             marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(0,0,0,.08)" }}>
        {/* Ð¼Ð°ÑÑÐµÑ-Ð²ÑÐºÐ»ÑÑÐ°ÑÐµÐ»Ñ: ÑÐ°Ð±Ð¾ÑÐ°ÐµÑ Ð»Ð¸ ÑÐ¾ÑÐºÐ° Ð²Ð¾Ð¾Ð±ÑÐµ */}
        {outlet.isActive ? (
          <button className="admin-btn danger sm" disabled={busy} onClick={() => setConfirmDeact(true)}>
            Disable outlet
          </button>
        ) : (
          <button className="admin-btn primary sm" disabled={busy}
                  onClick={() => { setForceActivate(false); setConfirmAct(true); }}>
            Enable outlet
          </button>
        )}
        {/* ÑÑÑÐ½Ð°Ñ Ð¿Ð°ÑÐ·Ð°: Ð¿ÑÐ¸Ð½Ð¸Ð¼Ð°ÐµÑ Ð»Ð¸ Ð·Ð°ÐºÐ°Ð·Ñ Ð¿ÑÑÐ¼Ð¾ ÑÐµÐ¹ÑÐ°Ñ (ÑÐ¾Ð»ÑÐºÐ¾ Ñ Ð²ÐºÐ»ÑÑÑÐ½Ð½Ð¾Ð¹ ÑÐ¾ÑÐºÐ¸) */}
        {outlet.isActive && (
          <Toggle on={outlet.acceptingOrders}
                  label={outlet.acceptingOrders ? "Accepting orders" : "Orders paused"}
                  onChange={(v) => run(() => outletApi.update(outlet.id, { acceptingOrders: v }),
                                       v ? "Orders resumed" : "Outlet paused", v ? undefined : "warn")} />
        )}
        <span className="admin-meta" style={{ marginLeft: "auto" }}>
          Today: {outlet.drinksToday}{outlet.dailyDrinkLimit != null ? ` / ${outlet.dailyDrinkLimit}` : ""} drinks
        </span>
      </div>

      <ConfirmDialog open={confirmDeact} title="Disable outlet?"
        message="The outlet will stop accepting orders and disappear from the public site. Active orders will remain. You can enable it again later."
        confirmLabel="Disable" danger
        onCancel={() => setConfirmDeact(false)}
        onConfirm={() => { setConfirmDeact(false); run(() => outletApi.deactivate(outlet.id), "Outlet disabled", "warn"); }} />

      <ConfirmDialog open={confirmAct}
        title={forceActivate ? "Enable a second active outlet?" : "Enable outlet?"}
        message={forceActivate
          ? "The public site doesn’t have an outlet switcher yet â customers will see the menu of only one outlet. Enable the second active outlet anyway?"
          : "The outlet will become active and start accepting orders on schedule."}
        confirmLabel="Enable"
        onCancel={() => { setConfirmAct(false); setForceActivate(false); }}
        onConfirm={() => { const f = forceActivate; setConfirmAct(false); setForceActivate(false); run(() => outletApi.activate(outlet.id, f), "Outlet enabled"); }} />
    </div>
  );
}

/* ---------------- MAIN ---------------- */
function MainTab({ outlet, onSaved }: {
  outlet: AdminOutlet; onSaved: (o: AdminOutlet) => void;
}) {
  const toast = useToast();
  const [nameEn, setNameEn] = useState(outlet.name.en ?? "");
  const [nameAr, setNameAr] = useState(outlet.name.ar ?? "");
  const [address, setAddress] = useState(outlet.address ?? "");
  const [emirate, setEmirate] = useState(outlet.emirate ?? "");
  const [phone, setPhone] = useState(outlet.phone ?? "");
  const [email, setEmail] = useState(outlet.email ?? "");
  const [lat, setLat] = useState(outlet.lat != null ? String(outlet.lat) : "");
  const [lng, setLng] = useState(outlet.lng != null ? String(outlet.lng) : "");
  const [timezone, setTimezone] = useState(outlet.timezone);
  const [limit, setLimit] = useState(outlet.dailyDrinkLimit != null ? String(outlet.dailyDrinkLimit) : "");
  const [sort, setSort] = useState(String(outlet.sort));
  const [saving, setSaving] = useState(false);

  const tzOptions = TIMEZONES.includes(timezone) ? TIMEZONES : [timezone, ...TIMEZONES];

  const save = async () => {
    if (!nameEn.trim()) { toast("Enter the outlet name", "warn"); return; }
    // Ð»Ð¸Ð¼Ð¸Ñ: Ð¿ÑÑÑÐ¾ = Ð±ÐµÐ· Ð»Ð¸Ð¼Ð¸ÑÐ°, Ð¸Ð½Ð°ÑÐµ ÑÐµÐ»Ð¾Ðµ â¥ 0 (Ð·Ð°ÑÐ¸ÑÐ° Ð¾Ñ Ð¼ÑÑÐ¾ÑÐ° â 422)
    let dailyDrinkLimit: number | null = null;
    if (limit.trim() !== "") {
      const n = Number(limit);
      if (!Number.isInteger(n) || n < 0) { toast("Limit must be an integer â¥ 0, or empty", "warn"); return; }
      dailyDrinkLimit = n;
    }
    const latN = lat.trim() === "" ? null : Number(lat);
    const lngN = lng.trim() === "" ? null : Number(lng);
    if ((latN != null && Number.isNaN(latN)) || (lngN != null && Number.isNaN(lngN))) {
      toast("Coordinates must be numbers", "warn"); return;
    }
    setSaving(true);
    try {
      const o = await outletApi.update(outlet.id, {
        name: { ...(outlet.name ?? {}), en: nameEn.trim() || undefined, ar: nameAr.trim() || undefined },
        address: address.trim() || null, emirate: emirate.trim() || null,
        phone: phone.trim() || null, email: email.trim() || null,
        lat: latN, lng: lngN, timezone: timezone || outlet.timezone,
        dailyDrinkLimit, sort: Number(sort) || 0,
      });
      onSaved(o);
      toast("Outlet saved");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error";
      toast(ERR_HUMAN[msg] ?? msg, "warn");
    } finally { setSaving(false); }
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="admin-panel">
        <div className="admin-panel-head"><div className="admin-panel-title">Profile</div></div>
        <div className="admin-panel-body">
          <div className="admin-grid-2">
            <div className="admin-field">
              <label className="admin-label">Name (EN)</label>
              <input className="admin-input" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
            </div>
            <div className="admin-field">
              <label className="admin-label">Name (AR)</label>
              <input className="admin-input" value={nameAr} onChange={(e) => setNameAr(e.target.value)} dir="rtl" />
            </div>
          </div>
          <div className="admin-field">
            <label className="admin-label">Address</label>
            <input className="admin-input" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="admin-grid-2">
            <div className="admin-field">
              <label className="admin-label">Emirate</label>
              <input className="admin-input" value={emirate} onChange={(e) => setEmirate(e.target.value)} placeholder="Dubai" />
            </div>
            <div className="admin-field">
              <label className="admin-label">Phone</label>
              <input className="admin-input mono" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="admin-field">
            <label className="admin-label">Email</label>
            <input className="admin-input mono" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-head"><div className="admin-panel-title">On the map</div></div>
        <div className="admin-panel-body">
          <div className="admin-grid-2">
            <div className="admin-field">
              <label className="admin-label">Latitude</label>
              <input className="admin-input mono" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="25.1845" inputMode="decimal" />
            </div>
            <div className="admin-field">
              <label className="admin-label">Longitude</label>
              <input className="admin-input mono" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="55.2657" inputMode="decimal" />
            </div>
          </div>
          {lat.trim() !== "" && lng.trim() !== "" && (
            <a className="admin-btn sm" target="_blank" rel="noreferrer" href={`https://maps.google.com/?q=${lat},${lng}`}>Open on map â</a>
          )}
        </div>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-head"><div className="admin-panel-title">Operating rules</div></div>
        <div className="admin-panel-body">
          <div className="admin-grid-2">
            <div className="admin-field">
              <label className="admin-label">Daily drink limit</label>
              <input className="admin-input mono" value={limit} onChange={(e) => setLimit(e.target.value)}
                     placeholder="empty = no limit" inputMode="numeric" />
              <span className="admin-meta" style={{ marginTop: 4, display: "block" }}>
                Processed today: <strong>{outlet.drinksToday}</strong>
                {outlet.dailyDrinkLimit != null ? ` Â· ${outlet.limitRemaining} left` : " Â· no limit set"}
              </span>
            </div>
            <div className="admin-field">
              <label className="admin-label">Timezone</label>
              <select className="admin-input" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                {tzOptions.map((z) => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>
          </div>
          <div className="admin-field" style={{ maxWidth: 180 }}>
            <label className="admin-label">Sort order in list</label>
            <input className="admin-input mono" value={sort} onChange={(e) => setSort(e.target.value)} inputMode="numeric" />
          </div>
        </div>
      </div>

      <button className="admin-btn primary" onClick={save} disabled={saving} style={{ justifySelf: "start" }}>
        {saving ? "Savingâ¦" : "Save"}
      </button>
    </div>
  );
}

/* ---------------- HOURS ---------------- */
// ÑÐµÐ¶Ð¸Ð¼ Ð´Ð½Ñ: Ð·Ð°ÐºÑÑÑ / ÐºÑÑÐ³Ð»Ð¾ÑÑÑÐ¾ÑÐ½Ð¾ / Ð¿Ð¾ Ð²ÑÐµÐ¼ÐµÐ½Ð¸
type DayMode = "closed" | "24h" | "custom";
type HoursRow = { mode: DayMode; open: string; close: string };
const IS_24H = (iv?: { open: string; close: string }[]) =>
  !!iv && iv.length === 1 && iv[0].open === "00:00" && iv[0].close === "24:00";

function HoursTab({ outlet, onSaved }: { outlet: AdminOutlet; onSaved: (o: AdminOutlet) => void }) {
  const toast = useToast();
  // Ð¿ÑÑÑÐ¾Ðµ ÑÐ°ÑÐ¿Ð¸ÑÐ°Ð½Ð¸Ðµ ({}) = Ð½Ðµ Ð·Ð°Ð´Ð°Ð½Ð¾ = ÐºÑÑÐ³Ð»Ð¾ÑÑÑÐ¾ÑÐ½Ð¾ Ð¿Ð¾ ÑÐ¼Ð¾Ð»ÑÐ°Ð½Ð¸Ñ (ÐºÐ°Ðº Ð±ÑÐ»Ð¾)
  const pristine = Object.keys(outlet.hours ?? {}).length === 0;
  const seed = (): HoursRow[] => DAYS.map((_, i) => {
    const iv = outlet.hours?.[String(i)];
    if (pristine || IS_24H(iv)) return { mode: "24h", open: "09:00", close: "21:00" };
    if (!iv || iv.length === 0) return { mode: "closed", open: "09:00", close: "21:00" };
    return { mode: "custom", open: iv[0].open, close: iv[0].close };
  });
  const [rows, setRows] = useState<HoursRow[]>(seed);
  const [saving, setSaving] = useState(false);

  const update = (i: number, patch: Partial<HoursRow>) =>
    setRows((arr) => arr.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  const setAll = (mode: DayMode) => setRows((arr) => arr.map((r) => ({ ...r, mode })));

  const toIntervals = (r: HoursRow) =>
    r.mode === "closed" ? []
    : r.mode === "24h" ? [{ open: "00:00", close: "24:00" }]
    : [{ open: r.open, close: r.close }];

  const save = async () => {
    // Ð¾ÑÐ¿ÑÐ°Ð²Ð»ÑÐµÐ¼ Ð²ÑÐµ 7 Ð´Ð½ÐµÐ¹ ÑÐ²Ð½Ð¾ (Ð·Ð°ÐºÑÑÑÑÐµ â Ð¿ÑÑÑÑÐ¼ ÑÐ¿Ð¸ÑÐºÐ¾Ð¼), ÑÑÐ¾Ð±Ñ ÑÐ°ÑÐ¿Ð¸ÑÐ°Ð½Ð¸Ðµ Ð½Ðµ Ð¿ÑÑÐ°Ð»Ð¾ÑÑ
    // Ñ Â«Ð½Ðµ Ð·Ð°Ð´Ð°Ð½Ð¾Â» ({} = ÐºÑÑÐ³Ð»Ð¾ÑÑÑÐ¾ÑÐ½Ð¾)
    const hours: OutletHours = {};
    rows.forEach((r, i) => { hours[String(i)] = toIntervals(r); });
    setSaving(true);
    try {
      const o = await outletApi.update(outlet.id, { hours });
      onSaved(o);
      toast("Schedule saved");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error";
      toast(msg === "OUTLET_HOURS_INVALID" ? "Check the times: closing must be later than opening"
            : ERR_HUMAN[msg] ?? msg, "warn");
    } finally { setSaving(false); }
  };

  const MODES: [DayMode, string][] = [["closed", "Closed"], ["24h", "24/7"], ["custom", "Custom hours"]];

  return (
    <div className="admin-panel">
      <div className="admin-panel-head">
        <div className="admin-panel-title">Working hours</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="admin-btn sm" onClick={() => setAll("24h")}>All 24/7</button>
          <button className="admin-btn sm" onClick={() => setAll("closed")}>All closed</button>
        </div>
      </div>
      <div className="admin-panel-body">
        <p className="admin-meta" style={{ marginBottom: 10 }}>
          For each day: âClosedâ â the outlet doesn’t accept orders; â24/7â â open all day;
          âCustom hoursâ â you set the hours. The whole outlet can be disabled on the âGeneralâ tab.
        </p>
        {/* ÑÐ²Ð¾Ð´ÐºÐ° ÑÐ¾ÑÑÐ°Ð½ÑÐ½Ð½Ð¾Ð³Ð¾ ÑÐ°ÑÐ¿Ð¸ÑÐ°Ð½Ð¸Ñ (F12/R8) */}
        <div className="admin-meta" style={{ marginBottom: 14, padding: "8px 12px", background: "#F4F3EC", borderRadius: 10 }}>
          {Object.keys(outlet.hours ?? {}).length === 0
            ? "Now: no schedule set â the outlet is open 24/7."
            : `Now: ${DAYS_SHORT.map((d, i) => `${d} ${describeDay(outlet.hours?.[String(i)])}`).join(" Â· ")}`}
        </div>
        {DAYS.map((d, i) => (
          <div key={d} style={{ display: "grid", gridTemplateColumns: "150px 1fr",
                 gap: 12, alignItems: "center", padding: "10px 0", borderBottom: "1px solid #EFEDE3" }}>
            <div style={{ fontWeight: 600 }}>{d}</div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ display: "inline-flex", gap: 4, padding: 4, background: "#F4F3EC", borderRadius: 999 }}>
                {MODES.map(([m, l]) => (
                  <button key={m} className="admin-btn sm" onClick={() => update(i, { mode: m })}
                          style={rows[i].mode === m ? { background: "#4A56E2", color: "#FFF" } : { background: "transparent" }}>
                    {l}
                  </button>
                ))}
              </div>
              {rows[i].mode === "custom" && (
                <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                  <input className="admin-input mono" type="time" value={rows[i].open} style={{ width: 124 }}
                         onChange={(e) => update(i, { open: e.target.value })} />
                  <span className="admin-meta">â</span>
                  <input className="admin-input mono" type="time" value={rows[i].close} style={{ width: 124 }}
                         onChange={(e) => update(i, { close: e.target.value })} />
                </span>
              )}
            </div>
          </div>
        ))}
        <button className="admin-btn primary" style={{ marginTop: 14 }} onClick={save} disabled={saving}>
          {saving ? "Savingâ¦" : "Save schedule"}
        </button>
      </div>
    </div>
  );
}

/* ---------------- STAFF ---------------- */
function StaffTab({ outlet, onChanged }: { outlet: AdminOutlet; onChanged: (o: AdminOutlet) => void }) {
  const router = useRouter();
  const toast = useToast();
  const [attachOpen, setAttachOpen] = useState(false);
  const [allStaff, setAllStaff] = useState<Staff[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [query, setQuery] = useState("");
  const managers = outlet.managers ?? [];
  const attachedIds = new Set(managers.map((m) => m.id));

  // Ð¿Ð¾Ð´Ð³ÑÑÐ¶Ð°ÐµÐ¼ ÑÐ¾ÑÑÑÐ´Ð½Ð¸ÐºÐ¾Ð² Ð¿ÑÐ¸ ÐºÐ°Ð¶Ð´Ð¾Ð¼ Ð¾ÑÐºÑÑÑÐ¸Ð¸ â ÑÑÐ¾Ð±Ñ Ð²Ð¸Ð´ÐµÑÑ Ð¸ ÑÐ¾Ð»ÑÐºÐ¾ ÑÑÐ¾ ÑÐ¾Ð·Ð´Ð°Ð½Ð½ÑÑ.
  // loadingStaff Ð²ÐºÐ»ÑÑÐ°ÐµÐ¼ Ð² Ð¾Ð±ÑÐ°Ð±Ð¾ÑÑÐ¸ÐºÐµ Ð¾ÑÐºÑÑÑÐ¸Ñ (Ð½Ðµ ÑÐ¸Ð½ÑÑÐ¾Ð½Ð½Ð¾ Ð² ÑÑÑÐµÐºÑÐµ â Ð¸Ð½Ð°ÑÐµ ÐºÐ°ÑÐºÐ°Ð´Ð½ÑÐ¹ ÑÐµÑÐµÐ½Ð´ÐµÑ)
  useEffect(() => {
    if (!attachOpen) return;
    adminApi.managers()
      .then(setAllStaff)
      .catch(() => toast("Failed to load staff", "warn"))
      .finally(() => setLoadingStaff(false));
  }, [attachOpen, toast]);

  const q = query.trim().toLowerCase();
  // ÑÑÐ¿ÐµÑ-Ð°Ð´Ð¼Ð¸Ð½ Ð½Ðµ ÑÐºÐ¾ÑÐ¿Ð¸ÑÑÑ Ð¿Ð¾ ÑÐ¾ÑÐºÐ°Ð¼ â Ð² ÑÐ¿Ð¸ÑÐ¾Ðº Ð½Ðµ Ð¿Ð¾Ð¿Ð°Ð´Ð°ÐµÑ; ÑÐ¶Ðµ Ð¿ÑÐ¸Ð²ÑÐ·Ð°Ð½Ð½ÑÑ Ð½Ðµ Ð¿Ð¾ÐºÐ°Ð·ÑÐ²Ð°ÐµÐ¼
  const candidates = allStaff
    .filter((s) => s.role !== "super_admin" && !attachedIds.has(s.id))
    .filter((s) => !q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q))
    .slice(0, 12);

  const attach = async (staffId: number) => {
    try {
      const o = await outletApi.attachStaff(outlet.id, staffId);
      onChanged(o); setAttachOpen(false); setQuery("");
      toast("Staff attached");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error";
      toast(ERR_HUMAN[msg] ?? msg, "warn");
    }
  };

  const detach = async (staffId: number) => {
    try {
      const o = await outletApi.detachStaff(outlet.id, staffId);
      onChanged(o);
      toast("Staff detached", "warn");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error";
      toast(ERR_HUMAN[msg] ?? msg, "warn");
    }
  };

  return (
    <>
      <div className="admin-panel">
        <div className="admin-panel-head">
          <div className="admin-panel-title">Staff at this outlet</div>
          <button className="admin-btn primary sm"
                  onClick={() => { setLoadingStaff(true); setAttachOpen(true); }}>+ Attach</button>
        </div>
        <div className="admin-tablewrap"><table className="admin-table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Primary</th><th></th></tr></thead>
          <tbody>
            {managers.map((m) => (
              <tr key={m.id} className={m.disabled ? "muted" : ""}>
                <td><strong>{m.name}</strong></td>
                <td className="admin-mono admin-meta">{m.email}</td>
                <td><span className="admin-pill accent">{ROLE_LABEL[m.role] ?? m.role}</span></td>
                <td>{m.isPrimary ? <span className="admin-pill accent">yes</span> : <span className="admin-meta">â</span>}</td>
                <td style={{ textAlign: "right" }}>
                  <button className="admin-btn ghost sm" onClick={() => router.push(`/admin/staff/${m.id}`)}>Staff card</button>
                  <button className="admin-btn ghost sm" style={{ color: "#A12822", marginLeft: 6 }}
                          onClick={() => detach(m.id)}>Detach</button>
                </td>
              </tr>
            ))}
            {managers.length === 0 && (
              <tr><td colSpan={5} className="admin-meta" style={{ padding: 16 }}>No one attached</td></tr>
            )}
          </tbody>
        </table></div>
      </div>

      <Modal open={attachOpen} title="Attach staff"
             subtitle="Start typing a name or email â pick from the list"
             onClose={() => { setAttachOpen(false); setQuery(""); }}>
        <div className="admin-field">
          <input className="admin-input" autoFocus placeholder="Name or emailâ¦"
                 value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 340, overflowY: "auto" }}>
          {candidates.map((s) => (
            <button key={s.id} type="button" onClick={() => attach(s.id)} className="admin-btn ghost"
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                             gap: 10, textAlign: "left", width: "100%", padding: "10px 12px" }}>
              <span style={{ minWidth: 0 }}>
                <strong>{s.name}</strong>
                <span className="admin-meta admin-mono" style={{ display: "block" }}>{s.email}</span>
              </span>
              <span className="admin-pill accent" style={{ flex: "none" }}>{ROLE_LABEL[s.role] ?? s.role}</span>
            </button>
          ))}
          {candidates.length === 0 && (
            <span className="admin-meta" style={{ padding: "8px 2px" }}>
              {loadingStaff ? "Loadingâ¦"
                : allStaff.length === 0 ? "No staff yet â create one in the âStaffâ section."
                : q ? "Nothing found."
                : "All eligible staff are already attached. Super admins aren't attached â they see all outlets."}
            </span>
          )}
        </div>
      </Modal>
    </>
  );
}

/* ---------------- MENU (stop-list + priorities) ---------------- */
function MenuTab({ outletId }: { outletId: number }) {
  const toast = useToast();
  const [drinks, setDrinks] = useState<AdminDrink[]>([]);
  const [cats, setCats] = useState<DrinkCat[]>([]);
  const [addons, setAddons] = useState<AdminAddon[]>([]);
  const [stop, setStop] = useState<OutletStopList>({ drinks: [], categories: [], addons: [] });
  const [prio, setPrio] = useState<Record<number, OutletPriority>>({});
  const [loading, setLoading] = useState(true);
  const [savingPrio, setSavingPrio] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([
      catalogApi.drinks(), catalogApi.drinkCategories(), catalogApi.addons(),
      outletApi.stopList(outletId), outletApi.priorities(outletId),
    ]).then(([d, c, a, s, p]) => {
      if (!alive) return;
      setDrinks(d); setCats(c); setAddons(a); setStop(s);
      const map: Record<number, OutletPriority> = {};
      p.forEach((row) => { map[row.drinkId] = row; });
      setPrio(map);
    }).catch(() => {}).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [outletId]);

  const drinkName = (d: AdminDrink) => d.name.ru ?? d.name.en ?? d.slug;
  const catName = (id: number) => { const c = cats.find((x) => x.id === id); return c ? oName(c.name) : "â"; };
  const addonName = (a: AdminAddon) => oName(a.name);

  const toggle = async (entityType: "drink" | "drink_category" | "addon", entityId: number) => {
    try {
      const { stopped } = await outletApi.toggleStop(outletId, entityType, entityId);
      setStop((s) => {
        const key = entityType === "drink" ? "drinks" : entityType === "addon" ? "addons" : "categories";
        const set = new Set(s[key]);
        if (stopped) set.add(entityId); else set.delete(entityId);
        return { ...s, [key]: Array.from(set) };
      });
    } catch (e) { toast(e instanceof Error ? e.message : "Error", "warn"); }
  };

  const setPrioRow = (drinkId: number, patch: Partial<OutletPriority>) =>
    setPrio((m) => {
      const cur = m[drinkId] ?? { drinkId, sort: 0, pinned: false };
      return { ...m, [drinkId]: { ...cur, ...patch } };
    });

  const savePriorities = async () => {
    const rows = Object.values(prio).filter((r) => r.sort !== 0 || r.pinned);
    setSavingPrio(true);
    try {
      const saved = await outletApi.setPriorities(outletId, rows);
      const map: Record<number, OutletPriority> = {};
      saved.forEach((row) => { map[row.drinkId] = row; });
      setPrio(map);
      toast("Priorities saved");
    } catch (e) { toast(e instanceof Error ? e.message : "Error", "warn"); }
    finally { setSavingPrio(false); }
  };

  const catStop = new Set(stop.categories);
  const drinkStop = new Set(stop.drinks);
  const addonStop = new Set(stop.addons);
  const totalStopped = stop.drinks.length + stop.categories.length + stop.addons.length;

  const clearStopList = async () => {
    try {
      setStop(await outletApi.setStopList(outletId, { drinks: [], categories: [], addons: [] }));
      toast("Stop list cleared");
    } catch (e) { toast(e instanceof Error ? e.message : "Error", "warn"); }
  };

  if (loading) return <div className="admin-meta">Loadingâ¦</div>;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <p className="admin-meta">
        The stop list hides an item only at this outlet â the global catalog stays unchanged.
      </p>

      <div className="admin-panel">
        <div className="admin-panel-body" style={{ display: "flex", justifyContent: "space-between",
               alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span className="admin-meta">
            {totalStopped === 0 ? "Nothing hidden â all catalog items are shown."
              : `Hidden at this outlet: ${stop.drinks.length} drinks Â· ${stop.categories.length} categories Â· ${stop.addons.length} add-ons`}
          </span>
          {totalStopped > 0 && (
            <button className="admin-btn sm" onClick={clearStopList}>Clear stop list</button>
          )}
        </div>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-head"><div className="admin-panel-title">Drink categories</div></div>
        <div className="admin-tablewrap"><table className="admin-table">
          <thead><tr><th>Category</th><th style={{ width: 140 }}>In stop list</th></tr></thead>
          <tbody>
            {cats.map((c) => (
              <tr key={c.id} className={catStop.has(c.id) ? "muted" : ""}>
                <td><strong>{oName(c.name)}</strong></td>
                <td><Toggle on={catStop.has(c.id)} onChange={() => toggle("drink_category", c.id)} /></td>
              </tr>
            ))}
            {cats.length === 0 && <tr><td colSpan={2} className="admin-meta" style={{ padding: 16 }}>No categories</td></tr>}
          </tbody>
        </table></div>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-head">
          <div className="admin-panel-title">Drinks â stop list and priorities</div>
          <button className="admin-btn primary sm" onClick={savePriorities} disabled={savingPrio}>
            {savingPrio ? "Savingâ¦" : "Save priorities"}
          </button>
        </div>
        <div className="admin-tablewrap"><table className="admin-table">
          <thead><tr>
            <th>Drink</th><th>Category</th><th style={{ width: 130 }}>In stop list</th>
            <th style={{ width: 110 }}>Sort</th><th style={{ width: 90 }}>Pinned</th>
          </tr></thead>
          <tbody>
            {drinks.map((d) => {
              const row = prio[d.id];
              return (
                <tr key={d.id} className={drinkStop.has(d.id) ? "muted" : ""}>
                  <td><strong>{drinkName(d)}</strong></td>
                  <td className="admin-meta">{catName(d.categoryId)}</td>
                  <td><Toggle on={drinkStop.has(d.id)} onChange={() => toggle("drink", d.id)} /></td>
                  <td>
                    <input className="admin-input mono" style={{ width: 80 }} inputMode="numeric"
                           value={row?.sort ?? 0}
                           onChange={(e) => setPrioRow(d.id, { sort: Number(e.target.value) || 0 })} />
                  </td>
                  <td>
                    <input type="checkbox" checked={row?.pinned ?? false}
                           onChange={(e) => setPrioRow(d.id, { pinned: e.target.checked })} />
                  </td>
                </tr>
              );
            })}
            {drinks.length === 0 && <tr><td colSpan={5} className="admin-meta" style={{ padding: 16 }}>No drinks</td></tr>}
          </tbody>
        </table></div>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-head"><div className="admin-panel-title">Add-ons</div></div>
        <div className="admin-tablewrap"><table className="admin-table">
          <thead><tr><th>Add-on</th><th style={{ width: 140 }}>In stop list</th></tr></thead>
          <tbody>
            {addons.map((a) => (
              <tr key={a.id} className={addonStop.has(a.id) ? "muted" : ""}>
                <td><strong>{addonName(a)}</strong></td>
                <td><Toggle on={addonStop.has(a.id)} onChange={() => toggle("addon", a.id)} /></td>
              </tr>
            ))}
            {addons.length === 0 && <tr><td colSpan={2} className="admin-meta" style={{ padding: 16 }}>No add-ons</td></tr>}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}

/* ---------------- AUDIT ---------------- */
// Â«Ð±ÑÐ»Ð¾ â ÑÑÐ°Ð»Ð¾Â» / ÑÑÑÑ ÑÐ¾Ð±ÑÑÐ¸Ñ Ð¸Ð· meta
function eventDetail(ev: OutletEventRow): string {
  const m = (ev.meta ?? {}) as Record<string, unknown>;
  if (ev.type === "limit_changed") return `${m.old ?? "no limit"} â ${m.new ?? "no limit"}`;
  if (ev.type === "limit_reached") return `${m.counted ?? "?"} of ${m.limit ?? "?"}`;
  if (ev.type === "stop_added" || ev.type === "stop_removed") {
    const parts: string[] = [];
    const cnt = (k: string, label: string) => {
      const v = m[k]; if (Array.isArray(v) && v.length) parts.push(`${label} Ã${v.length}`);
    };
    cnt("drink", "drinks"); cnt("drink_category", "categories"); cnt("addon", "add-ons");
    return parts.join(" Â· ") || (ev.note ?? "");
  }
  if (ev.type === "hours_changed") return "schedule updated";
  return ev.note ?? "";
}

function AuditTab({ outletId }: { outletId: number }) {
  const [events, setEvents] = useState<OutletEventRow[] | null>(null);
  useEffect(() => { outletApi.events(outletId).then(setEvents).catch(() => setEvents([])); }, [outletId]);

  return (
    <div className="admin-panel">
      <div className="admin-panel-head"><div className="admin-panel-title">Change history</div></div>
      <div className="admin-tablewrap"><table className="admin-table">
        <thead><tr><th>Event</th><th>Details</th><th>By</th><th>When</th></tr></thead>
        <tbody>
          {events === null ? (
            <tr><td colSpan={4} className="admin-meta" style={{ padding: 16 }}>Loadingâ¦</td></tr>
          ) : events.length === 0 ? (
            <tr><td colSpan={4} className="admin-meta" style={{ padding: 16 }}>No events</td></tr>
          ) : events.map((ev) => (
            <tr key={ev.id}>
              <td><strong>{EVENT_LABEL[ev.type] ?? ev.type}</strong></td>
              <td className="admin-meta">{eventDetail(ev) || "â"}</td>
              <td className="admin-meta">{ev.byStaffName ?? "system"}</td>
              <td className="admin-meta">{fmt(ev.at)}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </div>
  );
}

export default function OutletDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const numId = Number(id);
  const crumbs = useMemo(
    () => [{ label: "Network" }, { label: "Outlets", href: "/admin/outlets" }, { label: `#${id}` }],
    [id],
  );
  return (
    <AdminShell title="Outlet" crumbs={crumbs}>
      <Inner id={numId} />
    </AdminShell>
  );
}
