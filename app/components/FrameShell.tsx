"use client";
import { usePathname } from "next/navigation";

/**
 * Клиентский каркас: клиентское приложение рендерится в «телефонном» фрейме
 * (.mobile-frame, 390px), а админка (/admin/*) — на всю ширину экрана.
 */
export function FrameShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");
  return (
    <main className={isAdmin ? "admin-viewport flex flex-col" : "mobile-frame flex flex-col"}>
      {children}
    </main>
  );
}
