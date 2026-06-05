"""F11: оценка 👍/👎 + купоны (PUB-A-04/05, ADM-S-12)."""
from .conftest import make_order


def _complete(client, order_id, manager):
    client.post(f"/api/admin/orders/{order_id}/take", headers=manager["headers"])
    client.post(f"/api/admin/orders/{order_id}/status", json={"status": "ready"},
                headers=manager["headers"])
    client.post(f"/api/admin/orders/{order_id}/status", json={"status": "completed"},
                headers=manager["headers"])


def test_dislike_issues_coupon_and_apply(client, customer, manager, admin):
    order = make_order(client, customer)
    _complete(client, order["id"], manager)

    # оценка 👎 → купон
    r = client.post(f"/api/orders/{order['id']}/rate", json={"rating": "dislike"},
                    headers=customer["headers"])
    assert r.status_code == 200 and r.json()["couponIssued"] is True
    coupon_id = r.json()["couponId"]

    # повторная оценка запрещена (PUB-A-04 AC5)
    r = client.post(f"/api/orders/{order['id']}/rate", json={"rating": "like"},
                    headers=customer["headers"])
    assert r.status_code == 409

    # купон виден клиенту
    coupons = client.get("/api/coupons", headers=customer["headers"]).json()
    assert any(c["id"] == coupon_id and c["status"] == "active" for c in coupons)

    # применяем купон: напиток выбирает клиент (index 0)
    order2 = make_order(client, customer, coupon_id=coupon_id, coupon_item_index=0)
    assert order2["couponDiscount"] > 0
    assert order2["total"] == round(order2["subtotal"] - order2["couponDiscount"], 2)
    assert order2["items"][0]["paidByCoupon"] is True  # фиксация: какой напиток (PUB-A-05 AC3)

    # купон стал использованным
    coupons = client.get("/api/coupons", headers=customer["headers"]).json()
    used = next(c for c in coupons if c["id"] == coupon_id)
    assert used["status"] == "used" and used["usedOrderId"] == order2["id"]

    # повторное применение невозможно (PUB-A-05 AC4)
    det = client.get("/api/drinks/orange-fresh").json()
    r = client.post("/api/orders", json={
        "items": [{"drinkId": det["id"]}], "carPlate": "X 1",
        "couponId": coupon_id, "couponItemIndex": 0,
    }, headers=customer["headers"])
    assert r.status_code == 409

    # реестр купонов в админке (ADM-S-12) — только super_admin
    rows = client.get("/api/admin/coupons", headers=admin["headers"]).json()
    row = next(c for c in rows if c["id"] == coupon_id)
    assert row["usedItemId"] is not None and row["discountAmount"] > 0


def test_like_no_coupon(client, customer, manager):
    order = make_order(client, customer)
    _complete(client, order["id"], manager)
    r = client.post(f"/api/orders/{order['id']}/rate", json={"rating": "like"},
                    headers=customer["headers"])
    assert r.json()["couponIssued"] is False


def test_rate_before_arrival_409(client, customer):
    order = make_order(client, customer)  # status=new
    r = client.post(f"/api/orders/{order['id']}/rate", json={"rating": "like"},
                    headers=customer["headers"])
    assert r.status_code == 409


def test_void_coupon(client, customer, manager, admin):
    order = make_order(client, customer)
    _complete(client, order["id"], manager)
    cid = client.post(f"/api/orders/{order['id']}/rate", json={"rating": "dislike"},
                      headers=customer["headers"]).json()["couponId"]
    r = client.post(f"/api/admin/coupons/{cid}/void", headers=admin["headers"])
    assert r.json()["status"] == "void"
    # аннулированный купон не применить
    det = client.get("/api/drinks/orange-fresh").json()
    r = client.post("/api/orders", json={
        "items": [{"drinkId": det["id"]}], "carPlate": "X 2",
        "couponId": cid, "couponItemIndex": 0}, headers=customer["headers"])
    assert r.status_code == 409
