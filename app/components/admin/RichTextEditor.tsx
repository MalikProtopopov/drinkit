"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Лёгкий WYSIWYG-редактор для rich-описания напитка (без сторонних зависимостей).
 * Стили — узкий набор: заголовок H2/H3, обычный абзац, жирный, курсив, список.
 * Само поле редактирования стилизовано как итог (класс `rich-desc`), поэтому
 * является живым предпросмотром. HTML дополнительно санитизируется на сервере.
 *
 * Стили — переключатели: клик применяет, повторный клик по активному стилю — снимает
 * (заголовок → обычный абзац). Активные стили подсвечены в тулбаре. Кнопка «Clear»
 * сбрасывает форматирование выделения к обычному тексту.
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
  // активные стили выделения — для подсветки кнопок и поведения переключателя
  const [active, setActive] = useState<{ bold: boolean; italic: boolean; ul: boolean; block: string }>(
    { bold: false, italic: false, ul: false, block: "p" },
  );

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = initialHtml || "";
    // initialHtml читаем только при монтировании — далее источник истины это DOM
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = () => onChange(ref.current?.innerHTML ?? "");

  // текущее состояние форматирования в точке выделения (только если каретка внутри редактора)
  const refresh = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) return;
    let block = "p";
    try {
      block = (document.queryCommandValue("formatBlock") || "p").toLowerCase().replace(/[<>"]/g, "");
    } catch { /* ignore */ }
    setActive({
      bold: safeState("bold"),
      italic: safeState("italic"),
      ul: safeState("insertUnorderedList"),
      block: block || "p",
    });
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", refresh);
    return () => document.removeEventListener("selectionchange", refresh);
  }, [refresh]);

  const run = (command: string, value?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, value);
    emit();
    refresh();
  };

  // mousedown.preventDefault — чтобы не терять выделение при клике по кнопке тулбара
  const onCmd = (command: string, value?: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    run(command, value);
  };

  // заголовок-переключатель: если блок уже этот заголовок — возвращаем обычный абзац
  const onBlock = (tag: "h2" | "h3") => (e: React.MouseEvent) => {
    e.preventDefault();
    run("formatBlock", active.block === tag ? "<p>" : `<${tag}>`);
  };

  // сброс форматирования выделения к обычному тексту
  const onClear = (e: React.MouseEvent) => {
    e.preventDefault();
    ref.current?.focus();
    if (safeState("insertUnorderedList")) document.execCommand("insertUnorderedList");
    document.execCommand("removeFormat");
    document.execCommand("formatBlock", false, "<p>");
    emit();
    refresh();
  };

  const Btn = ({ label, on, title, isActive }: {
    label: React.ReactNode; on: (e: React.MouseEvent) => void; title: string; isActive?: boolean;
  }) => (
    <button type="button" className="admin-btn sm" title={title} onMouseDown={on}
            aria-pressed={isActive}
            style={{ minWidth: 38, ...(isActive ? { background: "#4A56E2", color: "#FFF" } : {}) }}>
      {label}
    </button>
  );

  return (
    <div className="admin-rte">
      <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
        <Btn title="Heading H2 (click again to reset)" on={onBlock("h2")} isActive={active.block === "h2"} label={<strong>H2</strong>} />
        <Btn title="Heading H3 (click again to reset)" on={onBlock("h3")} isActive={active.block === "h3"} label={<strong>H3</strong>} />
        <Btn title="Normal paragraph" on={onCmd("formatBlock", "<p>")} isActive={active.block !== "h2" && active.block !== "h3"} label="¶" />
        <span style={{ width: 1, background: "#E5DED4", margin: "0 2px" }} />
        <Btn title="Bold (toggle)" on={onCmd("bold")} isActive={active.bold} label={<b>B</b>} />
        <Btn title="Italic (toggle)" on={onCmd("italic")} isActive={active.italic} label={<i>I</i>} />
        <Btn title="List (toggle)" on={onCmd("insertUnorderedList")} isActive={active.ul} label="•—" />
        <span style={{ width: 1, background: "#E5DED4", margin: "0 2px" }} />
        <Btn title="Clear formatting of the selection" on={onClear} label="⨯ clear" />
      </div>
      <div
        ref={ref}
        className="rich-desc"
        dir={dir}
        contentEditable
        suppressContentEditableWarning
        data-placeholder="Enter a description — it will appear in the “More” drawer…"
        onInput={emit}
        onBlur={emit}
        onKeyUp={refresh}
        onMouseUp={refresh}
        style={{
          minHeight: 160, padding: "14px 16px", borderRadius: 12,
          border: "2px solid #eceef1", background: "#fff", outline: "none",
          // RTL: курсор и текст справа; иначе пустое поле показывает каретку слева
          direction: dir, textAlign: dir === "rtl" ? "right" : "left",
        }}
      />
      <p className="admin-meta" style={{ marginTop: 6 }}>
        Live preview — this is how the description looks on the site. Styles are toggles: click to apply,
        click the highlighted button again to remove. “Clear” resets the selection to plain text.
      </p>
    </div>
  );
}

// queryCommandState может бросать в некоторых браузерах при пустом выделении — гасим
function safeState(command: string): boolean {
  try {
    return document.queryCommandState(command);
  } catch {
    return false;
  }
}
