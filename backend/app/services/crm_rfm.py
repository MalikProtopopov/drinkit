"""RFM-аналитика: квинтильные пороги по когорте, скоринг r/f/m и сетка сегментов.

Чистые функции без FastAPI/SQLAlchemy. Метки сегментов — на английском (админка EN)."""

# ---- Сегменты RFM: ключ -> (метка, краткое описание), на английском ----
SEGMENTS: dict[str, tuple[str, str]] = {
    "champions": ("Champions", "Buy often, recently and a lot — the core of the base."),
    "loyal": ("Loyal", "Regular purchases, high value."),
    "potential_loyalist": ("Potential loyalists", "Recent, with potential to become loyal."),
    "new_customers": ("New customers", "Made their first purchases very recently."),
    "promising": ("Promising", "Recent buyers with low frequency."),
    "need_attention": ("Need attention", "Average metrics, haven't returned in a while."),
    "at_risk": ("At risk", "Used to buy actively, now gone quiet."),
    "hibernating": ("Hibernating", "Low activity, haven't bought in a long time."),
    "lost": ("Lost", "Minimal activity, haven't bought for a very long time."),
    "no_purchase": ("No purchases", "Registered but never paid for an order."),
}


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
    """Стандартная RFM-сетка 5x5 -> ключ сегмента (M используется для VIP-оверлея отдельно).
    Ветки упорядочены без перекрытий: каждая клетка (r,f) попадает ровно в один сегмент,
    недостижимых веток нет (ранее r==3&f>=3 и r<=2&f>=2 были затенены — RFM-DEAD)."""
    if r >= 4 and f >= 4:
        return "champions"
    if r == 3 and f >= 4:
        return "loyal"               # очень частые, умеренно свежие
    if r >= 4 and f >= 2:
        return "potential_loyalist"  # свежие, средняя частота
    if r >= 4:                       # f <= 1
        return "new_customers"
    if r == 3 and f >= 2:
        return "need_attention"      # середина по всем осям
    if r == 3:                       # f <= 1
        return "promising"           # недавние, низкая частота
    if r <= 2 and f >= 3:
        return "at_risk"             # раньше покупали активно, затихли
    if r <= 2 and f == 2:
        return "hibernating"
    return "lost"                    # r <= 2, f <= 1
