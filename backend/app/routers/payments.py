from datetime import datetime

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.config import settings
from ..core.db import get_db
from ..core.security import get_current_user
from ..models.orders import Order, Payment
from ..models.users import User
from ..services.order_flow import mark_paid
from ..services.payment_mock import apply_mock_stripe

router = APIRouter(prefix="/api/payments", tags=["payments"])


class CheckoutIn(BaseModel):
    orderId: int
    successUrl: str = "/orders/{id}"
    cancelUrl: str = "/checkout"


@router.post("/checkout-session")
def create_checkout(body: CheckoutIn, user: User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    """PUB-A-02: hosted-форма Stripe (решение владельца).
    DECISION: без STRIPE_SECRET_KEY работает mock-режим — платёж создаётся и сразу
    подтверждается, redirect ведёт на страницу заказа; при наличии ключа создаётся
    реальная Checkout Session (код за флагом, чтобы прототип работал без аккаунта Stripe)."""
    order = db.get(Order, body.orderId)
    if not order or order.user_id != user.id:
        raise HTTPException(404, "NOT_FOUND")
    if order.payment_status == "paid":
        raise HTTPException(409, "ALREADY_PAID")

    payment = Payment(order_id=order.id, amount=order.total, status="pending",
                      livemode=bool((settings.stripe_secret_key or "").startswith("sk_live")))
    db.add(payment)
    db.commit()

    if settings.stripe_secret_key:
        try:
            import stripe  # type: ignore

            stripe.api_key = settings.stripe_secret_key
            session = stripe.checkout.Session.create(
                mode="payment",
                line_items=[{
                    "price_data": {
                        "currency": "aed",
                        "product_data": {"name": f"Juicy order #{order.number}"},
                        "unit_amount": int(order.total * 100),
                    },
                    "quantity": 1,
                }],
                success_url=body.successUrl.replace("{id}", str(order.id)),
                cancel_url=body.cancelUrl,
                metadata={"order_id": order.id, "payment_id": payment.id},
            )
            payment.provider_id = session.id
            db.commit()
            return {"checkoutUrl": session.url, "mock": False}
        except ModuleNotFoundError:
            pass  # stripe SDK не установлен -> mock

    # mock-режим: оплата подтверждается сразу, Stripe-детали — детерминированный синтетик
    payment.provider_id = f"mock_{payment.id}"
    payment.status = "succeeded"
    apply_mock_stripe(payment, order)
    db.commit()
    mark_paid(db, order, provider_id=payment.provider_id)
    return {"checkoutUrl": f"/orders/{order.id}?paid=1", "mock": True}


# ---------- маппинг реальных объектов Stripe в нашу модель платежа ----------

def _apply_charge(payment: Payment, charge: dict) -> None:
    """Stripe Charge → поля платежа: карта, чек, риск, комиссия, возвраты."""
    payment.charge_id = charge.get("id") or payment.charge_id
    payment.payment_intent_id = charge.get("payment_intent") or payment.payment_intent_id
    payment.customer_id = charge.get("customer") or payment.customer_id
    payment.receipt_url = charge.get("receipt_url") or payment.receipt_url
    payment.livemode = bool(charge.get("livemode", payment.livemode))

    pmd = charge.get("payment_method_details") or {}
    card = pmd.get("card") or {}
    if card:
        payment.method_type = pmd.get("type") or payment.method_type
        payment.card_brand = card.get("brand") or payment.card_brand
        payment.card_last4 = card.get("last4") or payment.card_last4
        payment.card_funding = card.get("funding") or payment.card_funding
        payment.card_country = card.get("country") or payment.card_country
        exp_m, exp_y = card.get("exp_month"), card.get("exp_year")
        if exp_m and exp_y:
            payment.card_exp = f"{int(exp_m):02d}/{exp_y}"

    outcome = charge.get("outcome") or {}
    payment.risk_level = outcome.get("risk_level") or payment.risk_level
    if outcome.get("risk_score") is not None:
        payment.risk_score = outcome.get("risk_score")

    bt = charge.get("balance_transaction")  # комиссия/чистыми (если развёрнут expand)
    if isinstance(bt, dict):
        payment.fee_amount = round((bt.get("fee", 0) or 0) / 100, 2)
        payment.net_amount = round((bt.get("net", 0) or 0) / 100, 2)

    if charge.get("amount_refunded") is not None:
        payment.refunded_amount = round(charge["amount_refunded"] / 100, 2)
    payment.updated_at = datetime.utcnow()


def _enrich_payment_from_stripe(payment: Payment) -> None:
    """Подтягивает Charge/PaymentMethod/BalanceTransaction по PaymentIntent (best-effort)."""
    if not settings.stripe_secret_key or not payment.payment_intent_id:
        return
    try:
        import stripe  # type: ignore

        stripe.api_key = settings.stripe_secret_key
        pi = stripe.PaymentIntent.retrieve(
            payment.payment_intent_id, expand=["latest_charge.balance_transaction"])
        charge = pi.get("latest_charge")
        if isinstance(charge, dict):
            _apply_charge(payment, charge)
    except Exception:
        pass  # обогащение опционально — факт оплаты уже зафиксирован


def _payment_by_charge(db: Session, charge: dict) -> Payment | None:
    cid, pi = charge.get("id"), charge.get("payment_intent")
    p = db.scalar(select(Payment).where(Payment.charge_id == cid)) if cid else None
    if not p and pi:
        p = db.scalar(select(Payment).where(Payment.payment_intent_id == pi))
    return p


@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db),
                         stripe_signature: str | None = Header(None)):
    """PUB-A-02 AC4: факт оплаты подтверждается webhook'ом, не редиректом.
    Помимо оплаты обрабатываем отказ, возврат и спор — чтобы карточка платежа в
    админке всегда отражала актуальное состояние со стороны Stripe."""
    payload = await request.json()
    if settings.stripe_webhook_secret:
        # подпись проверяется stripe SDK; без ключа принимаем тестовые события
        try:
            import stripe  # type: ignore

            raw = await request.body()
            stripe.Webhook.construct_event(raw, stripe_signature, settings.stripe_webhook_secret)
        except Exception:
            raise HTTPException(400, "BAD_SIGNATURE")

    etype = payload.get("type")
    obj = payload.get("data", {}).get("object", {})

    if etype == "checkout.session.completed":
        meta = obj.get("metadata", {})
        # устойчивость к мусорным metadata: нечисловой id → событие игнорируем, не 500
        try:
            order_id = int(meta.get("order_id", 0))
            payment_id = int(meta.get("payment_id", 0))
        except (TypeError, ValueError):
            return {"received": True}
        order = db.get(Order, order_id)
        payment = db.get(Payment, payment_id)
        if order and payment and order.payment_status != "paid":
            payment.status = "succeeded"
            payment.payment_intent_id = obj.get("payment_intent") or payment.payment_intent_id
            payment.customer_id = obj.get("customer") or payment.customer_id
            _enrich_payment_from_stripe(payment)
            mark_paid(db, order, provider_id=payment.provider_id)

    elif etype == "payment_intent.payment_failed":
        payment = db.scalar(select(Payment).where(
            Payment.payment_intent_id == obj.get("id"))) if obj.get("id") else None
        if payment:
            err = obj.get("last_payment_error") or {}
            payment.status = "failed"
            payment.failure_code = err.get("code") or err.get("decline_code")
            payment.failure_message = err.get("message")
            payment.updated_at = datetime.utcnow()
            db.commit()

    elif etype == "charge.refunded":
        payment = _payment_by_charge(db, obj)
        if payment:
            _apply_charge(payment, obj)
            if (payment.refunded_amount or 0) >= (payment.amount or 0) - 0.001:
                payment.status = "refunded"
                if payment.order and payment.order.payment_status != "refunded":
                    payment.order.payment_status = "refunded"
            db.commit()

    elif etype == "charge.dispute.created":
        payment = db.scalar(select(Payment).where(
            Payment.charge_id == obj.get("charge"))) if obj.get("charge") else None
        if payment:
            payment.dispute_status = obj.get("status") or "needs_response"
            payment.updated_at = datetime.utcnow()
            db.commit()

    return {"received": True}
