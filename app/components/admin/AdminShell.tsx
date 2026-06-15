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
      { href: "/admin/audience", label: "Аудитория", roles: ["super_admin"] },
      { href: "/admin/payments", label: "Платежи", roles: ["super_admin"] },
    ],
  },
  {
    title: "Сеть",
    items: [
      { href: "/admin/staff", label: "Сотрудники", roles: ["super_admin"] },
    ],
  },
];

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

  if (!staff) {
    return <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", color: "#5A6172" }}>Загрузка…</div>;
  }

  return (
    <AdminContext.Provider value={{ staff }}>
     <ToastProvider>
      <div className="admin-shell">
        <aside className="admin-sidebar">
          <div className="admin-brand" style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="JOOZ" style={{ height: 24, width: "auto" }} />
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
            <span>v1.0 · JOOZ</span>
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
