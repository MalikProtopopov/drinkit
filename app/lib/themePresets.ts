/** ВРЕМЕННЫЙ набор цветовых концептов для превью на сайте (light-only).
 *  Меняет ТОЛЬКО цветовые CSS-переменные (кнопки/фон/текст/акценты/фоны категорий),
 *  не трогая UX/структуру. Когда заказчик выберет один — значения вшиваются в globals.css,
 *  а компонент ThemeSwitcher и этот файл удаляются. */
export type ThemePreset = { key: string; label: string; swatch: string; vars: Record<string, string> };

const cat = (a: string, b: string, c: string, d: string, e: string) => ({
  "--cat-bg-0": a, "--cat-bg-1": b, "--cat-bg-2": c, "--cat-bg-3": d, "--cat-bg-4": e,
});

export const PRESETS: ThemePreset[] = [
  // Текущий дизайн (сброс к globals.css). vars пустой → переключатель снимает оверрайды.
  { key: "default", label: "JOOZ · Indigo (текущий)", swatch: "#3A3DE0", vars: {} },

  {
    key: "citrus", label: "Citrus · оранж", swatch: "#E8730E",
    vars: {
      "--color-primary-500": "#E8730E", "--color-primary-600": "#C75E06", "--color-primary-100": "#FDE7D0",
      "--jooz-bg": "#FBF6EE", "--jooz-surface": "#F3ECE0",
      "--jooz-ink": "#20160C", "--jooz-ink-2": "#241A12", "--jooz-muted": "#7A6E60",
      ...cat("#FCE9CF", "#FBD9B0", "#F6E7C8", "#FBEAD6", "#F3DDBE"),
    },
  },
  {
    key: "matcha", label: "Matcha · зелёный", swatch: "#2E9E6B",
    vars: {
      "--color-primary-500": "#2E9E6B", "--color-primary-600": "#237E55", "--color-primary-100": "#D6F0E2",
      "--jooz-bg": "#F0F4EE", "--jooz-surface": "#E8EFE6",
      "--jooz-ink": "#16241B", "--jooz-ink-2": "#162420", "--jooz-muted": "#5E7065",
      ...cat("#DDEDDC", "#E6F0DC", "#D9ECE4", "#EAF1DC", "#DCEAD8"),
    },
  },
  {
    key: "berry", label: "Berry · малина", swatch: "#D7367E",
    vars: {
      "--color-primary-500": "#D7367E", "--color-primary-600": "#B72468", "--color-primary-100": "#FBE0EE",
      "--jooz-bg": "#FAF1F5", "--jooz-surface": "#F3E6EC",
      "--jooz-ink": "#2A1620", "--jooz-ink-2": "#2A1620", "--jooz-muted": "#7E6470",
      ...cat("#F7DDEA", "#EFE0F0", "#F8E2DC", "#F5E6EE", "#EFDCE6"),
    },
  },
  {
    key: "ocean", label: "Ocean · бирюза", swatch: "#0E8FA8",
    vars: {
      "--color-primary-500": "#0E8FA8", "--color-primary-600": "#0A7387", "--color-primary-100": "#D2EEF3",
      "--jooz-bg": "#EEF4F5", "--jooz-surface": "#E6EFF1",
      "--jooz-ink": "#122026", "--jooz-ink-2": "#122026", "--jooz-muted": "#5E7176",
      ...cat("#D7EAEC", "#DEEBF0", "#D9ECE6", "#E6EEF0", "#DCE9EC"),
    },
  },
  {
    key: "espresso", label: "Espresso · кофе", swatch: "#6B4A2E",
    vars: {
      "--color-primary-500": "#6B4A2E", "--color-primary-600": "#523620", "--color-primary-100": "#ECE0D4",
      "--jooz-bg": "#F6F1EA", "--jooz-surface": "#EEE7DD",
      "--jooz-ink": "#241A12", "--jooz-ink-2": "#241A12", "--jooz-muted": "#756656",
      ...cat("#EFE6DA", "#ECE2D6", "#F0E8DC", "#EDE4D6", "#E8DDCD"),
    },
  },
  {
    key: "grape", label: "Grape · фиолет", swatch: "#6D3BD1",
    vars: {
      "--color-primary-500": "#6D3BD1", "--color-primary-600": "#5A2DB3", "--color-primary-100": "#E9E0FA",
      "--jooz-bg": "#F2EFF7", "--jooz-surface": "#EAE5F2",
      "--jooz-ink": "#1F1730", "--jooz-ink-2": "#1F1730", "--jooz-muted": "#6A6280",
      ...cat("#E9E0F2", "#EFE6F0", "#E5E2F2", "#EEE6F2", "#E6DEF0"),
    },
  },
  {
    key: "sunset", label: "Sunset · коралл", swatch: "#E8553D",
    vars: {
      "--color-primary-500": "#E8553D", "--color-primary-600": "#C9402B", "--color-primary-100": "#FBDED6",
      "--jooz-bg": "#FBF2EF", "--jooz-surface": "#F4E7E2",
      "--jooz-ink": "#2A1813", "--jooz-ink-2": "#2A1813", "--jooz-muted": "#80675F",
      ...cat("#FBDED2", "#F6E0DA", "#F8E5D6", "#FAE6DC", "#F2DACE"),
    },
  },
];

/** Все переменные, которые могут переопределяться — для корректного сброса. */
export const THEMABLE_VARS = Array.from(new Set(PRESETS.flatMap((p) => Object.keys(p.vars))));
