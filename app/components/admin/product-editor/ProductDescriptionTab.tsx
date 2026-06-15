"use client";

import { DESC_LOCALES, type AdminDrink } from "@/lib/adminApi";
import { RichTextEditor } from "@/components/admin/RichTextEditor";

export function ProductDescriptionTab({
  drink, descLocale, descDraft, descRev, descLocalesFilled,
  switchDescLocale, setDescDraft, saveDesc, deleteDesc,
}: {
  drink: AdminDrink;
  descLocale: string;
  descDraft: string;
  descRev: number;
  descLocalesFilled: Set<string>;
  switchDescLocale: (loc: string) => void;
  setDescDraft: (html: string) => void;
  saveDesc: () => void;
  deleteDesc: () => void;
}) {
  return (
    <div className="admin-split" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
      <div className="admin-panel">
        <div className="admin-panel-head">
          <div className="admin-panel-title">Extended description</div>
          <span className="admin-meta">the “More” sheet; separate for each locale</span>
        </div>
        <div className="admin-panel-body">
          {/* выбор языка описания — галочка у языков, где описание уже есть */}
          <div className="admin-field">
            <label className="admin-label">Description language</label>
            <div style={{ display: "inline-flex", gap: 2, padding: 3, background: "#F5EFE7", borderRadius: 999 }}>
              {DESC_LOCALES.map((l) => (
                <button key={l.code} className="admin-btn sm" onClick={() => switchDescLocale(l.code)}
                        style={descLocale === l.code ? { background: "#4A56E2", color: "#FFF" } : { background: "transparent" }}>
                  {l.label}{descLocalesFilled.has(l.code) ? " ✓" : ""}
                </button>
              ))}
            </div>
            {/* понятный статус именно выбранного языка + что это значит для сайта */}
            <span className="admin-meta">
              {descLocalesFilled.has(descLocale)
                ? "✓ A description has been added for this language — the “More” button is shown on the site."
                : "There is no description for this language yet — the “More” button stays hidden on the site until you add and save one."}
            </span>
          </div>

          <RichTextEditor key={`${descLocale}-${descRev}`} initialHtml={descDraft}
                          dir={descLocale === "ar" ? "rtl" : "ltr"}
                          onChange={setDescDraft} />

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="admin-btn primary" onClick={saveDesc}>Save description</button>
            {descLocalesFilled.has(descLocale) && (
              <button className="admin-btn" onClick={deleteDesc}>Delete</button>
            )}
          </div>
          <p className="admin-meta" style={{ marginTop: 8 }}>
            If there is no description for a locale, the “More” button is hidden on the site in that locale.
          </p>
        </div>
      </div>

      {/* предпросмотр «как в шторке» */}
      <div className="admin-panel">
        <div className="admin-panel-head">
          <div className="admin-panel-title">Sheet preview</div>
          <span className="admin-meta">{DESC_LOCALES.find((l) => l.code === descLocale)?.label}</span>
        </div>
        <div className="admin-panel-body">
          <div style={{ background: "#fff", border: "1px solid #ECE6DC", borderRadius: 20, padding: 18 }}>
            <div style={{ fontWeight: 900, fontSize: 22, marginBottom: 8 }}>{drink.name.en || drink.name.ru || drink.slug}</div>
            {descDraft && descDraft.replace(/<[^>]*>/g, "").trim() ? (
              <div className="rich-desc" dir={descLocale === "ar" ? "rtl" : "ltr"}
                   dangerouslySetInnerHTML={{ __html: descDraft }} />
            ) : (
              <div className="admin-meta">Empty — the “More” button is hidden on the site for this locale.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
