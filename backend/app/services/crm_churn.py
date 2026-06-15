"""Метрики оттока (churn) и прогнозной ценности клиента (CLV). Чистые функции."""


def _round2(x) -> float:
    return round(float(x or 0), 2)


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


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
