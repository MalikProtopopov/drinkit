"use client";
import { useEffect, useRef } from "react";

export type DrinkMediaProps = {
  video: string;
  poster?: string;
  className?: string;
  /** When false, video pauses (useful for off-screen cards). Default true. */
  active?: boolean;
};

/**
 * Plays a short looping product video (muted, inline) the same way Drinkit
 * shows lifestyle clips on product cards & hero shots.
 *
 * The element fills its parent — wrap in a sized, rounded container with the
 * product's gradient background to recreate the colored card look.
 */
export function DrinkMedia({ video, poster, className, active = true }: DrinkMediaProps) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (active) {
      el.play().catch(() => {
        /* autoplay can be blocked on first interaction — ignored */
      });
    } else {
      el.pause();
    }
  }, [active]);

  return (
    <video
      ref={ref}
      src={video}
      poster={poster}
      muted
      loop
      playsInline
      autoPlay
      preload="metadata"
      className={className}
    />
  );
}
