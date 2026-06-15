"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { type ApiOrder } from "@/lib/api";
import { maskPhoneUAE, maskPlate } from "@/lib/masks";
import { IconClose } from "@/components/icons";
import { useT } from "@/lib/i18n";
import { useMyOrders, useProfileUpdate } from "@/lib/profile/hooks";
import { EditInfoSheet } from "@/components/profile/EditInfoSheet";
import { EditCarSheet } from "@/components/profile/EditCarSheet";
import { OrderCard } from "@/components/profile/OrderCard";
import { CouponsSection } from "@/components/profile/CouponsSection";

// «в работе» = открытые статусы (зеркало ACTIVE_STATUSES на бэке); остальное — закрытые → история
const ACTIVE_STATUSES = new Set(["new", "in_progress", "ready"]);

/**
 * Профиль как шторка (JOOZ): выезжает поверх главной, авторизация не требуется.
 * Гость видит карточку «добавь данные», но может пользоваться приложением.
 */
export function ProfileSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const user = useStore((s) => s.user);
  const logout = useStore((s) => s.logout);
  const { t, locale } = useT();

  const { orders, visibleCount, sentinelRef } = useMyOrders(open);
  const { setLocale, saveInfo, saveCar } = useProfileUpdate();

  const [editInfo, setEditInfo] = useState(false);
  const [editCar, setEditCar] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [phoneDraft, setPhoneDraft] = useState("");
  const [plate, setPlate] = useState("");
  const [emirate, setEmirate] = useState("Dubai");

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  const startEditInfo = () => {
    setNameDraft(user.name ?? ""); setPhoneDraft(maskPhoneUAE(user.phone ?? "")); setEditInfo(true);
  };
  const onSaveInfo = () => {
    saveInfo(nameDraft, phoneDraft);
    setEditInfo(false);
  };
  const startEditCar = () => {
    setPlate(maskPlate(user.defaultCarPlate ?? "")); setEmirate(user.defaultEmirate ?? "Dubai"); setEditCar(true);
  };
  const onSaveCar = () => {
    saveCar(plate, emirate);
    setEditCar(false);
  };

  const initials = (user.name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const hasProfile = Boolean(user.name || user.phone);

  // карточка заказа в списках «в работе» / «история»
  const renderOrder = (o: ApiOrder) => (
    <OrderCard key={o.id} order={o} locale={locale} t={t} onOpen={(id) => router.push(`/orders/${id}`)} />
  );

  // компактный указатель выбранной локали (без флага); тап — переключение ru/ar
  const langToggle = (
    <button onClick={() => setLocale(user.preferredLocale === "ar" ? "en" : "ar")}
            aria-label={t("Language", "اللغة")}
            className="px-3 h-8 rounded-full text-[13px] font-semibold tracking-wide flex items-center relative z-[1]"
            style={{ background: "rgba(255,255,255,.7)", color: "var(--jooz-ink)" }}>
      {user.preferredLocale === "ar" ? "AR" : "EN"}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-center">
      {/* затемнение под шторкой */}
      <div className="absolute inset-0 animate-fadeIn" style={{ background: "rgba(15,10,4,.45)" }} onClick={onClose} />

      {/* колонка шириной с mobile-frame */}
      <div className="relative w-full max-w-[390px] h-full">
      {/* панель профиля */}
      <div className="absolute left-0 right-0 bottom-0 animate-sheetUp overflow-y-auto no-scrollbar"
           style={{
             top: 34,
             borderRadius: "30px 30px 0 0",
             padding: "18px 18px 150px",
             background: "linear-gradient(180deg,#f0a23a 0%,#f3c98f 10%,var(--jooz-bg) 19%,var(--jooz-bg) 100%)",
           }}>
        {/* шапка: язык + заголовок + закрыть */}
        <div className="relative flex items-center justify-between gap-2.5 mb-5">
          {langToggle}
          <div className="absolute inset-x-0 text-center font-extrabold text-[18px] pointer-events-none" style={{ color: "var(--jooz-ink)" }}>{t("Profile", "الملف الشخصي")}</div>
          <button onClick={onClose} aria-label={t("Close", "إغلاق")}
                  className="w-11 h-11 rounded-full bg-white flex items-center justify-center shadow-sm relative z-[1]" style={{ color: "var(--jooz-ink)" }}>
            <IconClose size={18} />
          </button>
        </div>

        {/* карточка профиля / приглашение добавить данные */}
        {hasProfile ? (
          <button onClick={startEditInfo} className="jooz-card w-full p-4 flex items-center gap-4 text-left">
            <div className="w-16 h-16 rounded-full flex-none flex items-center justify-center text-white font-black text-[24px]"
                 style={{ background: "linear-gradient(145deg,#3a3de0,#7b80ff)", boxShadow: "0 8px 18px -6px rgba(58,61,224,.5)" }}>
              {initials || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-extrabold text-[21px]" style={{ color: "var(--jooz-ink)" }}>{user.name || t("Guest", "ضيف")}</div>
              {user.phone && <div className="font-semibold text-[15px] mt-0.5" style={{ color: "var(--jooz-muted-2)" }}>{user.phone}</div>}
            </div>
            <div className="w-9 h-9 rounded-full flex-none flex items-center justify-center text-[16px]" style={{ background: "#f2f3f6" }}>✎</div>
          </button>
        ) : (
          <div className="jooz-card w-full p-6 flex flex-col items-center text-center">
            <div className="w-[78px] h-[78px] rounded-full flex items-center justify-center mb-3.5"
                 style={{ background: "linear-gradient(145deg,#3a3de0,#7b80ff)", boxShadow: "0 10px 22px -6px rgba(58,61,224,.5)" }}>
              <svg width="34" height="34" viewBox="0 0 24 24" fill="#fff"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z" /></svg>
            </div>
            <div className="font-extrabold text-[19px] max-w-[250px] leading-snug" style={{ color: "var(--jooz-ink)" }}>
              {t("Add your name and phone — order in one tap", "أضف اسمك ورقم هاتفك — اطلب بنقرة واحدة")}
            </div>
            <button onClick={startEditInfo} className="jooz-cta mt-4" style={{ width: "auto", paddingInline: 28 }}>{t("Add details", "إضافة البيانات")}</button>
          </div>
        )}

        {/* машина */}
        <div className="font-black text-[19px] mt-6 mb-3 px-1" style={{ color: "var(--jooz-ink)" }}>{t("My car", "سيارتي")}</div>
        {user.defaultCarPlate ? (
          <button onClick={startEditCar} className="jooz-card w-full p-3.5 flex items-center gap-3 text-left">
            <div dir="ltr" className="flex-1 flex items-center gap-3 rounded-xl px-3 py-2" style={{ background: "#fcfcfa", border: "2.5px solid #15171c" }}>
              <div className="flex flex-col leading-[1.05]">
                <div className="text-[10px] font-black tracking-wide" style={{ color: "#c0392b" }}>{user.defaultEmirate || "Dubai"}</div>
                <div className="text-[8.5px] font-extrabold tracking-[1px] mt-0.5" style={{ color: "#15171c" }}>U.A.E</div>
              </div>
              <div className="w-[1.5px] h-8" style={{ background: "#dcdcd6" }} />
              <div className="font-black text-[26px] tracking-wide flex-1 text-center" style={{ color: "#15171c" }}>{user.defaultCarPlate}</div>
            </div>
            <div className="w-9 h-9 rounded-full flex-none flex items-center justify-center text-[16px]" style={{ background: "#f2f3f6" }}>✎</div>
          </button>
        ) : (
          <button onClick={startEditCar}
                  className="w-full rounded-[22px] p-5 flex items-center justify-center gap-2.5"
                  style={{ background: "rgba(255,255,255,.55)", border: "2px dashed #c2c6cd" }}>
            <span className="w-9 h-9 rounded-full flex items-center justify-center text-white" style={{ background: "var(--color-primary-500)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
            <span className="font-extrabold text-[16px]" style={{ color: "var(--jooz-ink)" }}>{t("Add plate number", "إضافة رقم اللوحة")}</span>
          </button>
        )}

        {/* заказы: «в работе» (открытые) + «история» (закрытые) */}
        {orders === null ? (
          <>
            <div className="font-black text-[19px] mt-6 mb-3 px-1" style={{ color: "var(--jooz-ink)" }}>{t("Order history", "سجل الطلبات")}</div>
            <div className="py-6 text-center text-[15px]" style={{ color: "var(--jooz-muted)" }}>{t("Loading…", "جارٍ التحميل…")}</div>
          </>
        ) : orders.length === 0 ? (
          <>
            <div className="font-black text-[19px] mt-6 mb-3 px-1" style={{ color: "var(--jooz-ink)" }}>{t("Order history", "سجل الطلبات")}</div>
            <div className="flex flex-col items-center py-6">
              <div className="w-24 h-24 rounded-full flex items-center justify-center mb-4" style={{ background: "#dde0e5" }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#eef0f3" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16v18l-3-2-3 2-3-2-3 2-4-2z" /><path d="M9 9h6M9 13h6" />
                </svg>
              </div>
              <div className="font-extrabold text-[16px] text-center max-w-[240px]" style={{ color: "var(--jooz-ink)" }}>{t("Your orders will appear here", "ستظهر طلباتك هنا")}</div>
            </div>
          </>
        ) : (
          (() => {
            const active = orders.filter((o) => ACTIVE_STATUSES.has(o.status));
            const history = orders.filter((o) => !ACTIVE_STATUSES.has(o.status));
            return (
              <>
                {/* блок открытых заказов — скрыт, если активных нет */}
                {active.length > 0 && (
                  <>
                    <div className="font-black text-[19px] mt-6 mb-3 px-1" style={{ color: "var(--jooz-ink)" }}>{t("Orders in progress", "طلبات قيد التنفيذ")}</div>
                    <div className="flex flex-col gap-2">{active.map(renderOrder)}</div>
                  </>
                )}
                {/* история — закрытые статусы, с ленивой подгрузкой */}
                {history.length > 0 && (
                  <>
                    <div className="font-black text-[19px] mt-6 mb-3 px-1" style={{ color: "var(--jooz-ink)" }}>{t("Order history", "سجل الطلبات")}</div>
                    <div className="flex flex-col gap-2">
                      {history.slice(0, visibleCount).map(renderOrder)}
                      {visibleCount < history.length && (
                        <div ref={sentinelRef} className="py-3 text-center text-tiny" style={{ color: "var(--jooz-muted)" }}>{t("Loading more…", "تحميل المزيد…")}</div>
                      )}
                    </div>
                  </>
                )}
              </>
            );
          })()
        )}

        <CouponsSection open={open} />

        {hasProfile && (
          <button onClick={() => { logout(); onClose(); }}
                  className="w-full text-center font-bold text-[15px] py-4 mt-3" style={{ color: "#b04a3a" }}>
            {t("Log out", "تسجيل الخروج")}
          </button>
        )}
      </div>

      {/* CTA «Заказать» — закрывает шторку и возвращает к выбору */}
      <button onClick={onClose}
              className="absolute left-[18px] right-[18px] bottom-[26px] h-[62px] rounded-full text-white font-extrabold text-[19px] flex items-center justify-center"
              style={{ background: "var(--color-primary-500)", boxShadow: "0 16px 34px -10px rgba(58,61,224,.6)" }}>
        {t("Order", "اطلب")}
      </button>
      </div>

      <EditInfoSheet
        open={editInfo} onClose={() => setEditInfo(false)}
        nameDraft={nameDraft} setNameDraft={setNameDraft}
        phoneDraft={phoneDraft} setPhoneDraft={setPhoneDraft}
        onSave={onSaveInfo}
      />

      <EditCarSheet
        open={editCar} onClose={() => setEditCar(false)}
        plate={plate} setPlate={setPlate}
        emirate={emirate} setEmirate={setEmirate}
        onSave={onSaveCar}
      />
    </div>
  );
}
