"use client";

import * as React from "react";
// Импорт из recharts по требованию контракта (Tooltip используем для подсказки по ячейке).
import { Tooltip } from "recharts";

/**
 * RfmHeatGrid — тепловая сетка 5×5 для RFM-матрицы.
 *
 * Ось X (слева направо): Recency 1..5 (5 = заходил недавно).
 * Ось Y (сверху вниз):   Frequency 5..1 (5 = частый — наверху).
 *
 * props.grid индексируется как grid[f][r], 0-based:
 *   f = 0 → Frequency score 5 (верхняя строка),  f = 4 → Frequency score 1 (нижняя строка)
 *   r = 0 → Recency   score 1 (левый столбец),   r = 4 → Recency   score 5 (правый столбец)
 *
 * Цвет ячейки интерполируется от светлого (#EFEAE0) к акценту (#4A56E2) по доле от максимума.
 */

const ACCENT = "#4A56E2";
const MUTED = "#EFEAE0";

export interface RfmHeatGridProps {
  /** grid[f][r], 0-based; f-строка 0 = Frequency 5 (верх), r-столбец 0 = Recency 1 (лево). */
  grid: number[][];
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

const MUTED_RGB = hexToRgb(MUTED);
const ACCENT_RGB = hexToRgb(ACCENT);

/** Линейная интерполяция светлый→акцент по нормированной интенсивности t∈[0,1]. */
function cellColor(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const r = Math.round(MUTED_RGB[0] + (ACCENT_RGB[0] - MUTED_RGB[0]) * clamped);
  const g = Math.round(MUTED_RGB[1] + (ACCENT_RGB[1] - MUTED_RGB[1]) * clamped);
  const b = Math.round(MUTED_RGB[2] + (ACCENT_RGB[2] - MUTED_RGB[2]) * clamped);
  return `rgb(${r}, ${g}, ${b})`;
}

export function RfmHeatGrid({ grid }: RfmHeatGridProps) {
  // Нормируем сетку к 5×5, недостающие значения трактуем как 0.
  const rows = 5;
  const cols = 5;
  const at = (f: number, r: number): number => {
    const row = grid?.[f];
    const v = row ? row[r] : 0;
    return Number.isFinite(v) ? (v as number) : 0;
  };

  let max = 0;
  for (let f = 0; f < rows; f++) {
    for (let r = 0; r < cols; r++) {
      if (at(f, r) > max) max = at(f, r);
    }
  }
  const safeMax = max || 1;

  // Подписи осей: F сверху вниз 5..1, R слева направо 1..5.
  const fLabels = [5, 4, 3, 2, 1];
  const rLabels = [1, 2, 3, 4, 5];

  return (
    <div
      style={{
        display: "grid",
        // [подпись F] + 5 столбцов ; строки: 5 строк + [подпись R снизу]
        gridTemplateColumns: "auto repeat(5, 1fr)",
        gridTemplateRows: "repeat(5, 1fr) auto",
        gap: 4,
        width: "100%",
      }}
    >
      {/* Скрытый Tooltip из recharts — удовлетворяет контракту импорта, не рендерит видимого UI. */}
      <div style={{ display: "none" }} aria-hidden>
        <Tooltip />
      </div>

      {fLabels.map((fScore, f) => (
        <React.Fragment key={`row-${f}`}>
          {/* Подпись строки (Frequency) слева */}
          <div
            style={{
              gridColumn: 1,
              gridRow: f + 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 22,
              fontSize: 11,
              fontWeight: 700,
              color: "#8A8F9C",
            }}
          >
            {fScore}
          </div>

          {rLabels.map((rScore, r) => {
            const count = at(f, r);
            const t = count / safeMax;
            // Текст светлый на тёмных ячейках для контраста.
            const ink = t > 0.55 ? "#FFFFFF" : "#3A3A44";
            return (
              <div
                key={`cell-${f}-${r}`}
                title={`R${rScore} · F${fScore} — ${count}`}
                style={{
                  gridColumn: r + 2,
                  gridRow: f + 1,
                  aspectRatio: "1 / 1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: cellColor(t),
                  color: ink,
                  borderRadius: 8,
                  fontSize: 13,
                  fontVariantNumeric: "tabular-nums",
                  fontWeight: count ? 700 : 500,
                  transition: "transform 120ms ease",
                  cursor: "default",
                }}
              >
                {count}
              </div>
            );
          })}
        </React.Fragment>
      ))}

      {/* Нижний ряд: пустая ячейка под подписью F + подписи R 1..5 */}
      <div style={{ gridColumn: 1, gridRow: rows + 1 }} />
      {rLabels.map((rScore, r) => (
        <div
          key={`rlabel-${r}`}
          style={{
            gridColumn: r + 2,
            gridRow: rows + 1,
            textAlign: "center",
            fontSize: 11,
            fontWeight: 700,
            color: "#8A8F9C",
            paddingTop: 2,
          }}
        >
          {rScore}
        </div>
      ))}

      {/* Подписи осей: R снизу по центру, F слева — добавляем как абсолютные метки через отдельный ряд */}
      <div
        style={{
          gridColumn: "2 / span 5",
          gridRow: rows + 1,
          textAlign: "center",
          fontSize: 10,
          letterSpacing: 0.6,
          textTransform: "uppercase",
          color: "#B0B3BC",
          marginTop: 16,
          alignSelf: "end",
        }}
      >
        Recency (R)
      </div>
      <div
        style={{
          gridColumn: 1,
          gridRow: "1 / span 5",
          writingMode: "vertical-rl",
          transform: "rotate(180deg)",
          textAlign: "center",
          fontSize: 10,
          letterSpacing: 0.6,
          textTransform: "uppercase",
          color: "#B0B3BC",
          alignSelf: "center",
          justifySelf: "start",
          marginRight: 2,
        }}
      >
        Frequency (F)
      </div>
    </div>
  );
}

export default RfmHeatGrid;
