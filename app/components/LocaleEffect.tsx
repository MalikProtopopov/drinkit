"use client";
import { useEffect } from "react";
import { useStore } from "@/lib/store";

/** PUB-A-09 AC6: применяет lang/dir к документу — арабский рендерится в RTL. */
export function LocaleEffect() {
  const locale = useStore((s) => s.user.preferredLocale);
  useEffect(() => {
    const lang = locale === "ar" ? "ar" : "en";
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [locale]);
  return null;
}
