"""Агрегация CRM-аудитории и расширенная сводка по клиенту.

Оркестрирует RFM/отток/CLV/персоны (модули crm_rfm/crm_churn/crm_personas) в готовые к
сериализации словари. Чистый слой: на входе уже загруженные ORM-объекты и предрасчитанная
статистика, обращения к БД делает вызывающий роутер. Считается по ОПЛАЧЕННЫМ заказам.
"""
from collections import Counter
from datetime import datetime

from .crm_churn import churn_metrics, clv_metrics
from .crm_personas import persona_tags
from .crm_rfm import SEGMENTS, rfm_scores, rfm_segment, rfm_thresholds


def _event_times(events: list) -> dict:
    """paid_at, ready_at, completed_at из событий заказа (in_progress нам не нужен)."""
    paid_at = ready_at = completed_at = None
    for e in events:
        if e.type == "paid" and paid_at is None:
            paid_at = e.created_at
        elif e.type == "status_change" and e.status == "ready" and ready_at is None:
            ready_at = e.created_at
        elif e.type == "status_change" and e.status == "completed" and completed_at is None:
            completed_at = e.created_at
    return {"paid": paid_at, "ready": ready_at, "completed": completed_at}


def _minutes(a, b) -> float | None:
    if a is None or b is None:
        return None
    return (b - a).total_seconds() / 60.0


def _last_12_months(now: datetime) -> list[str]:
    months = []
    y, m = now.year, now.month
    for _ in range(12):
        months.append(f"{y:04d}-{m:02d}")
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    return list(reversed(months))


def per_customer_extra(orders: list, events_by_order: dict, manager_names: dict,
                       rfm: dict | None = None, now: datetime | None = None) -> dict:
    """Расширенная аналитика клиента: rfm/churn/clv/monthly/heatmap/serviceTimes/
    managerAffinity/sizeMix. Считается по оплаченным заказам.

    orders            — все заказы клиента (ORM Order);
    events_by_order   — {order_id: [OrderEvent, ...]} (для таймингов сервиса);
    manager_names     — {staff_id: name};
    rfm               — заранее посчитанный {r,f,m} (если None -> 1/1/1, segment по сетке).
    """
    now = now or datetime.utcnow()
    paid = [o for o in orders if o.payment_status == "paid"]
    n = len(paid)
    spent = sum(o.total for o in paid)

    # ---- RFM ----
    rfm = rfm or {"r": 1, "f": 1, "m": 1}
    r, f, m = rfm.get("r", 1), rfm.get("f", 1), rfm.get("m", 1)
    segment = rfm_segment(r, f) if n >= 1 else "no_purchase"
    rfm_block = {"r": r, "f": f, "m": m, "score": f"{r}{f}{m}", "segment": segment}

    dates = sorted((o.created_at for o in paid if o.created_at))
    first, last = (dates[0], dates[-1]) if dates else (None, None)
    recency_days = (now - last).days if last else None
    tenure_days = (now - first).days if first else 0
    avg_days_between = round(tenure_days / (n - 1), 1) if n > 1 else None
    orders_per_month = round(n / max(tenure_days / 30.0, 1.0), 2) if n else 0
    aov = round(spent / n, 2) if n else 0

    # ---- churn / clv ----
    churn = churn_metrics(recency_days, avg_days_between, orders_per_month)
    clv = clv_metrics({"totalSpent": spent, "avgOrderValue": aov,
                       "ordersPerMonth": orders_per_month}, churn)

    # ---- monthly (12 календарных месяцев, zero-filled, oldest first) ----
    months = _last_12_months(now)
    month_idx = {mk: i for i, mk in enumerate(months)}
    monthly = [{"month": mk, "orders": 0, "revenue": 0.0} for mk in months]
    for o in paid:
        if not o.created_at:
            continue
        mk = f"{o.created_at.year:04d}-{o.created_at.month:02d}"
        i = month_idx.get(mk)
        if i is not None:
            monthly[i]["orders"] += 1
            monthly[i]["revenue"] = round(monthly[i]["revenue"] + (o.total or 0), 2)

    # ---- heatmap int[7][24] weekday(0=Mon) x hour ----
    heatmap = [[0] * 24 for _ in range(7)]
    for o in paid:
        if o.created_at:
            heatmap[o.created_at.weekday()][o.created_at.hour] += 1

    # ---- serviceTimes ----
    prep, pickup, total = [], [], []
    for o in paid:
        evs = events_by_order.get(o.id) or []
        ts = _event_times(evs)
        p = _minutes(ts["paid"], ts["ready"])
        u = _minutes(ts["ready"], ts["completed"])
        tt = _minutes(ts["paid"], ts["completed"])
        if p is not None and p >= 0:
            prep.append(p)
        if u is not None and u >= 0:
            pickup.append(u)
        if tt is not None and tt >= 0:
            total.append(tt)

    def _avg(xs):
        return round(sum(xs) / len(xs), 1) if xs else None

    service_times = {
        "avgPrepMin": _avg(prep),
        "avgPickupMin": _avg(pickup),
        "avgTotalMin": _avg(total),
        "samples": max(len(prep), len(pickup), len(total)),
    }

    # ---- managerAffinity ----
    mgr_counts: Counter = Counter()
    for o in paid:
        if o.manager_id:
            mgr_counts[o.manager_id] += 1
    mgr_total = sum(mgr_counts.values())
    manager_affinity = [
        {"managerId": mid, "name": manager_names.get(mid, f"#{mid}"),
         "orders": cnt, "share": round(cnt / mgr_total, 2) if mgr_total else 0.0}
        for mid, cnt in mgr_counts.most_common()
    ]

    # ---- sizeMix ----
    size_counts: Counter = Counter()
    for o in paid:
        for it in o.items:
            size_counts[it.size_label or "—"] += it.quantity
    size_total = sum(size_counts.values())
    size_mix = [
        {"size": sz, "qty": qty, "share": round(qty / size_total, 2) if size_total else 0.0}
        for sz, qty in size_counts.most_common()
    ]

    return {
        "rfm": rfm_block,
        "churn": churn,
        "clv": clv,
        "monthly": monthly,
        "heatmap": heatmap,
        "serviceTimes": service_times,
        "managerAffinity": manager_affinity,
        "sizeMix": size_mix,
    }


def build_audience(users, per_user_stats, now):
    """Агрегирует CRM-аудиторию (сегменты / KPI / RFM-сетка / персоны) из уже
    загруженной статистики клиентов. Чистая: на входе ORM-клиенты + per_user_stats,
    DB-запросы делает вызывающий роутер."""
    # пороги RFM один раз по всей когорте оплаченных клиентов
    thresholds = rfm_thresholds(list(per_user_stats.values()))

    seg_buckets: dict[str, list[dict]] = {k: [] for k in SEGMENTS}
    rfm_grid = [[0] * 5 for _ in range(5)]  # [fIndex-1][rIndex-1]
    persona_counter: Counter = Counter()
    clv_sum = 0.0
    kpi_active = kpi_at_risk = kpi_churned = kpi_new = 0
    month_key = f"{now.year:04d}-{now.month:02d}"

    for u in users:
        st = per_user_stats[u.id]
        paid = st["paidOrders"]
        scores = rfm_scores(st["recencyDays"], paid, st["totalSpent"], thresholds)
        r, f, m = scores["r"], scores["f"], scores["m"]
        segment = rfm_segment(r, f) if paid >= 1 else "no_purchase"

        churn = churn_metrics(st["recencyDays"], st["avgDaysBetween"], st["ordersPerMonth"])
        clv = clv_metrics(st, churn)
        clv_sum += clv["predicted"]
        tags = persona_tags(st)
        for tag in tags:
            persona_counter[tag] += 1

        recency = st["recencyDays"]
        if recency is not None and recency <= 30:
            kpi_active += 1
        if churn["risk"] == "high" and paid > 0:
            kpi_at_risk += 1
        if recency is not None and recency > 60:
            kpi_churned += 1
        if (st["firstOrderAt"] or "").startswith(month_key):
            kpi_new += 1

        if paid >= 1:
            rfm_grid[f - 1][r - 1] += 1

        seg_buckets[segment].append({
            "id": u.id, "name": u.name, "phone": u.phone,
            "totalSpent": st["totalSpent"], "recencyDays": recency,
            "paidOrders": paid,
            "rfm": {"r": r, "f": f, "m": m, "score": f"{r}{f}{m}", "segment": segment},
            "_tags": tags,
        })

    segments_out = []
    for key, label_desc in SEGMENTS.items():
        label, description = label_desc
        members = seg_buckets[key]
        count = len(members)
        spents = [c["totalSpent"] for c in members]
        recencies = [c["recencyDays"] for c in members if c["recencyDays"] is not None]
        freqs = [c["paidOrders"] for c in members]
        tag_counter: Counter = Counter()
        for c in members:
            for tg in c["_tags"]:
                tag_counter[tg] += 1
        top = sorted(members, key=lambda c: c["totalSpent"], reverse=True)[:12]
        segments_out.append({
            "key": key, "label": label, "description": description,
            "count": count,
            "share": round(count / len(users), 2) if users else 0.0,
            "avgSpent": round(sum(spents) / count, 2) if count else 0.0,
            "avgRecency": round(sum(recencies) / len(recencies), 1) if recencies else None,
            "avgFrequency": round(sum(freqs) / count, 2) if count else 0.0,
            "personaTags": [{"tag": tg, "count": cnt} for tg, cnt in tag_counter.most_common(5)],
            "customers": [{k: v for k, v in c.items() if k != "_tags"} for c in top],
        })

    total = len(users)
    personas = [{"tag": tg, "count": cnt, "share": round(cnt / total, 2) if total else 0.0}
                for tg, cnt in persona_counter.most_common()]

    return {
        "total": total,
        "kpis": {
            "customers": total,
            "active": kpi_active,
            "atRisk": kpi_at_risk,
            "churned": kpi_churned,
            "newThisMonth": kpi_new,
            "avgCLV": round(clv_sum / total, 2) if total else 0.0,
        },
        "segments": segments_out,
        "rfmGrid": rfm_grid,
        "personas": personas,
    }
