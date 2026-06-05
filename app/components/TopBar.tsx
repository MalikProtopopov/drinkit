"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore, getOutlet, useCartTotal } from "@/lib/store";

type Props = {
  title?: string;
  showOutlet?: boolean;
  showProfile?: boolean;
  showCart?: boolean;
  back?: string | true;
  rightSlot?: React.ReactNode;
  transparent?: boolean;
};

export function TopBar({
  title,
  showOutlet,
  showProfile,
  showCart,
  back,
  rightSlot,
  transparent,
}: Props) {
  const router = useRouter();
  const outletId = useStore((s) => s.selectedOutletId);
  const cartCount = useCartTotal().count;
  const outlet = getOutlet(outletId);

  return (
    <header
      className="sticky top-0 z-20 flex items-center justify-between px-4 pt-safe"
      style={{
        height: 64,
        background: transparent ? "transparent" : "var(--background)",
      }}
    >
      <div className="flex items-center gap-3">
        {back && (
          <button
            onClick={() => (typeof back === "string" ? router.push(back) : router.back())}
            className="w-10 h-10 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow-sm"
            aria-label="back"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}
        {showOutlet && outlet && (
          <Link href="/outlets" className="flex items-center gap-2">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: "var(--color-primary-500)" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 4 C 4 4, 13 2, 18 5 C 22 7, 23 13, 19 18 C 15 22, 8 21, 5 17 C 2 13, 4 4, 4 4 Z"
                  fill="#fff"
                />
              </svg>
            </div>
            <div className="leading-tight">
              <div className="text-[15px] font-semibold">{outlet.name}</div>
              <div className="text-tiny muted">до {outlet.hours.split(" – ")[1]}</div>
            </div>
          </Link>
        )}
        {title && <h1 className="text-h2">{title}</h1>}
      </div>

      <div className="flex items-center gap-2">
        {rightSlot}
        {showCart && (
          <Link
            href="/cart"
            className="w-10 h-10 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow-sm relative"
            aria-label="cart"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 6h15l-1.5 9h-12L6 6z" />
              <path d="M6 6L5 3H2" />
              <circle cx="9" cy="20" r="1.5" />
              <circle cx="18" cy="20" r="1.5" />
            </svg>
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 text-[10px] font-bold bg-[var(--color-primary-500)] text-white rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </Link>
        )}
        {showProfile && (
          <Link
            href="/profile"
            className="w-10 h-10 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow-sm"
            aria-label="profile"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="8" r="4" />
              <path d="M3 21c0-4.5 4-7 9-7s9 2.5 9 7" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
          </Link>
        )}
      </div>
    </header>
  );
}
