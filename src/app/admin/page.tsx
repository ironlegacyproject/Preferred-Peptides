import Link from "next/link";
import { getSession } from "@/lib/supabase/server";
import { formatDate, formatMoney, formatWindow, shopToday } from "@/lib/format";
import { STATUS_LABEL, type OrderItem, type OrderStatus } from "@/lib/types";
import { OrderRow, type AdminOrder } from "./OrderRow";
import { PickList } from "./PickList";
import { SHOP_STATUS_LABEL } from "@/components/StatusBadge";

type Search = { when?: string; status?: string; q?: string };

const STATUS_FILTERS: { value: string; label: string; statuses: OrderStatus[] | null }[] = [
  { value: "open", label: "To fill", statuses: ["pending", "ready"] },
  { value: "pending", label: STATUS_LABEL.pending, statuses: ["pending"] },
  { value: "ready", label: SHOP_STATUS_LABEL.ready, statuses: ["ready"] },
  { value: "picked_up", label: STATUS_LABEL.picked_up, statuses: ["picked_up"] },
  { value: "no_show", label: STATUS_LABEL.no_show, statuses: ["no_show"] },
  { value: "cancelled", label: STATUS_LABEL.cancelled, statuses: ["cancelled"] },
  { value: "all", label: "All", statuses: null },
];

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const { supabase, profile } = await getSession();
  const isAdmin = !!profile?.is_admin;
  // Staff only work today's and upcoming pickup days.
  const when = isAdmin ? (sp.when ?? "upcoming") : "upcoming";
  const statusFilter = STATUS_FILTERS.find((s) => s.value === sp.status) ?? STATUS_FILTERS[0];
  const q = (sp.q ?? "").trim().toLowerCase();
  const today = shopToday();

  let query = supabase
    .from("orders")
    .select(
      `id, order_number, status, total, customer_note, created_at, pickup_date_id, waiver_signed_name, waiver_version, waiver_accepted_at, picked_up_at, staged_location, staged_at, ${isAdmin ? "order_admin_notes(note), profiles:profiles!orders_user_id_fkey(full_name, phone, email)" : "profiles:profiles!orders_user_id_fkey(full_name)"}, staged_by_profile:profiles!orders_staged_by_fkey(full_name), picked_up_by_profile:profiles!orders_picked_up_by_fkey(full_name), pickup_dates!inner(id, pickup_date, start_time, end_time), order_items(id, product_name, product_size, unit_price, quantity, line_total)`,
    )
    .order("created_at", { ascending: true })
    .limit(1000);
  if (when === "upcoming") query = query.gte("pickup_dates.pickup_date", today);
  if (when === "past") query = query.lt("pickup_dates.pickup_date", today);
  if (statusFilter.statuses) query = query.in("status", statusFilter.statuses);

  const [{ data, error }, { data: allDays }] = await Promise.all([
    query,
    supabase.from("pickup_dates").select("id, pickup_date").gte("pickup_date", today).order("pickup_date"),
  ]);

  let orders = (data ?? []) as unknown as (AdminOrder & {
    pickup_dates: { id: string; pickup_date: string; start_time: string | null; end_time: string | null };
  })[];
  if (q) {
    orders = orders.filter(
      (o) =>
        String(o.order_number).includes(q) ||
        o.profiles?.full_name.toLowerCase().includes(q) ||
        o.profiles?.phone?.toLowerCase().includes(q) ||
        o.profiles?.email?.toLowerCase().includes(q),
    );
  }

  // Group by pickup day, soonest first (past view: most recent first).
  const days = new Map<string, { day: (typeof orders)[number]["pickup_dates"]; orders: typeof orders }>();
  for (const o of orders) {
    const k = o.pickup_dates.id;
    if (!days.has(k)) days.set(k, { day: o.pickup_dates, orders: [] });
    days.get(k)!.orders.push(o);
  }
  const groups = [...days.values()].sort((a, b) =>
    when === "past" ? b.day.pickup_date.localeCompare(a.day.pickup_date) : a.day.pickup_date.localeCompare(b.day.pickup_date),
  );

  const link = (patch: Partial<Search>) => {
    const p = new URLSearchParams({ when, status: statusFilter.value, ...(q ? { q } : {}), ...patch } as Record<string, string>);
    return `/admin?${p}`;
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="display text-3xl sm:text-4xl">Orders</h1>
        <form className="flex gap-2" action="/admin">
          <input type="hidden" name="when" value={when} />
          <input type="hidden" name="status" value={statusFilter.value} />
          <input name="q" defaultValue={sp.q} placeholder={isAdmin ? "Name, phone, email or order #" : "Name or order #"} className="field !w-64" aria-label="Search orders" />
          <button className="btn btn-quiet">Search</button>
        </form>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {isAdmin && (
        <div className="flex gap-1" aria-label="Pickup days">
          {[
            ["upcoming", "Upcoming"],
            ["past", "Past"],
            ["all", "All days"],
          ].map(([v, l]) => (
            <Link key={v} href={link({ when: v })} className={`rounded-full border px-3 py-1 font-semibold ${when === v ? "border-blue bg-blue text-on-blue" : "border-line bg-surface"}`}>
              {l}
            </Link>
          ))}
        </div>
        )}
        <div className="flex flex-wrap gap-1" aria-label="Status">
          {STATUS_FILTERS.map((s) => (
            <Link key={s.value} href={link({ status: s.value })} className={`rounded-full border px-3 py-1 font-semibold ${statusFilter.value === s.value ? "border-ink bg-ink text-surface" : "border-line bg-surface"}`}>
              {s.label}
            </Link>
          ))}
        </div>
      </div>

      {error && <p className="mt-6 text-danger">Orders couldn’t load: {error.message}</p>}

      {!error && groups.length === 0 && (
        <p className="mt-10 rounded-lg border border-dashed border-line bg-surface p-8 text-center text-muted">
          No orders match these filters.
        </p>
      )}

      {groups.map(({ day, orders: list }) => {
        const counted = list.filter((o) => o.status !== "cancelled" && o.status !== "no_show");
        const cash = counted.reduce((n, o) => n + Number(o.total), 0);
        const pick = new Map<string, number>();
        for (const o of counted)
          for (const i of o.order_items as OrderItem[]) {
            const k = `${i.product_name}${i.product_size ? ` ${i.product_size}` : ""}`;
            pick.set(k, (pick.get(k) ?? 0) + i.quantity);
          }
        return (
          <section key={day.id} className="mt-8">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b-2 border-ink pb-2">
              <h2 className="display text-2xl">{formatDate(day.pickup_date)}</h2>
              <span className="text-muted">{formatWindow(day.start_time, day.end_time)}</span>
              <span className="ml-auto text-sm font-semibold">
                {list.length} {list.length === 1 ? "order" : "orders"}, {formatMoney(cash)} expected cash
              </span>
            </div>
            {pick.size > 0 && <PickList dayId={day.id} items={[...pick.entries()].sort()} />}
            <ul className="mt-3 grid gap-3">
              {list.map((o) => (
                <OrderRow key={o.id} order={o} days={allDays ?? []} isAdmin={isAdmin} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
