import os
import tempfile

os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp()}/test.db"

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def customer(client):
    """Авторизованный клиент (PUB-G-04 флоу)."""
    r = client.post("/api/auth/request-code", json={"phone": "+971501234567"})
    code = r.json()["devCode"]
    r = client.post("/api/auth/verify", json={"phone": "+971501234567", "code": code,
                                              "name": "Тест", "locale": "ru"})
    data = r.json()
    return {"headers": {"Authorization": f"Bearer {data['token']}"}, "user": data["user"]}


@pytest.fixture(scope="session")
def admin(client):
    r = client.post("/api/staff/login", json={"email": "admin@juicy.ae", "password": "admin123"})
    return {"headers": {"Authorization": f"Bearer {r.json()['token']}"}}


@pytest.fixture(scope="session")
def manager(client):
    r = client.post("/api/staff/login", json={"email": "manager@juicy.ae", "password": "manager123"})
    return {"headers": {"Authorization": f"Bearer {r.json()['token']}"}}


def make_order(client, customer, coupon_id=None, coupon_item_index=None):
    """Хелпер: создать оплаченный (mock) заказ из 2 напитков."""
    det = client.get("/api/drinks/orange-fresh").json()
    ginger = next(a for a in det["addons"] if a["name"] == "Имбирь")
    body = {
        "items": [
            {"drinkId": det["id"], "quantity": 1,
             "addons": [{"addonId": ginger["addonId"], "portions": 1}]},
            {"drinkId": client.get("/api/drinks/immunity-shot").json()["id"], "quantity": 2,
             "addons": [{"addonId": 5, "portions": 1}]},
        ],
        "carPlate": "F 88888", "emirate": "Dubai", "customerName": "Тест",
    }
    if coupon_id:
        body["couponId"] = coupon_id
        body["couponItemIndex"] = coupon_item_index
    r = client.post("/api/orders", json=body, headers=customer["headers"])
    assert r.status_code == 200, r.text
    order = r.json()
    r = client.post("/api/payments/checkout-session", json={"orderId": order["id"]},
                    headers=customer["headers"])
    assert r.status_code == 200, r.text
    return client.get(f"/api/orders/{order['id']}", headers=customer["headers"]).json()
