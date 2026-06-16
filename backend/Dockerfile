FROM python:3.12-slim
WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt "psycopg[binary]" redis stripe
COPY app ./app
# --proxy-headers + forwarded-allow-ips: за nginx (TLS terminate) уважаем X-Forwarded-Proto,
# чтобы request.base_url был https (media-URL) и не было mixed content на сайте.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
