from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..core.config import settings
from ..core.db import get_db
from ..core.security import get_current_user
from ..models.orders import Order, Payment
from ..models.users import User
from ..services.order_flow import mark_paid

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

    payment = Payment(order_id=order.id, amount=order.total, status="pending")
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

    # mock-режим: webhook эмулируется немедленно
    payment.provider_id = f"mock_{payment.id}"
    payment.status = "succeeded"
    mark_paid(db, order, provider_id=payment.provider_id)
    return {"checkoutUrl": f"/orders/{order.id}?paid=1", "mock": True}


@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db),
                         stripe_signature: str | None = Header(None)):
    """PUB-A-02 AC4: факт оплаты подтверждается webhook'ом, не редиректом."""
    payload = await request.json()
    if settings.stripe_webhook_secret:
        # подпись проверяется stripe SDK; без ключа принимаем тестовые события
        try:
            import stripe  # type: ignore

            raw = await request.body()
            stripe.Webhook.construct_event(raw, stripe_signature, settings.stripe_webhook_secret)
        except Exception:
            raise HTTPException(400, "BAD_SIGNATURE")

    if payload.get("type") == "checkout.session.completed":
        meta = payload.get("data", {}).get("object", {}).get("metadata", {})
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
            mark_paid(db, order, provider_id=payment.provider_id)
    return {"received": True}
