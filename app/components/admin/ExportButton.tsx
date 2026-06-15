"use client";
import { useState } from "react";
import { downloadExport } from "@/lib/adminApi";
import { useToast } from "@/components/admin/AdminUI";

/** Кнопка выгрузки таблицы в Excel. `path` — путь эндпоинта (с query-фильтрами). */
export function ExportButton({ path, filename, label = "Export Excel" }: {
  path: string;
  filename: string;
  label?: string;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      await downloadExport(path, filename);
    } catch (e) {
      toast(`Export failed: ${(e as Error).message}`, "danger");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button className="admin-btn sm" onClick={run} disabled={busy} title="Download .xlsx">
      {busy ? "Preparing…" : `⬇ ${label}`}
    </button>
  );
}
