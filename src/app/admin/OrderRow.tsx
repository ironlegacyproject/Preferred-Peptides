"use client";

import { useState, useTransition } from "react";
import { formatDate, formatMoney } from "@/lib/format";
import { STATUS_LABEL, type OrderItem, type OrderStatus } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";
import { moveOrderPickup, setOrderAdminNote, setOrderStatus } from "./actions";

export type AdminOrder = {
  id: string;
  order_number: number;
  status: OrderStatus;
  total: number;
  customer_note: string | null;
  order_admin_notes?: { note: string } | null;
  created_at: string;
  pickup_date_id: string;
  waiver_signed_name: string;
  waiver_version: string;
  waiver_accepted_at: string;
  picked_up_at: string | null;
  profiles: { full_name: string; phone: string; email: string | null } | null;
  order_items: OrderItem[];
};

const NEXT_STEP: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> = {
  pending: { status: "ready", label: "Mark ready" },
  ready: { status: "picked_up", label: "Mark picked up and paid" },
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Denver" });

export function OrderRow({
  order,
  days,
  isAdmin,
}: {
  order: AdminOrder;
  days: { id: string; pickup_date: string }[];
  isAdmin: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const savedNote = order.order_admin_notes?.note ?? "";
  const [note, setNote] = useState(savedNote);
  const [noteSaved, setNoteSaved] = useState(false);
  const step = NEXT_STEP[order.status];

  const run = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      setError("");
      const r = await fn();
      if (r.error) setError(r.error);
    });

  return (
    <li className={`rounded-lg border bg-surface p-4 ${order.status === "cancelled" ? "border-line opacity-60" : "border-line"}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="font-bold">#{order.order_number}</span>
        <StatusBadge status={order.status} />
        <span className="font-semibold">{order.profiles?.full_name || "No name"}</span>
        {order.profiles?.phone && (
          <a href={`tel:${order.profiles.phone}`} className="text-sm text-blue underline">{order.profiles.phone}</a>
        )}
        {order.profiles?.email && (
          <a href={`mailto:${order.profiles.email}`} className="text-sm text-muted underline">{order.profiles.email}</a>
        )}
        <span className="ml-auto text-lg font-bold tabular-nums">{formatMoney(order.total)}</span>
      </div>

      <ul className="mt-3 grid gap-x-6 text-sm sm:grid-cols-2">
        {order.order_items.map((i) => (
          <li key={i.id} className="flex justify-between gap-3 border-b border-line py-1">
            <span>
              <span className="font-bold tabular-nums">{i.quantity} ×</span> {i.product_name}
              {i.product_size && <span className="text-muted"> {i.product_size}</span>}
            </span>
            <span className="tabular-nums text-muted">{formatMoney(i.line_total)}</span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-muted">
        Agreement signed as <span className="font-semibold text-ink">{order.waiver_signed_name}</span> on{" "}
        {fmt(order.waiver_accepted_at)} (v{order.waiver_version})
        {order.picked_up_at ? `. Accepted at pickup ${fmt(order.picked_up_at)}.` : ". Pickup will confirm acceptance."}
      </p>

      {order.customer_note && (
        <p className="mt-3 rounded bg-note px-3 py-2 text-sm">
          <span className="font-semibold">Customer note:</span> {order.customer_note}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {step && (
          <button className="btn btn-primary !py-1.5 text-sm" disabled={pending} onClick={() => run(() => setOrderStatus(order.id, step.status))}>
            {step.label}
          </button>
        )}
        <label className="sr-only" htmlFor={`status-${order.id}`}>Status</label>
        <select
          id={`status-${order.id}`}
          className="field !w-auto !py-1.5 text-sm"
          value={order.status}
          disabled={pending}
          onChange={(e) => run(() => setOrderStatus(order.id, e.target.value as OrderStatus))}
        >
          {(Object.keys(STATUS_LABEL) as OrderStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
        {isAdmin && (
          <>
        <label className="sr-only" htmlFor={`day-${order.id}`}>Pickup day</label>
        <select
          id={`day-${order.id}`}
          className="field !w-auto !py-1.5 text-sm"
          value=""
          disabled={pending}
          onChange={(e) => e.target.value && run(() => moveOrderPickup(order.id, e.target.value))}
        >
          <option value="">Move to another day…</option>
          {days.filter((d) => d.id !== order.pickup_date_id).map((d) => (
            <option key={d.id} value={d.id}>{formatDate(d.pickup_date, { weekday: "short", month: "short", day: "numeric" })}</option>
          ))}
        </select>
          </>
        )}
        <span className="text-xs text-muted">
          Placed {new Date(order.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Denver" })}
        </span>
      </div>

      {isAdmin && (
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            const r = await setOrderAdminNote(order.id, note);
            if (!r.error) setNoteSaved(true);
            return r;
          });
        }}
      >
        <label className="sr-only" htmlFor={`note-${order.id}`}>Private note</label>
        <input
          id={`note-${order.id}`}
          className="field !py-1.5 text-sm"
          placeholder="Private shop note (customers never see this)"
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setNoteSaved(false);
          }}
        />
        <button className="btn btn-quiet !py-1.5 text-sm" disabled={pending || note === savedNote}>
          {noteSaved ? "Saved" : "Save note"}
        </button>
      </form>
      )}

      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    </li>
  );
}
