"""CRM-аналитика (RFM, отток, CLV, персоны, тайминги сервиса).

Чистые функции без зависимости от FastAPI/SQLAlchemy: на вход подаются уже
загруженные ORM-объекты заказов/событий (или их атрибуты), на выход — словари
готовые к сериализации в camelCase JSON. Денежные/частотные метрики считаются по
ОПЛАЧЕННЫМ заказам (payment_status == "paid") — это реальные покупки.

Все денежные значения округляются до 2 знаков; деления защищены от нуля; клиенты
без оплаченных заказов обрабатываются мягко (сегмент no_purchase, r=f=m по grid).
"""
from collections import Counter
from datetime import datetime

# ---- Сегменты RFM: ключ -> (русская метка, краткое описание) ----
SEGMENTS: dict[str, tuple[str, str]] = {
    "champions": ("Чемпионы", "Покупают часто, много и недавно — ядро базы."),
    "loyal": ("Лояльные", "Регулярные покупки, высокая ценность."),
    "potential_loyalist": ("Потенциально лояльные", "Недавние, с потенциалом стать лояльными."),
    "new_customers": ("Новички", "Совершили первые покупки совсем недавно."),
    "promising": ("Перспективные", "Недавние покупатели с небольшой частотой."),
    "need_attention": ("Требуют внимания", "Средние показатели, давно не возвращались."),
    "at_risk": ("В зоне риска", "Раньше покупали активно, сейчас пропали."),
    "hibernating": ("Засыпающие", "Низкая активность, давно не покупали."),
    "lost": ("Потерянные", "Минимальная активность, очень давно не покупали."),
    "no_purchase": ("Без покупок", "Зарегистрированы, но не оплатили ни одного заказа."),
}


def _round2(x) -> float:
    return round(float(x or 0), 2)


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


# ====================== RFM ======================

def _quintiles(values: list[float]) -> list[float]:
    """4 точки отсечения (20/40/60/80 перцентили) над отсортированными значениями."""
    vals = sorted(values)
    n = len(vals)
    if n == 0:
        return [0.0, 0.0, 0.0, 0.0]
    cuts = []
    for p in (0.2, 0.4, 0.6, 0.8):
        idx = int(round(p * (n - 1)))
        cuts.append(float(vals[idx]))
    return cuts


def rfm_thresholds(metrics_list: list[dict]) -> dict:
    """Квинтильные пороги по когорте (только клиенты с paidOrders >= 1).

    recency  — меньше = лучше (свежее), инвертируется при скоринге;
    frequency — paidOrders; monetary — totalSpent.
    """
    cohort = [m for m in metrics_list if (m.get("paidOrders") or 0) >= 1]
    recency = [float(m["recencyDays"]) for m in cohort if m.get("recencyDays") is not None]
    freq = [float(m.get("paidOrders") or 0) for m in cohort]
    monetary = [float(m.get("totalSpent") or 0) for m in cohort]
    return {
        "recency": _quintiles(recency),
        "frequency": _quintiles(freq),
        "monetary": _quintiles(monetary),
        "count": len(cohort),
    }


def _score_high_good(value: float, cuts: list[float]) -> int:
    """Больше = лучше: 1..5 по тому, выше скольких порогов значение."""
    score = 1
    for c in cuts:
        if value >= c:
            score += 1
    return min(score, 5)


def _score_low_good(value: float, cuts: list[float]) -> int:
    """Меньше = лучше (recency): 1..5, свежие получают 5."""
    score = 5
    for c in cuts:
        if value > c:
            score -= 1
    return max(score, 1)


def rfm_scores(recency_days, paid_orders, total_spent, thresholds: dict) -> dict:
    """{r,f,m} каждый 1..5. Клиент без покупок -> r=f=m=1."""
    if (paid_orders or 0) < 1 or recency_days is None:
        return {"r": 1, "f": 1, "m": 1}
    r = _score_low_good(float(recency_days), thresholds.get("recency") or [0, 0, 0, 0])
    f = _score_high_good(float(paid_orders or 0), thresholds.get("frequency") or [0, 0, 0, 0])
    m = _score_high_good(float(total_spent or 0), thresholds.get("monetary") or [0, 0, 0, 0])
    return {"r": r, "f": f, "m": m}


def rfm_segment(r: int, f: int) -> str:
    """Стандартная RFM-сетка 5x5 -> ключ сегмента (M используется для VIP-оверлея отдельно)."""
    if r >= 4 and f >= 4:
        return "champions"
    if r >= 3 and f >= 3:
        return "loyal"
    if r >= 4 and f >= 2:
        return "potential_loyalist"
    if r >= 4 and f <= 1:
        return "new_customers"
    if r >= 3 and f <= 2:
        return "promising"
    if r == 3 and f >= 3:
        return "need_attention"
    if r <= 2 and f >= 3:
        return "at_risk"
    if r == 2 and f <= 2:
        return "hibernating"
    if r <= 2 and f >= 2:
        return "need_attention"
    return "lost"


# ====================== Персоны ======================

# намёки на категорию по названию напитка (если категория неизвестна)
_CATEGORY_HINTS = {
    "Фреш-фан": ("fresh", "juice", "фреш", "сок"),
    "Смузи-фан": ("smoothie", "смузи"),
    "Детокс-фан": ("detox", "детокс", "cleanse"),
    "Шот-фан": ("shot", "шот"),
}


def persona_tags(stats: dict) -> list[str]:
    """Поведенческие теги клиента из фиксированного словаря (русские метки)."""
    tags: list[str] = []
    peak_hour = stats.get("peakHour")
    if peak_hour is not None:
        if peak_hour < 12:
            tags.append("Утренний")
        elif peak_hour < 18:
            tags.append("Дневной")
        else:
            tags.append("Вечерний")

    by_weekday = stats.get("byWeekday") or [0] * 7
    weekdays = sum(by_weekday[:5])
    weekend = sum(by_weekday[5:])
    if weekdays > weekend:
        tags.append("Будни")
    elif (weekdays + weekend) > 0:
        tags.append("Выходные")

    # любитель добавок: в среднем >= 1.5 порции добавок на оплаченный заказ
    top_addons = stats.get("topAddons") or []
    paid = stats.get("paidOrders") or 0
    addon_portions = sum(a.get("qty", 0) for a in top_addons)
    if paid and addon_portions / paid >= 1.5:
        tags.append("Любитель добавок")

    # крупный чек: средний чек в верхнем диапазоне (>= 60 AED — эвристика верхнего тира)
    if (stats.get("avgOrderValue") or 0) >= 60:
        tags.append("Крупный чек")

    # доминирующая категория по объёму (выводим из названий topDrinks)
    top_drinks = stats.get("topDrinks") or []
    cat_qty: Counter = Counter()
    for d in top_drinks:
        name = (d.get("name") or "").lower()
        qty = d.get("qty", 0)
        for tag, hints in _CATEGORY_HINTS.items():
            if any(h in name for h in hints):
                cat_qty[tag] += qty
                break
    if cat_qty:
        tags.append(cat_qty.most_common(1)[0][0])

    if (stats.get("couponsUsed") or 0) > 0:
        tags.append("Купонщик")

    rated = stats.get("ratedOrders") or 0
    satisfaction = stats.get("satisfaction")
    if rated >= 2 and satisfaction is not None:
        if satisfaction >= 0.7:
            tags.append("Промоутер")
        elif satisfaction < 0.4:
            tags.append("Критик")

    return tags


# ====================== Отток / CLV ======================

def churn_metrics(recency_days, avg_days_between, orders_per_month) -> dict:
    """Эвристика оттока. Если известен средний интервал между заказами —
    просрочка = recency - avgDaysBetween; вероятность = clamp(overdue/(avg*3),0,1)."""
    if recency_days is None:
        # нет покупок -> максимальный риск, но без вероятности интервала
        return {"probability": 1.0, "risk": "high",
                "expectedNextOrderInDays": None, "daysOverdue": None}

    if avg_days_between and avg_days_between > 0:
        overdue = recency_days - avg_days_between
        probability = _clamp(overdue / (avg_days_between * 3.0), 0.0, 1.0)
        days_overdue = max(0, round(overdue))
        expected_next = max(0, round(avg_days_between - recency_days))
    else:
        # единственный заказ / нет интервала: судим по сроку давности
        probability = _clamp(recency_days / 90.0, 0.0, 1.0)
        days_overdue = None
        expected_next = None

    probability = round(probability, 2)
    if probability < 0.34:
        risk = "low"
    elif probability < 0.67:
        risk = "medium"
    else:
        risk = "high"
    return {"probability": probability, "risk": risk,
            "expectedNextOrderInDays": expected_next, "daysOverdue": days_overdue}


def clv_metrics(stats: dict, churn: dict) -> dict:
    """Историческая ценность = totalSpent; прогноз на 12 мес с поправкой на отток."""
    historical = _round2(stats.get("totalSpent"))
    aov = stats.get("avgOrderValue") or 0
    opm = stats.get("ordersPerMonth") or 0
    retention = 1.0 - (churn.get("probability") or 0.0)
    predicted = max(0.0, aov * opm * 12.0 * retention)
    return {"historical": historical, "predicted": _round2(predicted), "horizonMonths": 12}


# ====================== Тайминги сервиса ======================

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


# ====================== Месячная динамика / heatmap ======================

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


# ====================== Сводка по клиенту ======================

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
