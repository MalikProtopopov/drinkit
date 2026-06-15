import "./admin.css";

export const metadata = {
  title: "Juicy Admin",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // Тема и полная ширина приходят из FrameShell (main.admin-viewport);
  // app-shell с сайдбаром добавляет уже AdminShell на внутренних страницах.
  return <>{children}</>;
}
