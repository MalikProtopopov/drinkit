"""Детерминированный синтетик деталей платежа Stripe для mock-режима.

Без ключей Stripe (settings.stripe_secret_key пуст) реальных Charge / PaymentMethod /
BalanceTransaction нет, поэтому карточку платежа в админке наполняем правдоподобными
данными, выведенными из id платежа — стабильно между перезапусками. Та же функция
используется и при создании mock-оплаты в checkout, и при бэкфилле старых строк, так что
страница «Платежи» выглядит как на реальном Stripe ещё до подключения аккаунта.

Комиссия считается по тарифу Stripe UAE: 2.9% + 1 AED за успешное списание.
"""
from datetime import datetime

# (brand, funding, country) — реалистичный набор карт для рынка UAE
_CARDS = [
    ("visa", "credit", "AE"),
    ("mastercard", "credit", "AE"),
    ("mada", "debit", "SA"),
    ("visa", "debit", "AE"),
    ("amex", "credit", "AE"),
    ("mastercard", "prepaid", "GB"),
]
_METHODS = ["card", "card", "card", "card", "apple_pay", "google_pay", "link"]

STRIPE_FEE_PCT = 0.029
STRIPE_FEE_FIXED = 1.0  # AED


def stripe_fee(amount: float) -> float:
    """Комиссия Stripe UAE на успешное списание: 2.9% + 1 AED."""
    return round((amount or 0) * STRIPE_FEE_PCT + STRIPE_FEE_FIXED, 2)


def apply_mock_stripe(payment, order=None) -> None:
    """Заполняет Stripe-поля платежа правдоподобным синтетиком in-place.

    Идемпотентно: заполненный `card_brand` — признак «уже наполнено», повторно не трогаем.
    Деньги/карта проставляются для succeeded и refunded; failed получает причину отказа."""
    if payment.card_brand:  # уже наполнено ранее
        return
    pid = payment.id or 0
    brand, funding, country = _CARDS[pid % len(_CARDS)]
    payment.method_type = _METHODS[pid % len(_METHODS)]
    payment.card_brand = brand
    payment.card_last4 = f"{(pid * 7919 + 1234) % 10000:04d}"
    payment.card_funding = funding
    payment.card_country = country
    payment.card_exp = f"{(pid % 12) + 1:02d}/2028"
    payment.customer_id = payment.customer_id or (
        f"cus_mock{order.user_id}" if order else f"cus_mock{pid}")

    if payment.status in ("succeeded", "refunded"):
        payment.payment_intent_id = payment.payment_intent_id or f"pi_mock_{pid}"
        payment.charge_id = payment.charge_id or f"ch_mock_{pid}"
        fee = stripe_fee(payment.amount)
        payment.fee_amount = fee
        payment.net_amount = round((payment.amount or 0) - fee, 2)
        payment.receipt_url = f"https://pay.stripe.com/receipts/mock/{payment.charge_id}"
        # created_at (server_default) ещё не подгружен на свежесозданном объекте → фолбэк
        payment.paid_at = payment.paid_at or payment.created_at or datetime.utcnow()
        # риск: преимущественно normal, изредка elevated (детерминированно по id)
        if pid % 11 == 0:
            payment.risk_level, payment.risk_score = "elevated", 58 + pid % 12
        else:
            payment.risk_level, payment.risk_score = "normal", 5 + pid % 25

    if payment.status == "refunded":
        payment.refunded_amount = payment.amount
    if payment.status == "failed":
        payment.failure_code = "card_declined"
        payment.failure_message = "Your card was declined."

    payment.updated_at = datetime.utcnow()
