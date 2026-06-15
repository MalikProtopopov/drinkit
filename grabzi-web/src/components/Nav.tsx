"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Адаптивная навигация (фронт-спека §3.1): desktop header + mobile bottom-nav. */
const LINKS = [
  { href: "/menu", label: "Menu" },
  { href: "/locations", label: "Location" },
  { href: "/orders", label: "Orders" },
  { href: "/info", label: "Info" },
];

export function Nav() {
  const path = usePathname() ?? "/";
  if (path.startsWith("/admin")) return null; // у админки своя оболочка
  const active = (href: string) => path === href || path.startsWith(href + "/");

  return (
    <>
      {/* desktop header */}
      <header
        className="desktop-only"
        style={{
          justifyContent: "space-between", alignItems: "center", gap: 24,
          padding: "12px 24px", borderBlockEnd: "1px solid var(--color-border)",
          background: "#fff", position: "sticky", insetBlockStart: 0, zIndex: 20,
        }}
      >
        <Link href="/" style={{ display: "flex", alignItems: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo.png" alt="GRABZI" style={{ height: 40, width: "auto" }} />
        </Link>
        <nav style={{ display: "flex", gap: 24, alignItems: "center" }}>
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="nav-link" data-active={active(l.href)}>{l.label}</Link>
          ))}
          <Link href="/locations"><button className="btn-primary" style={{ minHeight: 40, paddingBlock: 8 }}>Create order</button></Link>
        </nav>
      </header>

      {/* mobile bottom nav */}
      <nav
        className="mobile-only"
        style={{
          position: "fixed", insetInline: 0, insetBlockEnd: 0, zIndex: 20,
          justifyContent: "space-around", alignItems: "center", gap: 4,
          background: "#fff", borderBlockStart: "1px solid var(--color-border)",
          paddingBlock: 10, paddingBlockEnd: "calc(10px + env(safe-area-inset-bottom))",
        }}
      >
        {LINKS.map((l) => {
          const icon = l.label === "Menu" ? "🧊" : l.label === "Location" ? "📍"
            : l.label === "Orders" ? "🧾" : "ℹ️";
          return (
            <Link key={l.href} href={l.href} className="nav-link" data-active={active(l.href)}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", fontSize: 11 }}>
              <span style={{ fontSize: 20 }}>{icon}</span>
              {l.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
