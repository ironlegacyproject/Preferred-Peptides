import { requireAdmin } from "@/lib/supabase/server";
import { shopToday } from "@/lib/format";
import { AddPickupDayForm, PickupDayRow, type AdminPickupDay } from "./PickupDayParts";

export default async function PickupDaysPage() {
  const { supabase } = await requireAdmin();
  const today = shopToday();
  const { data } = await supabase
    .from("pickup_dates")
    .select("id, pickup_date, start_time, end_time, note, max_orders, is_open, orders(status)")
    .order("pickup_date");

  const days = ((data ?? []) as unknown as (AdminPickupDay & { orders: { status: string }[] })[]).map((d) => ({
    ...d,
    order_count: d.orders.filter((o) => o.status !== "cancelled").length,
  }));
  const upcoming = days.filter((d) => d.pickup_date >= today);
  const past = days.filter((d) => d.pickup_date < today).reverse().slice(0, 20);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <section>
        <h1 className="display text-3xl sm:text-4xl">Pickup days</h1>
        <p className="mt-2 text-muted">Customers can choose any open day from today on. Close a day to stop new orders for it.</p>
        {upcoming.length === 0 ? (
          <p className="mt-6 rounded-lg border border-dashed border-line bg-surface p-8 text-center">
            No upcoming pickup days. Add one so customers can place orders.
          </p>
        ) : (
          <ul className="mt-6 grid gap-2">
            {upcoming.map((d) => (
              <PickupDayRow key={d.id} day={d} />
            ))}
          </ul>
        )}
        {past.length > 0 && (
          <details className="mt-8">
            <summary className="cursor-pointer font-semibold">Past days</summary>
            <ul className="mt-3 grid gap-2 opacity-75">
              {past.map((d) => (
                <PickupDayRow key={d.id} day={d} past />
              ))}
            </ul>
          </details>
        )}
      </section>
      <aside className="h-fit rounded-lg border border-line bg-surface p-5">
        <h2 className="mb-4 text-lg font-bold">Add a pickup day</h2>
        <AddPickupDayForm minDate={today} />
      </aside>
    </div>
  );
}
