"use client";
import { BottomSheet } from "@/components/BottomSheet";
import { emirates } from "@/lib/data";
import { maskPlate } from "@/lib/masks";
import { useT } from "@/lib/i18n";

const inputCls = "w-full h-14 px-4 rounded-2xl outline-none text-[17px] font-bold jooz-input";
function FieldLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`font-bold text-[13px] mb-1.5 px-1 ${className}`} style={{ color: "var(--jooz-muted-2)" }}>{children}</div>;
}

/** ШТОРКА: машина */
export function EditCarSheet({
  open, onClose, plate, setPlate, emirate, setEmirate, onSave,
}: {
  open: boolean;
  onClose: () => void;
  plate: string;
  setPlate: (v: string) => void;
  emirate: string;
  setEmirate: (v: string) => void;
  onSave: () => void;
}) {
  const { t } = useT();
  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="px-6 pb-safe pt-1">
        <div className="font-black text-[23px] mb-4" style={{ color: "var(--jooz-ink)" }}>{t("Car plate", "رقم لوحة السيارة")}</div>
        <div className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 mb-4" style={{ background: "#fcfcfa", border: "2.5px solid #15171c" }}>
          <div className="flex flex-col leading-[1.05]">
            <div className="text-[10px] font-black" style={{ color: "#c0392b" }}>{emirate}</div>
            <div className="text-[8.5px] font-extrabold tracking-[1px] mt-0.5" style={{ color: "#15171c" }}>U.A.E</div>
          </div>
          <div className="w-[1.5px] h-8" style={{ background: "#dcdcd6" }} />
          <div className="font-black text-[26px] tracking-wide flex-1 text-center" style={{ color: "#15171c" }}>{plate || "—"}</div>
        </div>
        <FieldLabel>{t("Emirate", "الإمارة")}</FieldLabel>
        <div className="flex flex-wrap gap-2 mt-1">
          {emirates.map((em) => {
            const active = emirate === em;
            return (
              <button key={em} onClick={() => setEmirate(em)}
                      className="px-3.5 py-2 rounded-full font-extrabold text-[14px]"
                      style={{ background: active ? "var(--color-primary-500)" : "#f2f3f6", color: active ? "#fff" : "var(--jooz-ink)" }}>{em}</button>
            );
          })}
        </div>
        <FieldLabel className="mt-4">{t("Plate number", "رقم اللوحة")}</FieldLabel>
        <input value={plate} onChange={(e) => setPlate(maskPlate(e.target.value))}
               placeholder="A 82741" inputMode="text" autoCapitalize="characters"
               className={`${inputCls} tracking-wider`} />
        <div className="flex gap-3 mt-5 mb-2">
          <button onClick={onClose} className="flex-1 h-14 rounded-full font-extrabold text-[17px]" style={{ background: "#f2f3f6", color: "var(--jooz-ink)" }}>{t("Cancel", "إلغاء")}</button>
          <button onClick={onSave} className="jooz-cta" style={{ flex: 1.4, height: 56 }}>{t("Save", "حفظ")}</button>
        </div>
      </div>
    </BottomSheet>
  );
}
