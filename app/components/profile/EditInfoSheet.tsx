"use client";
import { BottomSheet } from "@/components/BottomSheet";
import { maskName, maskPhoneUAE } from "@/lib/masks";
import { useT } from "@/lib/i18n";

const inputCls = "w-full h-14 px-4 rounded-2xl outline-none text-[17px] font-bold jooz-input";
function FieldLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`font-bold text-[13px] mb-1.5 px-1 ${className}`} style={{ color: "var(--jooz-muted-2)" }}>{children}</div>;
}

/** ШТОРКА: редактирование данных */
export function EditInfoSheet({
  open, onClose, nameDraft, setNameDraft, phoneDraft, setPhoneDraft, onSave,
}: {
  open: boolean;
  onClose: () => void;
  nameDraft: string;
  setNameDraft: (v: string) => void;
  phoneDraft: string;
  setPhoneDraft: (v: string) => void;
  onSave: () => void;
}) {
  const { t } = useT();
  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="px-6 pb-safe pt-1">
        <div className="font-black text-[23px] mb-4" style={{ color: "var(--jooz-ink)" }}>{t("Personal details", "البيانات الشخصية")}</div>
        <FieldLabel>{t("Name", "الاسم")}</FieldLabel>
        <input value={nameDraft} onChange={(e) => setNameDraft(maskName(e.target.value))} placeholder={t("Your name", "اسمك")} className={inputCls} />
        <FieldLabel className="mt-4">{t("Phone", "الهاتف")}</FieldLabel>
        <input dir="ltr" value={phoneDraft} onChange={(e) => setPhoneDraft(maskPhoneUAE(e.target.value))} inputMode="tel" placeholder="+971 50 123 4567" className={`${inputCls} text-left`} />
        <div className="flex gap-3 mt-5 mb-2">
          <button onClick={onClose} className="flex-1 h-14 rounded-full font-extrabold text-[17px]" style={{ background: "#f2f3f6", color: "var(--jooz-ink)" }}>{t("Cancel", "إلغاء")}</button>
          <button onClick={onSave} className="jooz-cta" style={{ flex: 1.4, height: 56 }}>{t("Save", "حفظ")}</button>
        </div>
      </div>
    </BottomSheet>
  );
}
