import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import { LocaleEffect } from "@/components/LocaleEffect";
import "./globals.css";

// JOOZ UI-kit: Nunito (тяжёлые начертания — основа айдентики редизайна)
const nunito = Nunito({
  variable: "--font-sans",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "JOOZ — order your fresh juice ahead",
  description:
    "Juice bar web app in the UAE: pre-order fresh juices, smoothies and shots. Pickup by car plate.",
};

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${nunito.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <LocaleEffect />
        <main className="mobile-frame flex flex-col">{children}</main>
      </body>
    </html>
  );
}
