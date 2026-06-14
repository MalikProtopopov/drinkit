"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { outlets } from "@/lib/data";
import { useStore } from "@/lib/store";
import { OutletArt } from "@/components/OutletArt";
import { useT } from "@/lib/i18n";

export default function OutletsPage() {
  const { t } = useT();
  const router = useRouter();
  const setOutlet = useStore((s) => s.setOutlet);
  const currentOutlet = useStore((s) => s.selectedOutletId);
  const [search, setSearch] = useState("");
  const [sortedByDistance, setSortedByDistance] = useState(false);

  const filtered = outlets.filter(
    (o) =>
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      o.city.toLowerCase().includes(search.toLowerCase())
  );

  const list = sortedByDistance
    ? [...filtered].sort((a, b) => a.distanceKm - b.distanceKm)
    : filtered;

  const handleSelect = (id: string) => {
    setOutlet(id);
    router.push("/home");
  };

  return (
    <div className="flex-1 flex flex-col bg-white">
      <header className="px-4 pt-safe pb-2 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 rounded-full bg-[#F2F2F4] flex items-center justify-center"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <path d="M3 9h18M9 3v18" />
          </svg>
        </button>
        <h1 className="text-h1">{t("Choose an outlet", "اختر فرعًا")}</h1>
      </header>

      <div className="px-4 pb-3">
        <div className="flex items-center gap-2 h-12 px-4 bg-[#F2F2F4] rounded-full">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("Search outlets and cities", "ابحث عن الفروع والمدن")}
            className="flex-1 bg-transparent outline-none text-[15px]"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-32">
        <div className="text-h3 text-[var(--color-primary-500)] mb-3 mt-2">Dubai</div>
        <div className="flex flex-col gap-3">
          {list.map((o) => (
            <button
              key={o.id}
              onClick={() => handleSelect(o.id)}
              className="text-left rounded-3xl overflow-hidden bg-white shadow-sm active:scale-[0.99] transition"
            >
              <div className="h-32 overflow-hidden">
                <OutletArt scene={o.scene} />
              </div>
              <div className="p-4 flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="text-h3 mb-0.5 flex items-center gap-2">
                    {o.name}
                    {currentOutlet === o.id && (
                      <span className="text-tiny font-semibold text-[var(--color-primary-500)] bg-[var(--color-primary-100)] px-2 py-0.5 rounded-full">
                        {t("current", "الحالي")}
                      </span>
                    )}
                  </div>
                  <div className="text-caption muted">{o.address}</div>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-caption font-medium bg-[#F2F2F4] px-2.5 py-1 rounded-full inline-flex items-center gap-1">
                      <ClockIcon /> {t("until", "حتى")} {o.hours.split(" – ")[1]}
                    </span>
                    <span className="text-caption muted">
                      {o.distanceKm.toLocaleString("en")} {t("km", "كم")}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="sticky bottom-0 left-0 right-0 px-4 pt-3 pb-safe bg-gradient-to-t from-white via-white to-transparent">
        <button
          onClick={() => setSortedByDistance(true)}
          className="btn-pill btn-primary w-full gap-2 inline-flex"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
            <path d="M3 11l18-8-8 18-2-8z" />
          </svg>
          {t("Near me", "بالقرب مني")}
        </button>
      </div>
    </div>
  );
}

function ClockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" />
    </svg>
  );
}
