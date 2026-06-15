"""Сериализаторы строк админки (заказ / платёж / купон) — общие для доменных роутеров.
Вынесены из admin_orders.py при разбиении god-файла; чистые функции, без FastAPI."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models.catalog import Addon, Drink
from ..models.orders import Coupon, Order, Payment
from ..services.i18n import t


def _drink_map(db: Session, orders: list[Order]) -> dict[int, Drink]:
    """drink_id -> Drink (картинка/slug/актуальное имя в позициях заказа)."""
    ids = {i.drink_id for o in orders for i in o.items}
    if not ids:
        return {}
    return {d.id: d for d in db.scalars(select(Drink).where(Drink.id.in_(ids)))}


def _addon_map(db: Session, orders: list[Order]) -> dict[int, Addon]:
    """addon_id -> Addon (актуальное англ. имя добавки для админки)."""
    ids = {a.addon_id for o in orders for i in o.items for a in i.addons}
    if not ids:
        return {}
    return {a.id: a for a in db.scalars(select(Addon).where(Addon.id.in_(ids)))}



def _order_row(o: Order, drink_map: dict[int, Drink] | None = None,
               addon_map: dict[int, Addon] | None = None) -> dict:
    drink_map = drink_map or {}
    addon_map = addon_map or {}
    return {
        "id": o.id, "number": o.number, "status": o.status, "paymentStatus": o.payment_status,
        "customerName": o.customer_name, "phone": o.phone,
        "carPlate": o.car_plate, "emirate": o.emirate,
        "subtotal": o.subtotal, "couponDiscount": o.coupon_discount, "total": o.total,
        "managerId": o.manager_id, "rating": o.rating,
        "arrived": o.arrived_at is not None,
        "createdAt": o.created_at.isoformat() if o.created_at else None,
        "items": [
            {
                "id": i.id,
                # снэпшот (как оформил клиент, в локали заказа) — для блока проверки
                "name": i.custom_name or i.drink_name,
                "customName": i.custom_name, "drinkName": i.drink_name,
                # актуальное англ. имя из каталога — для рабочего вида менеджера
                "drinkNameEn": (t(drink_map[i.drink_id].name, "en")
                                if i.drink_id in drink_map else i.drink_name),
                "sizeLabel": i.size_label,
                "previewUrl": drink_map[i.drink_id].preview_url if i.drink_id in drink_map else None,
                "drinkSlug": drink_map[i.drink_id].slug if i.drink_id in drink_map else None,
                "quantity": i.quantity, "unitPrice": i.unit_price, "paidByCoupon": i.paid_by_coupon,
                # граммовка + цена добавок; name = снэпшот, nameEn = актуальное англ.
                "addons": [
                    {"name": a.addon_name,
                     "nameEn": (t(addon_map[a.addon_id].name, "en")
                                if a.addon_id in addon_map else a.addon_name),
                     "portions": a.portions, "amount": a.amount,
                     "unit": a.unit_code, "price": a.price_per_portion}
                    for a in i.addons
                ],
            }
            for i in o.items
        ],
    }


def _payment_row(p: Payment) -> dict:
    """Полная карточка платежа по модели Stripe (для списка, детальной и карточки клиента)."""
    return {
        "id": p.id, "orderId": p.order_id,
        "amount": round(p.amount or 0, 2), "currency": p.currency,
        "provider": p.provider, "providerId": p.provider_id, "status": p.status,
        "paymentIntentId": p.payment_intent_id, "chargeId": p.charge_id,
        "customerId": p.customer_id,
        "method": p.method_type, "cardBrand": p.card_brand, "cardLast4": p.card_last4,
        "cardFunding": p.card_funding, "cardCountry": p.card_country, "cardExp": p.card_exp,
        "fee": round(p.fee_amount or 0, 2),
        "net": round(p.net_amount, 2) if p.net_amount is not None else None,
        "refunded": round(p.refunded_amount or 0, 2),
        "receiptUrl": p.receipt_url,
        "failureCode": p.failure_code, "failureMessage": p.failure_message,
        "riskLevel": p.risk_level, "riskScore": p.risk_score,
        "disputeStatus": p.dispute_status, "livemode": bool(p.livemode),
        "createdAt": p.created_at.isoformat() if p.created_at else None,
        "paidAt": p.paid_at.isoformat() if p.paid_at else None,
        "updatedAt": p.updated_at.isoformat() if p.updated_at else None,
    }


def _payment_row_full(p: Payment) -> dict:
    """Строка платежа + контекст заказа/клиента (для списка и детальной)."""
    row = _payment_row(p)
    o = p.order
    row["orderNumber"] = o.number if o else None
    row["customerName"] = o.customer_name if o else None
    row["customerPhone"] = o.phone if o else None
    row["userId"] = o.user_id if o else None
    return row


def _coupon_row(c: Coupon) -> dict:
    return {"id": c.id, "userId": c.user_id, "status": c.status,
            "sourceOrderId": c.source_order_id, "usedOrderId": c.used_order_id,
            "usedItemId": c.used_item_id, "discountAmount": c.discount_amount,
            "issuedAt": c.issued_at.isoformat() if c.issued_at else None,
            "usedAt": c.used_at.isoformat() if c.used_at else None}
