"use client";

import { useState, useTransition } from "react";
import { formatDate, formatMoney } from "@/lib/format";
import type { OrderItem, OrderStatus } from "@/lib/types";
import { SHOP_STATUS_LABEL, StatusBadge } from "@/components/StatusBadge";
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
  staged_location: string | null;
  staged_at: string | null;
  staged_by_profile: { full_name: string } | null;
  picked_up_by_profile: { full_name: string } | null;
  profiles: { full_name: string; phone?: string; email?: string | null } | null;
  order_items: OrderItem[];
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Denver" });
const time = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Denver" });

type Panel = "none" | "stage" | "collect" | "noshow";

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
  const [panel, setPanel] = useState<Panel>("none");
  const [location, setLocation] = useState(order.staged_location ?? "");

  const run = (fn: () => Promise<{ error?: string }>, after?: () => void) =>
    start(async () => {
      setError("");
      const r = await fn();
      if (r.error) setError(r.error);
      else {
        setPanel("none");
        after?.();
      }
    });

  const open = order.status === "pending" || order.status === "ready";
  const staffName = (p: { full_name: string } | null) => (p?.full_name ? ` by ${p.full_name}` : "");

  return (
    <li className={`rounded-lg border bg-surface p-4 ${order.status === "cancelled" ? "border-line opacity-60" : "border-line"}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="font-bold">#{order.order_number}</span>
        <StatusBadge status={order.status} shop />
        <span className="font-semibold">{order.profiles?.full_name || "No name"}</span>
        {isAdmin && order.profiles?.phone && <span className="text-sm text-muted">{order.profiles.phone}</span>}
        {isAdmin && order.profiles?.email && <span className="text-sm text-muted">{order.profiles.email}</span>}
        <span className="ml-auto text-lg font-bold tabular-nums">{formatMoney(order.total)}</span>
      </div>

      {order.status === "ready" && (
        <p className="mt-3 flex flex-wrap items-center gap-x-2 rounded-md bg-blue-soft px-3 py-2 text-sm">
          <span className="font-bold">Staged{order.staged_location ? `: ${order.staged_location}` : ""}</span>
          {order.staged_at && (
            <span className="text-muted">
              {staffName(order.staged_by_profile)} at {time(order.staged_at)}
            </span>
          )}
        </p>
      )}
      {order.status === "picked_up" && order.picked_up_at && (
        <p className="mt-3 text-sm text-muted">
          Picked up and paid{staffName(order.picked_up_by_profile)}, {fmt(order.picked_up_at)}
          {order.staged_location ? ` (was in ${order.staged_location})` : ""}.
        </p>
      )}

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

      {order.customer_note && (
        <p className="mt-3 rounded bg-note px-3 py-2 text-sm">
          <span className="font-semibold">Customer note:</span> {order.customer_note}
        </p>
      )}

      {/* Step actions */}
      {open && panel === "none" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {order.status === "pending" && (
            <button className="btn btn-primary !py-1.5 text-sm" disabled={pending} onClick={() => setPanel("stage")}>
              Mark staged
            </button>
          )}
          {order.status === "ready" && (
            <>
              <button className="btn btn-primary !py-1.5 text-sm" disabled={pending} onClick={() => setPanel("collect")}>
                Mark picked up and paid
              </button>
              <button className="btn btn-quiet !py-1.5 text-sm" disabled={pending} onClick={() => setPanel("stage")}>
                Change location
              </button>
              <button className="btn btn-quiet !py-1.5 text-sm" disabled={pending} onClick={() => run(() => setOrderStatus(order.id, "pending"))}>
                Unstage
              </button>
            </>
          )}
          <button className="text-sm text-muted underline hover:text-danger" disabled={pending} onClick={() => setPanel("noshow")}>
            Not picked up
          </button>
        </div>
      )}

      {panel === "stage" && (
        <form
          className="mt-3 flex flex-wrap items-end gap-2 rounded-md border border-blue bg-blue-soft/50 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => setOrderStatus(order.id, "ready", location));
          }}
        >
          <div className="min-w-0 flex-1">
            <label className="label !text-sm" htmlFor={`loc-${order.id}`}>
              Where is it staged?
            </label>
            <input
              id={`loc-${order.id}`}
              className="field !py-1.5"
              autoFocus
              maxLength={60}
              placeholder="Bin or shelf, like Bin 4"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <button className="btn btn-primary !py-1.5 text-sm" disabled={pending}>
            Save as staged
          </button>
          <button type="button" className="btn btn-quiet !py-1.5 text-sm" onClick={() => setPanel("none")}>
            Cancel
          </button>
        </form>
      )}

      {panel === "collect" && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md border-2 border-blue bg-blue-soft/50 p-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Collect cash before handing it over</p>
            <p className="display text-2xl tabular-nums">{formatMoney(order.total)}</p>
            {order.staged_location && <p className="text-sm text-muted">Staged in {order.staged_location}</p>}
          </div>
          <button
            className="btn btn-primary"
            disabled={pending}
            onClick={() => run(() => setOrderStatus(order.id, "picked_up"))}
          >
            Cash received, mark picked up
          </button>
          <button className="btn btn-quiet" onClick={() => setPanel("none")}>
            Back
          </button>
        </div>
      )}

      {panel === "noshow" && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-line bg-paper p-3 text-sm">
          <span className="flex-1">
            Mark order #{order.order_number} as not picked up?{isAdmin ? "" : " Only the admin can reopen it after this."}
          </span>
          <button className="btn btn-quiet !py-1.5 text-sm !text-danger" disabled={pending} onClick={() => run(() => setOrderStatus(order.id, "no_show"))}>
            Mark not picked up
          </button>
          <button className="btn btn-quiet !py-1.5 text-sm" onClick={() => setPanel("none")}>
            Back
          </button>
        </div>
      )}

      {/* Admin-only controls */}
      {isAdmin && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <label className="sr-only" htmlFor={`status-${order.id}`}>Status</label>
          <select
            id={`status-${order.id}`}
            className="field !w-auto !py-1.5 text-sm"
            value={order.status}
            disabled={pending}
            onChange={(e) => run(() => setOrderStatus(order.id, e.target.value as OrderStatus, order.staged_location ?? undefined))}
          >
            {(Object.keys(SHOP_STATUS_LABEL) as OrderStatus[]).map((s) => (
              <option key={s} value={s}>
                {SHOP_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor={`day-${order.id}`}>Pickup day</label>
          <select
            id={`day-${order.id}`}
            className="field !w-auto !py-1.5 text-sm"
            value=""
            disabled={pending}
            onChange={(e) => e.target.value && run(() => moveOrderPickup(order.id, e.target.value))}
          >
            <option value="">Move to another day…</option>
            {days
              .filter((d) => d.id !== order.pickup_date_id)
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {formatDate(d.pickup_date, { weekday: "short", month: "short", day: "numeric" })}
                </option>
              ))}
          </select>
          <span className="text-xs text-muted">Placed {fmt(order.created_at)}</span>
        </div>
      )}

      {isAdmin && (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => setOrderAdminNote(order.id, note),
              () => setNoteSaved(true),
            );
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

      <p className="mt-3 text-xs text-muted">
        Agreement signed as <span className="font-semibold text-ink">{order.waiver_signed_name}</span> on{" "}
        {fmt(order.waiver_accepted_at)} (v{order.waiver_version})
        {order.picked_up_at ? `. Accepted at pickup ${fmt(order.picked_up_at)}.` : ". Pickup will confirm acceptance."}
      </p>

      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    </li>
  );
}
