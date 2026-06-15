"""Поведенческие персоны клиента: набор тегов из фиксированного словаря (метки на английском)."""
from collections import Counter

# намёки на категорию по названию напитка (если категория неизвестна); ключ — это сам тег
_CATEGORY_HINTS = {
    "Fresh fan": ("fresh", "juice", "фреш", "сок"),
    "Smoothie fan": ("smoothie", "смузи"),
    "Detox fan": ("detox", "детокс", "cleanse"),
    "Shot fan": ("shot", "шот"),
}


def persona_tags(stats: dict) -> list[str]:
    """Поведенческие теги клиента из фиксированного словаря (английские метки)."""
    tags: list[str] = []
    peak_hour = stats.get("peakHour")
    if peak_hour is not None:
        if peak_hour < 12:
            tags.append("Morning")
        elif peak_hour < 18:
            tags.append("Afternoon")
        else:
            tags.append("Evening")

    by_weekday = stats.get("byWeekday") or [0] * 7
    weekdays = sum(by_weekday[:5])
    weekend = sum(by_weekday[5:])
    if weekdays > weekend:
        tags.append("Weekdays")
    elif (weekdays + weekend) > 0:
        tags.append("Weekends")

    # любитель добавок: в среднем >= 1.5 порции добавок на оплаченный заказ
    top_addons = stats.get("topAddons") or []
    paid = stats.get("paidOrders") or 0
    addon_portions = sum(a.get("qty", 0) for a in top_addons)
    if paid and addon_portions / paid >= 1.5:
        tags.append("Add-on lover")

    # крупный чек: средний чек в верхнем диапазоне (>= 60 AED — эвристика верхнего тира)
    if (stats.get("avgOrderValue") or 0) >= 60:
        tags.append("Big spender")

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
        tags.append("Coupon user")

    rated = stats.get("ratedOrders") or 0
    satisfaction = stats.get("satisfaction")
    if rated >= 2 and satisfaction is not None:
        if satisfaction >= 0.7:
            tags.append("Promoter")
        elif satisfaction < 0.4:
            tags.append("Detractor")

    return tags
