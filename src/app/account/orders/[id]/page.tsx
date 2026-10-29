import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/supabase/server";
import { formatDate, formatMoney, formatWindow } from "@/lib/format";
import { PICKUP_ADDRESS, pickupMapUrl } from "@/lib/pickup";
import type { OrderItem, OrderStatus } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";
import { CancelOrderButton } from "@/components/CancelOrderButton";

type Order = {
  id: string;
  order_number: number;
  status: OrderStatus;
  total: number;
  customer_note: string | null;
  created_at: string;
  waiver_signed_name: string;
  waiver_version: string;
  waiver_accepted_at: string;
  picked_up_at: string | null;
  pickup_dates: { pickup_date: string; start_time: string | null; end_time: string | null; note: string | null } | null;
  order_items: OrderItem[];
};

const stamp = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Denver" });

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ placed?: string }>;
}) {
  const { id } = await params;
  const { placed } = await searchParams;
  const { supabase, user } = await getSession();
  if (!user) redirect(`/login?next=/account/orders/${id}`);

  const { data } = await supabase
    .from("orders")
    .select("id, order_number, status, total, customer_note, created_at, waiver_signed_name, waiver_version, waiver_accepted_at, picked_up_at, pickup_dates(pickup_date, start_time, end_time, note), order_items(id, product_name, product_size, unit_price, quantity, line_total)")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) notFound();
  const order = data as unknown as Order;
  const pd = order.pickup_dates;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/account" className="text-sm font-semibold text-blue underline">All my orders</Link>

      {placed && (
        <div role="status" className="mt-4 rounded-lg border border-blue bg-blue-soft p-4">
          <p className="font-bold">Order request sent.</p>
          <p className="text-sm">Bring {formatMoney(order.total)} in cash to {PICKUP_ADDRESS} on your pickup day. You can check its status here any time.</p>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <h1 className="display text-3xl sm:text-4xl">Order #{order.order_number}</h1>
        <StatusBadge status={order.status} />
      </div>

      <div className="mt-6 rounded-lg border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold text-muted">Pickup</h2>
        {pd ? (
          <>
            <p className="display mt-1 text-2xl">{formatDate(pd.pickup_date)}</p>
            <p className="text-muted">{[formatWindow(pd.start_time, pd.end_time), pd.note].filter(Boolean).join(". ")}</p>
          </>
        ) : (
          <p>The shop will contact you about a pickup day.</p>
        )}
        {order.status !== "cancelled" && (
          <div className="mt-4 border-t border-line pt-4">
            <h3 className="text-sm font-semibold text-muted">Pickup address</h3>
            <p className="mt-1 text-lg font-semibold">{PICKUP_ADDRESS}</p>
            <a href={pickupMapUrl()} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-blue underline">
              Open in Maps
            </a>
          </div>
        )}
      </div>

      <table className="mt-6 w-full overflow-hidden rounded-lg border border-line bg-surface text-left">
        <thead className="bg-head text-sm text-muted">
          <tr>
            <th className="px-4 py-2 font-semibold">Item</th>
            <th className="px-4 py-2 text-right font-semibold">Qty</th>
            <th className="px-4 py-2 text-right font-semibold">Price</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {order.order_items.map((i) => (
            <tr key={i.id}>
              <td className="px-4 py-2">
                {i.product_name}
                {i.product_size && <span className="text-muted"> {i.product_size}</span>}
              </td>
              <td className="px-4 py-2 text-right tabular-nums">{i.quantity}</td>
              <td className="px-4 py-2 text-right tabular-nums">{formatMoney(i.line_total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-line">
            <td className="px-4 py-3 font-bold" colSpan={2}>Cash due at pickup</td>
            <td className="px-4 py-3 text-right font-bold tabular-nums">{formatMoney(order.total)}</td>
          </tr>
        </tfoot>
      </table>

      {order.customer_note && (
        <p className="mt-4 text-sm"><span className="font-semibold">Your note:</span> {order.customer_note}</p>
      )}

      <div className="mt-6 rounded-lg border border-line bg-surface p-4 text-sm">
        <p className="font-semibold">
          <Link href="/waiver" className="underline">
            Research Use Agreement
          </Link>
        </p>
        <p className="mt-1 text-muted">
          Signed as <span className="font-semibold text-ink">{order.waiver_signed_name}</span> on{" "}
          {stamp(order.waiver_accepted_at)} (version {order.waiver_version}).
          {order.picked_up_at && <> Accepted at pickup on {stamp(order.picked_up_at)}.</>}
        </p>
      </div>

      {order.status === "pending" && (
        <div className="mt-6">
          <CancelOrderButton orderId={order.id} />
        </div>
      )}
    </div>
  );
}
