"use client";

import { useState } from "react";
import { useToast } from "@/components/admin/AdminUI";
import { outletApi, type AdminOutlet, type OutletHours } from "@/lib/adminApi";
import { DAYS, DAYS_SHORT, describeDay, ERR_HUMAN } from "@/lib/outlets/format";

/* ---------------- HOURS ---------------- */
// режим дня: закрыт / круглосуточно / по времени
type DayMode = "closed" | "24h" | "custom";
type HoursRow = { mode: DayMode; open: string; close: string };
const IS_24H = (iv?: { open: string; close: string }[]) =>
  !!iv && iv.length === 1 && iv[0].open === "00:00" && iv[0].close === "24:00";

export function OutletHoursTab({ outlet, onSaved }: { outlet: AdminOutlet; onSaved: (o: AdminOutlet) => void }) {
  const toast = useToast();
  // пустое расписание ({}) = не задано = круглосуточно по умолчанию (как было)
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
    // отправляем все 7 дней явно (закрытые — пустым списком), чтобы расписание не путалось
    // с «не задано» ({} = круглосуточно)
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
          For each day: “Closed” — the outlet doesn’t accept orders; “24/7” — open all day;
          “Custom hours” — you set the hours. The whole outlet can be disabled on the “General” tab.
        </p>
        {/* сводка сохранённого расписания (F12/R8) */}
        <div className="admin-meta" style={{ marginBottom: 14, padding: "8px 12px", background: "#F4F3EC", borderRadius: 10 }}>
          {Object.keys(outlet.hours ?? {}).length === 0
            ? "Now: no schedule set — the outlet is open 24/7."
            : `Now: ${DAYS_SHORT.map((d, i) => `${d} ${describeDay(outlet.hours?.[String(i)])}`).join(" · ")}`}
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
                  <span className="admin-meta">–</span>
                  <input className="admin-input mono" type="time" value={rows[i].close} style={{ width: 124 }}
                         onChange={(e) => update(i, { close: e.target.value })} />
                </span>
              )}
            </div>
          </div>
        ))}
        <button className="admin-btn primary" style={{ marginTop: 14 }} onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save schedule"}
        </button>
      </div>
    </div>
  );
}
