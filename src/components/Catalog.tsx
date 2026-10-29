"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CATEGORY_ORDER, GROUP_ORDER, type Product } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { useCart } from "./CartProvider";

type Group = { key: string; name: string; category: string; subcategory: string | null; variants: Product[] };

function groupProducts(products: Product[]): Group[] {
  const map = new Map<string, Group>();
  for (const p of products) {
    const key = `${p.category}::${p.name}`;
    if (!map.has(key)) map.set(key, { key, name: p.name, category: p.category, subcategory: p.subcategory, variants: [] });
    map.get(key)!.variants.push(p);
  }
  return [...map.values()];
}

/** Splits a tab's products into its groups (e.g. "Copper peptides"), in the shop's preferred order. */
function splitByGroup(gs: Group[]): { title: string; items: Group[]; isCategory?: boolean }[] {
  const byName = (a: Group, b: Group) => a.name.localeCompare(b.name, undefined, { numeric: true });
  if (!gs.some((g) => g.subcategory)) return [{ title: "", items: [...gs].sort(byName) }];
  const map = new Map<string, Group[]>();
  for (const g of gs) {
    const t = g.subcategory || "Other";
    if (!map.has(t)) map.set(t, []);
    map.get(t)!.push(g);
  }
  const rank = (t: string) => {
    const i = GROUP_ORDER.indexOf(t);
    return t === "Other" ? 999 : i === -1 ? 500 : i;
  };
  return [...map.entries()]
    .sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0]))
    .map(([title, items]) => ({ title, items: items.sort(byName) }));
}

export function Catalog({ products }: { products: Product[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("Peptides");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const cart = useCart();

  const categories = useMemo(() => {
    const present = new Set(products.map((p) => p.category));
    const known = CATEGORY_ORDER.filter((c) => present.has(c));
    const extra = [...present].filter((c) => !CATEGORY_ORDER.includes(c)).sort();
    return [...known, ...extra];
  }, [products]);

  const groups = useMemo(() => groupProducts(products), [products]);
  const activeCategory = categories.includes(category) ? category : categories[0];
  const searching = query.trim() !== "";

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups.filter(
      (g) =>
        (q ? true : g.category === activeCategory) &&
        (!q || g.name.toLowerCase().includes(q) || g.variants.some((v) => v.description?.toLowerCase().includes(q))),
    );
  }, [groups, query, activeCategory]);

  const byCategory = useMemo(() => {
    const out: { category: string; groups: Group[] }[] = [];
    for (const c of categories) {
      const gs = visible.filter((g) => g.category === c);
      if (gs.length) out.push({ category: c, groups: gs });
    }
    return out;
  }, [visible, categories]);

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-4 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, like BPC-157 or GHK-Cu"
          aria-label="Search products"
          className="field"
        />
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Categories">
          {categories.map((c) => (
            <button
              key={c}
              role="tab"
              aria-selected={!searching && activeCategory === c}
              onClick={() => {
                setCategory(c);
                setQuery("");
              }}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold ${
                !searching && activeCategory === c ? "bg-blue text-on-blue" : "text-muted hover:bg-surface hover:text-ink"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {byCategory.length === 0 && (
        <p className="py-16 text-center text-muted">
          Nothing matches “{query}”. Try a shorter name or part of the name.
        </p>
      )}

      {byCategory.map(({ category: c, groups: gs }) => {
        const card = (g: Group) => (
          <ProductCard
            key={g.key}
            group={g}
            open={openKey === g.key || (visible.length === 1 && searching)}
            onToggle={() => setOpenKey(openKey === g.key ? null : g.key)}
          />
        );
        // While searching: one section per category. Otherwise: sections by group inside the tab.
        const sections = searching ? [{ title: c, items: gs, isCategory: true }] : splitByGroup(gs);
        return (
          <div key={c} className="mt-5">
            {sections.map((sec) => (
              <section key={sec.title || "all"} className="mb-8" aria-label={sec.title || c}>
                {sec.title && (
                  <div className="mb-3 flex items-baseline gap-3">
                    <h2 className={sec.isCategory ? "display text-xl" : "text-lg font-bold"}>{sec.title}</h2>
                    <span className="text-sm text-muted">
                      {sec.items.length}{" "}
                      {sec.isCategory ? (sec.items.length === 1 ? "match" : "matches") : sec.items.length === 1 ? "product" : "products"}
                    </span>
                  </div>
                )}
                <ul className="grid list-none items-start gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(min(100%,19rem),1fr))]">
                  {sec.items.map(card)}
                </ul>
              </section>
            ))}
          </div>
        );
      })}

      {cart.ready && cart.count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface p-3 sm:hidden">
          <Link href="/cart" className="btn btn-primary w-full">
            Review order: {cart.count} {cart.count === 1 ? "item" : "items"}, {formatMoney(cart.total)}
          </Link>
        </div>
      )}
    </div>
  );
}

function ProductCard({ group, open, onToggle }: { group: Group; open: boolean; onToggle: () => void }) {
  const cart = useCart();
  const inCart = group.variants.reduce((n, v) => n + cart.qtyOf(v.id), 0);
  const low = Math.min(...group.variants.map((v) => Number(v.price)));
  const single = group.variants.length === 1;
  const bodyId = `pb-${group.variants[0].id}`;

  return (
    <li
      className={`rounded-xl border bg-surface transition-colors ${
        open ? "border-blue ring-1 ring-blue" : inCart ? "border-blue/60" : "border-transparent hover:border-line"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={bodyId}
        className="flex w-full items-center gap-3 rounded-xl px-[18px] py-4 text-left"
      >
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="leading-tight font-semibold">{group.name}</span>
          <span className="text-[13px] text-muted tabular-nums">
            {single ? (
              <>
                {group.variants[0].size || "Each"}, <b className="font-normal">{formatMoney(low)}</b>
              </>
            ) : (
              <>
                {group.variants.length} sizes, from <b className="font-normal">{formatMoney(low)}</b>
              </>
            )}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {inCart > 0 && (
            <span className="rounded-full bg-blue px-2 py-0.5 text-xs font-bold whitespace-nowrap text-on-blue">{inCart} in order</span>
          )}
          <svg
            viewBox="0 0 24 24"
            className={`size-[18px] transition-transform ${open ? "rotate-180 text-blue" : "text-muted"}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>

      {open && (
        <div id={bodyId} className="border-t border-line-soft px-[18px] pt-3 pb-4">
          {group.variants[0].description && (
            <p className="mb-3 text-sm leading-relaxed text-muted">{group.variants[0].description}</p>
          )}
          <p className="mb-2 text-[13px] font-semibold text-muted">{single ? "Add to your order" : "Choose a size"}</p>
          <ul className="grid gap-1.5">
            {group.variants.map((v) => (
              <SizeRow key={v.id} product={v} qty={cart.qtyOf(v.id)} />
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

function SizeRow({ product, qty }: { product: Product; qty: number }) {
  const { add, setQty } = useCart();
  const size = product.size || "Each";
  return (
    <li
      className={`grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-lg border py-1.5 pr-2 pl-3 ${
        qty > 0 ? "border-blue bg-blue-soft" : "border-transparent bg-head"
      }`}
    >
      <span className="font-semibold tabular-nums">{size}</span>
      <span className="font-bold tabular-nums">{formatMoney(product.price)}</span>
      {qty > 0 ? (
        <span className="inline-flex overflow-hidden rounded-md border border-blue bg-surface">
          <button
            onClick={() => setQty(product.id, qty - 1)}
            className="w-7 bg-blue py-1 text-base leading-none font-bold text-on-blue hover:bg-blue-dark"
            aria-label={`One fewer ${product.name} ${size}`}
          >
            −
          </button>
          <span className="grid min-w-7 place-items-center font-bold text-blue tabular-nums" aria-label={`${qty} in order`}>
            {qty}
          </span>
          <button
            onClick={() => setQty(product.id, qty + 1)}
            className="w-7 bg-blue py-1 text-base leading-none font-bold text-on-blue hover:bg-blue-dark"
            aria-label={`One more ${product.name} ${size}`}
          >
            +
          </button>
        </span>
      ) : (
        <button
          onClick={() => add({ id: product.id, name: product.name, size: product.size, price: Number(product.price) })}
          className="rounded-md border border-blue bg-surface px-3.5 py-1 text-[13px] font-semibold text-blue hover:bg-blue hover:text-on-blue"
          aria-label={`Add ${product.name} ${size} to order`}
        >
          Add
        </button>
      )}
    </li>
  );
}
