"use client";

import { useMemo, useState, useTransition } from "react";
import { CATEGORY_ORDER, GROUP_ORDER, type Product } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { deleteProduct, saveProduct, type ProductInput } from "../actions";

const toInput = (p?: Partial<Product>, applyToAllSizes = true): ProductInput => ({
  name: p?.name ?? "",
  size: p?.size ?? "",
  price: p?.price != null ? String(p.price) : "",
  category: p?.category ?? "Peptides",
  subcategory: p?.subcategory ?? "",
  description: p?.description ?? "",
  is_active: p?.is_active ?? true,
  applyToAllSizes,
});

type Editing = { id: string } | { id: null; initial: ProductInput } | null;

export function ProductManager({ products }: { products: Product[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [missingOnly, setMissingOnly] = useState(false);
  const [showHidden, setShowHidden] = useState(true);
  const [editing, setEditing] = useState<Editing>(null);

  const categories = useMemo(
    () => [...new Set([...CATEGORY_ORDER, ...products.map((p) => p.category)])],
    [products],
  );
  const groups = useMemo(
    () => [...new Set([...GROUP_ORDER, ...products.map((p) => p.subcategory).filter(Boolean) as string[]])],
    [products],
  );
  const missingCount = products.filter((p) => !p.description).length;

  const visible = products
    .filter(
      (p) =>
        (showHidden || p.is_active) &&
        (category === "All" || p.category === category) &&
        (!missingOnly || !p.description) &&
        (!query || `${p.name} ${p.size ?? ""} ${p.category} ${p.subcategory ?? ""}`.toLowerCase().includes(query.toLowerCase())),
    )
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name, undefined, { numeric: true }) || a.sort_order - b.sort_order);

  const startNew = (from?: Partial<Product>) => {
    setEditing({ id: null, initial: toInput(from ? { ...from, size: "", price: undefined } : undefined) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-3xl sm:text-4xl">Products</h1>
          <p className="mt-1 text-muted">
            {products.length} products, {products.filter((p) => !p.is_active).length} hidden, {missingCount} without a
            description. Price changes apply to new orders only.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => startNew()}>
          Add product
        </button>
      </div>

      <datalist id="categories">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <datalist id="groups">
        {groups.map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>

      {editing && editing.id === null && (
        <div className="mt-5 rounded-lg border-2 border-blue bg-surface p-4">
          <h2 className="mb-3 text-lg font-bold">New product</h2>
          <ProductForm initial={editing.initial} id={null} products={products} onDone={() => setEditing(null)} />
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <input
          type="search"
          className="field !w-64"
          placeholder="Search products"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search products"
        />
        <select className="field !w-auto" aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option>All</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="accent-blue" checked={missingOnly} onChange={(e) => setMissingOnly(e.target.checked)} />
          Missing description only
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="accent-blue" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
          Show hidden products
        </label>
      </div>

      <div className="relative mt-4 overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead className="bg-head text-muted">
            <tr>
              <th className="px-3 py-2 font-semibold">Name</th>
              <th className="px-3 py-2 font-semibold">Size</th>
              <th className="px-3 py-2 font-semibold">Category / group</th>
              <th className="px-3 py-2 text-right font-semibold">Price</th>
              <th className="px-3 py-2 font-semibold">Description</th>
              <th className="px-3 py-2 font-semibold">Shown</th>
              <th className="px-3 py-2">
                <span className="sr-only">Edit</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {visible.map((p) =>
              editing?.id === p.id ? (
                <tr key={p.id}>
                  <td colSpan={7} className="bg-blue-soft/40 p-4">
                    <ProductForm
                      initial={toInput(p, true)}
                      id={p.id}
                      products={products}
                      onDone={() => setEditing(null)}
                      onAddSize={() => startNew(p)}
                    />
                  </td>
                </tr>
              ) : (
                <tr key={p.id} className={p.is_active ? "" : "text-muted"}>
                  <td className="px-3 py-2 font-semibold">{p.name}</td>
                  <td className="px-3 py-2">{p.size}</td>
                  <td className="px-3 py-2">
                    {p.category}
                    {p.subcategory && <span className="block text-xs text-muted">{p.subcategory}</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoney(p.price)}</td>
                  <td className="max-w-[16rem] px-3 py-2">
                    {p.description ? (
                      <span className="line-clamp-2 text-muted">{p.description}</span>
                    ) : (
                      <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-bold text-danger">Missing</span>
                    )}
                  </td>
                  <td className="px-3 py-2">{p.is_active ? "Yes" : "Hidden"}</td>
                  <td className="px-3 py-2 text-right">
                    <button className="font-semibold text-blue underline" onClick={() => setEditing({ id: p.id })}>
                      Edit
                    </button>
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

function ProductForm({
  initial,
  id,
  products,
  onDone,
  onAddSize,
}: {
  initial: ProductInput;
  id: string | null;
  products: Product[];
  onDone: () => void;
  onAddSize?: () => void;
}) {
  const [v, setV] = useState(initial);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();
  const set =
    (k: keyof ProductInput) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setV({ ...v, [k]: e.target instanceof HTMLInputElement && e.target.type === "checkbox" ? e.target.checked : e.target.value });

  const siblings = products.filter((p) => p.name === v.name.trim() && p.category === v.category.trim() && p.id !== id);
  const fid = id ?? "new";

  // Typing the name of an existing product fills in its category, group and description.
  function onNameBlur() {
    if (id || v.description || v.subcategory) return;
    const match = products.find((p) => p.name.toLowerCase() === v.name.trim().toLowerCase());
    if (match) setV({ ...v, name: match.name, category: match.category, subcategory: match.subcategory ?? "", description: match.description ?? "" });
  }

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
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
        <div>
          <label className="label" htmlFor={`name-${fid}`}>Product name</label>
          <input id={`name-${fid}`} required className="field" value={v.name} onChange={set("name")} onBlur={onNameBlur} placeholder="BPC-157" />
        </div>
        <div>
          <label className="label" htmlFor={`size-${fid}`}>Size</label>
          <input id={`size-${fid}`} className="field" placeholder="10mg" value={v.size} onChange={set("size")} />
        </div>
        <div>
          <label className="label" htmlFor={`price-${fid}`}>Price ($)</label>
          <input id={`price-${fid}`} required type="number" min={0} step="0.01" className="field" value={v.price} onChange={set("price")} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={`cat-${fid}`}>Category (tab)</label>
          <input id={`cat-${fid}`} list="categories" required className="field" value={v.category} onChange={set("category")} />
          <p className="mt-1 text-xs text-muted">The tab it appears under, like Peptides, Drops or Sprays.</p>
        </div>
        <div>
          <label className="label" htmlFor={`grp-${fid}`}>
            Group <span className="font-normal text-muted">(optional)</span>
          </label>
          <input id={`grp-${fid}`} list="groups" className="field" value={v.subcategory} onChange={set("subcategory")} placeholder="Copper peptides" />
          <p className="mt-1 text-xs text-muted">A section inside the tab. Pick one from the list or type a new one.</p>
        </div>
      </div>

      <div>
        <label className="label" htmlFor={`desc-${fid}`}>What it is</label>
        <textarea id={`desc-${fid}`} rows={3} maxLength={1000} className="field" value={v.description} onChange={set("description")} placeholder="Synthetic 15-amino-acid peptide based on a sequence from a protein found in gastric juice." />
        <p className="mt-1 text-xs text-muted">
          One or two factual sentences about what the compound is. Products are sold for research use only, so leave out
          health benefits, uses on people, and dosing.
        </p>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <label className="flex items-center gap-2 font-semibold">
          <input type="checkbox" className="accent-blue" checked={v.is_active} onChange={set("is_active")} />
          Show on the price list
        </label>
        {siblings.length > 0 && (
          <label className="flex items-center gap-2">
            <input type="checkbox" className="accent-blue" checked={v.applyToAllSizes} onChange={set("applyToAllSizes")} />
            Use this group and description for all {siblings.length + 1} sizes of {v.name.trim()}
          </label>
        )}
      </div>

      {error && <p role="alert" className="text-sm text-danger">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : id ? "Save product" : "Add product"}
        </button>
        <button type="button" className="btn btn-quiet" onClick={onDone}>
          Cancel
        </button>
        {id && onAddSize && (
          <button type="button" className="btn btn-quiet" onClick={onAddSize}>
            Add another size
          </button>
        )}
        {id &&
          (confirmDelete ? (
            <span className="ml-auto flex flex-wrap items-center gap-2 text-sm">
              Delete this size? Past orders keep their copy.
              <button
                type="button"
                className="btn btn-quiet !py-1 text-sm !text-danger"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await deleteProduct(id);
                    if (r.error) setError(r.error);
                    else onDone();
                  })
                }
              >
                Delete
              </button>
              <button type="button" className="btn btn-quiet !py-1 text-sm" onClick={() => setConfirmDelete(false)}>
                Keep
              </button>
            </span>
          ) : (
            <button type="button" className="ml-auto text-sm text-muted underline hover:text-danger" onClick={() => setConfirmDelete(true)}>
              Delete
            </button>
          ))}
      </div>
    </form>
  );
}
