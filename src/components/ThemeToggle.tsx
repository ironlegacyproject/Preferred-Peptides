"use client";

import { useEffect, useState } from "react";

// Day view is the default. Night view only turns on when the visitor picks it.
const isNight = () => document.documentElement.dataset.theme === "dark";

export function ThemeToggle() {
  const [night, setNight] = useState<boolean | null>(null);

  useEffect(() => setNight(isNight()), []);

  function toggle() {
    const next = isNight() ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("pp-theme", next);
    } catch {}
    setNight(next === "dark");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={night ? "Switch to day view" : "Switch to night view"}
      className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-[13px] font-semibold hover:bg-blue-soft"
    >
      {night ? (
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
      <span className="hidden sm:inline">{night ? "Day" : "Night"}</span>
    </button>
  );
}
