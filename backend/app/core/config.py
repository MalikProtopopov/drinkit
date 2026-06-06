from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # DECISION: по умолчанию SQLite-файл, чтобы проект запускался без docker;
    # в проде задаётся DATABASE_URL=postgresql+psycopg://... (см. docker-compose.yml)
    database_url: str = "sqlite:///./juicy.db"
    redis_url: str | None = None  # None -> in-memory pubsub/otp fallback

    jwt_secret: str = "dev-secret-change-me"
    jwt_alg: str = "HS256"
    jwt_ttl_hours: int = 24 * 30

    # Stripe: без ключа работает mock-режим (оплата подтверждается сразу)
    stripe_secret_key: str | None = None
    stripe_webhook_secret: str | None = None

    # Вход по телефону: OTP выключен (решение владельца — SMS пока не отправляем,
    # телефон = контакт для выдачи; клиент мотивирован указать верный — заказ уже оплачен).
    # При подключении SMS-провайдера включается AUTH_OTP_ENABLED=true без правок кода.
    auth_otp_enabled: bool = False
    # OTP: в dev-режиме код фиксированный и возвращается в ответе API
    otp_dev_mode: bool = True
    otp_dev_code: str = "1836"
    otp_ttl_seconds: int = 300

    default_locale: str = "ru"
    locales: list[str] = ["ru", "ar"]

    rating_timeout_minutes: int = 15  # захардкоженный порог из требований (PUB-A-04)

    class Config:
        env_file = ".env"


settings = Settings()
