import { useEffect, useRef } from "react";
import gsap from "gsap";

/**
 * GSAP-появление прямых детей контейнера со stagger (snappy, мобильно-дружелюбно).
 * Перезапускается при изменении deps; полностью отключается при prefers-reduced-motion.
 * Возвращает ref — навесь его на контейнер, чьих детей анимируем.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(deps: unknown[] = []) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || el.children.length === 0) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.from(el.children, {
        opacity: 0, y: 18, duration: 0.5, ease: "power3.out", stagger: 0.07, clearProps: "transform",
      });
    }, el);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}
