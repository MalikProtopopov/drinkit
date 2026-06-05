"""F04: OTP-авторизация и профиль (PUB-G-04, PUB-A-06, PUB-A-09)."""


def test_request_and_verify(client):
    r = client.post("/api/auth/request-code", json={"phone": "+971509999999"})
    assert r.status_code == 200
    code = r.json()["devCode"]
    r = client.post("/api/auth/verify", json={"phone": "+971509999999", "code": code,
                                              "name": "Лина", "locale": "ar"})
    assert r.status_code == 200
    data = r.json()
    assert data["created"] is True
    assert data["user"]["locale"] == "ar"  # PUB-A-09 AC3: язык фиксируется при регистрации


def test_wrong_code_401(client):
    client.post("/api/auth/request-code", json={"phone": "+971508888888"})
    r = client.post("/api/auth/verify", json={"phone": "+971508888888", "code": "0000"})
    assert r.status_code == 401


def test_invalid_phone_422(client):
    r = client.post("/api/auth/request-code", json={"phone": "not-a-phone"})
    assert r.status_code == 422


def test_me_requires_auth(client):
    assert client.get("/api/auth/me").status_code == 401


def test_profile_update(client, customer):
    r = client.patch("/api/auth/me", headers=customer["headers"],
                     json={"carPlate": "o 12345", "emirate": "Dubai", "locale": "ru"})
    assert r.status_code == 200
    assert r.json()["carPlate"] == "O 12345"  # uppercase-нормализация


def test_profile_bad_locale(client, customer):
    r = client.patch("/api/auth/me", headers=customer["headers"], json={"locale": "fr"})
    assert r.status_code == 422
