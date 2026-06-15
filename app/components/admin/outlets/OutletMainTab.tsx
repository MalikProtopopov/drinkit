"use client";

import { useState } from "react";
import { useToast } from "@/components/admin/AdminUI";
import { outletApi, type AdminOutlet } from "@/lib/adminApi";
import { ERR_HUMAN, TIMEZONES } from "@/lib/outlets/format";

/* ---------------- MAIN ---------------- */
export function OutletMainTab({ outlet, onSaved }: {
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
    // лимит: пусто = без лимита, иначе целое ≥ 0 (защита от мусора → 422)
    let dailyDrinkLimit: number | null = null;
    if (limit.trim() !== "") {
      const n = Number(limit);
      if (!Number.isInteger(n) || n < 0) { toast("Limit must be an integer ≥ 0, or empty", "warn"); return; }
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
            <a className="admin-btn sm" target="_blank" rel="noreferrer" href={`https://maps.google.com/?q=${lat},${lng}`}>Open on map ↗</a>
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
                {outlet.dailyDrinkLimit != null ? ` · ${outlet.limitRemaining} left` : " · no limit set"}
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
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
