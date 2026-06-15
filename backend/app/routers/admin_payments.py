"""Админка: платежи (ADM-S-09) + интеграция Stripe (config/summary/refund)."""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..core.config import settings
from ..core.db import get_db
from ..core.pagination import PageLimit, PageOffset, paginate
from ..core.security import require_super_admin
from ..models.orders import Order, Payment
from ..services.order_flow import add_event, notify
from ._serializers import _payment_row, _payment_row_full

router = APIRouter(prefix="/api/admin", tags=["admin-payments"])


def _stripe_mode() -> str:
    """mock (нет ключа) | test (sk_test_…) | live (sk_live_…)."""
    key = settings.stripe_secret_key or ""
    if not key:
        return "mock"
    return "live" if key.startswith("sk_live") else "test"


@router.get("/payments/config", dependencies=[Depends(require_super_admin)])
def payments_config():
    """Состояние интеграции Stripe — для баннера/чеклиста подключения в админке."""
    mode = _stripe_mode()
    return {
        "provider": "stripe",
        "connected": mode != "mock",
        "mode": mode,                                    # mock | test | live
        "webhookConfigured": bool(settings.stripe_webhook_secret),
        "currency": "AED",
        "feePolicy": "2.9% + 1 AED",
        "dashboardUrl": "https://dashboard.stripe.com" + ("/test" if mode == "test" else ""),
    }


@router.get("/payments/summary", dependencies=[Depends(require_super_admin)])
def payments_summary(date_from: datetime | None = Query(None, alias="from"),
                     date_to: datetime | None = Query(None, alias="to"),
                     db: Session = Depends(get_db)):
    """Сводка: оборот / комиссии Stripe / чистыми / возвраты + разбивки по статусу, методу, карте."""
    q = select(Payment)
    if date_from:
        q = q.where(Payment.created_at >= date_from)
    if date_to:
        q = q.where(Payment.created_at <= date_to)
    rows = db.scalars(q).all()

    succeeded = [p for p in rows if p.status == "succeeded"]
    refunded = [p for p in rows if p.status == "refunded"]
    captured = succeeded + refunded                       # деньги реально списывались
    gross = sum(p.amount or 0 for p in captured)
    fees = sum(p.fee_amount or 0 for p in captured)
    refunds = sum(p.refunded_amount or 0 for p in rows)
    net = gross - fees - refunds

    by_status: dict[str, dict] = {}
    for p in rows:
        s = by_status.setdefault(p.status, {"count": 0, "amount": 0.0})
        s["count"] += 1
        s["amount"] = round(s["amount"] + (p.amount or 0), 2)

    by_method: dict[str, dict] = {}
    for p in captured:
        m = by_method.setdefault(p.method_type or "card", {"count": 0, "amount": 0.0})
        m["count"] += 1
        m["amount"] = round(m["amount"] + (p.amount or 0), 2)

    by_brand: dict[str, int] = {}
    for p in captured:
        if p.card_brand:
            by_brand[p.card_brand] = by_brand.get(p.card_brand, 0) + 1

    attempts = len(rows)
    ok = len(captured)
    return {
        "count": attempts,
        "gross": round(gross, 2),
        "fees": round(fees, 2),
        "refunds": round(refunds, 2),
        "net": round(net, 2),
        "avg": round(gross / ok, 2) if ok else 0,
        "successRate": round(ok / attempts, 3) if attempts else 0,
        "succeededCount": len(succeeded),
        "refundedCount": len(refunded),
        "pendingCount": sum(1 for p in rows if p.status == "pending"),
        "failedCount": sum(1 for p in rows if p.status == "failed"),
        "disputedCount": sum(1 for p in rows if p.dispute_status),
        "currency": "AED",
        "byStatus": by_status,
        "byMethod": by_method,
        "byBrand": by_brand,
    }


@router.get("/payments", dependencies=[Depends(require_super_admin)])
def payments_list(response: Response,
                  status: str | None = Query(None),
                  method: str | None = Query(None),
                  q: str | None = Query(None, description="поиск: № заказа, телефон, id Stripe, last4"),
                  date_from: datetime | None = Query(None, alias="from"),
                  date_to: datetime | None = Query(None, alias="to"),
                  limit: int | None = PageLimit, offset: int = PageOffset,
                  db: Session = Depends(get_db)):
    sel = select(Payment).options(selectinload(Payment.order)).order_by(Payment.id.desc())
    if status:
        sel = sel.where(Payment.status == status)
    if method:
        sel = sel.where(Payment.method_type == method)
    if date_from:
        sel = sel.where(Payment.created_at >= date_from)
    if date_to:
        sel = sel.where(Payment.created_at <= date_to)
    rows = db.scalars(sel).all()

    out = [_payment_row_full(p) for p in rows]
    if q:
        needle = q.strip().lower()
        out = [r for r in out if needle in " ".join(
            str(v).lower() for v in (r["orderNumber"], r["customerPhone"], r["customerName"],
                                     r["providerId"], r["paymentIntentId"], r["chargeId"],
                                     r["cardLast4"], r["id"]) if v)]
    return paginate(out, response, limit, offset)


@router.get("/payments/{payment_id}", dependencies=[Depends(require_super_admin)])
def payment_detail(payment_id: int, db: Session = Depends(get_db)):
    p = db.get(Payment, payment_id)
    if not p:
        raise HTTPException(404, "NOT_FOUND")
    row = _payment_row_full(p)
    o = p.order
    if o:
        row["order"] = {
            "id": o.id, "number": o.number, "status": o.status,
            "paymentStatus": o.payment_status, "total": round(o.total or 0, 2),
            "subtotal": round(o.subtotal or 0, 2), "couponDiscount": round(o.coupon_discount or 0, 2),
            "createdAt": o.created_at.isoformat() if o.created_at else None,
            "items": [{"name": i.custom_name or i.drink_name, "quantity": i.quantity,
                       "unitPrice": round(i.unit_price or 0, 2)} for i in o.items],
        }
        # таймлайн платежа из денежных событий заказа (реальные данные)
        timeline = [{"type": e.type, "note": e.note,
                     "at": e.created_at.isoformat() if e.created_at else None}
                    for e in o.events if e.type in ("created", "paid", "refund")]
        if p.dispute_status:
            timeline.append({"type": "dispute", "note": p.dispute_status,
                             "at": row.get("updatedAt")})
        row["timeline"] = timeline
    return row


class PaymentRefundIn(BaseModel):
    amount: float | None = None   # частичный возврат; None → полный остаток
    reason: str | None = None


@router.post("/payments/{payment_id}/refund", dependencies=[Depends(require_super_admin)])
def refund_payment(payment_id: int, body: PaymentRefundIn | None = None,
                   db: Session = Depends(get_db)):
    """Возврат по платежу: Stripe Refund при реальном charge, иначе локально.
    Частичный возврат поддержан; полный переводит заказ в payment_status=refunded.
    Готовочный статус заказа не трогаем — возврат денег от него не зависит."""
    p = db.get(Payment, payment_id)
    if not p:
        raise HTTPException(404, "NOT_FOUND")
    if p.status not in ("succeeded", "refunded"):
        raise HTTPException(409, "NOT_REFUNDABLE")
    already = p.refunded_amount or 0
    remaining = round((p.amount or 0) - already, 2)
    if remaining <= 0:
        raise HTTPException(409, "ALREADY_REFUNDED")
    amount = round(min(body.amount, remaining), 2) if (body and body.amount) else remaining
    if amount <= 0:
        raise HTTPException(422, "VALIDATION_ERROR")

    if settings.stripe_secret_key and p.charge_id and not p.charge_id.startswith("ch_mock"):
        try:
            import stripe  # type: ignore

            stripe.api_key = settings.stripe_secret_key
            stripe.Refund.create(charge=p.charge_id, amount=int(amount * 100),
                                 reason=(body.reason if body else None) or None)
        except Exception as e:  # пробрасываем как 502, не роняем 500
            raise HTTPException(502, f"STRIPE_REFUND_FAILED:{e}")

    p.refunded_amount = round(already + amount, 2)
    full = p.refunded_amount >= (p.amount or 0) - 0.001
    if full:
        p.status = "refunded"
    p.updated_at = datetime.utcnow()

    o = p.order
    if o:
        note = (body.reason if body else None) or f"refund {amount} {p.currency}"
        add_event(db, o, "refund", note=note)
        if full and o.payment_status != "refunded":
            o.payment_status = "refunded"
    db.commit()
    if o:
        notify(o)
    return _payment_row_full(p)
