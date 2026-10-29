"use client";

import { useMemo, useState, useTransition } from "react";
import { CATEGORY_ORDER } from "@/lib/types";
import { receiveStock, setCount, setLevels, type AdminResult } from "../actions";

export type InvRow = {
  product_id: string;
  name: string;
  size: string | null;
  category: string;
  is_active: boolean;
  on_hand: number;
  committed: number;
  available: number;
  reorder_point: number;
  reorder_qty: number;
  needs_reorder: boolean;
  last_counted_at: string | null;
};

export type Move = {
  id: number;
  change: number;
  on_hand_after: number;
  reason: "count" | "received" | "picked_up" | "pickup_undone" | "adjust";
  note: string | null;
  created_at: string;
  products: { name: string; size: string | null } | null;
  orders: { order_number: number } | null;
};

type View = "all" | "reorder" | "out" | "uncounted";

const REASON: Record<Move["reason"], string> = {
  count: "Counted",
  received: "Received",
  picked_up: "Picked up",
  pickup_undone: "Pickup undone",
  adjust: "Adjusted",
};

const shortDate = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Denver" });

/** What to order: the reorder quantity you set, or enough to get back to twice the reorder point. */
const suggested = (r: InvRow) => (r.reorder_qty > 0 ? r.reorder_qty : Math.max(r.reorder_point * 2 - r.available, 1));

export function InventoryManager({ rows, moves }: { rows: InvRow[]; moves: Move[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [view, setView] = useState<View>("all");
  const [editing, setEditing] = useState<string | null>(null);

  const live = rows.filter((r) => r.is_active);
  const reorder = live.filter((r) => r.needs_reorder);
  const out = live.filter((r) => r.available <= 0);
  const uncounted = live.filter((r) => !r.last_counted_at);
  const categories = useMemo(() => {
    const present = new Set(rows.map((r) => r.category));
    return CATEGORY_ORDER.filter((c) => present.has(c)).concat([...present].filter((c) => !CATEGORY_ORDER.includes(c)));
  }, [rows]);

  const visible = live.filter((r) => {
    if (category !== "All" && r.category !== category) return false;
    if (view === "reorder" && !r.needs_reorder) return false;
    if (view === "out" && r.available > 0) return false;
    if (view === "uncounted" && r.last_counted_at) return false;
    const q = query.trim().toLowerCase();
    return !q || `${r.name} ${r.size ?? ""}`.toLowerCase().includes(q);
  });

  const views: { v: View; label: string; n: number }[] = [
    { v: "all", label: "All", n: live.length },
    { v: "reorder", label: "Needs reorder", n: reorder.length },
    { v: "out", label: "Out of stock", n: out.length },
    { v: "uncounted", label: "Not counted yet", n: uncounted.length },
  ];

  return (
    <div>
      <h1 className="display text-3xl sm:text-4xl">Inventory</h1>
      <p className="mt-2 max-w-2xl text-muted">
        On hand drops automatically when an order is marked picked up. Available is on hand minus what open orders
        still need. A product needs reordering when available falls to its reorder point.
      </p>

      {reorder.length > 0 && (
        <section className="mt-6 rounded-lg border border-danger/40 bg-danger-soft p-4" aria-labelledby="reorder-h">
          <h2 id="reorder-h" className="font-bold text-danger">
            {reorder.length} {reorder.length === 1 ? "product needs" : "products need"} reordering
          </h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {reorder.map((r) => (
              <li key={r.product_id} className="flex items-center gap-3 rounded-md bg-surface px-3 py-2 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">{r.name}</span> <span className="text-muted">{r.size}</span>
                  <span className="block text-xs text-muted tabular-nums">
                    {r.available} available, reorder at {r.reorder_point}
                  </span>
                </span>
                <span className="text-right text-xs text-muted">
                  Order
                  <span className="block text-base font-bold text-ink tabular-nums">{suggested(r)}</span>
                </span>
                <button
                  className="btn btn-quiet !px-3 !py-1 text-sm"
                  onClick={() => {
                    setView("all");
                    setCategory("All");
                    setQuery(r.name);
                    setEditing(r.product_id);
                  }}
                >
                  Update
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <input
          type="search"
          className="field !w-64"
          placeholder="Search products"
          aria-label="Search inventory"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select className="field !w-auto" aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option>All</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Show">
          {views.map(({ v, label, n }) => (
            <button
              key={v}
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`rounded-full border px-3 py-1 text-sm font-semibold ${
                view === v ? "border-ink bg-ink text-surface" : "border-line bg-surface"
              }`}
            >
              {label} <span className="tabular-nums opacity-70">{n}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-4 overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[52rem] text-left text-sm">
          <thead className="bg-head text-xs text-muted">
            <tr>
              <th className="px-3 py-2 font-semibold">Product</th>
              <th className="px-3 py-2 text-right font-semibold">On hand</th>
              <th className="px-3 py-2 text-right font-semibold">In open orders</th>
              <th className="px-3 py-2 text-right font-semibold">Available</th>
              <th className="px-3 py-2 text-right font-semibold">Reorder at</th>
              <th className="px-3 py-2 text-right font-semibold">Order qty</th>
              <th className="px-3 py-2 font-semibold">Last counted</th>
              <th className="px-3 py-2">
                <span className="sr-only">Update</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {visible.map((r) =>
              editing === r.product_id ? (
                <tr key={r.product_id}>
                  <td colSpan={8} className="bg-blue-soft/50 p-4">
                    <StockEditor row={r} onDone={() => setEditing(null)} />
                  </td>
                </tr>
              ) : (
                <tr key={r.product_id} className={r.needs_reorder ? "bg-danger-soft/50" : undefined}>
                  <td className="px-3 py-2">
                    <span className="font-semibold">{r.name}</span> <span className="text-muted">{r.size}</span>
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{r.on_hand}</td>
                  <td className="px-3 py-2 text-right text-muted tabular-nums">{r.committed || ""}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <span className={r.available <= 0 ? "font-bold text-danger" : r.needs_reorder ? "font-bold text-danger" : ""}>
                      {r.available}
                    </span>
                    {r.needs_reorder && (
                      <span className="ml-2 rounded-full bg-danger px-1.5 py-0.5 text-[11px] font-bold text-surface">Reorder</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-muted tabular-nums">{r.reorder_point || "Not set"}</td>
                  <td className="px-3 py-2 text-right text-muted tabular-nums">{r.reorder_qty || ""}</td>
                  <td className="px-3 py-2 text-muted">{r.last_counted_at ? shortDate(r.last_counted_at) : "Never"}</td>
                  <td className="px-3 py-2 text-right">
                    <button className="font-semibold text-blue underline" onClick={() => setEditing(r.product_id)}>
                      Update
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
        {visible.length === 0 && <p className="p-6 text-center text-muted">No products match.</p>}
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-bold">Recent stock changes</h2>
        {moves.length === 0 ? (
          <p className="mt-2 text-muted">No changes yet. Start by counting what’s on your shelf.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-surface text-sm">
            {moves.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
                <span className="w-32 shrink-0 text-muted">{shortDate(m.created_at)}</span>
                <span className="min-w-0 flex-1">
                  {m.products?.name} <span className="text-muted">{m.products?.size}</span>
                </span>
                <span className="text-muted">
                  {REASON[m.reason]}
                  {m.orders ? ` (order #${m.orders.order_number})` : ""}
                  {m.note ? `: ${m.note}` : ""}
                </span>
                <span className={`w-14 text-right font-bold tabular-nums ${m.change < 0 ? "text-danger" : "text-blue"}`}>
                  {m.change > 0 ? `+${m.change}` : m.change}
                </span>
                <span className="w-20 text-right text-muted tabular-nums">{m.on_hand_after} on hand</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StockEditor({ row, onDone }: { row: InvRow; onDone: () => void }) {
  const [count, setCountVal] = useState(String(row.on_hand));
  const [received, setReceived] = useState("");
  const [note, setNote] = useState("");
  const [point, setPoint] = useState(String(row.reorder_point || ""));
  const [qty, setQty] = useState(String(row.reorder_qty || ""));
  const [msg, setMsg] = useState<AdminResult & { text?: string }>({});
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<AdminResult>, text: string) =>
    start(async () => {
      setMsg({});
      const r = await fn();
      setMsg(r.error ? r : { ok: true, text });
    });

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <p className="font-bold">
          {row.name} <span className="font-normal text-muted">{row.size}</span>
        </p>
        <p className="text-sm text-muted tabular-nums">
          {row.on_hand} on hand, {row.committed} in open orders, {row.available} available
        </p>
        <button className="ml-auto text-sm underline" onClick={onDone}>
          Close
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <form
          className="grid gap-2 rounded-md border border-line bg-surface p-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => setCount(row.product_id, parseInt(count, 10), note), "Count saved.");
          }}
        >
          <label className="label !mb-0" htmlFor={`count-${row.product_id}`}>
            Shelf count
          </label>
          <p className="text-xs text-muted">Sets on hand to exactly what you counted.</p>
          <input id={`count-${row.product_id}`} type="number" min={0} required className="field tabular-nums" value={count} onChange={(e) => setCountVal(e.target.value)} />
          <button className="btn btn-primary !py-1.5 text-sm" disabled={pending}>
            Save count
          </button>
        </form>

        <form
          className="grid gap-2 rounded-md border border-line bg-surface p-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => receiveStock(row.product_id, parseInt(received, 10), note), "Received stock added.");
            setReceived("");
          }}
        >
          <label className="label !mb-0" htmlFor={`recv-${row.product_id}`}>
            Received
          </label>
          <p className="text-xs text-muted">Adds a delivery to on hand.</p>
          <input id={`recv-${row.product_id}`} type="number" min={1} required className="field tabular-nums" placeholder="How many arrived" value={received} onChange={(e) => setReceived(e.target.value)} />
          <button className="btn btn-primary !py-1.5 text-sm" disabled={pending}>
            Add to stock
          </button>
        </form>

        <form
          className="grid gap-2 rounded-md border border-line bg-surface p-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => setLevels(row.product_id, parseInt(point || "0", 10), parseInt(qty || "0", 10)), "Reorder levels saved.");
          }}
        >
          <span className="label !mb-0">Reorder reminder</span>
          <p className="text-xs text-muted">Flag it when available drops to this number. Leave blank for no reminder.</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted" htmlFor={`rop-${row.product_id}`}>Reorder at</label>
              <input id={`rop-${row.product_id}`} type="number" min={0} className="field tabular-nums" value={point} onChange={(e) => setPoint(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted" htmlFor={`rq-${row.product_id}`}>Order qty</label>
              <input id={`rq-${row.product_id}`} type="number" min={0} className="field tabular-nums" value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
          </div>
          <button className="btn btn-primary !py-1.5 text-sm" disabled={pending}>
            Save levels
          </button>
        </form>
      </div>

      <div>
        <label className="label" htmlFor={`note-${row.product_id}`}>
          Note for the stock log <span className="font-normal text-muted">(optional, saved with a count or delivery)</span>
        </label>
        <input id={`note-${row.product_id}`} className="field" placeholder="Supplier invoice #, damaged vial, etc." value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      {msg.error && <p role="alert" className="text-sm text-danger">{msg.error}</p>}
      {msg.ok && <p role="status" className="text-sm font-semibold text-blue">{msg.text}</p>}
    </div>
  );
}
