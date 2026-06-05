"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCartTotal } from "@/lib/store";
import { useT } from "@/lib/i18n";

const tabs = [
  { href: "/home", key: "nav.home", icon: HomeIcon },
  { href: "/menu", key: "nav.menu", icon: MenuIcon },
  { href: "/orders", key: "nav.orders", icon: ListIcon },
  { href: "/profile", key: "nav.profile", icon: UserIcon },
];

export function BottomNav() {
  const pathname = usePathname();
  const cartCount = useCartTotal().count;
  const { t } = useT();

  return (
    <nav className="sticky bottom-0 left-0 right-0 z-30 bg-white border-t border-[var(--color-border)] pb-safe">
      <ul className="flex items-center justify-around h-16 px-2">
        {tabs.map((tab) => {
          const active = pathname.startsWith(tab.href);
          const showBadge = tab.href === "/orders" && cartCount > 0;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                className="flex flex-col items-center gap-0.5 py-1 relative"
                style={{ color: active ? "var(--color-primary-500)" : "var(--color-text-muted)" }}
              >
                <tab.icon active={active} />
                <span className="text-tiny font-medium">{t(tab.key)}</span>
                {showBadge && (
                  <span className="absolute top-0 right-[calc(50%-22px)] text-[10px] font-semibold bg-[var(--color-primary-500)] text-white rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
      <path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2v-9z" strokeLinejoin="round" />
    </svg>
  );
}
function MenuIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
      <rect x="3" y="4" width="7" height="7" rx="2" />
      <rect x="14" y="4" width="7" height="7" rx="2" />
      <rect x="3" y="13" width="7" height="7" rx="2" />
      <rect x="14" y="13" width="7" height="7" rx="2" />
    </svg>
  );
}
function ListIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.6 : 1.8} strokeLinecap="round">
      <path d="M8 6h13M8 12h13M8 18h13" />
      <circle cx="4" cy="6" r="1.4" fill="currentColor" />
      <circle cx="4" cy="12" r="1.4" fill="currentColor" />
      <circle cx="4" cy="18" r="1.4" fill="currentColor" />
    </svg>
  );
}
function UserIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
      <circle cx="12" cy="8" r="4" />
      <path d="M3 21c0-4.5 4-7 9-7s9 2.5 9 7" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
