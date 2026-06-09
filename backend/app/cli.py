"""CLI-команды (Poetry scripts, план §B): миграции, сиды, запуск API."""
import subprocess
import sys


def run_api():
    subprocess.run(["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"])


def run_migrate():
    subprocess.run(["alembic", "upgrade", "head"], check=True)


def run_seed():
    """Juicy-сиды (демо-каталог)."""
    from . import models  # noqa: F401
    from .core.db import SessionLocal
    from .services.seed import seed
    with SessionLocal() as db:
        seed(db)
    print("Juicy seed done.")


def run_seed_grabzi():
    """GRABZI-сиды: локации, каталог, контент, персонал."""
    from . import models  # noqa: F401
    from .core.db import SessionLocal
    from .services.seed_grabzi import seed_grabzi
    with SessionLocal() as db:
        seed_grabzi(db)
    print("GRABZI seed done (admin@grabzi.ae / barista@grabzi.ae).")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "seed-grabzi"
    {"api": run_api, "migrate": run_migrate, "seed": run_seed,
     "seed-grabzi": run_seed_grabzi}[cmd]()
