"use client";
import Link from "next/link";
import { getProductVideo, type Product } from "@/lib/data";
import { DrinkArt } from "./DrinkArt";
import { DrinkMedia } from "./DrinkMedia";

export function ProductCard({
  product,
  large,
}: {
  product: Product;
  large?: boolean;
}) {
  const minPrice = Math.min(...product.variants.map((v) => v.priceAed));
  const media = getProductVideo(product.slug);

  return (
    <Link href={`/product/${product.slug}`} className="block group select-none">
      <div
        className="relative rounded-3xl overflow-hidden"
        style={{
          background: product.bgColor,
          aspectRatio: large ? "4/5" : "1/1.1",
        }}
      >
        {product.badge && (
          <span
            className="absolute top-3 left-3 z-10 text-tiny font-semibold px-2.5 py-1 rounded-full"
            style={{
              background: "var(--color-primary-500)",
              color: "#fff",
            }}
          >
            {product.badge}
          </span>
        )}

        {media ? (
          <>
            <DrinkMedia
              video={media.video}
              poster={media.poster}
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* Subtle gradient tint matching the bg color so the card keeps its identity */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `linear-gradient(180deg, ${product.bgColor}55 0%, transparent 35%, ${product.bgColor}55 100%)`,
                mixBlendMode: "soft-light",
              }}
            />
          </>
        ) : (
          <div className="absolute inset-0 flex items-end justify-center pb-1">
            <DrinkArt
              glass={product.art.glass}
              liquid={product.art.liquid}
              foam={product.art.foam}
              garnish={product.art.garnish}
              straw={product.art.straw}
              size={large ? 200 : 150}
            />
          </div>
        )}
      </div>
      <div className="px-1 pt-3 pb-1">
        <div className="text-[15px] font-medium leading-tight line-clamp-2 min-h-[36px]">
          {product.name}
        </div>
        <div className="text-[14px] font-semibold mt-0.5 muted">
          {minPrice} AED
        </div>
      </div>
    </Link>
  );
}
