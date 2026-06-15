// JUICY — Roadmap deck (16:9). Hours reconciled 1:1 with СМЕТА (202 ч / 505 000 ₽).
// Editorial DNA: PT Serif + JetBrains Mono + citrus accent.
#set document(title: "Juicy — план запуска (10 дней, по смете)", author: "mediann")

// ---- palette ----
#let c-ink   = rgb("#17130E")
#let c-paper = rgb("#FAF7F2")
#let c-mute  = rgb("#5A5249")
#let c-soft  = rgb("#938B7F")
#let c-rule  = rgb("#E4DDD2")
#let c-accent      = rgb("#C26A1F")  // citrus amber
#let c-accent-soft = rgb("#F6E8D6")
#let c-green      = rgb("#3E6B4F")   // fresh secondary
#let c-green-soft = rgb("#E5EDE6")
#let c-be    = rgb("#2E2A24")        // backend bar
#let f-serif = "PT Serif"
#let f-mono  = "JetBrains Mono"

// ---- page ----
#set page(
  width: 33.867cm, height: 19.05cm,
  margin: (x: 16mm, y: 13mm),
  fill: c-paper,
)
#set text(font: f-serif, size: 11pt, fill: c-ink, lang: "ru", hyphenate: false)
#set par(leading: 0.72em, spacing: 0.9em, justify: false)

// ---- helpers ----
#let kick(t) = text(font: f-mono, size: 8pt, fill: c-soft, tracking: 1.2pt)[#upper[#t]]

#let chip(col, label) = box(baseline: 0.18em)[
  #box(width: 9pt, height: 9pt, fill: col, radius: 1.5pt) #h(2pt) #text(font: f-mono, size: 7.5pt, fill: c-mute)[#label]
]

// horizontal stacked hours bar; total scaled vs ref (max day = 32h)
#let hours-bar(b, f, d, total, price) = {
  let maxw = 60mm
  let u = maxw / 32
  block(breakable: false, {
    if b > 0 { box(height: 8pt, width: b*u, fill: c-be,    radius: (left: 1.5pt)) }
    if f > 0 { box(height: 8pt, width: f*u, fill: c-accent) }
    if d > 0 { box(height: 8pt, width: d*u, fill: c-green,  radius: (right: 1.5pt)) }
    h(5pt)
    text(font: f-mono, size: 8pt, fill: c-ink, weight: "bold")[#total ч]
    linebreak()
    v(2pt)
    text(font: f-mono, size: 7.5pt, fill: c-mute)[Б #b · Ф #f · Д #d]
    h(5pt)
    text(font: f-mono, size: 7.5pt, fill: c-green, weight: "bold")[#price]
  })
}

// roadmap (gantt cascade) single row. total project = 202 h.
#let CW = 168mm
#let U  = CW / 202
#let gantt-row(idx, label, start, b, f, d, total, ms) = {
  grid(columns: (46mm, 1fr), column-gutter: 4mm, align: (left + horizon, left + horizon),
    {
      text(font: f-mono, size: 8.5pt, fill: c-accent, weight: "bold")[#idx]
      h(4pt)
      text(size: 9.5pt, fill: c-ink)[#label]
    },
    block(height: 6.3mm, breakable: false, {
      box(height: 5mm, width: start*U)[]
      box(height: 5mm, width: b*U, fill: c-be, radius: (left: 1.5pt))
      box(height: 5mm, width: f*U, fill: c-accent)
      box(height: 5mm, width: d*U, fill: c-green, radius: (right: 1.5pt))
      h(3pt)
      text(font: f-mono, size: 7.5pt, fill: c-mute)[#total ч]
      if ms != none {
        h(4pt)
        text(fill: c-accent, size: 9pt)[◆]
        h(2pt)
        text(font: f-mono, size: 7pt, fill: c-green, weight: "bold")[#ms]
      }
    })
  )
}

// progress dots footer (1..10)
#let node(i, cur) = {
  if i == cur {
    box(width: 13pt, height: 13pt, fill: c-accent, radius: 50%, inset: 0pt)[
      #align(center + horizon)[#text(fill: white, font: f-mono, size: 6.5pt, weight: "bold")[#i]]
    ]
  } else if i < cur {
    box(width: 11pt, height: 11pt, fill: c-accent-soft, radius: 50%, stroke: 0.7pt + c-accent, inset: 0pt)[
      #align(center + horizon)[#text(fill: c-accent, font: f-mono, size: 5.5pt)[#i]]
    ]
  } else {
    box(width: 11pt, height: 11pt, radius: 50%, stroke: 0.7pt + c-rule, fill: c-paper, inset: 0pt)[
      #align(center + horizon)[#text(fill: c-soft, font: f-mono, size: 5.5pt)[#i]]
    ]
  }
}
#let progress(cur) = {
  set align(center)
  stack(dir: ltr, spacing: 7pt, ..range(1, 11).map(i => node(i, cur)))
}

// info card
#let card(title, body, accent: c-rule, fill: white) = block(
  width: 100%, inset: 9pt, radius: 3pt, fill: fill, stroke: 0.6pt + accent,
  breakable: false,
  {
    text(font: f-mono, size: 7.5pt, fill: c-mute, tracking: 0.6pt)[#upper[#title]]
    v(3pt)
    set text(size: 10pt, fill: c-ink)
    body
  }
)

#let bullets(items) = {
  set par(leading: 0.6em, spacing: 0.5em)
  for it in items {
    grid(columns: (10pt, 1fr), align: (left + top, left + top),
      text(fill: c-accent)[—], text(size: 9.5pt, fill: c-ink)[#it])
  }
}

// ============================================================
// SLIDE 1 — COVER
// ============================================================
#kick[Juicy · Roadmap · v2.0 · 2026-06-11]
#v(13mm)
#text(font: f-serif, size: 13pt, fill: c-accent, weight: "bold", tracking: 2pt)[#upper[План запуска проекта]]
#v(3mm)
#text(font: f-serif, size: 60pt, weight: "bold", fill: c-ink)[
  За 10 дней — \
  от фундамента до запуска
]
#v(5mm)
#text(size: 14pt, fill: c-mute)[
  Mobile-web сервис предзаказа напитков. Что и в какой последовательности делается по каждому дню.
]
#v(1fr)
#line(length: 100%, stroke: 0.6pt + c-rule)
#v(4mm)
#grid(columns: (1fr, 1fr, 1fr, 1fr), column-gutter: 6mm,
  ..(("10", "рабочих дней · ≈ 2 недели"), ("202 ч", "объём по смете"), ("500 000 ₽", "к оплате · скидка 5 000 ₽"), ("RU / AR", "две локали")).map(s => {
    text(font: f-serif, size: 30pt, weight: "bold", fill: c-accent)[#s.at(0)]
    linebreak()
    text(font: f-mono, size: 8pt, fill: c-mute)[#upper[#s.at(1)]]
  })
)

// ============================================================
// SLIDE 2 — ROADMAP OVERVIEW (gantt cascade)
// ============================================================
#pagebreak()
#grid(columns: (1fr, auto), align: (left+horizon, right+horizon),
  { kick[Дорожная карта · 10 дней]; linebreak(); v(1pt); text(font: f-serif, size: 25pt, weight: "bold")[Весь путь на одном экране] },
  text(font: f-mono, size: 8pt, fill: c-soft)[ОБЗОР · 202 Ч]
)
#v(2mm)
#line(length: 100%, stroke: 0.5pt + c-rule)
#v(3.5mm)

#gantt-row("01", "Фундамент + дизайн",   0,   10, 2, 4, 16, none)
#v(1.0mm)
#gantt-row("02", "Каталог",              16,  8, 6, 0, 14, none)
#v(1.0mm)
#gantt-row("03", "Конструктор напитка",  30,  8, 8, 0, 16, none)
#v(1.0mm)
#gantt-row("04", "Корзина + вход",       46,  7, 7, 0, 14, none)
#v(1.0mm)
#gantt-row("05", "Оплата + чек",         60,  9, 4, 1, 14, "Собрал → оплатил")
#v(1.0mm)
#gantt-row("06", "Статусы realtime",     74,  10, 9, 1, 20, none)
#v(1.0mm)
#gantt-row("07", "Мои заказы + админка",  94,  8, 10, 0, 18, "Кабинет + вход персонала")
#v(1.0mm)
#gantt-row("08", "Админ-каталог + медиа", 112, 12, 14, 2, 28, "Drag-drop медиа")
#v(1.0mm)
#gantt-row("09", "Заказы + дашборд",      140, 15, 15, 2, 32, none)
#v(1.0mm)
#gantt-row("10", "Локализация + запуск",  172, 14, 13, 3, 30, "Приёмка и запуск")

#v(2.5mm)
#line(length: 100%, stroke: 0.4pt + c-rule)
#v(2.5mm)
#grid(columns: (auto, auto, auto, auto, 1fr), column-gutter: 13pt, align: left + horizon,
  chip(c-be, "Бэкенд 101 ч"),
  chip(c-accent, "Фронтенд 88 ч"),
  chip(c-green, "Дизайн 13 ч"),
  box(baseline: 0.18em)[#text(fill: c-accent, size: 9pt)[◆] #h(2pt) #text(font: f-mono, size: 7.5pt, fill: c-mute)[Контрольная точка]],
  align(right)[#text(size: 8.5pt, fill: c-mute, style: "italic")[Длина полосы = часы по смете. Каждый этап начинается там, где закончился предыдущий.]]
)
#v(2.5mm)
#block(width: 100%, inset: (x: 9pt, y: 6pt), radius: 3pt, fill: c-green-soft, stroke: 0.6pt + c-green,
  grid(columns: (auto, 1fr), column-gutter: 8pt, align: (left+horizon, left+horizon),
    text(font: f-mono, size: 7.5pt, fill: c-green, weight: "bold")[★ БОНУС],
    text(size: 9.5pt, fill: c-ink)[Сверх сметы и без доплаты: приём заказов по рабочим часам точки (подробнее — отдельный слайд).]
  )
)

// ============================================================
// PER-DAY SLIDE TEMPLATE
// ============================================================
#let day-slide(idx, theme, title, smeta, goal, work, result, done, dep, b, f, d, total, price) = {
  let num = if idx < 10 { "0" + str(idx) } else { str(idx) }
  pagebreak()
  // header
  grid(columns: (1fr, auto), align: (left+horizon, right+horizon),
    kick[Juicy · Roadmap · этап #theme],
    text(font: f-mono, size: 8pt, fill: c-soft)[ЭТАП #num / 10]
  )
  v(2.5mm)
  // big number + title + smeta ref
  grid(columns: (32mm, 1fr), column-gutter: 8mm, align: (left+bottom, left+bottom),
    text(font: f-serif, size: 78pt, weight: "bold", fill: c-accent, baseline: 0pt)[#num],
    {
      set par(leading: 0.5em)
      text(font: f-serif, size: 21pt, weight: "bold", fill: c-ink)[#title]
      linebreak()
      v(2pt)
      text(font: f-mono, size: 7.5pt, fill: c-green)[СМЕТА: #smeta]
    }
  )
  v(2mm)
  line(length: 100%, stroke: 0.5pt + c-rule)
  v(3.5mm)
  // goal banner
  block(width: 100%, inset: (x: 10pt, y: 7pt), fill: c-accent-soft, radius: 3pt, breakable: false,
    grid(columns: (auto, 1fr), column-gutter: 8pt, align: (left+horizon, left+horizon),
      text(font: f-mono, size: 7.5pt, fill: c-accent, weight: "bold")[ЦЕЛЬ],
      text(size: 12pt, fill: c-ink, weight: "bold")[#goal]
    )
  )
  v(4mm)
  // two columns
  grid(columns: (1.15fr, 1fr), column-gutter: 9mm, align: (left+top, left+top),
    {
      text(font: f-mono, size: 7.5pt, fill: c-mute, tracking: 0.6pt)[#upper[Состав работ]]
      v(2.5mm)
      bullets(work)
    },
    {
      card("Результат для вас", text[#result], accent: c-green, fill: c-green-soft)
      v(3mm)
      grid(columns: (1fr, 1fr), column-gutter: 4mm,
        card("Готово, когда", text(size: 9pt)[#done]),
        card("После чего", text(size: 9pt)[#dep]),
      )
      v(3mm)
      block(width: 100%, inset: 9pt, radius: 3pt, stroke: 0.6pt + c-rule, breakable: false, {
        text(font: f-mono, size: 7.5pt, fill: c-mute, tracking: 0.6pt)[#upper[Объём этапа · по смете]]
        v(4pt)
        hours-bar(b, f, d, total, price)
      })
    }
  )
  place(bottom + center, dy: 2mm, progress(idx))
}

#day-slide(1, "01", "Фундамент и дизайн-система", "№1 Инфраструктура · №13 Дизайн 9 экранов",
  "Поднять «скелет» продукта и заложить единый визуальный язык.",
  ("Репозиторий и окружения dev / prod",
   "База данных, миграции, авторизация (JWT)",
   "Каркасы платежей (webhook) и realtime (WebSocket)",
   "Базовый деплой и автосборка (CI)",
   "Дизайн 9 ключевых экранов — визуальная система"),
  "Работает «пустое» приложение и вход в админку; готова дизайн-система экранов.",
  "Разворачивается одной командой, проходит health-check, есть вход в админку.",
  "Стартовый этап — фундамент для всех дней.",
  10, 2, 4, 16, "40 000 ₽")

#day-slide(2, "02", "Каталог напитков (витрина)", "№2 Каталог (PUB-G-01, 02)",
  "Меню, которое видит клиент.",
  ("Категории напитков (данные с бэкенда)",
   "Список напитков и карточка напитка",
   "Деталка с видео"),
  "Клиент открывает меню по категориям и карточку напитка с медиа.",
  "Меню отображается из каталога, карточки и видео работают.",
  "После Дня 1 — нужна БД.",
  8, 6, 0, 14, "35 000 ₽")

#day-slide(3, "03", "Конструктор напитка", "№3 Конструктор добавок (PUB-G-03)",
  "Собрать напиток под себя.",
  ("Связка напиток × добавка, типы выбора",
   "Live-пересчёт цены и КБЖУ в реальном времени"),
  "Клиент выбирает размер и добавки, сразу видит цену и КБЖУ.",
  "Конфигуратор корректно считает цену и КБЖУ на лету.",
  "После Дня 2 — нужен каталог.",
  8, 8, 0, 16, "40 000 ₽")

#day-slide(4, "04", "Корзина и вход по телефону", "№4 Корзина (PUB-G-05) · №5 Авторизация по телефону (PUB-G-04)",
  "Собрать заказ и узнать клиента.",
  ("Корзина: несколько напитков, количество, итоги, сохранение",
   "Авторизация по номеру телефона"),
  "Клиент собирает заказ из нескольких позиций и входит по телефону.",
  "Заказ из нескольких позиций считается; вход по телефону работает.",
  "После Дня 3 — нужен конструктор.",
  7, 7, 0, 14, "35 000 ₽")

#day-slide(5, "05", "Оформление, оплата и чек", "№6 Оформление + оплата Stripe (PUB-A-01, 02)",
  "Принять деньги.",
  ("Оформление заказа",
   "Оплата через Stripe + подтверждение по webhook",
   "Чек с VAT 5 %"),
  "Клиент оплачивает; заказ помечается оплаченным, виден расчёт чека.",
  "Тестовая оплата проходит, заказ «оплачен», чек корректен.",
  "После Дня 4. Зависит от Stripe и решения по VAT.",
  9, 4, 1, 14, "35 000 ₽")

#day-slide(6, "06", "Статусы в реальном времени + профиль", "№7 Статусы + realtime (PUB-A-03) · №9 Профиль + guards (PUB-A-06, 08)",
  "Клиент видит прогресс, у него есть профиль.",
  ("Единая статусная модель: Принят → Готовим → Готов → Выдан",
   "«Прибыл, готов забрать» + realtime (WebSocket)",
   "Профиль + состояния гость/клиент + route-guards"),
  "Статус меняется мгновенно; у клиента есть профиль и защита маршрутов.",
  "Смена статуса видна клиенту в реальном времени; гость/клиент разграничены.",
  "После Дня 5 — статусы живут у оплаченного заказа.",
  10, 9, 1, 20, "50 000 ₽")

#day-slide(7, "07", "Мои заказы + каркас админки", "№8 Мои заказы (PUB-A-07) · №10 Каркас админки + роли (ADM-S-06)",
  "История заказов у клиента и вход для персонала.",
  ("«Мои заказы»: список + деталка с историей статусов",
   "Каркас админки, вход персонала, роли, менеджеры"),
  "Клиент видит свои заказы; персонал входит в админку с ролями.",
  "История заказов доступна; вход персонала и роли работают.",
  "После Дня 6.",
  8, 10, 0, 18, "45 000 ₽")

#day-slide(8, "08", "Админ-каталог: меню + drag-and-drop медиа", "№11 Админка-каталог (ADM-S-01…05)",
  "Управлять меню самим, с удобной загрузкой медиа.",
  ("Категории напитков и добавок, добавки, единицы измерения",
   "Напитки + привязка добавок",
   "Загрузка фото/видео перетаскиванием (drag-and-drop) в облако — без ручных ссылок"),
  "Заводите напиток и перетаскиваете картинку — она сразу в меню.",
  "Меню наполняется из админки, медиа грузится drag-and-drop, видно у клиента.",
  "После Дня 7 — нужен каркас админки.",
  12, 14, 2, 28, "70 000 ₽")

#day-slide(9, "09", "Админ-заказы + дашборд", "№12 Админка-заказы (ADM-M-01…05) · Опция О5 Дашборд (ADM-S-10)",
  "Управлять заказами и видеть метрики.",
  ("Админ-заказы: фильтры, «Взять в работу», статусы",
   "Данные клиента, история, состав заказа",
   "Дашборд: 9 метрик с фильтром по периоду"),
  "Персонал ведёт заказы от приёма до выдачи; владелец видит дашборд продаж.",
  "Заказы управляются из админки; дашборд показывает данные за период.",
  "После Дня 8.",
  15, 15, 2, 32, "80 000 ₽")

#day-slide(10, "10", "Клиенты/платежи, локализация RU/AR и запуск", "Опция О4 Клиенты + платежи (ADM-S-08, 09) · Опция О3 Локализация (PUB-A-09)",
  "Две локали, реестры и публичный запуск.",
  ("Локализация RU / AR + RTL + язык в профиле + переводы в админке",
   "Админка: клиенты с деталкой + реестр платежей",
   "Боевые ключи (Stripe), финальный деплой и приёмка"),
  "Приложение на двух языках, есть реестры клиентов и платежей; продукт запущен.",
  "Пройдена приёмка, подключены боевые интеграции, продукт на prod (RU/AR).",
  "После Дней 1–9 — финал.",
  14, 13, 3, 30, "75 000 ₽")

// ============================================================
// BONUS SLIDE (сверх сметы)
// ============================================================
#pagebreak()
#grid(columns: (1fr, auto), align: (left+horizon, right+horizon),
  { kick[Добавленная ценность]; linebreak(); v(1pt); text(font: f-serif, size: 25pt, weight: "bold")[Бонус от команды — сверх сметы] },
  text(font: f-mono, size: 8pt, fill: c-green, weight: "bold")[БЕЗ ДОПЛАТЫ]
)
#v(2mm)
#line(length: 100%, stroke: 0.5pt + c-green)
#v(4mm)
#text(size: 13pt, fill: c-mute)[
  Эту возможность мы #text(fill: c-ink, weight: "bold")[доработаем отдельно, без отдельной оплаты] — чтобы в проекте
  она тоже была. В смету #text(fill: c-ink, weight: "bold")[202 ч / 500 000 ₽] не входит.
]
#v(8mm)
#block(width: 100%, inset: 16pt, radius: 4pt, fill: c-green-soft, stroke: 0.7pt + c-green, breakable: false, {
  text(fill: c-green, size: 16pt)[★]
  h(4pt)
  text(font: f-serif, size: 20pt, weight: "bold", fill: c-ink)[Часы приёма заказов]
  v(8pt)
  text(size: 12.5pt, fill: c-mute)[Приём заказов — только когда точка реально работает и может их выполнить.]
  v(9pt)
  set par(leading: 0.7em, spacing: 0.7em)
  for it in (
    "Рабочие часы точки задаются в админке по дням недели, с учётом часового пояса.",
    "Вне расписания оформить заказ нельзя — клиент видит понятное сообщение «точка закрыта».",
    "Снимает заказы «в закрытую» и связанные с ними отмены, возвраты и недовольство клиентов.",
  ) {
    grid(columns: (13pt, 1fr), align: (left+top, left+top),
      text(fill: c-green, size: 11pt)[—], text(size: 11.5pt, fill: c-ink)[#it])
  }
})
#v(1fr)
#block(width: 100%, inset: (x: 10pt, y: 8pt), radius: 3pt, fill: c-accent-soft, stroke: 0.6pt + c-accent,
  text(size: 10.5pt, fill: c-ink)[
    #text(weight: "bold")[Почему это важно.] Заказы принимаются только в рабочие часы точки — меньше заказов
    «в закрытую», отмен и недовольных клиентов. Реализуем параллельно на этапе админ-заказов (День 9).
  ]
)

// ============================================================
// FINAL SLIDE — MILESTONES + WHAT WE NEED + TOTALS
// ============================================================
#pagebreak()
#grid(columns: (1fr, auto), align: (left+horizon, right+horizon),
  { kick[Контрольные точки · что нужно от вас]; linebreak(); v(1pt); text(font: f-serif, size: 25pt, weight: "bold")[Вехи и зависимости] },
  text(font: f-mono, size: 8pt, fill: c-soft)[ИТОГ]
)
#v(2mm)
#line(length: 100%, stroke: 0.5pt + c-rule)
#v(4mm)

#text(font: f-mono, size: 8pt, fill: c-mute, tracking: 0.6pt)[#upper[4 контрольные точки приёмки]]
#v(3mm)
#grid(columns: (1fr, 1fr, 1fr, 1fr), column-gutter: 5mm, align: left+top,
  ..(("День 5", "Сквозной заказ с оплатой: собрал → вошёл → оплатил"),
     ("День 7", "Личный кабинет клиента + вход персонала в админку"),
     ("День 8", "Полное самоуправление меню + drag-and-drop медиа"),
     ("День 10", "Финальная приёмка и публичный запуск (RU/AR)")).map(m => block(
       width: 100%, inset: 9pt, radius: 3pt, fill: c-accent-soft, stroke: 0.6pt + c-accent, breakable: false, {
         text(fill: c-accent, size: 11pt)[◆]
         h(3pt)
         text(font: f-mono, size: 9pt, fill: c-accent, weight: "bold")[#m.at(0)]
         v(4pt)
         text(size: 9.5pt, fill: c-ink)[#m.at(1)]
       }))
)

#v(6mm)
#text(font: f-mono, size: 8pt, fill: c-mute, tracking: 0.6pt)[#upper[Что нужно от вас, чтобы не было простоев]]
#v(3mm)
#grid(columns: (1fr, 1fr), column-gutter: 9mm, row-gutter: 3.5mm, align: left+top,
  ..(("Stripe", "аккаунт продавца (merchant) + TRN/VAT для приёма реальных платежей", "к Дню 5"),
     ("Контент", "логотип, фото/видео напитков, тексты, часы работы точек", "к Дням 2 и 8"),
     ("Решения", "модель VAT (в цене / сверху), минимальная сумма заказа", "к Дню 5")).map(n =>
     grid(columns: (auto, 1fr), column-gutter: 8pt, align: (left+top, left+top),
       text(fill: c-accent, size: 11pt)[—],
       {
         text(size: 11pt, weight: "bold", fill: c-ink)[#n.at(0)]
         text(font: f-mono, size: 7.5pt, fill: c-green)[ · #n.at(2)]
         linebreak()
         text(size: 9.5pt, fill: c-mute)[#n.at(1)]
       }))
)

#v(1fr)
#line(length: 100%, stroke: 0.6pt + c-rule)
#v(3mm)
#grid(columns: (1fr, auto), align: (left+horizon, right+horizon),
  text(size: 10pt, fill: c-mute, style: "italic")[Часы по дням сходятся со сметой (505 000 ₽). Со скидкой 5 000 ₽ — к оплате 500 000 ₽.],
  text(font: f-mono, size: 9pt, fill: c-accent, weight: "bold")[10 дней · 202 ч · 500 000 ₽ · RU/AR]
)
