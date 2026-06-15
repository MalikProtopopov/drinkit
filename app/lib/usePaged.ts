"use client";
import { useCallback, useEffect, useState } from "react";
import type { Paged } from "./adminApi";

/**
 * Пагинация списочных страниц админки (limit/offset).
 * `fetcher` дергает paged-эндпоинт; `deps` — внешние фильтры: их смена
 * сбрасывает на первую страницу. `reload()` — ручной перезапрос после мутаций.
 */
export function usePaged<T>(
  fetcher: (p: { limit: number; offset: number }) => Promise<Paged<T>>,
  deps: unknown[] = [],
  initialLimit = 20,
) {
  const [limit, setLimit] = useState(initialLimit);
  const [offset, setOffset] = useState(0);
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [bump, setBump] = useState(0);

  const depKey = JSON.stringify(deps);

  // смена фильтров или размера страницы → на первую страницу
  useEffect(() => { setOffset(0); }, [depKey, limit]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetcher({ limit, offset })
      .then((r) => { if (alive) { setItems(r.items); setTotal(r.total); } })
      .catch(() => { if (alive) { setItems([]); setTotal(0); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // fetcher намеренно не в зависимостях — пересоздаётся каждый рендер; ключ — depKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depKey, limit, offset, bump]);

  const reload = useCallback(() => setBump((b) => b + 1), []);

  return { items, total, limit, offset, loading, setOffset, setLimit, reload };
}
