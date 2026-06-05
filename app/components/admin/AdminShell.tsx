"use client";

import { useState, useEffect, createContext, useContext } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ToastProvider } from "@/components/admin/AdminUI";
import { adminApi, setStaffToken, getStaffToken, type Staff } from "@/lib/adminApi";

// V2: роль приходит из staff-JWT (/api/staff/me); переключатель-эмулятор убран
type AdminCtx = { staff: Staff | null };
const AdminContext = createContext<AdminCtx>({ staff: null });
export const useAdmin = () => useContext(AdminContext);

const NAV_GROUPS: {
  title: string;
  items: { href: string; label: string; roles?: string[] }[];
}[] = [
  {
    title: "Обзор",
    items: [
      { href: "/admin", label: "Дашборд", roles: ["super_admin"] },
      { href: "/admin/orders", label: "Заказы" },
    ],
  },
  {
    title: "Каталог",
    items: [
      { href: "/admin/catalog/categories", label: "Категории напитков", roles: ["super_admin"] },
      { href: "/admin/catalog/products", label: "Напитки", roles: ["super_admin"] },
      { href: "/admin/catalog/addons", label: "Добавки", roles: ["super_admin"] },
      { href: "/admin/catalog/groups", label: "Категории добавок и единицы", roles: ["super_admin"] },
    ],
  },
  {
    title: "Клиенты и деньги",
    items: [
      { href: "/admin/customers", label: "Клиенты", roles: ["super_admin"] },
      { href: "/admin/payments", label: "Платежи", roles: ["super_admin"] },
      { href: "/admin/coupons", label: "Купоны", roles: ["super_admin"] },
    ],
  },
  {
    title: "Сеть",
    items: [
      { href: "/admin/staff", label: "Сотрудники", roles: ["super_admin"] },
    ],
  },
];

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
  const [staff, setStaff] = useState<Staff | null>(null);

  useEffect(() => {
    if (!getStaffToken()) {
      router.replace("/admin/login");
      return;
    }
    adminApi.me().then(setStaff).catch(() => {
      setStaffToken(null);
      router.replace("/admin/login");
    });
  }, [router]);

  const logout = () => {
    setStaffToken(null);
    router.replace("/admin/login");
  };

  if (!staff) {
    return <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", color: "#5A6172" }}>Загрузка…</div>;
  }

  return (
    <AdminContext.Provider value={{ staff }}>
     <ToastProvider>
      <div className="admin-shell">
        <aside className="admin-sidebar">
          <div className="admin-brand">
            <span className="admin-brand-mark">J</span>
            <div>
              <span className="admin-brand-text">Juicy</span>
              <span className="admin-brand-sub">Admin · UAE</span>
            </div>
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
                      <Link key={it.href} href={it.href} className="admin-nav-link" data-active={active}>
                        <span>{it.label}</span>
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </nav>
          <div className="admin-sidebar-foot">
            <span>v1.0 · Juicy V2</span>
            <span style={{ color: "#16A34A" }}>● online</span>
          </div>
        </aside>

        <header className="admin-topbar">
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
          <div className="admin-topbar-tools">
            <span style={{ fontSize: 12, color: "#5A6172" }}>
              {staff.name} · {staff.role === "super_admin" ? "Супер-админ" : "Менеджер"}
            </span>
            <button className="admin-btn ghost sm" onClick={logout}>Выйти</button>
          </div>
        </header>

        <main className="admin-content">
          <div className="admin-page-head">
            <div>
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
