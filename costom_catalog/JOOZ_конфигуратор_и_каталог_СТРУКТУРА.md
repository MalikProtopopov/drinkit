# JOOZ — структурированное описание конфигуратора и каталога напитков

> **Статус.** Документ собран из 4 исходных материалов папки `costom_catalog/` (см. §1).
> Описано строго «как есть» в источниках; всё, чего в источниках нет (цены, дозы, КБЖУ, лимиты),
> вынесено в открытые вопросы (§8), а не додумано. Назначение — основа для **функционала формул,
> которыми управляется каталог напитков** (custom-конфигуратор + готовые рецепты-пресеты).

**Дата сборки:** 05.06.2026

---

## 1. Источники

| # | Файл | Тип | Что содержит |
|---|---|---|---|
| K1 | `Jooz объяснение конфигуратора.md` | текст | Логика конфигуратора **Build Your Juice**: 9 базовых соков, разрешённые добавки к каждой базе, premium add-ons |
| K2 | `готовые миксы.png` | постер | **Signature Mixes** — готовые миксы (заголовок «Top 8», карточек **9** ⚠️), составы, premium add-on, бейджи |
| K3 | `nutrition signatures.png` | постер | **Nutrition Signatures** — 13 функциональных напитков с составами и назначением («Top 13 functional drinks») |
| K4 | `готовые авокадо.png` | постер | **Avocado Specials** — 7 слоёных авокадо-муссов («Top 7 avocado mousse mixes»), составы, premium add-on |

> ⚠️ Бренд на всех материалах — **JOOZ** («JOOZ — Build Your Juice»), при том что рабочее название
> проекта — Juicy. Зафиксировать в глоссарии как открытый вопрос нейминга (см. §8).

---

## 2. Модель каталога: три типа продуктов

Из материалов следует, что каталог состоит из **трёх разных по механике типов** продуктов:

| Тип | Источник | Механика | Формула |
|---|---|---|---|
| **T1. Custom — Build Your Juice** | K1 | Покупатель собирает напиток сам: выбирает **базу** → добавляет **mix-ins из whitelist этой базы** → опционально **premium add-ons** | `Drink = Base + Σ MixIn(из whitelist базы) + Σ PremiumAddon` |
| **T2. Preset — готовые рецепты** | K2, K3 | Именованный фиксированный состав (Signature Mixes — вкусовые; Nutrition Signatures — функциональные, «под эффект») | `Preset = именованная формула из ингредиентов (+ опц. premium add-on)` |
| **T3. Layered — авокадо-муссы** | K4 | Слоёные муссовые миксы на базе avocado mousse с фруктами/орехами/топпингами | `Special = Avocado mousse + Σ Layer/Topping (+ опц. premium add-on)` |

Ключевое следствие для формульного движка: **пресеты используют ингредиенты, которых нет в
custom-конфигураторе** (Strawberry, Kiwi, Papaya, Banana, Chia, Protein и др. — см. §3). То есть
реестр ингредиентов един, но каждый ингредиент имеет флаг доступности: `custom_base` /
`custom_mixin` / `preset_only` / `premium_addon` / `topping`.

---

## 3. Единый реестр ингредиентов

Все ингредиенты, встречающиеся во всех 4 материалах. Роли: **Б** = база custom (K1), **М** = mix-in
custom (K1), **П** = встречается в пресетах (K2/K3), **А** = avocado specials (K4), **PA** = premium add-on.

### 3.1 Соки / фрукты / овощи

| Ингредиент | Б | М | П | А | Примечание |
|---|---|---|---|---|---|
| Orange (апельсин) | ✅ | ✅ | ✅ | — | |
| Watermelon (арбуз) | ✅ | — | ✅ | — | |
| Mango (манго) | ✅ | ✅ | ✅ | ✅ | в K4 также «Mango base» и «Mango cubes» |
| Pineapple (ананас) | ✅ | ✅ | ✅ | — | |
| Pomegranate (гранат) | ✅ | ✅ | ✅ | ✅ | в K4 — «Pomegranate seeds» (зёрна) |
| Apple / Green Apple (яблоко) | ✅ | ✅ | ✅ | — | ⚠️ в K1 «Apple», в K2/K3 «Green Apple» — унифицировать |
| Carrot (морковь) | ✅ | ✅ | ✅ | — | |
| Beetroot (свёкла) | ✅ | ✅ | ✅ | — | |
| Celery (сельдерей) | ✅ | ✅ | ✅ | — | |
| Cucumber (огурец) | — | ✅ | ✅ | — | только mix-in, не база |
| Lemon (лимон) | — | ✅ | ✅ | — | только mix-in |
| Lime (лайм) | — | ✅ | ✅ | — | только mix-in |
| Passion Fruit (маракуйя) | — | ✅ | ✅ | — | только mix-in |
| Strawberry (клубника) | — | — | ✅ | ✅ | **нет в custom** (preset-only) |
| Kiwi (киви) | — | — | ✅ | — | preset-only (Focus Green) |
| Papaya (папайя) | — | — | ✅ | — | preset-only (Gut Support) |
| Banana (банан) | — | — | ✅ | ✅ | preset-only (Night Calm, Post-Workout) |
| Avocado (авокадо) | — | — | — | ✅ | только как «Avocado mousse» — база T3 |
| Dates (финики) | — | — | — | ✅ | |

### 3.2 Травы / специи

| Ингредиент | Б | М | П | А | Примечание |
|---|---|---|---|---|---|
| Ginger (имбирь) | — | ✅ | ✅ | — | самый частый mix-in: разрешён у 7 баз из 9 |
| Mint (мята) | — | ✅ | ✅ | — | |
| Basil (базилик) | — | ✅ | — | — | только custom (Orange, Watermelon); в пресетах не встречается |

### 3.3 Жидкие основы

| Ингредиент | Б | М | П | А | Примечание |
|---|---|---|---|---|---|
| Coconut Water (кокосовая вода) | — | ✅ | ✅ | — | mix-in у Watermelon; в Electro Fresh выступает **базой** ⚠️ (в custom базой не является) |
| Oat Milk (овсяное молоко) | — | — | ✅ | — | preset-only (Night Calm) |
| Almond Milk (миндальное молоко) | — | — | — | ✅ | Avocado Protein |

### 3.4 Бустеры / суперфуды / топпинги

| Ингредиент | Роль | Где встречается |
|---|---|---|
| **Collagen (коллаген)** | **PA** — premium add-on «к любому напитку» | K1 (premium), K2 (premium add-on на постере), K3 (в составе Collagen Glow), K4 (premium add-on) — **единственный сквозной add-on всех 4 материалов** |
| **Turmeric (куркума)** | **PA** — premium add-on «к любому напитку» | только K1; ⚠️ не встречается ни в одном готовом рецепте |
| Chia (чиа) | preset-only | Sleep Recovery |
| Protein (протеин) | preset-only / topping | Post-Workout Recovery (K3), Avocado Protein (K4) |
| Sea Salt Micro-dose (микродоза морской соли) | preset-only | Electro Fresh |
| Cacao (какао) | preset-only | Night Calm |
| Almond Butter (миндальная паста) | preset-only | Night Calm |
| Honey (мёд) | topping (K4) | Avocado Pomegranate / Strawberry / Pistachio |
| Pistachio (фисташка) | topping (K4) | Avocado Pistachio |
| Mixed Nuts (ореховый микс) | topping (K4) | Avocado Royal |

**Итого реестр: 32 уникальных ингредиента** (19 фрукты/овощи + 3 травы + 3 жидкие основы + 10 бустеров/топпингов; Avocado mousse и Mango base считаются формами Avocado/Mango).

---

## 4. T1 — Custom-конфигуратор «Build Your Juice» (канон: K1)

### 4.1 Правила (как описано в источнике)

1. Покупатель выбирает **одну базу** из 9.
2. К базе предлагается выбрать дополнительно **mix-ins строго из whitelist этой базы** (см. матрицу §4.2).
3. **Premium add-ons (Collagen, Turmeric)** можно добавить **к любому напитку** — глобальная группа, не зависящая от базы.
4. Лимиты на количество mix-ins, цены, дозы — **в источнике не указаны** → открытые вопросы §8.

### 4.2 Матрица совместимости «база × mix-in»

Канонический вид правил конфигуратора. ✅ — разрешено источником K1:

| Mix-in ↓ \ База → | 🍊 Orange | 🍉 Watermelon | 🥭 Mango | 🍍 Pineapple | ❤️ Pomegranate | 🍏 Apple | 🥕 Carrot | ❤️ Beetroot | 🌿 Celery |
|---|---|---|---|---|---|---|---|---|---|
| Carrot | ✅ | — | — | — | — | ✅ | — | — | — |
| Mango | ✅ | — | — | ✅ | — | — | — | — | — |
| Pineapple | ✅ | — | ✅ | — | — | — | — | — | — |
| Pomegranate | ✅ | — | — | — | — | — | — | ✅ | — |
| Orange | — | — | ✅ | — | ✅ | — | ✅ | ✅ | — |
| Apple | — | — | — | — | ✅ | — | ✅ | ✅ | ✅ |
| Beetroot | — | — | — | — | ✅ | ✅ | — | — | — |
| Passion Fruit | — | — | ✅ | ✅ | — | — | — | — | — |
| Ginger | ✅ | — | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Lemon | — | — | — | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| Lime | — | ✅ | ✅ | ✅ | — | — | — | — | — |
| Mint | — | ✅ | — | ✅ | — | — | — | — | — |
| Basil | ✅ | ✅ | — | — | — | — | — | — | — |
| Cucumber | — | ✅ | — | — | — | — | — | — | ✅ |
| Coconut Water | — | ✅ | — | — | — | — | — | — | — |
| **Всего mix-ins** | **6** | **5** | **4** | **5** | **5** | **4** | **4** | **5** | **4** |

**Premium add-ons (к любой базе):** Collagen · Turmeric.

### 4.3 Свойства матрицы (важно для модели данных)

- Совместимость **направленная, задаётся базой** (whitelist per base), а не симметричная пара:
  - **Orange → Pineapple разрешено, но Pineapple → Orange — нет** ⚠️;
  - **Celery → Apple разрешено, но Apple → Celery — нет** ⚠️;
  - остальные пары «база↔база» симметричны (Orange↔Carrot, Orange↔Mango, Mango↔Pineapple, Pomegranate↔Beetroot, Apple↔Carrot, Apple↔Beetroot, Pomegranate↔Orange, Beetroot↔Orange, Carrot↔Orange).
  - → Уточнить у бизнеса: асимметрия намеренная (вкусовая логика «что к чему доливают») или ошибка (§8).
- 7 из 9 баз сами же являются mix-ins для других баз; **Watermelon и Celery — только базы** (никто не разрешает их как добавку).
- 8 ингредиентов — **только mix-ins** (Ginger, Lemon, Lime, Mint, Basil, Cucumber, Coconut Water, Passion Fruit).
- Самые «универсальные» mix-ins: **Ginger (7 баз)**, **Lemon (5 баз)**, Apple (4), Orange (4).
- У Watermelon — единственной базы — нет Ginger и Lemon; её профиль полностью «освежающий» (Mint, Lime, Cucumber, Basil, Coconut Water).

---

## 5. T2a — Signature Mixes, готовые вкусовые миксы (канон: K2)

> Постер: «JOOZ — Signature Mixes · Top 8 ready mixes». ⚠️ Заголовок «Top 8», карточек — **9**.

| № | Название | Состав (формула) | Выводим в конфигураторе §4? |
|---|---|---|---|
| 1 | **Mango Passion** | Mango + Passion Fruit | ✅ (база Mango) |
| 2 | **Tropical Mango** | Mango + Pineapple + Passion Fruit | ✅ (база Mango) |
| 3 | **Watermelon Mint Lime** | Watermelon + Mint + Lime | ✅ (база Watermelon) |
| 4 | **Watermelon Cucumber** | Watermelon + Cucumber + Mint | ✅ (база Watermelon) |
| 5 | **Orange Carrot Ginger** | Orange + Carrot + Ginger | ✅ (база Orange) |
| 6 | **Pomegranate Orange** | Pomegranate + Orange | ✅ (база Pomegranate) |
| 7 | **Strawberry Mango** | Strawberry + Mango + Lime | 🚧 нет — **Strawberry отсутствует в custom** |
| 8 | **Green Clean** | Green Apple + Cucumber + Celery + Lemon | ⚠️ только как база **Celery** (+Apple+Cucumber+Lemon); как база Apple — нет |
| 9 | **Red Recovery** | Beetroot + Pomegranate + Apple + Lemon | ✅ (база Beetroot) |

**Premium add-on на постере:** Collagen.
**Маркетинговые клеймы:** 100 % Natural · No Added Sugar · «Fresh ingredients. Smart combinations. Made just for you.»

---

## 6. T2b — Nutrition Signatures, 13 функциональных напитков (канон: K3)

> Постер: «JOOZ — Nutrition Signatures · Top 13 functional drinks · Functional blends from real
> fruits, vegetables, greens and natural boosters». Слоган: **«Choose the way you want to feel —
> hydrated, focused, glowing, recovered or balanced»**.
> Бейджи: Real ingredients · No artificials · Nutrient dense · Made fresh daily · Feel the difference.

| № | Название | Функция (из названия) | Состав (формула) | Выводим в custom §4? |
|---|---|---|---|---|
| 1 | **Iron Support** | железо | Beetroot + Pomegranate + Orange + Lemon | ✅ (база Beetroot) |
| 2 | **Ferritin C Boost** | ферритин + вит. C | Beetroot + Orange + Green Apple + Ginger | ✅ (база Beetroot) |
| 3 | **Deep Hydration** | глубокая гидратация | Watermelon + Cucumber + Coconut Water + Mint + Lime | ✅ (база Watermelon, все 5 её mix-ins кроме Basil — 4 из 5) |
| 4 | **Electro Fresh** | электролиты | Coconut Water + Pineapple + Lime + Mint + Sea Salt Micro-dose | 🚧 нет — Coconut Water не база; Sea Salt нет в custom |
| 5 | **Collagen Glow** | коллаген / кожа | Pomegranate + Strawberry + Orange + Collagen | 🚧 нет — Strawberry нет в custom (Collagen есть как PA) |
| 6 | **Men's Performance** | мужская энергия | Beetroot + Pomegranate + Watermelon + Lime + Ginger | 🚧 нет — Watermelon и Lime не разрешены базе Beetroot |
| 7 | **Cycle Comfort** | женский цикл | Beetroot + Pomegranate + Orange + Ginger | ✅ (база Beetroot) |
| 8 | **Sleep Recovery** | сон / восстановление | Pomegranate + Strawberry + Orange + Chia | 🚧 нет — Strawberry, Chia нет в custom |
| 9 | **Night Calm** | вечернее расслабление | Banana + Oat Milk + Cacao + Almond Butter | 🚧 нет — целиком вне соковой модели (смузи-тип) |
| 10 | **Focus Green** | фокус | Green Apple + Kiwi + Cucumber + Mint + Lime | 🚧 нет — Kiwi нет в custom; базе Apple не разрешены Cucumber/Mint/Lime |
| 11 | **Gut Support** | пищеварение | Pineapple + Papaya + Ginger + Lime + Mint | 🚧 нет — Papaya нет в custom |
| 12 | **Green Gut** | пищеварение / грин | Green Apple + Celery + Cucumber + Lemon + Ginger | ⚠️ только как база **Celery** (+Apple+Cucumber+Lemon+Ginger — все 4 её mix-ins) |
| 13 | **Post-Workout Recovery** | после тренировки | Banana + Mango + Coconut Water + Protein | 🚧 нет — Banana, Protein нет в custom |

**Вывод для движка формул:** только **5 из 13** функциональных напитков выводимы из custom-матрицы;
8 используют preset-only ингредиенты или запрещённые сочетания → пресеты должны храниться как
**самостоятельные формулы**, а не как «сохранённые конфигурации кастомайзера».

### 6.1 Функциональные группы (по слогану «choose the way you want to feel»)

| Эффект | Напитки |
|---|---|
| hydrated | Deep Hydration, Electro Fresh |
| focused | Focus Green |
| glowing | Collagen Glow |
| recovered | Sleep Recovery, Night Calm, Post-Workout Recovery |
| balanced (нутриенты/циклы/ЖКТ) | Iron Support, Ferritin C Boost, Men's Performance, Cycle Comfort, Gut Support, Green Gut |

---

## 7. T3 — Avocado Specials, 7 слоёных авокадо-муссов (канон: K4)

> Постер: «JOOZ — Avocado Specials · Top 7 avocado mousse mixes · Layered avocado mousse blends with
> fruits, nuts and toppings» · «Curated premium avocado mousse blends for indulgent, easy ordering».

| № | Название | Состав (формула) |
|---|---|---|
| 1 | **Mango Avocado** | Mango base + Avocado mousse + Mango cubes |
| 2 | **Avocado Pomegranate** | Avocado mousse + Pomegranate seeds + Honey |
| 3 | **Avocado Banana Dates** | Avocado mousse + Banana + Dates |
| 4 | **Avocado Strawberry** | Avocado mousse + Strawberry + Honey |
| 5 | **Avocado Pistachio** | Avocado mousse + Pistachio + Honey |
| 6 | **Avocado Royal** | Avocado mousse + Mango + Strawberry + Pomegranate + Mixed Nuts |
| 7 | **Avocado Protein** | Avocado mousse + Banana + Protein + Almond Milk |

**Premium add-on на постере:** Collagen.

Особенности типа T3:
- База всегда **Avocado mousse** (кроме №1, где базой выступает Mango base, а мусс — слой);
- ингредиенты — не соки, а **слои и топпинги** (cubes, seeds, орехи, мёд, финики) → в модели данных
  это другая группа add-on'ов (`layer/topping`), не смешиваемая с соковыми mix-ins;
- «curated… for easy ordering» — линейка позиционируется как **только пресеты** (без кастомизации,
  кроме premium add-on Collagen).

---

## 8. Противоречия и открытые вопросы (свести в общий реестр ТЗ)

### Противоречия источников ⚠️

| # | Противоречие | Где | Предлагаемый канон |
|---|---|---|---|
| П1 | Бренд **JOOZ** vs рабочее название проекта **Juicy** | K1–K4 vs весь остальной проект | вопрос к бизнесу |
| П2 | Заголовок «Top **8** ready mixes», карточек — **9** | K2 | считать 9 (фактический состав постера) |
| П3 | «Apple» (K1) vs «Green Apple» (K2, K3) | K1 vs K2/K3 | один ингредиент, унифицировать имя |
| П4 | Асимметрия матрицы: Orange→Pineapple есть, Pineapple→Orange нет; Celery→Apple есть, Apple→Celery нет | K1 | уточнить намеренность |
| П5 | Coconut Water в Electro Fresh — фактически **база**, в конфигураторе — только mix-in Watermelon | K3 vs K1 | пресеты ≠ ограничения custom |
| П6 | Men's Performance нарушает custom-матрицу (Beetroot + Watermelon + Lime) | K3 vs K1 | пресеты ≠ ограничения custom |
| П7 | Turmeric заявлен как premium add-on «к любому напитку», но не входит ни в один готовый рецепт | K1 vs K2–K4 | ок, но проверить востребованность |

### Открытые вопросы для бизнеса 🚧 (в источниках отсутствуют)

1. **Лимит mix-ins** в custom: min/max на напиток? (UI-паттерн Drinkit предполагает counter/чипы)
2. **Ценообразование**: цена базы? цена каждого mix-in (единая или индивидуальная)? цена premium add-ons (Collagen, Turmeric)? цена пресетов vs сумма ингредиентов?
3. **Дозы/пропорции**: объём базы и доза каждого mix-in (мл/г) — нужны для себестоимости и КБЖУ.
4. **КБЖУ ингредиентов** — без них не работает live-пересчёт (механика прототипа `product.kbju + Σ(addon.kbju)`).
5. **Размеры S/M/L** — применимы ли к custom и пресетам; пересчёт доз по размеру?
6. Можно ли в custom добавлять **preset-only ингредиенты** (Strawberry, Kiwi, Papaya, Banana, Chia, Protein, Sea Salt, Cacao…)? Если да — какие к каким базам?
7. **Кастомизируемы ли пресеты** (T2): можно ли в Iron Support докинуть Ginger / убрать Lemon? Или пресет неизменен (только premium add-on)?
8. **Avocado Specials**: фиксированные слои или допускают замены/добавки топпингов?
9. Premium add-ons: можно ли **оба сразу** (Collagen + Turmeric)? Counter (×2)?
10. **Наличие по точкам**: ингредиент закончился — что выключается (база? все рецепты с ним? mix-in в матрице?) → связка с `OutletInventory`.

---

## 9. Маппинг на формульный движок (связка с `docs/BACKEND.md`)

Как материалы K1–K4 ложатся на существующую доменную модель (BACKEND.md §2.3–2.6):

| Понятие JOOZ | Сущность BACKEND.md | Комментарий |
|---|---|---|
| Ингредиент (реестр §3) | `Addon` (или новая сущность `Ingredient`) | единый реестр; роли через флаги/группы |
| База (9 шт.) | `Product` типа `custom_juice` | каждая база — продукт-конструктор |
| Whitelist mix-ins базы (§4.2) | `AddonGroupBinding` (продукт ↔ группа) + `compatibility rules` (§2.6) | матрица §4.2 = прямое наполнение binding'ов; **направленность от базы** поддерживается тем, что binding висит на продукте-базе |
| Premium add-ons (Collagen, Turmeric) | глобальная `AddonGroup`, привязанная ко всем продуктам | тип `counter` или `multi` — уточнить (§8 в.9) |
| Signature Mix / Nutrition Signature | `Product` типа `preset` с фиксированным составом (рецепт-формула) | состав хранится как структура рецепта, **не** через кастомайзер (см. §6 — 8 из 13 не выводимы) |
| Avocado Special | `Product` типа `layered` + группа `topping` | отдельная категория |
| Функция напитка (hydrated/focused/…) | тег/атрибут продукта | для фильтров и витрины «по эффекту» |
| «Build Your Juice» flow | экран кастомайзера C1 (`/product/[slug]`) | текущий AddonPopover-паттерн прототипа переиспользуем; меняется источник правил — формулы вместо хардкода `lib/data.ts` |

**Каноническая формула напитка (для движка):**

```
Drink := Base(1)                                  — из множества custom_base
       + MixIns(0..N)  where mixin ∈ whitelist(Base)   — матрица §4.2; N = лимит (открыт, §8 в.1)
       + PremiumAddons(0..M) ⊆ {Collagen, Turmeric}     — глобально разрешены

Preset := name + ingredients[фиксированный список] + function_tag (+ PremiumAddons)
Layered := AvocadoMousse + Layers/Toppings[фиксированный список] (+ Collagen)

Price := ?(база) + Σ ?(mixin) + Σ ?(premium)       — все цены открыты (§8 в.2)
KBJU  := kbju(Base) + Σ kbju(mixin) + Σ kbju(premium)  — данных КБЖУ нет (§8 в.4)
```

---

## 10. Сводные количественные показатели

| Показатель | Значение | Источник |
|---|---|---|
| Базовых соков (custom) | **9** | K1 |
| Уникальных mix-ins (custom) | **15** | K1, матрица §4.2 |
| Связей «база × mix-in» | **42** | подсчёт по §4.2 |
| Premium add-ons | **2** (Collagen, Turmeric) | K1 |
| Signature Mixes | **9** (заявлено 8 ⚠️) | K2 |
| Nutrition Signatures | **13** | K3 |
| Avocado Specials | **7** | K4 |
| **Итого готовых позиций (пресетов)** | **29** | K2+K3+K4 |
| Уникальных ингредиентов в реестре | **32** | §3 |
| Пресетов, выводимых из custom-матрицы | **13 из 22** соковых: K2 — 8 из 9 (7 напрямую + Green Clean через базу Celery); K3 — 5 из 13 (4 напрямую + Green Gut через базу Celery). Avocado (7) — отдельный тип T3, вне соковой матрицы | §5, §6 |
