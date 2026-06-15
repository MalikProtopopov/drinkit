"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminApi } from "@/lib/adminApi";
import { aed as money, pct, recencyText as recency } from "@/lib/format";
import { Stat } from "@/components/admin/Stat";
import { SegmentDonut } from "@/components/admin/charts/SegmentDonut";
import { RfmHeatGrid } from "@/components/admin/charts/RfmHeatGrid";
import { HorizontalBars } from "@/components/admin/charts/HorizontalBars";

// аудитория показывает короткую форму давности («N дн.» без «назад»)
const recencyText = (d?: number | null) => recency(d, { short: true });

// RFM-сетка с бэка приходит как rfmGrid[f-1][r-1] (F снаружи 1..5, R внутри 1..5).
// Компоненту нужен grid[f][r], где строка 0 = F5 (сверху) … строка 4 = F1,
// столбец 0 = R1 (слева) … столбец 4 = R5. Разворачиваем внешний массив (ось F).
function toHeatGrid(rfmGrid: number[][] | undefined): number[][] {
  const g = Array.isArray(rfmGrid) ? rfmGrid : [];
  const norm = Array.from({ length: 5 }, (_, f) =>
    Array.from({ length: 5 }, (_, r) => Number(g?.[f]?.[r]) || 0)
  );
  return norm.slice().reverse(); // F1..F5 -> F5..F1
}


const RFM_PILL: Record<string, string> = {
  champions: "accent",
  loyal: "accent",
  potential_loyalist: "accent",
  new_customers: "",
  promising: "",
  need_attention: "warn",
  at_risk: "warn",
  hibernating: "warn",
  lost: "danger",
  no_purchase: "",
};

function SegmentRow({ seg }: { seg: any }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const customers: any[] = seg.customers ?? [];
  const tags: { tag: string; count: number }[] = seg.personaTags ?? [];

  return (
    <>
      <tr
        className="admin-row-link"
        style={{ cursor: customers.length ? "pointer" : "default" }}
        onClick={() => customers.length && setOpen((v) => !v)}
      >
        <td>
          <span className={`admin-pill ${RFM_PILL[seg.key] ?? ""}`} style={{ fontWeight: 700 }}>
            {seg.label}
          </span>
          <div className="admin-meta" style={{ fontSize: 11.5, marginTop: 4, maxWidth: 320 }}>
            {seg.description}
          </div>
        </td>
        <td className="admin-num">{seg.count}</td>
        <td className="admin-num">{pct(seg.share)}</td>
        <td className="admin-num">{money(seg.avgSpent ?? 0)}</td>
        <td className="admin-num">{recencyText(seg.avgRecency)}</td>
        <td className="admin-num">{(seg.avgFrequency ?? 0).toFixed(2)}/мес</td>
        <td>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {tags.length === 0 ? (
              <span className="admin-meta">—</span>
            ) : (
              tags.map((t) => (
                <span key={t.tag} className="admin-badge" title={`${t.count} клиент(ов)`}>
                  {t.tag} · {t.count}
                </span>
              ))
            )}
          </div>
        </td>
        <td className="admin-meta" style={{ textAlign: "right", whiteSpace: "nowrap" }}>
          {customers.length ? (open ? "Свернуть ▲" : "Клиенты ▼") : "—"}
        </td>
      </tr>
      {open && customers.length > 0 && (
        <tr>
          <td colSpan={8} style={{ background: "#FAF8F3", padding: 0 }}>
            <div className="admin-tablewrap">
              <table className="admin-table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Клиент</th>
                    <th>Телефон</th>
                    <th>Потрачено</th>
                    <th>Заказов</th>
                    <th>Последний</th>
                    <th>RFM</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((cu) => (
                    <tr
                      key={cu.id}
                      className="admin-row-link"
                      style={{ cursor: "pointer" }}
                      onClick={() => router.push(`/admin/customers/${cu.id}`)}
                    >
                      <td>
                        <strong>{cu.name ?? "—"}</strong>
                      </td>
                      <td className="admin-mono admin-meta">{cu.phone}</td>
                      <td className="admin-num">{money(cu.totalSpent ?? 0)}</td>
                      <td className="admin-num">{cu.paidOrders ?? 0}</td>
                      <td className="admin-meta">{recencyText(cu.recencyDays)}</td>
                      <td>
                        <span className="admin-mono admin-meta">{cu.rfm?.score ?? "—"}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function AudienceInner() {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    adminApi.audience().then(setData).catch(() => setErr(true));
  }, []);

  if (err) return <div className="admin-meta">Не удалось загрузить аудиторию</div>;
  if (!data) return <div className="admin-meta">Загрузка…</div>;

  const k = data.kpis ?? {};
  const segments: any[] = data.segments ?? [];
  const personas: { tag: string; count: number; share: number }[] = data.personas ?? [];

  const donutData = segments
    .filter((s) => (s.count ?? 0) > 0)
    .map((s) => ({ label: s.label, count: s.count, key: s.key }));

  const personaBars = personas.map((p) => ({ label: p.tag, value: p.count }));

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* KPI-строка */}
      <div className="admin-grid-3">
        <Stat label="Клиентов всего" value={k.customers ?? data.total ?? 0} />
        <Stat label="Активные (≤30 дн.)" value={k.active ?? 0}
              sub={data.total ? `${Math.round(((k.active ?? 0) / data.total) * 100)}% базы` : undefined} />
        <Stat label="В зоне риска" value={k.atRisk ?? 0} sub="высокий риск оттока" />
        <Stat label="Отток (>60 дн.)" value={k.churned ?? 0} />
        <Stat label="Новые в этом месяце" value={k.newThisMonth ?? 0} />
        <Stat label="Средний CLV" value={money(k.avgCLV ?? 0)} sub="прогноз на 12 мес." />
      </div>

      {/* распределение по сегментам + RFM-сетка */}
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16, alignItems: "start" }}>
        <div className="admin-panel">
          <div className="admin-panel-head">
            <div className="admin-panel-title">Сегменты RFM</div>
            <span className="admin-meta">{data.total ?? 0} клиентов</span>
          </div>
          <div className="admin-panel-body">
            <SegmentDonut data={donutData} />
          </div>
        </div>

        <div className="admin-panel">
          <div className="admin-panel-head">
            <div className="admin-panel-title">RFM-матрица</div>
            <span className="admin-meta">Recency × Frequency</span>
          </div>
          <div className="admin-panel-body">
            <RfmHeatGrid grid={toHeatGrid(data.rfmGrid)} />
          </div>
        </div>
      </div>

      {/* таблица сегментов */}
      <div className="admin-panel">
        <div className="admin-panel-head">
          <div className="admin-panel-title">Сегменты: метрики и состав</div>
          <span className="admin-meta">кликните строку, чтобы раскрыть клиентов</span>
        </div>
        <div className="admin-tablewrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Сегмент</th>
                <th>Клиентов</th>
                <th>Доля</th>
                <th>Ср. чек·сумма</th>
                <th>Ср. давность</th>
                <th>Частота</th>
                <th>Персоны</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {segments.map((seg) => (
                <SegmentRow key={seg.key} seg={seg} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* распределение персон */}
      <div className="admin-panel">
        <div className="admin-panel-head">
          <div className="admin-panel-title">Персоны (поведенческие теги)</div>
          <span className="admin-meta">{personas.length} тегов</span>
        </div>
        <div className="admin-panel-body">
          <HorizontalBars
            data={personaBars}
            suffix=" чел."
            height={Math.max(160, personaBars.length * 30 + 24)}
          />
        </div>
      </div>
    </div>
  );
}

export default function AudiencePage() {
  return (
    <AdminShell title="Аудитория" crumbs={[{ label: "Аудитория" }]}>
      <AudienceInner />
    </AdminShell>
  );
}
