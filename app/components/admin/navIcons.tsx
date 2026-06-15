import type { ReactNode } from "react";

// Иконки разделов сайдбара (line-style, наследуют currentColor).
const svg = (children: ReactNode) => (
  <svg className="admin-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

export const NAV_ICONS: Record<string, ReactNode> = {
  "/admin": svg(<><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></>),
  "/admin/orders": svg(<><path d="M6 2h12v20l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></>),
  "/admin/catalog/categories": svg(<><path d="M12 2 2 7l10 5 10-5z" /><path d="M2 12l10 5 10-5" /><path d="M2 17l10 5 10-5" /></>),
  "/admin/catalog/products": svg(<><path d="M7 8h10l-1 11a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>),
  "/admin/catalog/addons": svg(<><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>),
  "/admin/catalog/groups": svg(<><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></>),
  "/admin/customers": svg(<><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M16 5.5a3 3 0 0 1 0 5.8M21.5 20a6 6 0 0 0-4.5-5.8" /></>),
  "/admin/audience": svg(<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="0.6" fill="currentColor" /></>),
  "/admin/payments": svg(<><rect x="2" y="5" width="20" height="14" rx="2.5" /><path d="M2 10h20M6 15h4" /></>),
  "/admin/outlets": svg(<><path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></>),
  "/admin/staff": svg(<><rect x="4" y="3" width="16" height="18" rx="2.5" /><circle cx="12" cy="9" r="2.5" /><path d="M8 16.5a4 4 0 0 1 8 0" /></>),
  "/admin/profile": svg(<><circle cx="12" cy="8" r="3.5" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></>),
};
