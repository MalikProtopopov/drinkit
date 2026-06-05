"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

/* ============================================================
   Toast
   ============================================================ */

type ToastKind = "ok" | "info" | "warn" | "danger";
type ToastMsg = { id: number; text: string; kind: ToastKind };

type ToastCtx = (text: string, kind?: ToastKind) => void;
const ToastContext = createContext<ToastCtx>(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastMsg[]>([]);
  const idRef = useRef(1);

  const push = useCallback<ToastCtx>((text, kind = "ok") => {
    const id = idRef.current++;
    setItems((arr) => [...arr, { id, text, kind }]);
    setTimeout(() => setItems((arr) => arr.filter((t) => t.id !== id)), 2600);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        style={{
          position: "fixed",
          right: 24,
          bottom: 24,
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          gap: 6,
          pointerEvents: "none",
        }}
      >
        {items.map((t) => (
          <div
            key={t.id}
            style={{
              background:
                t.kind === "danger" ? "#DC2626" :
                t.kind === "warn"   ? "#B45309" :
                t.kind === "info"   ? "#0E0E10" :
                                       "#4A56E2",
              color: "#FFFFFF",
              padding: "12px 18px",
              fontSize: 13.5,
              fontWeight: 600,
              borderRadius: 14,
              boxShadow: "0 12px 28px rgba(14,14,16,0.22)",
              minWidth: 240,
              maxWidth: 360,
              pointerEvents: "auto",
            }}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/* ============================================================
   Toggle — self-managed state. Опционально controlled через onChange.
   ============================================================ */

export function Toggle({
  defaultOn = false,
  on: controlledOn,
  onChange,
  label,
  disabled,
}: {
  defaultOn?: boolean;
  on?: boolean;
  onChange?: (next: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  const [innerOn, setInnerOn] = useState(defaultOn);
  const on = controlledOn ?? innerOn;
  return (
    <button
      type="button"
      className="admin-toggle"
      data-on={on}
      disabled={disabled}
      onClick={() => {
        const next = !on;
        if (controlledOn === undefined) setInnerOn(next);
        onChange?.(next);
      }}
      style={{ opacity: disabled ? 0.4 : 1 }}
    >
      <span className="admin-toggle-track">
        <span className="admin-toggle-thumb" />
      </span>
      {label && <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>}
    </button>
  );
}

/* ============================================================
   Modal — простой right-side drawer для форм "+"
   ============================================================ */

export function Modal({
  open,
  title,
  subtitle,
  onClose,
  onSubmit,
  submitLabel = "Сохранить",
  submitDisabled,
  danger,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  onSubmit?: () => void;
  submitLabel?: string;
  submitDisabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <>
      <div className="admin-drawer-backdrop" onClick={onClose} />
      <aside className="admin-drawer">
        <div className="admin-drawer-head">
          <div>
            <div className="admin-panel-title">{title}</div>
            {subtitle && <div className="admin-meta">{subtitle}</div>}
          </div>
          <button className="admin-btn ghost" onClick={onClose}>×</button>
        </div>
        <div className="admin-drawer-body">{children}</div>
        <div className="admin-drawer-foot">
          <button className="admin-btn ghost" onClick={onClose}>Отмена</button>
          {onSubmit && (
            <button
              className={`admin-btn ${danger ? "danger" : "primary"}`}
              onClick={onSubmit}
              disabled={submitDisabled}
            >
              {submitLabel}
            </button>
          )}
        </div>
      </aside>
    </>
  );
}

/* ============================================================
   ConfirmDialog — для destructive actions
   ============================================================ */

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Подтвердить",
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <>
      <div className="admin-drawer-backdrop" onClick={onCancel} style={{ zIndex: 200 }} />
      <div
        style={{
          position: "fixed",
          left: "50%",
          top: "40%",
          transform: "translate(-50%, -50%)",
          background: "#FFFFFF",
          borderRadius: 18,
          zIndex: 201,
          width: 440,
          padding: 0,
          boxShadow: "0 24px 60px rgba(14,14,16,0.25)",
          overflow: "hidden",
          fontFamily: "var(--font-sans), Manrope, ui-sans-serif, sans-serif",
        }}
      >
        <div style={{ padding: "18px 22px", borderBottom: "1px solid #E8E2D5" }}>
          <div className="admin-panel-title">{title}</div>
        </div>
        <div style={{ padding: 22, fontSize: 14, color: "#0E0E10", lineHeight: 1.5 }}>{message}</div>
        <div
          style={{
            padding: "14px 22px",
            borderTop: "1px solid #E8E2D5",
            background: "#FAF6F0",
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <button className="admin-btn ghost" onClick={onCancel}>Отмена</button>
          <button
            className={`admin-btn ${danger ? "danger" : "primary"}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}
