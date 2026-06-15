import "./admin.css";

export const metadata = {
  title: "JOOZ Admin",
  // админка не должна попадать в поисковую выдачу: noindex на всех /admin страницах
  // (любой домен). На уровне nginx admin-домен дополнительно закрыт X-Robots-Tag.
  robots: { index: false, follow: false, nocache: true,
    googleBot: { index: false, follow: false } },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // Тема и полная ширина приходят из FrameShell (main.admin-viewport);
  // app-shell с сайдбаром добавляет уже AdminShell на внутренних страницах.
  return <>{children}</>;
}
