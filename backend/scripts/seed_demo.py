"""Демо-данные для просмотра заполненной админки (НЕ запускается автоматически).

Создаёт пару менеджеров и наплодит оплаченных заказов с историей статусов, ДАТИРОВАННЫХ
задним числом на ~30 дней — именно из этих событий строится календарь смен сотрудника и
метрики дашборда/аудитории. Заказы помечены car_plate 'DEMO ...' и привязаны к активной точке.

Запуск (из каталога backend):
    .venv/bin/python scripts/seed_demo.py          # сидит, если ещё не сидели
    .venv/bin/python scripts/seed_demo.py --force   # досыпать ещё данных

Идемпотентность: повторный запуск без --force выходит, если демо-заказы уже есть.
"""
import os
import random
import sys
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # backend/

from sqlalchemy import func, select  # noqa: E402

from app.core.db import SessionLocal  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.models.catalog import Drink  # noqa: E402
from app.models.orders import Order, OrderEvent, OrderItem  # noqa: E402
from app.models.outlet import Outlet, StaffOutlet  # noqa: E402
from app.models.users import StaffUser, User  # noqa: E402

random.seed(42)
TZ = ZoneInfo("Asia/Dubai")
FORCE = "--force" in sys.argv

# менеджеры: (email, имя, доля рабочих дней из 30, заказов в рабочий день)
MANAGERS = [
    ("manager@juicy.ae", "Иван Морозов", 0.80, (3, 7)),
    ("aliya@juicy.ae", "Алия Хан", 0.60, (2, 5)),
    ("dmitry@juicy.ae", "Дмитрий Соколов", 0.45, (1, 4)),
]
CUSTOMERS = [
    ("+971500000101", "Сара"), ("+971500000102", "Омар"), ("+971500000103", "Лина"),
    ("+971500000104", "Карим"), ("+971500000105", "Нур"),
]
EMIRATES = ["Dubai", "Abu Dhabi", "Sharjah"]


def get_or_create_manager(db, email, name, outlet_id):
    s = db.scalar(select(StaffUser).where(StaffUser.email == email))
    if not s:
        s = StaffUser(email=email, password_hash=hash_password("manager123"),
                      name=name, role="manager")
        db.add(s)
        db.flush()
    if not db.scalar(select(StaffOutlet).where(StaffOutlet.staff_id == s.id,
                                               StaffOutlet.outlet_id == outlet_id)):
        db.add(StaffOutlet(staff_id=s.id, outlet_id=outlet_id, is_primary=True))
    return s


def get_or_create_customer(db, phone, name):
    u = db.scalar(select(User).where(User.phone == phone))
    if not u:
        u = User(phone=phone, name=name, preferred_locale="en")
        db.add(u)
        db.flush()
    return u


def main():
    with SessionLocal() as db:
        outlet = db.scalar(select(Outlet).where(Outlet.is_active.is_(True)).order_by(Outlet.id))
        if not outlet:
            print("Нет активной точки — сначала запусти бэкенд (создаст дефолтную).")
            return

        already = db.scalar(select(func.count(Order.id)).where(Order.car_plate.like("DEMO%")))
        if already and not FORCE:
            print(f"Демо-заказы уже есть ({already}). Повтори с --force, чтобы досыпать.")
            return

        drinks = db.scalars(select(Drink).where(Drink.status == "published")).all()
        managers = [get_or_create_manager(db, e, n, outlet.id) for e, n, _, _ in MANAGERS]
        customers = [get_or_create_customer(db, p, n) for p, n in CUSTOMERS]
        db.flush()

        number = (db.scalar(select(func.max(Order.number))) or 1000) + 1
        today = datetime.now(timezone.utc).astimezone(TZ).date()
        created_orders = 0

        for mgr, (_, _, work_ratio, (lo, hi)) in zip(managers, MANAGERS):
            for d in range(30):
                day = today - timedelta(days=d)
                if random.random() > work_ratio:
                    continue  # в этот день не работал
                for _ in range(random.randint(lo, hi)):
                    cust = random.choice(customers)
                    hour = random.randint(8, 17)  # +4 (Dubai) → тот же день
                    minute = random.randint(0, 59)
                    base_dt = datetime(day.year, day.month, day.day, hour, minute)

                    items = random.sample(drinks, k=random.randint(1, 3))
                    order = Order(
                        number=number, user_id=cust.id, status="completed",
                        payment_status="paid", outlet_id=outlet.id, manager_id=mgr.id,
                        customer_name=cust.name, phone=cust.phone,
                        car_plate=f"DEMO {1000 + number % 9000}",
                        emirate=random.choice(EMIRATES), created_at=base_dt,
                    )
                    db.add(order)
                    db.flush()
                    number += 1

                    subtotal = 0.0
                    for it in items:
                        qty = random.randint(1, 2)
                        price = float(it.base_price)
                        nm = (it.name or {}).get("en") or (it.name or {}).get("ru") or it.slug
                        db.add(OrderItem(order_id=order.id, drink_id=it.id, drink_name=nm,
                                         unit_price=price, quantity=qty))
                        subtotal += price * qty
                    order.subtotal = round(subtotal, 2)
                    order.total = round(subtotal, 2)

                    # история: created/paid (клиент) + взял/готово/передал (менеджер) — со сдвигом времени
                    def ev(mins, type_, status=None, by_staff=None, by_user=None):
                        db.add(OrderEvent(order_id=order.id, type=type_, status=status,
                                          by_staff_id=by_staff, by_user_id=by_user,
                                          created_at=base_dt + timedelta(minutes=mins)))
                    ev(0, "created", status="new", by_user=cust.id)
                    ev(1, "paid")
                    ev(3, "status_change", status="in_progress", by_staff=mgr.id)
                    ev(7, "status_change", status="ready", by_staff=mgr.id)
                    ev(12, "status_change", status="completed", by_staff=mgr.id)
                    created_orders += 1

        db.commit()
        print(f"Готово: +{created_orders} демо-заказов за 30 дней.")
        print("Менеджеры (пароль manager123):", ", ".join(m.email for m in managers))
        print("Открой /admin/staff → карточку менеджера: метрики + календарь смен заполнятся.")


if __name__ == "__main__":
    main()
