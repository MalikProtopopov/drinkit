import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GRABZI — Ice V'60 Coffee",
  description: "Order premium iced V'60 coffee. Drive-through pickup.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#c44429",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // EN-only сейчас; dir=ltr. AR/RTL — задел (логические CSS, переключение dir на будущее).
  return (
    <html lang="en" dir="ltr">
      <body>{children}</body>
    </html>
  );
}
