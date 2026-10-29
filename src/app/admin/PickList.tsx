"use client";

import { useEffect, useState } from "react";

/** The day's pick list with checkboxes. Ticks are remembered on this device only. */
export function PickList({ dayId, items }: { dayId: string; items: [string, number][] }) {
  const key = `pp-pick-${dayId}`;
  const [done, setDone] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      setDone(JSON.parse(localStorage.getItem(key) || "{}"));
    } catch {}
  }, [key]);

  function toggle(name: string) {
    const next = { ...done, [name]: !done[name] };
    setDone(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {}
  }

  const count = items.filter(([n]) => done[n]).length;

  return (
    <details className="mt-3 rounded-md border border-line bg-surface">
      <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">
        Pick list for this day ({items.length} products{count ? `, ${count} pulled` : ""})
      </summary>
      <ul className="columns-1 gap-6 px-3 pb-3 text-sm sm:columns-2">
        {items.map(([name, qty]) => (
          <li key={name} className="break-inside-avoid border-b border-line py-1">
            <label className={`flex cursor-pointer items-center gap-2 ${done[name] ? "text-muted line-through" : ""}`}>
              <input type="checkbox" className="size-4 accent-blue" checked={!!done[name]} onChange={() => toggle(name)} />
              <span className="flex-1">{name}</span>
              <span className="font-bold tabular-nums">{qty}</span>
            </label>
          </li>
        ))}
      </ul>
      {count > 0 && (
        <div className="px-3 pb-3">
          <button
            type="button"
            className="text-xs text-muted underline"
            onClick={() => {
              setDone({});
              try {
                localStorage.removeItem(key);
              } catch {}
            }}
          >
            Clear checkmarks
          </button>
        </div>
      )}
    </details>
  );
}
