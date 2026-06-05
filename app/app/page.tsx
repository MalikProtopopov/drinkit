"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";

export default function Index() {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setHydrated(true), []);

  useEffect(() => {
    if (!hydrated) return;
    const s = useStore.getState();
    if (!s.onboardingSeen) router.replace("/onboarding");
    else if (!s.selectedOutletId) router.replace("/outlets");
    else router.replace("/home");
  }, [hydrated, router]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3">
      <svg width="64" height="64" viewBox="0 0 64 64" className="animate-pulseRing rounded-full">
        <path
          d="M10 10 C 10 10, 34 6, 48 14 C 60 20, 60 36, 50 50 C 40 60, 22 58, 14 46 C 6 36, 10 10, 10 10 Z"
          fill="#4A56E2"
        />
        <circle cx="26" cy="26" r="3" fill="#fff" />
        <path d="M 18 38 Q 28 44 38 38" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" />
      </svg>
      <div className="text-h2 font-bold tracking-tight">juicy</div>
      <div className="text-caption muted">фреш по предзаказу</div>
    </div>
  );
}
