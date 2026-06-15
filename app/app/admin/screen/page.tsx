"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { adminApi, adminOrdersWs, getStaffToken, type ScreenRow } from "@/lib/adminApi";

type Board = { ready: ScreenRow[]; preparing: ScreenRow[] };

const NAVY = "#13235B";
const ACCENT = "#2A43C2";

function Section({ title, sub, rows, variant }: {
  title: string; sub: string; rows: ScreenRow[]; variant: "ready" | "preparing";
}) {
  const ready = variant === "ready";
  return (
    <section style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: "1.2vw" }}>
        <h2 style={{ fontSize: "clamp(34px, 4.6vw, 78px)", fontWeight: 800, color: NAVY,
                     letterSpacing: "-0.02em", margin: 0 }}>{title}</h2>
        <span style={{ fontSize: "clamp(16px, 1.7vw, 30px)", color: "#8893B6", fontWeight: 600 }}>{sub}</span>
        <span style={{ marginInlineStart: "auto", fontSize: "clamp(16px, 1.7vw, 30px)",
                       color: "#A6AEC8", fontWeight: 700 }}>{rows.length || ""}</span>
      </div>

      {rows.length === 0 ? (
        <div style={{ color: "#AEB6CE", fontSize: "clamp(18px, 1.8vw, 30px)", padding: "0.6vw 0" }}>
          {ready ? "No orders ready yet" : "Queue is empty"}
        </div>
      ) : (
        <div style={{ display: "grid", gap: "clamp(8px, 0.9vw, 18px) clamp(16px, 2vw, 44px)",
                      gridTemplateColumns: "repeat(auto-fill, minmax(clamp(240px, 22vw, 420px), 1fr))",
                      alignContent: "start" }}>
          {rows.map((r) => (
            <div key={r.orderId} className={ready ? "" : "scr-pulse"}
                 style={{ display: "flex", alignItems: "center", gap: "clamp(10px, 1vw, 20px)" }}>
              <span style={{
                fontVariantNumeric: "tabular-nums", fontWeight: 800,
                fontSize: "clamp(22px, 2.3vw, 44px)", lineHeight: 1,
                color: ready ? "#FFFFFF" : ACCENT,
                background: ready ? ACCENT : "transparent",
                border: ready ? "none" : `clamp(2px,0.18vw,4px) solid ${ACCENT}`,
                borderRadius: "clamp(8px, 0.7vw, 14px)",
                padding: "clamp(6px,0.55vw,12px) clamp(10px,0.9vw,20px)", minWidth: "1.6em",
                textAlign: "center",
              }}>{r.number}</span>
              <span style={{ fontSize: "clamp(24px, 2.5vw, 48px)", fontWeight: 600, color: NAVY,
                             overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.name}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function ScreenBoardPage() {
  const router = useRouter();
  const [board, setBoard] = useState<Board>({ ready: [], preparing: [] });
  const [live, setLive] = useState(false);
  const [clock, setClock] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const aliveRef = useRef(true);

  const load = useCallback(async () => {
    try { setBoard(await adminApi.screenBoard()); }
    catch (e) { if ((e as { status?: number })?.status === 401) router.replace("/admin/login"); }
  }, [router]);

  useEffect(() => {
    if (!getStaffToken()) { router.replace("/admin/login"); return; }
    aliveRef.current = true;
    load();

    // realtime: тот же канал, что у админ-ленты; на любое событие — перезапрос доски
    const connect = () => {
      try {
        const ws = adminOrdersWs();
        wsRef.current = ws;
        ws.onopen = () => setLive(true);
        ws.onmessage = (e) => { try { const m = JSON.parse(e.data); if (m.type !== "ping") load(); } catch {} };
        ws.onclose = () => { setLive(false); if (aliveRef.current) setTimeout(connect, 3000); };
        ws.onerror = () => ws.close();
      } catch { if (aliveRef.current) setTimeout(connect, 3000); }
    };
    connect();

    // подстраховка: периодический перезапрос на случай пропущенных событий
    const poll = setInterval(load, 20000);
    const tick = () => setClock(new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }));
    tick();
    const clk = setInterval(tick, 30000);

    return () => {
      aliveRef.current = false;
      wsRef.current?.close();
      clearInterval(poll);
      clearInterval(clk);
    };
  }, [load]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#EAEEF8",
                  display: "flex", flexDirection: "column", padding: "clamp(20px, 3vw, 64px)",
                  fontFamily: "var(--font-sans), Manrope, ui-sans-serif, sans-serif", gap: "clamp(16px,2vw,40px)" }}>
      <style>{`@keyframes scrpulse{0%,100%{opacity:1}50%{opacity:.5}} .scr-pulse{animation:scrpulse 1.8s ease-in-out infinite}`}</style>

      {/* шапка: бренд + часы + индикатор связи */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="JOOZ" style={{ height: "clamp(20px,1.9vw,34px)", width: "auto" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "clamp(12px,1.2vw,24px)",
                      color: "#8893B6", fontWeight: 700, fontSize: "clamp(14px,1.5vw,26px)" }}>
          <span>{clock}</span>
          <span title={live ? "В сети" : "Переподключение…"} style={{
            width: "clamp(9px,0.8vw,14px)", height: "clamp(9px,0.8vw,14px)", borderRadius: 999,
            background: live ? "#16A34A" : "#D08A00", display: "inline-block" }} />
        </div>
      </header>

      <Section title="Ready" sub="جاهز · Готово" rows={board.ready} variant="ready" />
      <div style={{ height: 2, background: "#D6DCEC", margin: "clamp(4px,0.6vw,12px) 0" }} />
      <Section title="Preparing" sub="قيد التحضير · Готовится" rows={board.preparing} variant="preparing" />
    </div>
  );
}
