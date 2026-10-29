const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const cents = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
/** $35 for whole dollars, $35.50 otherwise. */
export const formatMoney = (n: number | string) => {
  const v = Number(n);
  return Number.isInteger(v) ? dollars.format(v) : cents.format(v);
};

/** "2026-11-04" → "Wednesday, Nov 4" (parsed as a plain calendar date, no timezone shift). */
export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "long", month: "short", day: "numeric" }) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
}

/** "14:30:00" → "2:30 PM" */
export function formatTime(t: string | null) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function formatWindow(start: string | null, end: string | null) {
  if (start && end) return `${formatTime(start)} to ${formatTime(end)}`;
  if (start) return `from ${formatTime(start)}`;
  if (end) return `until ${formatTime(end)}`;
  return "";
}

export const SHOP = {
  name: process.env.NEXT_PUBLIC_SHOP_NAME || "Preferred Peptides",
  phone: process.env.NEXT_PUBLIC_SHOP_PHONE || "",
};

/** Today's date at the shop, as YYYY-MM-DD. */
export function shopToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver" }).format(new Date());
}
