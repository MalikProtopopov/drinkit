"use client";
import { useEffect, useRef } from "react";

type Opts = {
  /** Открывает новый WebSocket (напр. adminOrdersWs). Должен быть стабильным. */
  connect: () => WebSocket;
  /** Живое событие из сокета (кроме ping). Решает, что обновить. */
  onMessage: (msg: unknown) => void;
  /** Принудительный refetch: при реконнекте/возврате вкладки/сети/поллинге. */
  onSync?: () => void;
  /** Интервал poll-подстраховки (мс). Поллит только при видимой вкладке. */
  pollMs?: number;
};

/**
 * Надёжная realtime-подписка на WS-ленту:
 *  • авто-reconnect с экспоненциальным backoff (1→2→4→8→15с);
 *  • догон пропущенного (onSync) при ПЕРЕподключении — события за время разрыва не теряются;
 *  • реакция на возврат вкладки/сети (visibilitychange/online): сразу refetch + reconnect;
 *  • опциональный poll как страховка от незамеченных потерь.
 * Колбэки берутся из ref, поэтому подписка не пересоздаётся на каждый рендер.
 */
export function useLiveReload({ connect, onMessage, onSync, pollMs }: Opts) {
  const ref = useRef({ connect, onMessage, onSync });
  ref.current = { connect, onMessage, onSync };

  useEffect(() => {
    let alive = true;
    let ws: WebSocket | null = null;
    let retry = 0;
    let reconnectT: ReturnType<typeof setTimeout> | undefined;
    let pollT: ReturnType<typeof setInterval> | undefined;

    const sync = () => ref.current.onSync?.();

    const open = () => {
      if (!alive) return;
      let sock: WebSocket;
      try { sock = ref.current.connect(); }
      catch { schedule(); return; }
      ws = sock;
      sock.onopen = () => {
        if (retry > 0) sync();   // были в офлайне — догнать пропущенное
        retry = 0;
      };
      sock.onmessage = (e) => {
        let m: unknown;
        try { m = JSON.parse(e.data); } catch { return; }
        if ((m as { type?: string })?.type === "ping") return;
        ref.current.onMessage(m);
      };
      sock.onclose = () => { if (alive && ws === sock) schedule(); };
      sock.onerror = () => { try { sock.close(); } catch { /* noop */ } };
    };

    const schedule = () => {
      if (!alive) return;
      clearTimeout(reconnectT);
      const delay = Math.min(1000 * 2 ** retry, 15000);
      retry += 1;
      reconnectT = setTimeout(open, delay);
    };

    const onWake = () => {
      if (document.visibilityState !== "visible") return;
      sync();
      if (!ws || ws.readyState > WebSocket.OPEN) { clearTimeout(reconnectT); retry = 0; open(); }
    };

    open();
    if (pollMs) {
      pollT = setInterval(() => {
        if (document.visibilityState === "visible") sync();
      }, pollMs);
    }
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("online", onWake);

    return () => {
      alive = false;
      clearTimeout(reconnectT);
      if (pollT) clearInterval(pollT);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("online", onWake);
      try { ws?.close(); } catch { /* noop */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
