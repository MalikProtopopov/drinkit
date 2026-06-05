import type { GlassType, GarnishType } from "@/components/DrinkArt";
import type { OutletScene } from "@/components/OutletArt";

export type Outlet = {
  id: string;
  name: string;
  address: string;
  city: string;
  hours: string;
  distanceKm: number;
  scene: OutletScene;
  bgColor: string;
};

export type Category = {
  slug: string;
  name: string;
  emoji?: string;
};

export type Variant = {
  code: "S" | "M" | "L";
  volumeMl: number;
  priceAed: number;
  caloriesMod: number;
};

export type AddonGroup = {
  slug: string;
  name: string;
  selectionType: "single" | "multi" | "counter";
  maxSelect?: number;
  emoji: string;
  items: Addon[];
};

export type Addon = {
  id: string;
  name: string;
  priceAed: number;
  caloriesDelta: number;
  proteinDelta: number;
  fatDelta: number;
  carbsDelta: number;
  emoji: string;
};

export type Product = {
  id: string;
  slug: string;
  category: string;
  name: string;
  description: string;
  bgColor: string;
  badge?: string;
  baseCalories: number;
  baseProtein: number;
  baseFat: number;
  baseCarbs: number;
  variants: Variant[];
  addonGroups: string[]; // slugs
  inStock?: boolean;
  art: {
    glass: GlassType;
    liquid: string;
    foam?: string;
    garnish?: GarnishType;
    straw?: boolean;
  };
};

export const outlets: Outlet[] = [
  {
    id: "bay-avenue",
    name: "Bay Avenue",
    address: "Executive Towers, Business Bay, Dubai",
    city: "Dubai",
    hours: "07:00 – 22:30",
    distanceKm: 1.2,
    scene: "business-bay",
    bgColor: "#F5D9C0",
  },
  {
    id: "emaar-square",
    name: "Emaar Square",
    address: "Building 4, Downtown Dubai",
    city: "Dubai",
    hours: "07:00 – 23:00",
    distanceKm: 3.4,
    scene: "downtown",
    bgColor: "#D8C8E0",
  },
  {
    id: "dubai-marina",
    name: "Dubai Marina",
    address: "Marina Walk, Dubai Marina",
    city: "Dubai",
    hours: "08:00 – 23:00",
    distanceKm: 6.1,
    scene: "marina",
    bgColor: "#BFE0EA",
  },
  {
    id: "city-centre-mirdif",
    name: "City Centre Mirdif",
    address: "Sheikh Mohammed Bin Zayed Road, Dubai",
    city: "Dubai",
    hours: "08:00 – 23:00",
    distanceKm: 12.5,
    scene: "mall",
    bgColor: "#F2C089",
  },
];

export const categories: Category[] = [
  { slug: "for-you", name: "для тебя", emoji: "✨" },
  { slug: "fresh", name: "фреши", emoji: "🍊" },
  { slug: "smoothie", name: "смузи", emoji: "🥤" },
  { slug: "detox", name: "детокс", emoji: "🌱" },
  { slug: "coffee", name: "кофе", emoji: "☕" },
  { slug: "non-coffee", name: "не кофе", emoji: "🍵" },
  { slug: "lemonade", name: "лимонады", emoji: "🍋" },
  { slug: "food", name: "еда", emoji: "🥐" },
];

export const addonGroups: AddonGroup[] = [
  {
    slug: "supplements",
    name: "Полезные добавки",
    selectionType: "single",
    emoji: "🌿",
    items: [
      { id: "ginger", name: "Имбирь", priceAed: 4, caloriesDelta: 5, proteinDelta: 0, fatDelta: 0, carbsDelta: 1, emoji: "🫚" },
      { id: "turmeric", name: "Куркума", priceAed: 4, caloriesDelta: 6, proteinDelta: 0, fatDelta: 0, carbsDelta: 1, emoji: "🟡" },
      { id: "spirulina", name: "Спирулина", priceAed: 5, caloriesDelta: 8, proteinDelta: 2, fatDelta: 0, carbsDelta: 0, emoji: "🟢" },
      { id: "chia", name: "Чиа", priceAed: 5, caloriesDelta: 30, proteinDelta: 1, fatDelta: 2, carbsDelta: 2, emoji: "⚫" },
    ],
  },
  {
    slug: "foam",
    name: "Пенки и муссы",
    selectionType: "counter",
    maxSelect: 2,
    emoji: "☁️",
    items: [
      { id: "milk-foam", name: "Молочная пенка", priceAed: 6, caloriesDelta: 22, proteinDelta: 1, fatDelta: 1.5, carbsDelta: 1.5, emoji: "🥛" },
      { id: "berry-mousse", name: "Ягодный мусс", priceAed: 7, caloriesDelta: 28, proteinDelta: 0, fatDelta: 0, carbsDelta: 6, emoji: "🍓" },
      { id: "vanilla-cream", name: "Ванильный крем", priceAed: 8, caloriesDelta: 35, proteinDelta: 1, fatDelta: 2, carbsDelta: 3, emoji: "🍦" },
    ],
  },
  {
    slug: "cream",
    name: "Сливки",
    selectionType: "single",
    emoji: "🥛",
    items: [
      { id: "oat", name: "Овсяные", priceAed: 0, caloriesDelta: 0, proteinDelta: 0, fatDelta: 0, carbsDelta: 0, emoji: "🌾" },
      { id: "coconut", name: "Кокосовые", priceAed: 4, caloriesDelta: 12, proteinDelta: 0, fatDelta: 1, carbsDelta: 1, emoji: "🥥" },
      { id: "almond", name: "Миндальные", priceAed: 4, caloriesDelta: 15, proteinDelta: 1, fatDelta: 1, carbsDelta: 0, emoji: "🌰" },
    ],
  },
  {
    slug: "espresso",
    name: "Эспрессо-дринки",
    selectionType: "counter",
    maxSelect: 3,
    emoji: "☕",
    items: [
      { id: "shot", name: "Эспрессо Дринкит", priceAed: 6, caloriesDelta: 5, proteinDelta: 0, fatDelta: 0, carbsDelta: 0, emoji: "☕" },
      { id: "shot-decaf", name: "Эспрессо без кофеина", priceAed: 7, caloriesDelta: 5, proteinDelta: 0, fatDelta: 0, carbsDelta: 0, emoji: "☕" },
    ],
  },
  {
    slug: "tapioca",
    name: "Шарики тапиоки",
    selectionType: "counter",
    maxSelect: 2,
    emoji: "⚫",
    items: [
      { id: "boba-classic", name: "Тапиока classic", priceAed: 8, caloriesDelta: 60, proteinDelta: 0, fatDelta: 0, carbsDelta: 14, emoji: "⚫" },
      { id: "boba-mango", name: "Тапиока манго", priceAed: 10, caloriesDelta: 55, proteinDelta: 0, fatDelta: 0, carbsDelta: 13, emoji: "🟡" },
    ],
  },
  {
    slug: "toppings",
    name: "Топпинги",
    selectionType: "multi",
    emoji: "🍫",
    items: [
      { id: "chocolate", name: "Шоколадная крошка", priceAed: 5, caloriesDelta: 40, proteinDelta: 1, fatDelta: 3, carbsDelta: 4, emoji: "🍫" },
      { id: "coconut-flakes", name: "Кокосовая стружка", priceAed: 4, caloriesDelta: 20, proteinDelta: 0, fatDelta: 1, carbsDelta: 2, emoji: "🥥" },
      { id: "nuts", name: "Грецкие орехи", priceAed: 6, caloriesDelta: 50, proteinDelta: 2, fatDelta: 4, carbsDelta: 1, emoji: "🌰" },
    ],
  },
  {
    slug: "sugar",
    name: "Сахар",
    selectionType: "single",
    emoji: "🍯",
    items: [
      { id: "no-sugar", name: "Без сахара", priceAed: 0, caloriesDelta: 0, proteinDelta: 0, fatDelta: 0, carbsDelta: 0, emoji: "🚫" },
      { id: "sugar-1", name: "1 ложка", priceAed: 0, caloriesDelta: 18, proteinDelta: 0, fatDelta: 0, carbsDelta: 4, emoji: "🥄" },
      { id: "sugar-2", name: "2 ложки", priceAed: 0, caloriesDelta: 36, proteinDelta: 0, fatDelta: 0, carbsDelta: 8, emoji: "🥄" },
      { id: "stevia", name: "Стевия", priceAed: 2, caloriesDelta: 0, proteinDelta: 0, fatDelta: 0, carbsDelta: 0, emoji: "🌿" },
    ],
  },
  {
    slug: "syrups",
    name: "Сиропы",
    selectionType: "multi",
    emoji: "🍯",
    items: [
      { id: "vanilla", name: "Ванильный", priceAed: 6, caloriesDelta: 60, proteinDelta: 0, fatDelta: 0, carbsDelta: 14, emoji: "🍦" },
      { id: "caramel", name: "Карамельный", priceAed: 6, caloriesDelta: 65, proteinDelta: 0, fatDelta: 0, carbsDelta: 15, emoji: "🍮" },
      { id: "raspberry", name: "Малиновый", priceAed: 6, caloriesDelta: 55, proteinDelta: 0, fatDelta: 0, carbsDelta: 13, emoji: "🍓" },
      { id: "mint", name: "Мятный", priceAed: 6, caloriesDelta: 50, proteinDelta: 0, fatDelta: 0, carbsDelta: 12, emoji: "🌿" },
    ],
  },
  {
    slug: "citrus",
    name: "Цитрусовый чипс",
    selectionType: "counter",
    maxSelect: 2,
    emoji: "🍋",
    items: [
      { id: "lemon-chip", name: "Чипс лимона", priceAed: 3, caloriesDelta: 4, proteinDelta: 0, fatDelta: 0, carbsDelta: 1, emoji: "🍋" },
      { id: "orange-chip", name: "Чипс апельсина", priceAed: 3, caloriesDelta: 5, proteinDelta: 0, fatDelta: 0, carbsDelta: 1, emoji: "🍊" },
    ],
  },
  {
    slug: "protein",
    name: "Протеины",
    selectionType: "single",
    emoji: "💪",
    items: [
      { id: "vanilla-protein", name: "Ванильный протеин", priceAed: 12, caloriesDelta: 90, proteinDelta: 18, fatDelta: 1, carbsDelta: 2, emoji: "🥄" },
      { id: "chocolate-protein", name: "Шоколадный протеин", priceAed: 12, caloriesDelta: 95, proteinDelta: 17, fatDelta: 1, carbsDelta: 3, emoji: "🍫" },
    ],
  },
  {
    slug: "collagen",
    name: "Коллаген",
    selectionType: "single",
    emoji: "✨",
    items: [
      { id: "marine-collagen", name: "Морской коллаген", priceAed: 14, caloriesDelta: 25, proteinDelta: 6, fatDelta: 0, carbsDelta: 0, emoji: "🐠" },
    ],
  },
];

const standardDrinkAddons = [
  "supplements",
  "foam",
  "cream",
  "espresso",
  "tapioca",
  "toppings",
  "sugar",
  "syrups",
  "citrus",
  "protein",
  "collagen",
];

const lightAddons = ["supplements", "sugar", "citrus", "protein"];

export const products: Product[] = [
  // === FRESH ===
  {
    id: "fresh-orange",
    slug: "fresh-orange",
    category: "fresh",
    name: "Фреш апельсин",
    description: "100% свежевыжатый апельсин. Без сахара. Освежает и заряжает витамином C.",
    bgColor: "#F8E0CA",
    baseCalories: 110,
    baseProtein: 2,
    baseFat: 0.5,
    baseCarbs: 26,
    variants: [
      { code: "S", volumeMl: 250, priceAed: 18, caloriesMod: 0 },
      { code: "M", volumeMl: 350, priceAed: 24, caloriesMod: 40 },
      { code: "L", volumeMl: 450, priceAed: 30, caloriesMod: 80 },
    ],
    addonGroups: lightAddons,
    art: { glass: "tall", liquid: "#F5A642", garnish: "orange-slice" },
  },
  {
    id: "fresh-pineapple",
    slug: "fresh-pineapple",
    category: "fresh",
    name: "Фреш ананас-имбирь",
    description: "Ананас, имбирь, лайм. Острая бомба для иммунитета.",
    bgColor: "#F9EAB8",
    badge: "ХИТ",
    baseCalories: 130,
    baseProtein: 1,
    baseFat: 0.3,
    baseCarbs: 30,
    variants: [
      { code: "S", volumeMl: 250, priceAed: 22, caloriesMod: 0 },
      { code: "M", volumeMl: 350, priceAed: 28, caloriesMod: 45 },
      { code: "L", volumeMl: 450, priceAed: 34, caloriesMod: 90 },
    ],
    addonGroups: lightAddons,
    art: { glass: "tall", liquid: "#F0C82A", garnish: "pineapple-leaf" },
  },
  {
    id: "fresh-beet",
    slug: "fresh-beet",
    category: "fresh",
    name: "Фреш свёкла-яблоко",
    description: "Свёкла, яблоко, морковь. Лёгкая земляная нота, насыщенный цвет.",
    bgColor: "#EFD5E0",
    baseCalories: 95,
    baseProtein: 2,
    baseFat: 0.2,
    baseCarbs: 22,
    variants: [
      { code: "S", volumeMl: 250, priceAed: 20, caloriesMod: 0 },
      { code: "M", volumeMl: 350, priceAed: 26, caloriesMod: 40 },
      { code: "L", volumeMl: 450, priceAed: 32, caloriesMod: 80 },
    ],
    addonGroups: lightAddons,
    art: { glass: "tall", liquid: "#A8366C", garnish: "leaf" },
  },
  // === SMOOTHIE ===
  {
    id: "smoothie-berry",
    slug: "smoothie-berry",
    category: "smoothie",
    name: "Смузи ягодный",
    description: "Малина, клубника, банан и кокосовое молоко. Десерт на трубочке.",
    bgColor: "#F5D1DC",
    baseCalories: 220,
    baseProtein: 4,
    baseFat: 3,
    baseCarbs: 42,
    variants: [
      { code: "S", volumeMl: 300, priceAed: 26, caloriesMod: 0 },
      { code: "M", volumeMl: 400, priceAed: 32, caloriesMod: 60 },
      { code: "L", volumeMl: 500, priceAed: 38, caloriesMod: 120 },
    ],
    addonGroups: standardDrinkAddons,
    art: {
      glass: "smoothie",
      liquid: "#DC6A8E",
      foam: "#F4C8D2",
      garnish: "berry",
      straw: true,
    },
  },
  {
    id: "smoothie-mango",
    slug: "smoothie-mango",
    category: "smoothie",
    name: "Смузи манго-маракуйя",
    description: "Тропики в стакане. Манго, маракуйя, йогурт.",
    bgColor: "#FFE0A8",
    baseCalories: 240,
    baseProtein: 5,
    baseFat: 4,
    baseCarbs: 44,
    variants: [
      { code: "S", volumeMl: 300, priceAed: 28, caloriesMod: 0 },
      { code: "M", volumeMl: 400, priceAed: 34, caloriesMod: 60 },
      { code: "L", volumeMl: 500, priceAed: 40, caloriesMod: 120 },
    ],
    addonGroups: standardDrinkAddons,
    art: {
      glass: "smoothie",
      liquid: "#F5A23A",
      foam: "#FFD9A0",
      garnish: "orange-slice",
      straw: true,
    },
  },
  {
    id: "smoothie-green",
    slug: "smoothie-green",
    category: "smoothie",
    name: "Смузи зелёный",
    description: "Шпинат, яблоко, киви, мята, сок лайма. Свежо и легко.",
    bgColor: "#D6E8D9",
    baseCalories: 180,
    baseProtein: 3,
    baseFat: 2,
    baseCarbs: 36,
    variants: [
      { code: "S", volumeMl: 300, priceAed: 24, caloriesMod: 0 },
      { code: "M", volumeMl: 400, priceAed: 30, caloriesMod: 60 },
      { code: "L", volumeMl: 500, priceAed: 36, caloriesMod: 120 },
    ],
    addonGroups: standardDrinkAddons,
    art: {
      glass: "smoothie",
      liquid: "#7DAE7F",
      foam: "#C6DEC8",
      garnish: "mint",
      straw: true,
    },
  },
  // === DETOX ===
  {
    id: "detox-celery",
    slug: "detox-celery",
    category: "detox",
    name: "Сельдерей-яблоко",
    description: "Холодный пресс сельдерея и зелёного яблока. Чистая зелень.",
    bgColor: "#D6E8D9",
    badge: "ДЕТОКС",
    baseCalories: 70,
    baseProtein: 2,
    baseFat: 0.1,
    baseCarbs: 16,
    variants: [{ code: "M", volumeMl: 330, priceAed: 28, caloriesMod: 0 }],
    addonGroups: lightAddons,
    art: { glass: "bottle", liquid: "#8FB670", garnish: "leaf" },
  },
  {
    id: "shot-immunity",
    slug: "shot-immunity",
    category: "detox",
    name: "Шот иммунитет",
    description: "Имбирь, лимон, куркума, мёд. 60 мл огненной пользы.",
    bgColor: "#FFE0A8",
    baseCalories: 35,
    baseProtein: 0.4,
    baseFat: 0,
    baseCarbs: 8,
    variants: [{ code: "S", volumeMl: 60, priceAed: 12, caloriesMod: 0 }],
    addonGroups: [],
    art: { glass: "tumbler", liquid: "#F0B340", garnish: "cinnamon" },
  },
  // === COFFEE ===
  {
    id: "cappuccino",
    slug: "cappuccino",
    category: "coffee",
    name: "Капучино",
    description: "Эспрессо и нежная молочная пенка.",
    bgColor: "#E8DCD0",
    baseCalories: 120,
    baseProtein: 6,
    baseFat: 5,
    baseCarbs: 12,
    variants: [
      { code: "S", volumeMl: 250, priceAed: 18, caloriesMod: 0 },
      { code: "M", volumeMl: 350, priceAed: 22, caloriesMod: 30 },
      { code: "L", volumeMl: 450, priceAed: 26, caloriesMod: 60 },
    ],
    addonGroups: standardDrinkAddons,
    art: { glass: "cup", liquid: "#9C6F4A", foam: "#F4E3C8", garnish: "cocoa" },
  },
  {
    id: "latte",
    slug: "latte",
    category: "coffee",
    name: "Латте",
    description: "Эспрессо и много молока. Кофейная классика.",
    bgColor: "#EFE2D0",
    baseCalories: 150,
    baseProtein: 7,
    baseFat: 6,
    baseCarbs: 14,
    variants: [
      { code: "S", volumeMl: 300, priceAed: 20, caloriesMod: 0 },
      { code: "M", volumeMl: 400, priceAed: 24, caloriesMod: 35 },
      { code: "L", volumeMl: 500, priceAed: 28, caloriesMod: 70 },
    ],
    addonGroups: standardDrinkAddons,
    art: { glass: "paper", liquid: "#C2A07A", foam: "#F5E8D0" },
  },
  {
    id: "mocha",
    slug: "mocha",
    category: "coffee",
    name: "Мокко",
    description: "Эспрессо, молоко и тёмный шоколад.",
    bgColor: "#E0C5A8",
    baseCalories: 240,
    baseProtein: 7,
    baseFat: 9,
    baseCarbs: 30,
    variants: [
      { code: "S", volumeMl: 300, priceAed: 22, caloriesMod: 0 },
      { code: "M", volumeMl: 400, priceAed: 26, caloriesMod: 40 },
      { code: "L", volumeMl: 500, priceAed: 30, caloriesMod: 80 },
    ],
    addonGroups: standardDrinkAddons,
    art: { glass: "mug", liquid: "#7A4C2A", foam: "#FFFFFF", garnish: "whipped" },
  },
  // === NON-COFFEE ===
  {
    id: "matcha",
    slug: "matcha",
    category: "non-coffee",
    name: "Матча латте",
    description: "Японская матча первого помола и молоко.",
    bgColor: "#D6E8D9",
    baseCalories: 160,
    baseProtein: 6,
    baseFat: 5,
    baseCarbs: 18,
    variants: [
      { code: "S", volumeMl: 250, priceAed: 24, caloriesMod: 0 },
      { code: "M", volumeMl: 350, priceAed: 28, caloriesMod: 35 },
      { code: "L", volumeMl: 450, priceAed: 32, caloriesMod: 70 },
    ],
    addonGroups: standardDrinkAddons,
    art: { glass: "tall", liquid: "#7DAE7F", foam: "#C6DEC8", garnish: "mint" },
  },
  {
    id: "chai",
    slug: "chai",
    category: "non-coffee",
    name: "Чай масала",
    description: "Чёрный чай, специи, молоко и мёд.",
    bgColor: "#E5CFB4",
    baseCalories: 180,
    baseProtein: 5,
    baseFat: 4,
    baseCarbs: 28,
    variants: [
      { code: "S", volumeMl: 300, priceAed: 22, caloriesMod: 0 },
      { code: "M", volumeMl: 400, priceAed: 26, caloriesMod: 40 },
    ],
    addonGroups: standardDrinkAddons,
    art: { glass: "mug", liquid: "#B58A5E", foam: "#F0E0CB", garnish: "cinnamon" },
  },
  {
    id: "hot-chocolate",
    slug: "hot-chocolate",
    category: "non-coffee",
    name: "Горячий шоколад",
    description: "Бельгийский тёмный шоколад и молоко.",
    bgColor: "#D6B89A",
    baseCalories: 320,
    baseProtein: 7,
    baseFat: 12,
    baseCarbs: 38,
    variants: [
      { code: "S", volumeMl: 250, priceAed: 22, caloriesMod: 0 },
      { code: "M", volumeMl: 350, priceAed: 26, caloriesMod: 50 },
    ],
    addonGroups: standardDrinkAddons,
    art: { glass: "mug", liquid: "#5B3E2A", foam: "#FFFFFF", garnish: "whipped" },
  },
  // === LEMONADE ===
  {
    id: "lemonade-classic",
    slug: "lemonade-classic",
    category: "lemonade",
    name: "Лимонад классический",
    description: "Лимон, лайм, мята, газированная вода.",
    bgColor: "#F5E5A0",
    baseCalories: 140,
    baseProtein: 0.5,
    baseFat: 0,
    baseCarbs: 34,
    variants: [
      { code: "M", volumeMl: 400, priceAed: 22, caloriesMod: 0 },
      { code: "L", volumeMl: 500, priceAed: 28, caloriesMod: 25 },
    ],
    addonGroups: ["sugar", "syrups", "citrus"],
    art: { glass: "tall", liquid: "#F2D548", garnish: "lemon-slice", straw: true },
  },
  {
    id: "lemonade-berry",
    slug: "lemonade-berry",
    category: "lemonade",
    name: "Лимонад ягодный",
    description: "Лимон, малина, клубника, базилик.",
    bgColor: "#F5C7D6",
    baseCalories: 160,
    baseProtein: 0.5,
    baseFat: 0,
    baseCarbs: 38,
    variants: [
      { code: "M", volumeMl: 400, priceAed: 24, caloriesMod: 0 },
      { code: "L", volumeMl: 500, priceAed: 30, caloriesMod: 25 },
    ],
    addonGroups: ["sugar", "syrups", "citrus"],
    art: { glass: "tall", liquid: "#E07596", garnish: "berry", straw: true },
  },
  // === FOOD ===
  {
    id: "croissant",
    slug: "croissant",
    category: "food",
    name: "Круассан с миндалём",
    description: "Слоёный круассан, миндальный крем, лепестки миндаля.",
    bgColor: "#F5EFE7",
    baseCalories: 360,
    baseProtein: 7,
    baseFat: 22,
    baseCarbs: 32,
    variants: [{ code: "M", volumeMl: 0, priceAed: 22, caloriesMod: 0 }],
    addonGroups: [],
    art: { glass: "croissant", liquid: "#C48B3B" },
  },
  {
    id: "sandwich",
    slug: "sandwich",
    category: "food",
    name: "Сэндвич пастрами",
    description: "Зерновой хлеб, пастрами, моцарелла, рукола.",
    bgColor: "#EFE2C8",
    baseCalories: 420,
    baseProtein: 22,
    baseFat: 18,
    baseCarbs: 38,
    variants: [{ code: "M", volumeMl: 0, priceAed: 32, caloriesMod: 0 }],
    addonGroups: [],
    art: { glass: "sandwich", liquid: "#C8615A" },
  },
];

export const popularProductIds = [
  "fresh-pineapple",
  "smoothie-mango",
  "matcha",
  "lemonade-berry",
];

/**
 * Map of product slug → short video clip that plays on cards & hero shots.
 * Items without a mapping fall back to the parametric DrinkArt SVG.
 * Videos and posters live at /videos/<name>.{mp4,jpg}.
 */
export const productVideos: Record<string, string> = {
  "fresh-orange": "juice-orange-pour",
  "fresh-pineapple": "juice-orange-pour",
  "fresh-beet": "tea-pour",
  "smoothie-berry": "chocolate-stir",
  "smoothie-mango": "juice-orange-pour",
  "smoothie-green": "milk-jug",
  "detox-celery": "tea-pour",
  "shot-immunity": "coffee-espresso",
  cappuccino: "coffee-latte-machine",
  latte: "coffee-latte-machine",
  mocha: "chocolate-stir",
  matcha: "milk-jug",
  chai: "coffee-moka",
  "hot-chocolate": "chocolate-stir",
  "lemonade-classic": "juice-orange-pour",
  "lemonade-berry": "juice-orange-pour",
};

export function getProductVideo(slug: string): { video: string; poster: string } | null {
  const name = productVideos[slug];
  if (!name) return null;
  return { video: `/videos/${name}.mp4`, poster: `/videos/${name}.jpg` };
}

export function findProduct(slug: string) {
  return products.find((p) => p.slug === slug || p.id === slug);
}

export function findAddonGroup(slug: string) {
  return addonGroups.find((g) => g.slug === slug);
}

export function findAddon(id: string) {
  for (const g of addonGroups) {
    const a = g.items.find((i) => i.id === id);
    if (a) return { group: g, addon: a };
  }
  return null;
}

export const emirates = [
  "Dubai",
  "Abu Dhabi",
  "Sharjah",
  "Ajman",
  "Umm Al Quwain",
  "Ras Al Khaimah",
  "Fujairah",
];
