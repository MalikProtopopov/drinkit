"use client";

import { useState } from "react";
import { ConfirmDialog, Toggle, useToast } from "@/components/admin/AdminUI";
import { outletApi, type AdminOutlet } from "@/lib/adminApi";
import { ERR_HUMAN, fmtTz, oName, STATUS_TONE, type Tab } from "@/lib/outlets/format";

/* ---------------- STATUS BANNER (единый блок состояния) ---------------- */
export function OutletStatusBanner({ outlet, onSaved, onGotoTab }: {
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
  // причина + подсказка + кнопка-исправление по statusReason (Нильсен #1/#9)
  let hint = "";
  let fix: { label: string; on: () => void } | null = null;
  if (outlet.statusReason === "open") {
    hint = outlet.closesAt ? `accepting orders · today until ${fmtTz(outlet.closesAt, tz)}`
      : Object.keys(outlet.hours ?? {}).length === 0 ? "accepting orders · 24/7 (no schedule set)"
      : "accepting orders · 24/7 today";
  } else if (outlet.statusReason === "paused_manual") {
    hint = "orders paused manually";
    fix = { label: "Resume orders",
            on: () => run(() => outletApi.update(outlet.id, { acceptingOrders: true }), "Orders resumed") };
  } else if (outlet.statusReason === "paused_limit") {
    hint = `daily limit reached ${outlet.drinksToday}/${outlet.dailyDrinkLimit}`
      + (outlet.resetsAt ? ` · resets at ${fmtTz(outlet.resetsAt, tz)}` : "");
    fix = { label: "Change limit", on: () => onGotoTab("main") };
  } else if (outlet.statusReason === "closed") {
    hint = outlet.opensAt ? `outside working hours · opens ${fmtTz(outlet.opensAt, tz, true)}` : "outside working hours";
    fix = { label: "Edit schedule", on: () => onGotoTab("hours") };
  } else {
    hint = "outlet is disabled — hidden from the site and not accepting orders";
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
        {/* мастер-выключатель: работает ли точка вообще */}
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
        {/* ручная пауза: принимает ли заказы прямо сейчас (только у включённой точки) */}
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
          ? "The public site doesn’t have an outlet switcher yet — customers will see the menu of only one outlet. Enable the second active outlet anyway?"
          : "The outlet will become active and start accepting orders on schedule."}
        confirmLabel="Enable"
        onCancel={() => { setConfirmAct(false); setForceActivate(false); }}
        onConfirm={() => { const f = forceActivate; setConfirmAct(false); setForceActivate(false); run(() => outletApi.activate(outlet.id, f), "Outlet enabled"); }} />
    </div>
  );
}
