/**
 * Мок-данные для админки. Все сущности параллельны реальным таблицам
 * из docs/BACKEND.md §2.10. На бэке заменятся на API.
 */

export type Role =
  | "super_admin"
  | "catalog_admin"
  | "outlet_manager"
  | "barista"
  | "finance"
  | "support";

export const roleLabels: Record<Role, string> = {
  super_admin: "Супер-админ",
  catalog_admin: "Каталог",
  outlet_manager: "Менеджер точки",
  barista: "Бариста",
  finance: "Финансы",
  support: "Поддержка",
};

export type StaffUser = {
  id: string;
  email: string;
  name: string;
  roles: Role[];
  outletScope: string[] | "*";   // outlet IDs или "*"
  lastLoginAt?: string;
  disabled: boolean;
};

export const staffUsers: StaffUser[] = [
  {
    id: "u-1",
    email: "owner@juicy.ae",
    name: "Магомед Г.",
    roles: ["super_admin"],
    outletScope: "*",
    lastLoginAt: "2026-05-13T08:42:00Z",
    disabled: false,
  },
  {
    id: "u-2",
    email: "anna.k@juicy.ae",
    name: "Anna K.",
    roles: ["catalog_admin"],
    outletScope: "*",
    lastLoginAt: "2026-05-12T17:10:00Z",
    disabled: false,
  },
  {
    id: "u-3",
    email: "sergey.m@juicy.ae",
    name: "Sergey M.",
    roles: ["outlet_manager"],
    outletScope: ["bay-avenue"],
    lastLoginAt: "2026-05-13T09:01:00Z",
    disabled: false,
  },
  {
    id: "u-4",
    email: "fatima.barista@juicy.ae",
    name: "Fatima H.",
    roles: ["barista"],
    outletScope: ["bay-avenue"],
    lastLoginAt: "2026-05-13T07:05:00Z",
    disabled: false,
  },
  {
    id: "u-5",
    email: "yusuf.barista@juicy.ae",
    name: "Yusuf R.",
    roles: ["barista"],
    outletScope: ["dubai-mall"],
    lastLoginAt: "2026-05-12T19:45:00Z",
    disabled: false,
  },
  {
    id: "u-6",
    email: "leila.support@juicy.ae",
    name: "Leila A.",
    roles: ["support", "finance"],
    outletScope: "*",
    lastLoginAt: "2026-05-11T14:20:00Z",
    disabled: false,
  },
  {
    id: "u-7",
    email: "old.barista@juicy.ae",
    name: "Test Test",
    roles: ["barista"],
    outletScope: ["bay-avenue"],
    disabled: true,
  },
];

export type AdminOutlet = {
  id: string;
  name: string;
  city: string;
  address: string;
  hours: string;
  isOpen: boolean;
  productsLive: number;
  productsTotal: number;
  staffCount: number;
};

export const adminOutlets: AdminOutlet[] = [
  { id: "bay-avenue", name: "Bay Avenue", city: "Dubai", address: "Executive Towers, Business Bay", hours: "07:00 – 22:30", isOpen: true, productsLive: 17, productsTotal: 19, staffCount: 4 },
  { id: "dubai-mall", name: "Dubai Mall", city: "Dubai", address: "Financial Center Rd, Downtown", hours: "10:00 – 23:00", isOpen: true, productsLive: 19, productsTotal: 19, staffCount: 5 },
  { id: "marina-walk", name: "Marina Walk", city: "Dubai", address: "Marina Promenade, Dubai Marina", hours: "08:00 – 23:30", isOpen: true, productsLive: 18, productsTotal: 19, staffCount: 3 },
  { id: "city-walk", name: "City Walk", city: "Dubai", address: "Al Wasl Rd, Jumeirah", hours: "09:00 – 22:30", isOpen: false, productsLive: 19, productsTotal: 19, staffCount: 2 },
];

export type AdminOrderStatus =
  | "CREATED" | "PAID" | "ACCEPTED" | "PREPARING"
  | "READY" | "PICKED_UP" | "CANCELLED" | "REFUNDED";

export type AdminOrder = {
  id: string;
  number: number;
  outletId: string;
  customerPhone: string;
  customerName?: string;
  carPlate?: string;
  carEmirate?: string;
  items: { name: string; variant: string; qty: number; addons: string[] }[];
  totalAed: number;
  status: AdminOrderStatus;
  paymentMethod: "card" | "applepay" | "googlepay";
  createdAt: string;
  baristaName?: string;
  notificationsSent: number;
  history: { status: AdminOrderStatus; at: string; byName?: string }[];
};

const now = Date.now();
const t = (minAgo: number) => new Date(now - minAgo * 60_000).toISOString();

export const adminOrders: AdminOrder[] = [
  {
    id: "ord-1778682860762",
    number: 1247,
    outletId: "bay-avenue",
    customerPhone: "+971501234567",
    customerName: "Тест",
    carPlate: "F 88888",
    carEmirate: "Dubai",
    items: [
      { name: "Латте", variant: "M, 300 ml", qty: 1, addons: ["овсяное молоко", "сироп карамель ×2"] },
      { name: "Круассан с миндалём", variant: "—", qty: 1, addons: [] },
    ],
    totalAed: 48.30,
    status: "PREPARING",
    paymentMethod: "applepay",
    createdAt: t(4),
    baristaName: "Fatima H.",
    notificationsSent: 2,
    history: [
      { status: "CREATED", at: t(4) },
      { status: "PAID", at: t(4), byName: "Tap webhook" },
      { status: "ACCEPTED", at: t(3), byName: "Fatima H." },
      { status: "PREPARING", at: t(2), byName: "Fatima H." },
    ],
  },
  {
    id: "ord-1778682860500",
    number: 1246,
    outletId: "bay-avenue",
    customerPhone: "+971559988100",
    customerName: "Maria",
    items: [
      { name: "Смузи манго-маракуйя", variant: "L, 500 ml", qty: 1, addons: ["шот имбиря"] },
    ],
    totalAed: 36.75,
    status: "READY",
    paymentMethod: "card",
    createdAt: t(11),
    baristaName: "Fatima H.",
    notificationsSent: 3,
    history: [
      { status: "CREATED", at: t(11) },
      { status: "PAID", at: t(11) },
      { status: "ACCEPTED", at: t(10), byName: "Fatima H." },
      { status: "PREPARING", at: t(9), byName: "Fatima H." },
      { status: "READY", at: t(2), byName: "Fatima H." },
    ],
  },
  {
    id: "ord-1778682860400",
    number: 1245,
    outletId: "dubai-mall",
    customerPhone: "+971521122334",
    items: [
      { name: "Капучино", variant: "M", qty: 2, addons: [] },
    ],
    totalAed: 42.00,
    status: "PICKED_UP",
    paymentMethod: "googlepay",
    createdAt: t(34),
    baristaName: "Yusuf R.",
    notificationsSent: 4,
    history: [
      { status: "CREATED", at: t(34) },
      { status: "PAID", at: t(34) },
      { status: "ACCEPTED", at: t(33), byName: "Yusuf R." },
      { status: "PREPARING", at: t(32), byName: "Yusuf R." },
      { status: "READY", at: t(28), byName: "Yusuf R." },
      { status: "PICKED_UP", at: t(25), byName: "Yusuf R." },
    ],
  },
  {
    id: "ord-1778682860300",
    number: 1244,
    outletId: "bay-avenue",
    customerPhone: "+971564455667",
    customerName: "Иван",
    items: [
      { name: "Раф таро", variant: "M", qty: 1, addons: ["сироп ваниль"] },
      { name: "Шот иммунитет", variant: "—", qty: 1, addons: [] },
    ],
    totalAed: 39.90,
    status: "CANCELLED",
    paymentMethod: "card",
    createdAt: t(58),
    notificationsSent: 1,
    history: [
      { status: "CREATED", at: t(58) },
      { status: "PAID", at: t(58) },
      { status: "CANCELLED", at: t(56), byName: "support: оплата дубликат" },
    ],
  },
  {
    id: "ord-1778682860200",
    number: 1243,
    outletId: "marina-walk",
    customerPhone: "+971507788900",
    items: [
      { name: "Лимонад классический", variant: "L", qty: 1, addons: [] },
      { name: "Сэндвич пастрами", variant: "—", qty: 1, addons: [] },
    ],
    totalAed: 51.45,
    status: "PAID",
    paymentMethod: "card",
    createdAt: t(2),
    notificationsSent: 1,
    history: [
      { status: "CREATED", at: t(2) },
      { status: "PAID", at: t(2) },
    ],
  },
];

export const allergens = ["milk", "nuts", "gluten", "soy", "egg", "honey"];

export const compatibilityRules = [
  {
    id: "r-1",
    scope: "global" as const,
    productSlug: null,
    when: [{ addonId: "milk-oat", label: "овсяное молоко" }],
    effect: { type: "forbid" as const, addonId: "milk-regular", label: "обычное молоко", message: "Нельзя комбинировать два вида молока" },
    enabled: true,
  },
  {
    id: "r-2",
    scope: "global" as const,
    productSlug: null,
    when: [{ addonId: "shot-decaf", label: "decaf шот" }],
    effect: { type: "forbid" as const, addonId: "shot-regular", label: "обычный шот", message: "Decaf и обычный кофе — взаимоисключение" },
    enabled: true,
  },
  {
    id: "r-3",
    scope: "product" as const,
    productSlug: "latte",
    when: [{ addonId: "milk-oat", label: "овсяное молоко" }],
    effect: { type: "discount-percent" as const, percent: 0, message: "Овсяное молоко в латте — без доплаты" },
    enabled: true,
  },
  {
    id: "r-4",
    scope: "global" as const,
    productSlug: null,
    when: [
      { addonId: "croissant", label: "круассан" },
      { addonId: "hot-chocolate", label: "горячий шоколад" },
    ],
    effect: { type: "discount-percent" as const, percent: 10, message: "Комбо: круассан + шоколад −10%" },
    enabled: false,
  },
];

export type AdminAddonGroup = {
  slug: string;
  name: string;
  selectionType: "single" | "multi" | "counter";
  itemCount: number;
  usedInProducts: number;
};

export const adminAddonGroups: AdminAddonGroup[] = [
  { slug: "milk", name: "Молоко", selectionType: "single", itemCount: 4, usedInProducts: 7 },
  { slug: "syrups", name: "Сиропы", selectionType: "multi", itemCount: 6, usedInProducts: 7 },
  { slug: "shots", name: "Шоты эспрессо", selectionType: "counter", itemCount: 2, usedInProducts: 5 },
  { slug: "boosters", name: "Усилители", selectionType: "multi", itemCount: 5, usedInProducts: 9 },
  { slug: "toppings", name: "Топпинги", selectionType: "multi", itemCount: 4, usedInProducts: 3 },
  { slug: "ice", name: "Лёд", selectionType: "single", itemCount: 3, usedInProducts: 12 },
  { slug: "sugar-level", name: "Сладость", selectionType: "single", itemCount: 4, usedInProducts: 14 },
];

export type AdminAddon = {
  id: string;
  name: string;
  groupSlug: string;
  // что выбирает клиент
  unit: "shot" | "scoop" | "piece" | "portion" | "ml" | "g";
  // сколько одна unit = в реальных g/ml (для пересчёта КБЖУ и веса в чеке)
  doseAmount: number;
  doseUnit: "g" | "ml";
  kcalPer100: number;
  proteinPer100: number;
  fatPer100: number;
  carbsPer100: number;
  // базовая цена за одну operational unit
  pricePerUnitAed: number;
  allergens: string[];
  visible: boolean;
};

export const adminAddons: AdminAddon[] = [
  { id: "milk-regular", name: "Обычное молоко", groupSlug: "milk", unit: "portion", doseAmount: 200, doseUnit: "ml", kcalPer100: 64, proteinPer100: 3.2, fatPer100: 3.5, carbsPer100: 4.7, pricePerUnitAed: 0, allergens: ["milk"], visible: true },
  { id: "milk-oat", name: "Овсяное молоко", groupSlug: "milk", unit: "portion", doseAmount: 200, doseUnit: "ml", kcalPer100: 47, proteinPer100: 1.0, fatPer100: 1.5, carbsPer100: 6.7, pricePerUnitAed: 4, allergens: [], visible: true },
  { id: "milk-coconut", name: "Кокосовое молоко", groupSlug: "milk", unit: "portion", doseAmount: 200, doseUnit: "ml", kcalPer100: 19, proteinPer100: 0.2, fatPer100: 1.0, carbsPer100: 2.7, pricePerUnitAed: 4, allergens: [], visible: true },
  { id: "milk-almond", name: "Миндальное молоко", groupSlug: "milk", unit: "portion", doseAmount: 200, doseUnit: "ml", kcalPer100: 17, proteinPer100: 0.6, fatPer100: 1.1, carbsPer100: 0.3, pricePerUnitAed: 4, allergens: ["nuts"], visible: true },
  { id: "syrup-caramel", name: "Сироп карамель", groupSlug: "syrups", unit: "ml", doseAmount: 10, doseUnit: "ml", kcalPer100: 270, proteinPer100: 0, fatPer100: 0, carbsPer100: 67, pricePerUnitAed: 4, allergens: [], visible: true },
  { id: "syrup-vanilla", name: "Сироп ваниль", groupSlug: "syrups", unit: "ml", doseAmount: 10, doseUnit: "ml", kcalPer100: 270, proteinPer100: 0, fatPer100: 0, carbsPer100: 67, pricePerUnitAed: 4, allergens: [], visible: true },
  { id: "syrup-hazelnut", name: "Сироп лесной орех", groupSlug: "syrups", unit: "ml", doseAmount: 10, doseUnit: "ml", kcalPer100: 270, proteinPer100: 0, fatPer100: 0, carbsPer100: 67, pricePerUnitAed: 4, allergens: [], visible: true },
  { id: "shot-regular", name: "Шот эспрессо", groupSlug: "shots", unit: "shot", doseAmount: 25, doseUnit: "ml", kcalPer100: 9, proteinPer100: 0.1, fatPer100: 0.2, carbsPer100: 1.7, pricePerUnitAed: 5, allergens: [], visible: true },
  { id: "shot-decaf", name: "Decaf шот", groupSlug: "shots", unit: "shot", doseAmount: 25, doseUnit: "ml", kcalPer100: 9, proteinPer100: 0.1, fatPer100: 0.2, carbsPer100: 1.7, pricePerUnitAed: 5, allergens: [], visible: true },
  { id: "ginger-shot", name: "Имбирь", groupSlug: "boosters", unit: "shot", doseAmount: 15, doseUnit: "g", kcalPer100: 80, proteinPer100: 1.8, fatPer100: 0.7, carbsPer100: 17, pricePerUnitAed: 6, allergens: [], visible: true },
  { id: "turmeric-shot", name: "Куркума", groupSlug: "boosters", unit: "shot", doseAmount: 15, doseUnit: "g", kcalPer100: 312, proteinPer100: 9, fatPer100: 3, carbsPer100: 67, pricePerUnitAed: 6, allergens: [], visible: true },
  { id: "topping-whip", name: "Взбитые сливки", groupSlug: "toppings", unit: "scoop", doseAmount: 20, doseUnit: "g", kcalPer100: 257, proteinPer100: 2.0, fatPer100: 22, carbsPer100: 12, pricePerUnitAed: 5, allergens: ["milk"], visible: true },
];

export function addonDoseLabel(a: AdminAddon): string {
  return `${a.doseAmount} ${a.doseUnit}/${a.unit}`;
}

export function addonKcalPerUnit(a: AdminAddon): number {
  return Math.round((a.doseAmount * a.kcalPer100) / 100);
}

export type ProductSummary = {
  id: string;
  slug: string;
  name: string;
  category: string;
  basePriceAed: number;
  kcal: number;
  badge?: string;
  variantCount: number;
  addonGroupCount: number;
  visible: boolean;
  inStock: boolean;
  hasVideo: boolean;
  posterUrl: string;
};

// Будет наполняться из products[] в product page — здесь только summary
export const adminProductRows: ProductSummary[] = [
  { id: "p-1", slug: "fresh-orange", name: "Фреш апельсин", category: "Фреши", basePriceAed: 22, kcal: 180, badge: "BESTSELLER", variantCount: 3, addonGroupCount: 2, visible: true, inStock: true, hasVideo: true, posterUrl: "/posters/fresh-orange.jpg" },
  { id: "p-2", slug: "fresh-pineapple", name: "Фреш ананас-имбирь", category: "Фреши", basePriceAed: 26, kcal: 165, variantCount: 3, addonGroupCount: 2, visible: true, inStock: true, hasVideo: true, posterUrl: "/posters/fresh-pineapple.jpg" },
  { id: "p-3", slug: "fresh-beet", name: "Фреш свёкла-яблоко", category: "Фреши", basePriceAed: 24, kcal: 140, variantCount: 3, addonGroupCount: 2, visible: true, inStock: false, hasVideo: true, posterUrl: "/posters/fresh-beet.jpg" },
  { id: "p-4", slug: "smoothie-berry", name: "Смузи ягодный", category: "Смузи", basePriceAed: 28, kcal: 220, variantCount: 3, addonGroupCount: 3, visible: true, inStock: true, hasVideo: true, posterUrl: "/posters/smoothie-berry.jpg" },
  { id: "p-5", slug: "smoothie-mango", name: "Смузи манго-маракуйя", category: "Смузи", basePriceAed: 30, kcal: 240, badge: "NEW", variantCount: 3, addonGroupCount: 3, visible: true, inStock: true, hasVideo: true, posterUrl: "/posters/smoothie-mango.jpg" },
  { id: "p-6", slug: "smoothie-green", name: "Смузи зелёный", category: "Смузи", basePriceAed: 32, kcal: 195, variantCount: 3, addonGroupCount: 3, visible: true, inStock: true, hasVideo: true, posterUrl: "/posters/smoothie-green.jpg" },
  { id: "p-7", slug: "detox-celery", name: "Сельдерей-яблоко", category: "Детокс", basePriceAed: 28, kcal: 70, variantCount: 2, addonGroupCount: 1, visible: true, inStock: true, hasVideo: true, posterUrl: "/posters/detox-celery.jpg" },
  { id: "p-8", slug: "shot-immunity", name: "Шот иммунитет", category: "Шоты", basePriceAed: 12, kcal: 35, variantCount: 1, addonGroupCount: 0, visible: true, inStock: true, hasVideo: false, posterUrl: "/posters/shot-immunity.jpg" },
  { id: "p-9", slug: "cappuccino", name: "Капучино", category: "Кофе", basePriceAed: 18, kcal: 130, variantCount: 3, addonGroupCount: 4, visible: true, inStock: true, hasVideo: true, posterUrl: "/posters/cappuccino.jpg" },
  { id: "p-10", slug: "latte", name: "Латте", category: "Кофе", basePriceAed: 19, kcal: 170, badge: "BESTSELLER", variantCount: 3, addonGroupCount: 4, visible: true, inStock: true, hasVideo: true, posterUrl: "/posters/latte.jpg" },
  { id: "p-11", slug: "raf-taro", name: "Раф таро", category: "Кофе", basePriceAed: 24, kcal: 235, variantCount: 3, addonGroupCount: 4, visible: true, inStock: true, hasVideo: true, posterUrl: "/posters/raf-taro.jpg" },
  { id: "p-12", slug: "mocha", name: "Мокко", category: "Кофе", basePriceAed: 22, kcal: 240, variantCount: 3, addonGroupCount: 4, visible: true, inStock: true, hasVideo: true, posterUrl: "/posters/mocha.jpg" },
  { id: "p-13", slug: "matcha", name: "Матча латте", category: "Не кофе", basePriceAed: 26, kcal: 145, variantCount: 3, addonGroupCount: 3, visible: true, inStock: true, hasVideo: true, posterUrl: "/posters/matcha.jpg" },
  { id: "p-14", slug: "chai", name: "Чай масала", category: "Не кофе", basePriceAed: 22, kcal: 155, variantCount: 3, addonGroupCount: 3, visible: true, inStock: true, hasVideo: true, posterUrl: "/posters/chai.jpg" },
  { id: "p-15", slug: "hot-chocolate", name: "Горячий шоколад", category: "Не кофе", basePriceAed: 24, kcal: 280, variantCount: 3, addonGroupCount: 3, visible: true, inStock: true, hasVideo: true, posterUrl: "/posters/hot-chocolate.jpg" },
  { id: "p-16", slug: "lemonade-classic", name: "Лимонад классический", category: "Лимонады", basePriceAed: 22, kcal: 95, variantCount: 3, addonGroupCount: 2, visible: true, inStock: true, hasVideo: true, posterUrl: "/posters/lemonade-classic.jpg" },
  { id: "p-17", slug: "lemonade-berry", name: "Лимонад ягодный", category: "Лимонады", basePriceAed: 24, kcal: 110, variantCount: 3, addonGroupCount: 2, visible: true, inStock: true, hasVideo: true, posterUrl: "/posters/lemonade-berry.jpg" },
  { id: "p-18", slug: "croissant", name: "Круассан с миндалём", category: "Еда", basePriceAed: 18, kcal: 340, variantCount: 1, addonGroupCount: 0, visible: true, inStock: true, hasVideo: false, posterUrl: "/posters/croissant.jpg" },
  { id: "p-19", slug: "sandwich", name: "Сэндвич пастрами", category: "Еда", basePriceAed: 32, kcal: 420, variantCount: 1, addonGroupCount: 0, visible: false, inStock: true, hasVideo: false, posterUrl: "/posters/sandwich.jpg" },
];

export function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export function fmtMinsAgo(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "только что";
  if (mins < 60) return `${mins} мин назад`;
  const hours = Math.floor(mins / 60);
  return `${hours} ч назад`;
}

export function statusLabel(s: AdminOrderStatus): string {
  return {
    CREATED: "Создан",
    PAID: "Оплачен",
    ACCEPTED: "Принят",
    PREPARING: "Готовится",
    READY: "Готов",
    PICKED_UP: "Выдан",
    CANCELLED: "Отменён",
    REFUNDED: "Возврат",
  }[s];
}
