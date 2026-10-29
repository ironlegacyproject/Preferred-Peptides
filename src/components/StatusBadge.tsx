import { STATUS_LABEL, type OrderStatus } from "@/lib/types";

const STYLE: Record<OrderStatus, string> = {
  pending: "bg-surface text-blue border-blue",
  ready: "bg-blue text-on-blue border-blue",
  picked_up: "bg-blue-soft text-blue border-blue-soft",
  cancelled: "bg-paper text-muted border-line line-through",
  no_show: "bg-danger-soft text-danger border-danger",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-bold ${STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}
