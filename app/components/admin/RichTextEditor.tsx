"use client";
import { useEffect, useRef } from "react";

/**
 * Лёгкий WYSIWYG-редактор для rich-описания напитка (без сторонних зависимостей).
 * Стили — узкий набор: жирный, заголовок H2, заголовок H3, обычный абзац.
 * Само поле редактирования стилизовано как итог (класс `rich-desc`), поэтому
 * является живым предпросмотром. HTML дополнительно санитизируется на сервере.
 *
 * Контролируемость: значение задаётся ОДИН раз при монтировании (initialHtml).
 * Чтобы загрузить другое значение (смена локали) — перемонтируйте через `key`.
 */
export function RichTextEditor({
  initialHtml,
  onChange,
  dir = "ltr",
}: {
  initialHtml: string;
  onChange: (html: string) => void;
  dir?: "ltr" | "rtl";
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = initialHtml || "";
    // initialHtml читаем только при монтировании — далее источник истины это DOM
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = () => onChange(ref.current?.innerHTML ?? "");

  // mousedown.preventDefault — чтобы не терять выделение при клике по кнопке тулбара
  const cmd = (command: string, value?: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    ref.current?.focus();
    document.execCommand(command, false, value);
    emit();
  };

  const Btn = ({ label, on, title }: { label: React.ReactNode; on: (e: React.MouseEvent) => void; title: string }) => (
    <button type="button" className="admin-btn sm" title={title}
            onMouseDown={on} style={{ minWidth: 38 }}>
      {label}
    </button>
  );

  return (
    <div className="admin-rte">
      <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
        <Btn title="Заголовок H2" on={cmd("formatBlock", "<h2>")} label={<strong>H2</strong>} />
        <Btn title="Заголовок H3" on={cmd("formatBlock", "<h3>")} label={<strong>H3</strong>} />
        <Btn title="Обычный абзац" on={cmd("formatBlock", "<p>")} label="¶" />
        <span style={{ width: 1, background: "#E5DED4", margin: "0 2px" }} />
        <Btn title="Жирный" on={cmd("bold")} label={<b>Ж</b>} />
        <Btn title="Курсив" on={cmd("italic")} label={<i>К</i>} />
        <Btn title="Список" on={cmd("insertUnorderedList")} label="•—" />
      </div>
      <div
        ref={ref}
        className="rich-desc"
        dir={dir}
        contentEditable
        suppressContentEditableWarning
        data-placeholder="Введите описание — оно появится в шторке «Подробнее»…"
        onInput={emit}
        onBlur={emit}
        style={{
          minHeight: 160, padding: "14px 16px", borderRadius: 12,
          border: "2px solid #eceef1", background: "#fff", outline: "none",
        }}
      />
      <p className="admin-meta" style={{ marginTop: 6 }}>
        Поле — живой предпросмотр: так описание увидят на сайте. Доступны стили: H2, H3, жирный, курсив, список.
      </p>
    </div>
  );
}
