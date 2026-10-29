import { STATUS_LABEL, type OrderStatus } from "@/lib/types";

const STYLE: Record<OrderStatus, string> = {
  pending: "bg-surface text-blue border-blue",
  ready: "bg-blue text-on-blue border-blue",
  picked_up: "bg-blue-soft text-blue border-blue-soft",
  cancelled: "bg-paper text-muted border-line line-through",
  no_show: "bg-danger-soft text-danger border-danger",
};

/** Customers see "Ready for pickup"; the shop side calls the same step "Staged". */
export const SHOP_STATUS_LABEL: Record<OrderStatus, string> = { ...STATUS_LABEL, ready: "Staged" };

export function StatusBadge({ status, shop = false }: { status: OrderStatus; shop?: boolean }) {
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-bold ${STYLE[status]}`}>
      {(shop ? SHOP_STATUS_LABEL : STATUS_LABEL)[status]}
    </span>
  );
}
