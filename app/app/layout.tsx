import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import { LocaleEffect } from "@/components/LocaleEffect";
import { FrameShell } from "@/components/FrameShell";
import "./globals.css";

// JOOZ UI-kit: Nunito (тяжёлые начертания — основа айдентики редизайна)
const nunito = Nunito({
  variable: "--font-sans",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "GRABZI — order your fresh juice ahead",
  description:
    "GRABZI in the UAE: pre-order fresh juices, smoothies and shots. Drive-through pickup by car plate.",
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
        <FrameShell>{children}</FrameShell>
      </body>
    </html>
  );
}
