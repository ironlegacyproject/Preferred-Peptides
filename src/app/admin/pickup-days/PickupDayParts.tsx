"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { formatDate, formatWindow } from "@/lib/format";
import { addPickupDay, deletePickupDay, setPickupDayOpen, type AdminResult } from "../actions";

export type AdminPickupDay = {
  id: string;
  pickup_date: string;
  start_time: string | null;
  end_time: string | null;
  note: string | null;
  max_orders: number | null;
  is_open: boolean;
  order_count: number;
};

export function PickupDayRow({ day, past }: { day: AdminPickupDay; past?: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const run = (fn: () => Promise<AdminResult>) =>
    start(async () => {
      setError("");
      const r = await fn();
      if (r.error) setError(r.error);
    });

  return (
    <li className="rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="font-bold">
            {formatDate(day.pickup_date, { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
          </p>
          <p className="text-sm text-muted">
            {[formatWindow(day.start_time, day.end_time), day.note].filter(Boolean).join(". ") || "No time window set"}
          </p>
        </div>
        <span className="text-sm font-semibold tabular-nums">
          {day.order_count}
          {day.max_orders ? ` of ${day.max_orders}` : ""} orders
        </span>
        {!past && (
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${day.is_open ? "bg-blue-soft text-blue" : "bg-paper text-muted"}`}>
            {day.is_open ? "Open" : "Closed"}
          </span>
        )}
        {!past && (
          <button className="btn btn-quiet !py-1.5 text-sm" disabled={pending} onClick={() => run(() => setPickupDayOpen(day.id, !day.is_open))}>
            {day.is_open ? "Close day" : "Reopen day"}
          </button>
        )}
        {day.order_count === 0 && (
          <button
            className="text-sm text-muted underline hover:text-danger"
            disabled={pending}
            onClick={() => confirm("Delete this pickup day?") && run(() => deletePickupDay(day.id))}
          >
            Delete
          </button>
        )}
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    </li>
  );
}

export function AddPickupDayForm({ minDate }: { minDate: string }) {
  const [state, action, pending] = useActionState<AdminResult, FormData>(addPickupDay, {});
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="grid gap-3">
      <div>
        <label className="label" htmlFor="pickup_date">Date</label>
        <input id="pickup_date" name="pickup_date" type="date" min={minDate} required className="field" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label" htmlFor="start_time">Opens</label>
          <input id="start_time" name="start_time" type="time" className="field" />
        </div>
        <div>
          <label className="label" htmlFor="end_time">Closes</label>
          <input id="end_time" name="end_time" type="time" className="field" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="note">Note for customers <span className="font-normal text-muted">(optional)</span></label>
        <input id="note" name="note" placeholder="Use the side door" className="field" />
      </div>
      <div>
        <label className="label" htmlFor="max_orders">Order limit <span className="font-normal text-muted">(optional)</span></label>
        <input id="max_orders" name="max_orders" type="number" min={1} className="field" />
        <p className="mt-1 text-xs text-muted">The day stops taking orders once it reaches this many.</p>
      </div>
      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      {state.ok && <p role="status" className="text-sm text-blue">Pickup day added.</p>}
      <button className="btn btn-primary" disabled={pending}>{pending ? "Adding…" : "Add pickup day"}</button>
    </form>
  );
}
