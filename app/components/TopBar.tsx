"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore, getOutlet, useCartTotal } from "@/lib/store";
import { IconBack, IconBag, IconUser } from "@/components/icons";
import { useT } from "@/lib/i18n";

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
  const { t } = useT();
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
            <IconBack size={18} />
          </button>
        )}
        {showOutlet && outlet && (
          <div className="flex items-center gap-2">
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
              <div className="text-tiny muted">{t("until", "حتى")} {outlet.hours.split(" – ")[1]}</div>
            </div>
          </div>
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
            <IconBag size={19} />
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
            <IconUser size={19} />
          </Link>
        )}
      </div>
    </header>
  );
}
