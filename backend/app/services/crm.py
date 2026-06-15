"""CRM-аналитика (RFM, отток, CLV, персоны, тайминги сервиса) — фасад.

Реализация разнесена по слоям-модулям, чтобы файлы были компактными и переиспользуемыми:
  - crm_rfm      — RFM: пороги, скоринг r/f/m, сетка сегментов, метки SEGMENTS;
  - crm_churn    — отток и прогнозная ценность (CLV);
  - crm_personas — поведенческие теги клиента;
  - crm_audience — сводка по клиенту и агрегация аудитории.

Этот модуль ре-экспортирует публичный API, чтобы существующие импорты
(`from ..services import crm; crm.build_audience(...)`) продолжали работать.
Все денежные значения округляются до 2 знаков; деления защищены от нуля; клиенты без
оплаченных заказов обрабатываются мягко (сегмент no_purchase, r=f=m=1).
"""
from .crm_audience import (_event_times, _last_12_months, _minutes, build_audience,
                           per_customer_extra)
from .crm_churn import _clamp, _round2, churn_metrics, clv_metrics
from .crm_personas import _CATEGORY_HINTS, persona_tags
from .crm_rfm import (SEGMENTS, _quintiles, _score_high_good, _score_low_good, rfm_scores,
                      rfm_segment, rfm_thresholds)

__all__ = [
    "SEGMENTS",
    "rfm_thresholds", "rfm_scores", "rfm_segment",
    "_quintiles", "_score_high_good", "_score_low_good",
    "churn_metrics", "clv_metrics", "_clamp", "_round2",
    "persona_tags", "_CATEGORY_HINTS",
    "per_customer_extra", "build_audience",
    "_event_times", "_minutes", "_last_12_months",
]
