"use client";
// template.tsx ремонтируется при каждом переходе → плавное появление на любой навигации.
// fill-mode: backwards (в .page-enter) — после анимации трансформа не остаётся,
// поэтому fixed/absolute-оверлеи позиционируются как обычно.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter flex-1 flex flex-col min-h-0 relative">{children}</div>;
}
