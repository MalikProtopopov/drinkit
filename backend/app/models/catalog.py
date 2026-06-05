from sqlalchemy import JSON, Boolean, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.db import Base

# DECISION: i18n-поля (name/description) — JSON-словарь {"ru": ..., "ar": ...}:
# добавление языка не требует миграции схемы (требование ADM-S-11 п.5).


class DrinkCategory(Base):
    """Категория напитков для переключателя каталога (ADM-S-01)."""

    __tablename__ = "drink_categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[dict] = mapped_column(JSON)
    photo_url: Mapped[str | None] = mapped_column(String(300))
    video_url: Mapped[str | None] = mapped_column(String(300))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort: Mapped[int] = mapped_column(Integer, default=0)

    drinks = relationship("Drink", back_populates="category")


class Unit(Base):
    """Справочник единиц измерения (ADM-S-04)."""

    __tablename__ = "units"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True)  # g, ml, pcs, l
    name: Mapped[dict] = mapped_column(JSON)


class AddonCategory(Base):
    """Категория добавок; selection_type — дефолт для всех напитков (ADM-S-02)."""

    __tablename__ = "addon_categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[dict] = mapped_column(JSON)
    icon_url: Mapped[str | None] = mapped_column(String(300))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    selection_type: Mapped[str] = mapped_column(String(10), default="counter")  # single|multi|counter

    addons = relationship("Addon", back_populates="category")


class Addon(Base):
    """Ингредиент/добавка: КБЖУ на 100 ед., цена за порцию (ADM-S-03)."""

    __tablename__ = "addons"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[dict] = mapped_column(JSON)
    image_url: Mapped[str | None] = mapped_column(String(300))
    category_id: Mapped[int] = mapped_column(ForeignKey("addon_categories.id"))
    unit_id: Mapped[int] = mapped_column(ForeignKey("units.id"))
    kcal_per_100: Mapped[float] = mapped_column(Float, default=0)
    protein_per_100: Mapped[float] = mapped_column(Float, default=0)
    fat_per_100: Mapped[float] = mapped_column(Float, default=0)
    carbs_per_100: Mapped[float] = mapped_column(Float, default=0)
    base_price: Mapped[float] = mapped_column(Float, default=0)  # цена за 1 порцию (дефолт)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    category = relationship("AddonCategory", back_populates="addons")
    unit = relationship("Unit")


class Drink(Base):
    """Напиток (ADM-S-05)."""

    __tablename__ = "drinks"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    name: Mapped[dict] = mapped_column(JSON)
    description: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(12), default="draft")  # draft|published|hidden
    preview_url: Mapped[str | None] = mapped_column(String(300))
    video_url: Mapped[str | None] = mapped_column(String(300))
    base_price: Mapped[float] = mapped_column(Float, default=0)
    kcal: Mapped[float] = mapped_column(Float, default=0)
    protein: Mapped[float] = mapped_column(Float, default=0)
    fat: Mapped[float] = mapped_column(Float, default=0)
    carbs: Mapped[float] = mapped_column(Float, default=0)
    category_id: Mapped[int] = mapped_column(ForeignKey("drink_categories.id"))

    category = relationship("DrinkCategory", back_populates="drinks")
    addon_links = relationship("DrinkAddon", back_populates="drink", cascade="all, delete-orphan")


class DrinkAddon(Base):
    """Промежуточная таблица напиток×добавка (ADM-S-05 AC3):
    price_override NULL => добавка бесплатна (включена в стоимость);
    объёмы в порциях; selection_type_override перекрывает тип категории."""

    __tablename__ = "drink_addons"

    id: Mapped[int] = mapped_column(primary_key=True)
    drink_id: Mapped[int] = mapped_column(ForeignKey("drinks.id"), index=True)
    addon_id: Mapped[int] = mapped_column(ForeignKey("addons.id"))
    price_override: Mapped[float | None] = mapped_column(Float, nullable=True)
    min_portions: Mapped[int] = mapped_column(Integer, default=0)
    default_portions: Mapped[int] = mapped_column(Integer, default=1)
    max_portions: Mapped[int] = mapped_column(Integer, default=3)
    portion_amount: Mapped[float] = mapped_column(Float, default=30)  # грамм/мл в одной порции
    selection_type_override: Mapped[str | None] = mapped_column(String(10), nullable=True)

    drink = relationship("Drink", back_populates="addon_links")
    addon = relationship("Addon")
