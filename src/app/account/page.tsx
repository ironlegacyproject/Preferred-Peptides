import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/supabase/server";
import { formatDate, formatMoney } from "@/lib/format";
import type { OrderStatus } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";
import { ProfileForm } from "@/components/ProfileForm";

type Row = {
  id: string;
  order_number: number;
  status: OrderStatus;
  total: number;
  created_at: string;
  pickup_dates: { pickup_date: string } | null;
  order_items: { quantity: number; product_name: string; product_size: string | null }[];
};

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ password?: string }> }) {
  const { supabase, user, profile } = await getSession();
  if (!user) redirect("/login?next=/account");
  const { password } = await searchParams;

  const { data } = await supabase
    .from("orders")
    .select("id, order_number, status, total, created_at, pickup_dates(pickup_date), order_items(quantity, product_name, product_size)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  const orders = (data ?? []) as unknown as Row[];

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[1fr_20rem]">
      <section>
        <h1 className="display text-3xl sm:text-4xl">My orders</h1>
        {password === "updated" && <p className="mt-3 text-blue">Password updated.</p>}
        {orders.length === 0 ? (
          <div className="mt-6 rounded-lg border border-dashed border-line bg-surface p-8 text-center">
            <p>You haven’t placed an order yet.</p>
            <Link href="/" className="btn btn-primary mt-4">Browse the price list</Link>
          </div>
        ) : (
          <ul className="mt-6 grid gap-3">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`/account/orders/${o.id}`} className="block rounded-lg border border-line bg-surface p-4 hover:border-blue">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-bold">Order #{o.order_number}</span>
                    <StatusBadge status={o.status} />
                    <span className="ml-auto font-bold tabular-nums">{formatMoney(o.total)}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    Pickup {o.pickup_dates ? formatDate(o.pickup_dates.pickup_date) : "date removed"}. Placed{" "}
                    {new Date(o.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Denver" })}.
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm">
                    {o.order_items.map((i) => `${i.quantity} × ${i.product_name}${i.product_size ? ` ${i.product_size}` : ""}`).join(", ")}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <aside className="h-fit rounded-lg border border-line bg-surface p-5">
        <h2 className="mb-4 text-lg font-bold">Your details</h2>
        <ProfileForm fullName={profile?.full_name ?? ""} phone={profile?.phone ?? ""} email={user.email ?? ""} />
        <div className="mt-5 flex flex-wrap gap-3 border-t border-line pt-4 text-sm">
          <Link href="/account/password" className="underline">Change password</Link>
          <form action="/auth/signout" method="post">
            <button className="underline">Sign out</button>
          </form>
        </div>
      </aside>
    </div>
  );
}
