"use client";
import Link from "next/link";
import type { ApiDrinkLite } from "@/lib/api";
import { DrinkArt } from "./DrinkArt";

// палитра фонов по категории (визуальная идентичность прототипа)
const BG = ["#F4EEE4", "#EFE6F0", "#DDE9DC", "#F5EFE7", "#E8DCD0"];
const GLASS: ("tall" | "smoothie" | "tumbler" | "paper")[] = ["tall", "smoothie", "tumbler", "paper"];
const LIQ = ["#F0A340", "#E07596", "#7DAE7F", "#C2A07A", "#B43A3A"];

export function categoryBg(categoryId: number) {
  return BG[categoryId % BG.length];
}

export function ApiProductCard({ drink }: { drink: ApiDrinkLite }) {
  const bg = categoryBg(drink.categoryId);
  return (
    <Link href={`/product/${drink.slug}`} className="block group select-none">
      <div
        className="relative rounded-3xl overflow-hidden"
        style={{ background: bg, aspectRatio: "1/1.1" }}
      >
        {drink.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={drink.previewUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
          />
        ) : null}
        <div className="absolute inset-0 flex items-end justify-center pb-1 pointer-events-none">
          <DrinkArt
            glass={GLASS[drink.id % GLASS.length]}
            liquid={LIQ[drink.id % LIQ.length]}
            size={150}
            showShadow={false}
          />
        </div>
      </div>
      <div className="px-1 pt-3 pb-1">
        <div className="text-[15px] font-medium leading-tight line-clamp-2 min-h-[36px]">
          {drink.name}
        </div>
        <div className="text-[14px] font-semibold mt-0.5 muted">{drink.basePrice} AED</div>
      </div>
    </Link>
  );
}
