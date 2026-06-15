// Каркас страницы (layout-классы для flex-высоты). Анимацию появления (.page-enter)
// убрали: template ремонтируется на КАЖДОМ переходе и проигрывал её заново
// (opacity:0 → 1), что давало мерцание при навигации.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 flex flex-col min-h-0 relative">{children}</div>;
}
