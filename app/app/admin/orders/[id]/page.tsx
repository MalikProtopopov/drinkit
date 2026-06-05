"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { ConfirmDialog, useToast } from "@/components/admin/AdminUI";
import { adminApi, adminOrdersWs, ADMIN_STATUS_LABEL, type AdminOrder } from "@/lib/adminApi";

const CHAIN = ["new", "in_progress", "ready", "arrived", "completed"];

function Detail({ id }: { id: number }) {
  const toast = useToast();
  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [confirmRefund, setConfirmRefund] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const load = useCallback(() => {
    adminApi.order(id).then(setOrder).catch(() => {});
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    try {
      const ws = adminOrdersWs();
      wsRef.current = ws;
      ws.onmessage = (e) => {
        const m = JSON.parse(e.data);
        if (m.type !== "ping" && m.orderId === id) load();
      };
    } catch {}
    return () => wsRef.current?.close();
  }, [id, load]);

  if (!order) return <div className="admin-meta">Загрузка…</div>;

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); load(); toast(ok); }
    catch (e) { toast(e instanceof Error ? e.message : "Ошибка", "warn"); }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
      <div>
        <div className="admin-panel" style={{ marginBottom: 16 }}>
          <div className="admin-panel-head">
            <div className="admin-panel-title">Состав заказа</div>
            <span className={`admin-badge ${order.status}`}>{ADMIN_STATUS_LABEL[order.status]}</span>
          </div>
          <table className="admin-table">
            <thead>
              <tr><th>Позиция</th><th>Добавки (граммовка)</th><th>Кол-во</th><th>Сумма</th></tr>
            </thead>
            <tbody>
              {order.items.map((it) => (
                <tr key={it.id}>
                  <td>
                    <strong>{it.name}</strong>
                    {it.paidByCoupon && <span className="admin-pill accent" style={{ marginLeft: 6 }}>купон</span>}
                  </td>
                  <td>
                    {it.addons.length === 0 ? <span className="admin-meta">—</span> :
                      it.addons.map((a, i) => (
                        <div key={i} style={{ fontSize: 12.5 }}>
                          {a.name}{a.portions > 1 ? ` ×${a.portions}` : ""}{" "}
                          <span className="admin-meta">({a.amount}{a.unit === "ml" ? " мл" : " г"})</span>
                        </div>
                      ))}
                  </td>
                  <td className="admin-num">{it.quantity}</td>
                  <td className="admin-num">{(it.unitPrice * it.quantity).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: "#FAF6F0" }}>
                <td colSpan={3} style={{ textAlign: "right", fontWeight: 700, padding: "14px 16px" }}>
                  Итого {order.couponDiscount > 0 && <span className="admin-meta">(купон −{order.couponDiscount.toFixed(0)})</span>}
                </td>
                <td className="admin-num" style={{ fontWeight: 800, fontSize: 15, padding: "14px 16px" }}>
                  {order.total.toFixed(2)} AED
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="admin-grid-2">
          <div className="admin-panel">
            <div className="admin-panel-head"><div className="admin-panel-title">Клиент</div></div>
            <div className="admin-panel-body">
              <div className="admin-field"><label className="admin-label">Имя</label>
                <div style={{ fontWeight: 600 }}>{order.customerName ?? "—"}</div></div>
              <div className="admin-field"><label className="admin-label">Телефон</label>
                <div className="admin-mono">{order.phone}</div></div>
              <div className="admin-field">
                <label className="admin-label">Машина для выдачи</label>
                <div className="admin-mono" style={{ fontSize: 18, fontWeight: 700 }}>
                  {order.emirate} {order.carPlate}
                </div>
              </div>
              {order.rating && (
                <div className="admin-field"><label className="admin-label">Оценка клиента</label>
                  <div style={{ fontSize: 22 }}>{order.rating === "like" ? "👍" : "👎"}</div></div>
              )}
            </div>
          </div>
          <div className="admin-panel">
            <div className="admin-panel-head"><div className="admin-panel-title">Оплата</div></div>
            <div className="admin-panel-body">
              <div className="admin-field"><label className="admin-label">Статус</label>
                <span className="admin-pill">{order.paymentStatus}</span></div>
              <div className="admin-field"><label className="admin-label">Сумма</label>
                <div className="admin-num" style={{ fontWeight: 700 }}>{order.total.toFixed(2)} AED</div></div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="admin-panel" style={{ marginBottom: 16 }}>
          <div className="admin-panel-head">
            <div className="admin-panel-title">Статус (единое поле, §0.1)</div>
          </div>
          <div className="admin-panel-body">
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              {CHAIN.map((s) => {
                const idx = CHAIN.indexOf(order.status);
                const i = CHAIN.indexOf(s);
                return (
                  <span key={s} className="admin-pill"
                        style={{
                          background: i === idx ? "#4A56E2" : i < idx ? "#DDEDE0" : "#F5EFE7",
                          color: i === idx ? "#FFF" : i < idx ? "#166534" : "#6B7280",
                          fontWeight: 700,
                        }}>
                    {ADMIN_STATUS_LABEL[s]}
                  </span>
                );
              })}
            </div>

            {order.status === "new" && (
              <button className="admin-btn primary" style={{ width: "100%", justifyContent: "center", padding: 10 }}
                      onClick={() => act(() => adminApi.take(order.id), "Взят в работу")}>
                Взять в работу
              </button>
            )}
            {order.status === "in_progress" && (
              <button className="admin-btn primary" style={{ width: "100%", justifyContent: "center", padding: 10 }}
                      onClick={() => act(() => adminApi.setStatus(order.id, "ready"), "Готов — ждём клиента")}>
                Готово, ожидает прибытия
              </button>
            )}
            {(order.status === "ready" || order.status === "arrived") && (
              <button className="admin-btn primary" style={{ width: "100%", justifyContent: "center", padding: 10 }}
                      onClick={() => act(() => adminApi.setStatus(order.id, "completed"), "Передан клиенту")}>
                Передан клиенту
              </button>
            )}
            {order.status === "arrived" && (
              <div style={{ marginTop: 10, padding: 10, background: "#FFF7E5", fontWeight: 600, borderRadius: 8 }}>
                🚗 Клиент ожидает получения — вынесите заказ к машине {order.emirate} {order.carPlate}
              </div>
            )}
            {order.status === "completed" && (
              <button className="admin-btn danger" style={{ width: "100%", justifyContent: "center", marginTop: 8 }}
                      onClick={() => setConfirmRefund(true)}>
                Оформить возврат
              </button>
            )}
          </div>
        </div>

        <div className="admin-panel">
          <div className="admin-panel-head"><div className="admin-panel-title">Хронология</div></div>
          <div className="admin-panel-body">
            <div className="admin-timeline">
              {(order.events ?? []).map((h, i, arr) => (
                <div key={i} className="admin-timeline-row">
                  <div className={`admin-timeline-dot ${i === arr.length - 1 ? "current" : "done"}`} />
                  <div>
                    <div className="admin-timeline-text">
                      <strong>{h.type === "status_change" ? ADMIN_STATUS_LABEL[h.status ?? ""] : h.type}</strong>
                      {h.note && <span className="admin-meta"> · {h.note}</span>}
                    </div>
                    <div className="admin-timeline-meta">
                      {new Date(h.at).toLocaleString("ru-RU")} ·{" "}
                      {h.byStaffId ? `сотрудник #${h.byStaffId}` : h.byUserId ? "клиент" : "система"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <ConfirmDialog
          open={confirmRefund}
          title={`Возврат по заказу #${order.number}?`}
          message="Опциональный модуль: статус станет «возврат», платёж пометится refunded. Клиент увидит возврат на странице заказа."
          confirmLabel="Оформить возврат"
          danger
          onCancel={() => setConfirmRefund(false)}
          onConfirm={() => {
            setConfirmRefund(false);
            act(() => adminApi.refund(order.id, "оформлен из админки"), "Возврат оформлен");
          }}
        />
      </div>
    </div>
  );
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AdminShell title={`Заказ`} crumbs={[{ label: "Заказы", href: "/admin/orders" }, { label: `#${id}` }]}>
      <Detail id={Number(id)} />
    </AdminShell>
  );
}
