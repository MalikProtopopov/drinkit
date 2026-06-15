"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";

/**
 * Числовое поле, которое МОЖНО полностью очистить.
 *
 * Обычный `value={number}` + `+e.target.value || 0` не даёт стереть «0»:
 * пустая строка тут же превращается обратно в 0. Здесь поле хранит свой
 * текстовый буфер — можно очистить и набрать новое число; при потере фокуса
 * пустое/невалидное значение нормализуется в `min` (по умолчанию 0).
 */
export function NumInput({
  value, onChange, min = 0, max, step, className = "admin-input mono", style, placeholder,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  style?: CSSProperties;
  placeholder?: string;
}) {
  const [buf, setBuf] = useState<string>(Number.isFinite(value) ? String(value) : "");
  const focused = useRef(false);

  // подхватываем внешние изменения значения, пока поле не редактируется
  useEffect(() => {
    if (!focused.current) setBuf(Number.isFinite(value) ? String(value) : "");
  }, [value]);

  return (
    <input
      type="number"
      inputMode="decimal"
      className={className}
      style={style}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      value={buf}
      onFocus={() => { focused.current = true; }}
      onChange={(e) => {
        const v = e.target.value;
        setBuf(v);                       // пустая строка допустима — поле очищается
        if (v !== "") {
          const n = Number(v);
          if (!Number.isNaN(n)) onChange(n);
        }
      }}
      onBlur={() => {
        focused.current = false;
        const n = Number(buf);
        const normalized = buf === "" || Number.isNaN(n) ? min : n;
        setBuf(String(normalized));
        onChange(normalized);
      }}
    />
  );
}
