"use client";
import { useEffect, useState } from "react";
import { api, type Location } from "@/lib/api";
import { TopBrand } from "@/components/TopBrand";
import { IconStrip } from "@/components/IconStrip";
import { Icon } from "@/components/Icon";
import { type WeekHours, todayHours } from "@/lib/hours";
import { statusBadge } from "@/lib/outletStatus";

// контакты GRABZI: карта + Instagram спарсены с grabzi.ae; телефон/почта — из конфигурации бренда
const MAP_URL = "https://maps.app.goo.gl/5iP1UrwEVMA9oW3x6?g_st=ipc";
const CONTACTS: { ic: React.ReactNode; lbl: string; val: string; href: string; ext: boolean }[] = [
  { ic: <Icon name="pin" size={22} />, lbl: "Find us", val: "On the map", href: MAP_URL, ext: true },
  { ic: <Icon name="phone" size={22} />, lbl: "Call us", val: "+971 55 667 6679", href: "tel:+971556676679", ext: false },
  { ic: <Icon name="mail" size={22} />, lbl: "Email", val: "grabzi150@gmail.com", href: "mailto:grabzi150@gmail.com", ext: false },
  { ic: "@", lbl: "Instagram", val: "@grabzi.ae", href: "https://instagram.com/grabzi.ae", ext: true },
];

function directionsUrl(address: string | null): string {
  return address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : MAP_URL;
}

export default function InfoPage() {
  const [outlets, setOutlets] = useState<Location[] | null>(null);
  useEffect(() => { api.locations().then(setOutlets).catch(() => setOutlets([])); }, []);

  return (
    <main style={{ maxWidth: 600, margin: "0 auto", paddingBlockEnd: 44 }}>
      <div style={{ paddingInline: 20 }}><TopBrand /></div>

      <section style={{ textAlign: "center", paddingInline: 20 }}>
        <h1 className="display" style={{ fontSize: "clamp(30px,8vw,46px)", lineHeight: 0.95, letterSpacing: ".01em" }}>
          VISIT GRABZI
        </h1>
        <p style={{ marginBlockStart: 8, color: "var(--color-muted)", fontStyle: "italic", fontWeight: 600, fontSize: 15 }}>
          Cold-pressed, blended fresh, grabbed to go.
        </p>
      </section>

      <div style={{ marginBlock: 16 }}><IconStrip /></div>

      <div style={{ paddingInline: 18 }}>
        {/* контакты */}
        <div style={{ display: "grid", gap: 12 }}>
          {CONTACTS.map((c, i) => (
            <a key={c.lbl} className="info-card rise" href={c.href}
              target={c.ext ? "_blank" : undefined} rel={c.ext ? "noopener noreferrer" : undefined}
              style={{ animationDelay: `${i * 70}ms` }}>
              <span className="info-card__ic">{c.ic}</span>
              <span style={{ display: "grid", gap: 2, minWidth: 0 }}>
                <span className="info-card__lbl">{c.lbl}</span>
                <span className="info-card__val">{c.val}</span>
              </span>
              <span style={{ marginInlineStart: "auto", color: "var(--color-brand)" }}>
                <Icon name="chevron-right" size={18} stroke={2.4} />
              </span>
            </a>
          ))}
        </div>

        {/* все точки: имя + статус + адрес + часы сегодня + маршрут */}
        <h2 className="display" style={{ fontSize: 26, marginBlockStart: 28, marginBlockEnd: 12, textAlign: "center" }}>
          OUR SPOTS
        </h2>

        {outlets === null && (
          <div style={{ display: "grid", gap: 12 }}>
            {[0, 1].map((i) => <div key={i} className="skeleton" style={{ height: 130, borderRadius: "var(--radius-card)" }} />)}
          </div>
        )}
        {outlets !== null && outlets.length === 0 && (
          <div className="card" style={{ textAlign: "center" }}>No spots yet — check back soon.</div>
        )}
        {outlets !== null && outlets.length > 0 && (
          <div style={{ display: "grid", gap: 12 }}>
            {outlets.map((o, i) => {
              const [label, cls] = statusBadge(o);
              const wh = (o.workingHours ?? {}) as WeekHours;
              return (
                <div key={o.id} className="card rise" style={{ animationDelay: `${(i + CONTACTS.length) * 70}ms`, display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                    <div className="display" style={{ fontSize: 22, textTransform: "uppercase", lineHeight: 1 }}>{o.name}</div>
                    <span className={`badge ${cls}`}>{label}</span>
                  </div>
                  {o.address && (
                    <div style={{ display: "flex", gap: 6, alignItems: "center", color: "var(--color-muted)", fontSize: 14 }}>
                      <Icon name="pin" size={15} /> {o.address}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 6, alignItems: "center", color: "var(--color-ink)", fontSize: 14, fontWeight: 600 }}>
                    <Icon name="clock" size={15} style={{ color: "var(--color-brand)" }} /> Today {todayHours(wh)}
                  </div>
                  <a href={directionsUrl(o.address)} target="_blank" rel="noopener noreferrer"
                    style={{ display: "inline-flex", gap: 6, alignItems: "center", color: "var(--color-brand)", fontWeight: 800, fontStyle: "italic", fontSize: 14, marginBlockStart: 2 }}>
                    <Icon name="car" size={16} /> Directions <Icon name="chevron-right" size={15} stroke={2.4} />
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <footer className="footer" style={{ marginBlockStart: 8 }}>© 2026 GRABZI · Come early, we don&apos;t make more!!</footer>
    </main>
  );
}
