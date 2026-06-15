"use client";
import { useId } from "react";
import { TallGlass } from "@/components/drink-glasses/TallGlass";
import { EspressoCup } from "@/components/drink-glasses/EspressoCup";
import { Mug } from "@/components/drink-glasses/Mug";
import { PaperCup } from "@/components/drink-glasses/PaperCup";
import { Tumbler } from "@/components/drink-glasses/Tumbler";
import { Bottle } from "@/components/drink-glasses/Bottle";
import { SmoothieCup } from "@/components/drink-glasses/SmoothieCup";
import { Croissant } from "@/components/drink-glasses/Croissant";
import { Sandwich } from "@/components/drink-glasses/Sandwich";
import { Garnish } from "@/components/drink-glasses/Garnish";

export type GlassType =
  | "tall"
  | "cup"
  | "mug"
  | "paper"
  | "tumbler"
  | "bottle"
  | "smoothie"
  | "croissant"
  | "sandwich";

export type GarnishType =
  | "orange-slice"
  | "lemon-slice"
  | "mint"
  | "berry"
  | "cocoa"
  | "cinnamon"
  | "flower"
  | "leaf"
  | "whipped"
  | "nuts"
  | "pineapple-leaf"
  | null;

export type DrinkArtProps = {
  glass: GlassType;
  liquid: string;
  foam?: string;
  garnish?: GarnishType;
  straw?: boolean;
  size?: number;
  className?: string;
  showShadow?: boolean;
};

export function DrinkArt({
  glass,
  liquid,
  foam,
  garnish,
  straw,
  size = 200,
  className,
  showShadow = true,
}: DrinkArtProps) {
  const w = size;
  const h = Math.round(size * 1.15);
  // Unique id per instance to avoid <defs> clashes when multiple drinks of same glass type render
  const uid = useId().replace(/:/g, "");

  return (
    <svg
      viewBox="0 0 200 230"
      width={w}
      height={h}
      className={className}
      style={{ display: "block" }}
    >
      {showShadow && (
        <ellipse cx="100" cy="222" rx="58" ry="6" fill="rgba(0,0,0,0.10)" />
      )}
      {glass === "tall" && <TallGlass uid={uid} liquid={liquid} foam={foam} straw={straw} />}
      {glass === "cup" && <EspressoCup liquid={liquid} foam={foam} />}
      {glass === "mug" && <Mug liquid={liquid} foam={foam} />}
      {glass === "paper" && <PaperCup liquid={liquid} foam={foam} />}
      {glass === "tumbler" && <Tumbler uid={uid} liquid={liquid} />}
      {glass === "bottle" && <Bottle liquid={liquid} />}
      {glass === "smoothie" && (
        <SmoothieCup uid={uid} liquid={liquid} foam={foam} straw={straw} />
      )}
      {glass === "croissant" && <Croissant uid={uid} />}
      {glass === "sandwich" && <Sandwich />}
      {garnish && <Garnish type={garnish} glass={glass} />}
    </svg>
  );
}
