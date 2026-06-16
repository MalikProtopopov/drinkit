"use client";

import { useState, useEffect, createContext, useContext } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ToastProvider } from "@/components/admin/AdminUI";
import { NAV_ICONS } from "@/components/admin/navIcons";
import { adminApi, setStaffToken, getStaffToken, type Staff } from "@/lib/adminApi";

// V2: роль приходит из staff-JWT (/api/staff/me); переключатель-эмулятор убран
type AdminCtx = { staff: Staff | null; logout: () => void };
const AdminContext = createContext<AdminCtx>({ staff: null, logout: () => {} });
export const useAdmin = () => useContext(AdminContext);

const NAV_GROUPS: {
  title: string;
  items: { href: string; label: string; roles?: string[] }[];
}[] = [
  {
    title: "Overview",
    items: [
      { href: "/admin", label: "Dashboard", roles: ["super_admin"] },
      { href: "/admin/orders", label: "Orders" },
    ],
  },
  {
    title: "Catalog",
    items: [
      { href: "/admin/catalog/categories", label: "Drink categories", roles: ["super_admin"] },
      { href: "/admin/catalog/products", label: "Drinks", roles: ["super_admin"] },
      { href: "/admin/catalog/addons", label: "Add-ons", roles: ["super_admin"] },
      { href: "/admin/catalog/groups", label: "Add-on categories & units", roles: ["super_admin"] },
    ],
  },
  {
    title: "Customers & money",
    items: [
      { href: "/admin/customers", label: "Customers", roles: ["super_admin"] },
      { href: "/admin/audience", label: "Audience", roles: ["super_admin"] },
      { href: "/admin/payments", label: "Payments", roles: ["super_admin"] },
    ],
  },
  {
    title: "Network",
    items: [
      { href: "/admin/outlets", label: "Outlets", roles: ["super_admin"] },
      { href: "/admin/staff", label: "Staff", roles: ["super_admin"] },
    ],
  },
  {
    title: "Account",
    items: [
      { href: "/admin/profile", label: "My account" },  // без roles — виден всем (и менеджеру)
    ],
  },
];

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super admin", manager: "Manager", screen: "Pickup screen",
};

// AdminShell навешивается на каждую страницу и перемонтируется при переходах.
// Кэшируем staff между перемонтированиями: иначе на каждом переходе показывалась бы
// «Загрузка…» пока me() перезапрашивается → мерцание сайдбара/контента.
let cachedStaff: Staff | null = null;

export function AdminShell({
  title,
  crumbs,
  actions,
  children,
}: {
  title: string;
  crumbs?: { label: string; href?: string }[];
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [staff, setStaff] = useState<Staff | null>(cachedStaff);
  const [navOpen, setNavOpen] = useState(false);  // мобильный off-canvas сайдбар
  // свёрнутый сайдбar (только десктоп); состояние помним в localStorage
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem("admin-collapsed") === "1");
  const toggleCollapsed = () => setCollapsed((v) => {
    if (typeof window !== "undefined") localStorage.setItem("admin-collapsed", v ? "0" : "1");
    return !v;
  });

  useEffect(() => {
    if (!getStaffToken()) {
      router.replace("/admin/login");
      return;
    }
    // revalidate в фоне; уже закэшированный staff не сбрасываем в null (без мерцания)
    adminApi.me().then((s) => {
      // учётка табло выдачи не ходит по админке — только полноэкранный экран
      if (s.role === "screen") { router.replace("/admin/screen"); return; }
      cachedStaff = s; setStaff(s);
    }).catch(() => {
      cachedStaff = null;
      setStaffToken(null);
      router.replace("/admin/login");
    });
  }, [router]);

  const logout = () => {
    cachedStaff = null;
    setStaffToken(null);
    router.replace("/admin/login");
  };

  const initials = staff
    ? staff.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase()
    : "";
  // «Назад» ведёт к родительскому разделу — самой глубокой хлебной крошке со ссылкой
  const backHref = crumbs?.slice().reverse().find((c) => c.href)?.href;

  if (!staff) {
    return (
      <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="GRABZI" className="animate-breathe" style={{ height: 64, width: "auto" }} />
          <div className="loader-ring" />
          <div style={{ color: "#8A7866", fontWeight: 700, fontStyle: "italic", letterSpacing: ".02em" }}>Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <AdminContext.Provider value={{ staff, logout }}>
     <ToastProvider>
      <div className="admin-shell" data-collapsed={collapsed}>
        {/* затемнение под выехавшим меню (только мобайл) */}
        <div className="admin-nav-backdrop" data-open={navOpen} onClick={() => setNavOpen(false)} />
        <aside className="admin-sidebar" data-open={navOpen}>
          <div className="admin-brand" style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="admin-brand-logo" src="/logo.png" alt="GRABZI" style={{ height: 44, width: "auto" }} />
            {/* компактная марка для свёрнутого сайдбара */}
            <span className="admin-brand-mark admin-brand-mark-collapsed" aria-hidden="true">G</span>
            <span className="admin-brand-sub">Admin · UAE</span>
          </div>
          <nav className="admin-nav">
            {NAV_GROUPS.map((group) => {
              const visibleItems = group.items.filter(
                (it) => !it.roles || it.roles.includes(staff.role)
              );
              if (visibleItems.length === 0) return null;
              return (
                <div key={group.title}>
                  <div className="admin-nav-group">{group.title}</div>
                  {visibleItems.map((it) => {
                    const active =
                      pathname === it.href ||
                      (it.href !== "/admin" && pathname.startsWith(it.href));
                    return (
                      <Link key={it.href} href={it.href} className="admin-nav-link" data-active={active}
                            onClick={() => setNavOpen(false)}>
                        {NAV_ICONS[it.href]}
                        <span className="admin-nav-label">{it.label}</span>
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </nav>
          <div className="admin-sidebar-foot">
            <span className="admin-nav-label">v1.0 · JOOZ</span>
            <button className="admin-collapse-btn" onClick={toggleCollapsed}
                    title={collapsed ? "Expand menu" : "Collapse menu"}
                    aria-label={collapsed ? "Expand menu" : "Collapse menu"}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
                   strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                   style={{ transform: collapsed ? "rotate(180deg)" : "none", transition: "transform 200ms" }}>
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          </div>
        </aside>

        <header className="admin-topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <button className="admin-burger" aria-label="Menu" onClick={() => setNavOpen(true)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
            </button>
            <div className="admin-crumbs">
            <Link href={staff.role === "super_admin" ? "/admin" : "/admin/orders"}
                  style={{ color: "#5A6172", textDecoration: "none" }}>
              Admin
            </Link>
            {crumbs?.map((c, i) => (
              <span key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="admin-crumbs-sep">/</span>
                {c.href ? (
                  <Link href={c.href} style={{ color: "#5A6172", textDecoration: "none" }}>
                    {c.label}
                  </Link>
                ) : (
                  <strong>{c.label}</strong>
                )}
              </span>
            ))}
            </div>
          </div>
          <Link href="/admin/profile" className="admin-topbar-me" title="My account">
            <span className="admin-user" style={{ width: 32, height: 32, fontSize: 12 }}>{initials}</span>
            <span className="admin-topbar-who">
              {staff.name} · {ROLE_LABEL[staff.role] ?? staff.role}
            </span>
          </Link>
        </header>

        <main className="admin-content">
          <div className="admin-page-head">
            <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
              {backHref && (
                <Link href={backHref} className="admin-back" aria-label="Back" title="Back">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
                       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                </Link>
              )}
              <h1 className="admin-page-title">{title}</h1>
            </div>
            {actions && <div style={{ display: "flex", gap: 8 }}>{actions}</div>}
          </div>
          {children}
        </main>
      </div>
     </ToastProvider>
    </AdminContext.Provider>
  );
}
