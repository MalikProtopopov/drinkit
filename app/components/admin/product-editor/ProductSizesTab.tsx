"use client";

import type { Dispatch, SetStateAction } from "react";
import type { DrinkSize } from "@/lib/adminApi";
import { Toggle } from "@/components/admin/AdminUI";
import { NumInput } from "@/components/admin/NumInput";

export function ProductSizesTab({ sizes, setSizes, pickDefaultSize, addSize, removeSize }: {
  sizes: DrinkSize[];
  setSizes: Dispatch<SetStateAction<DrinkSize[]>>;
  pickDefaultSize: (idx: number) => void;
  addSize: () => void;
  removeSize: (idx: number) => void;
}) {
  return (
    <div className="admin-panel">
      <div className="admin-panel-head">
        <div className="admin-panel-title">Drink sizes</div>
        <span className="admin-meta">volume and own price; the “default” price goes to the storefront card</span>
      </div>
      <div className="admin-tablewrap"><table className="admin-table">
        <thead>
          <tr>
            <th>Default</th><th>Volume</th><th>Unit</th><th>Price, AED</th><th>Active</th><th></th>
          </tr>
        </thead>
        <tbody>
          {sizes.map((s, i) => (
            <tr key={i}>
              <td>
                <input type="radio" name="default-size" checked={s.isDefault}
                       disabled={!s.isActive} onChange={() => pickDefaultSize(i)} />
              </td>
              <td>
                <NumInput value={s.volume} min={0} style={{ width: 90 }}
                          onChange={(n) => setSizes((arr) => arr.map((x, j) => j === i
                            ? { ...x, volume: n } : x))} />
              </td>
              <td>
                <select className="admin-select" style={{ width: 80 }} value={s.unit}
                        onChange={(e) => setSizes((arr) => arr.map((x, j) => j === i
                          ? { ...x, unit: e.target.value } : x))}>
                  <option value="ml">ml</option>
                  <option value="l">l</option>
                  <option value="g">g</option>
                </select>
              </td>
              <td>
                <NumInput value={s.price} min={0} style={{ width: 100 }}
                          onChange={(n) => setSizes((arr) => arr.map((x, j) => j === i
                            ? { ...x, price: n } : x))} />
              </td>
              <td>
                <Toggle defaultOn={s.isActive}
                        onChange={(v) => setSizes((arr) => {
                          const next = arr.map((x, j) => j === i ? { ...x, isActive: v } : x);
                          if (!v && next[i].isDefault) {
                            const firstActive = next.findIndex((x) => x.isActive);
                            return next.map((x, j) => ({ ...x, isDefault: j === firstActive }));
                          }
                          return next;
                        })} />
              </td>
              <td>
                <button className="admin-btn sm" onClick={() => removeSize(i)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>
      <div className="admin-panel-body">
        <button className="admin-btn" onClick={addSize}>+ Add size</button>
        <p className="admin-meta" style={{ marginTop: 8 }}>
          The size price is the drink cost WITHOUT add-ons; add-ons are charged on top.
          There must be at least one active size and exactly one “default”.
        </p>
      </div>
    </div>
  );
}
