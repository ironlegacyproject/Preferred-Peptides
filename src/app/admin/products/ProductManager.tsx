"use client";

import { useMemo, useState, useTransition } from "react";
import { CATEGORY_ORDER, type Product } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { deleteProduct, saveProduct, type ProductInput } from "../actions";

const toInput = (p?: Product): ProductInput => ({
  name: p?.name ?? "",
  size: p?.size ?? "",
  price: p ? String(p.price) : "",
  category: p?.category ?? "Peptides",
  description: p?.description ?? "",
  is_active: p?.is_active ?? true,
  sort_order: p ? String(p.sort_order) : "0",
});

export function ProductManager({ products }: { products: Product[] }) {
  const [query, setQuery] = useState("");
  const [showHidden, setShowHidden] = useState(true);
  const [editing, setEditing] = useState<string | "new" | null>(null);

  const categories = useMemo(
    () => [...new Set([...CATEGORY_ORDER, ...products.map((p) => p.category)])],
    [products],
  );

  const visible = products.filter(
    (p) =>
      (showHidden || p.is_active) &&
      (!query || `${p.name} ${p.size ?? ""} ${p.category}`.toLowerCase().includes(query.toLowerCase())),
  );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-3xl sm:text-4xl">Products</h1>
          <p className="mt-1 text-muted">
            {products.length} products, {products.filter((p) => !p.is_active).length} hidden. Price changes apply to new orders only.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing("new")}>Add product</button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <input type="search" className="field !w-72" placeholder="Search products" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search products" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="accent-blue" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
          Show hidden products
        </label>
      </div>

      <datalist id="categories">
        {categories.map((c) => <option key={c} value={c} />)}
      </datalist>

      {editing === "new" && (
        <div className="mt-4 rounded-lg border-2 border-blue bg-surface p-4">
          <ProductForm initial={toInput()} id={null} onDone={() => setEditing(null)} />
        </div>
      )}

      <div className="relative mt-4 overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="bg-head text-muted">
            <tr>
              <th className="px-3 py-2 font-semibold">Name</th>
              <th className="px-3 py-2 font-semibold">Size</th>
              <th className="px-3 py-2 font-semibold">Category</th>
              <th className="px-3 py-2 text-right font-semibold">Price</th>
              <th className="px-3 py-2 font-semibold">Shown</th>
              <th className="px-3 py-2"><span className="sr-only">Edit</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {visible.map((p) =>
              editing === p.id ? (
                <tr key={p.id}>
                  <td colSpan={6} className="bg-blue-soft/40 p-4">
                    <ProductForm initial={toInput(p)} id={p.id} onDone={() => setEditing(null)} />
                  </td>
                </tr>
              ) : (
                <tr key={p.id} className={p.is_active ? "" : "text-muted"}>
                  <td className="px-3 py-2 font-semibold">{p.name}</td>
                  <td className="px-3 py-2">{p.size}</td>
                  <td className="px-3 py-2">{p.category}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoney(p.price)}</td>
                  <td className="px-3 py-2">{p.is_active ? "Yes" : "Hidden"}</td>
                  <td className="px-3 py-2 text-right">
                    <button className="font-semibold text-blue underline" onClick={() => setEditing(p.id)}>Edit</button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
        {visible.length === 0 && <p className="p-6 text-center text-muted">No products match.</p>}
      </div>
    </div>
  );
}

function ProductForm({ initial, id, onDone }: { initial: ProductInput; id: string | null; onDone: () => void }) {
  const [v, setV] = useState(initial);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const set = (k: keyof ProductInput) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV({ ...v, [k]: k === "is_active" ? e.target.checked : e.target.value });

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveProduct(id, v);
          if (r.error) setError(r.error);
          else onDone();
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_1fr]">
        <div>
          <label className="label" htmlFor={`name-${id}`}>Name</label>
          <input id={`name-${id}`} required className="field" value={v.name} onChange={set("name")} />
        </div>
        <div>
          <label className="label" htmlFor={`size-${id}`}>Size</label>
          <input id={`size-${id}`} className="field" placeholder="10mg" value={v.size} onChange={set("size")} />
        </div>
        <div>
          <label className="label" htmlFor={`price-${id}`}>Price ($)</label>
          <input id={`price-${id}`} required type="number" min={0} step="0.01" className="field" value={v.price} onChange={set("price")} />
        </div>
        <div>
          <label className="label" htmlFor={`cat-${id}`}>Category</label>
          <input id={`cat-${id}`} list="categories" required className="field" value={v.category} onChange={set("category")} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-[3fr_1fr]">
        <div>
          <label className="label" htmlFor={`desc-${id}`}>Short description <span className="font-normal text-muted">(optional)</span></label>
          <input id={`desc-${id}`} className="field" value={v.description} onChange={set("description")} />
        </div>
        <div>
          <label className="label" htmlFor={`sort-${id}`}>Sort order</label>
          <input id={`sort-${id}`} type="number" className="field" value={v.sort_order} onChange={set("sort_order")} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" className="accent-blue" checked={v.is_active} onChange={set("is_active")} />
        Show on the price list
      </label>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : id ? "Save product" : "Add product"}</button>
        <button type="button" className="btn btn-quiet" onClick={onDone}>Cancel</button>
        {id && (
          <button
            type="button"
            className="ml-auto text-sm text-muted underline hover:text-danger"
            disabled={pending}
            onClick={() =>
              confirm("Delete this product? Past orders keep their copy. To keep it but stop selling it, uncheck “Show on the price list” instead.") &&
              start(async () => {
                const r = await deleteProduct(id);
                if (r.error) setError(r.error);
                else onDone();
              })
            }
          >
            Delete
          </button>
        )}
      </div>
    </form>
  );
}
