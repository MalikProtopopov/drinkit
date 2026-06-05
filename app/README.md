# Juicy MVP — прототип web-app juice bar (UAE)

Mobile-first прототип по ТЗ из `docs/compass_artifact_...md`. Повторяет UX-механики Drinkit: предзаказ → SMS-OTP → кастомизатор с КБЖУ → оплата → статус с «Я приехал».

Это **frontend-only прототип** — все данные mock'овые, состояние в Zustand + localStorage, оплата/SMS/готовка симулируются по таймерам. Бэкенда нет; контракт API для будущей интеграции описан в [`docs/BACKEND.md`](../docs/BACKEND.md).

## Запуск

```bash
npm install
npm run dev   # http://localhost:3000  (или PORT=3300 npm run dev)
npx playwright test   # 44 e2e теста, проект mobile-chromium 390×844
```

В браузере прототип занимает **100% по ширине на телефоне** и центрируется в фрейме **390 px на десктопе** (`.mobile-frame { width: 100%; max-width: 390px; height: 100dvh; overflow: hidden }`). Все внутренние экраны скроллятся вложенным `overflow-y-auto`, не страница целиком.

## Карта экранов

| Маршрут | Экран |
|---|---|
| `/` | Splash + автоматический редирект |
| `/onboarding` | 3-экранный onboarding со swipe |
| `/outlets` | Выбор точки в Dubai |
| `/auth/phone` | Телефон + кастомный NumPad, префикс +971 c SVG-флагом UAE |
| `/auth/otp` | OTP 4 ячейки + таймер 0:55 + демо-код |
| `/auth/name` | Имя клиента |
| `/home` | Full-bleed видео-hero, табы категорий поверх видео, promo-карточка, grid карточек |
| `/menu` | Полное меню по всем категориям |
| `/product/[slug]` | Full-bleed видео фон, KBJU поверх видео, размер S/M/L, **inline AddonPopover** над чипами, «Назови напиток» |
| `/cart` | Корзина с +/- (`StepperButton` с SVG-глифами), промокод, VAT 5%, итого |
| `/checkout` | Эмират + номер машины (Latin-only фильтр) + слот выдачи |
| `/payment` | Apple Pay / Google Pay / Карта (mock) |
| `/orders` | История заказов |
| `/orders/[id]` | Статус с авто-симуляцией CREATED → PAID → ACCEPTED → PREPARING → READY → PICKED_UP, кнопки «Я приехал» и «Позвонить» |
| `/profile` | Профиль, машина (Latin-only plate), язык, выход |

## Стек

- **Next.js 16** (App Router) + **React 19.2** + TypeScript
- **Tailwind v4** через `globals.css` с CSS-переменными из ТЗ
- **Zustand** с persist (`localStorage`)
- **Playwright** — 44 e2e теста, проект `mobile-chromium` (390×844, `isMobile`)
- Без бэка, без БД — `lib/data.ts` хранит 19 напитков, 8 категорий, 11 add-on-групп

## Каталог (19 продуктов)

| Категория | Продукты |
|---|---|
| Фреши (3) | апельсин, ананас-имбирь, свёкла-яблоко |
| Смузи (3) | ягодный, манго-маракуйя, зелёный |
| Детокс (1) | сельдерей-яблоко |
| Шоты (1) | иммунитет |
| Кофе (4) | капучино, латте, раф таро, мокко |
| Не кофе (4) | матча латте, чай масала, горячий шоколад |
| Лимонады (2) | классический, ягодный |
| Еда (2) | круассан с миндалём, сэндвич пастрами |

Эспрессо-группа моделируется как варианты внутри карточки кофе (обычный / без кофеина).

## Медиа

- Каждому продукту соответствует короткое MP4 из `/mocs/` (1080×1920 → ужато до 720×1280, H.264 faststart, CRF 28)
- В UI рендерится через `<DrinkMedia>` (`<video muted loop playsInline autoPlay>`)
- Для `<img>`-постеров и thumbnails в корзине / заказах — `getProductVideo(slug)` возвращает `{ video, poster }`
- Фолбэк (если slug не замаплен) — `<DrinkArt>` SVG-иллюстрация

## Add-on UX

- **Inline `AddonPopover`** раскрывается вверх над рядом чипов (по образцу реального Drinkit; не bottom-sheet)
- Чипы и карточки опций единообразного размера, горизонтальный скролл
- Все `+`/`−`/`×`/`✓` глифы кружков — SVG-иконки через `<StepperButton>` (текстовые символы не центрировались по baseline)
- Live-пересчёт КБЖУ по сумме `product.kbju + Σ(addon.kbju)`

## Тесты

```bash
npx playwright test --reporter=line
```

- `e2e/routes.spec.ts` — smoke на все маршруты, отсутствие console errors
- `e2e/links.spec.ts` — каждая `<a href>` на ключевых экранах возвращает 200
- `e2e/buttons.spec.ts` — нет «мёртвых» кнопок (sheets, addons, tabs, BottomNav)
- `e2e/golden-path.spec.ts` — полный сценарий от splash до READY
- `e2e/_helpers.ts` — `seedAuthenticatedState` / `seedCleanState`, оба засеваются один раз через `sessionStorage["__seeded"]` чтобы не сбрасывать мутации при `page.goto`

## Структура

```
app/
├── app/                # App Router маршруты
│   ├── auth/{phone,otp,name}/
│   ├── outlets/, onboarding/, home/, menu/
│   ├── product/[slug]/
│   ├── cart/, checkout/, payment/
│   ├── orders/, orders/[id]/
│   ├── profile/
│   ├── layout.tsx, page.tsx, globals.css
├── components/
│   ├── TopBar.tsx, BottomNav.tsx, BottomSheet.tsx
│   ├── ProductCard.tsx, Counter.tsx, NumPad.tsx
│   ├── DrinkMedia.tsx       # <video> wrapper
│   ├── DrinkArt.tsx         # SVG fallback
│   ├── AddonIcon.tsx        # SVG per-addon + per-group icons
│   ├── StepperButton.tsx    # SVG +/−/×/✓ кружок
│   ├── Flag.tsx             # SVG ru/gb/ae (вместо emoji)
│   └── OutletArt.tsx
├── lib/
│   ├── data.ts              # outlets, products, categories, addonGroups, productVideos
│   └── store.ts             # Zustand store (cart, orders, user) + computeCartTotal
└── e2e/                     # Playwright specs
```

## Известные технические нюансы

- **Tailwind v4 tree-shaking**. Кастомные CSS-правила вида `.flex-1.flex-col` v4 удаляет как «похожие на utility». Чтобы `min-height: 0` применялся к вложенным flex-контейнерам (иначе внутренние `overflow-y-auto` не скроллятся), используется attribute-селектор:
  ```css
  [class~="flex-1"][class~="flex-col"],
  [class~="flex-1"][class~="overflow-y-auto"] { min-height: 0 }
  ```
  Удалять это правило нельзя — сломается скролл во всём приложении.
- **Safe area** — утилиты `.pt-safe`, `.pb-safe`, `.mb-safe` рассчитаны через `max(N, env(safe-area-inset-*))`.
- **Локализация** — в UI остался только RU; EN отключён до бэка, AR (RTL) запланирован на V1.1.

## Что есть и чего нет

**Есть**
- Полная golden-path воронка от splash до выдачи
- 19 напитков с реальными видео из `/mocs`
- 11 add-on-групп (single / multi / counter), live-пересчёт КБЖУ
- Inline AddonPopover, full-bleed video-hero, frosted-glass overlays
- Кастомное имя напитка, переключатель размеров, эмират + plate с Latin-only фильтром
- Time-picker, имитация Apple/Google Pay, stepper статусов с авто-таймерами

**Нет в прототипе**
- Бэкенд / БД / реальный Tap Payments / Twilio Verify / SSE — см. [`docs/BACKEND.md`](../docs/BACKEND.md)
- Админка бариста (KDS)
- AR-локализация (только переключатель в профиле, RTL-readiness в CSS)
- Реальная геолокация «рядом со мной» (сортировка фейковая)
- Web Push (поведение симулируется auto-status таймерами)
