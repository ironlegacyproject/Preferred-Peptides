export type Product = {
  id: string;
  name: string;
  size: string | null;
  price: number;
  category: string;
  subcategory: string | null;
  description: string | null;
  is_active: boolean;
  sort_order: number;
};

export type PickupDate = {
  id: string;
  pickup_date: string; // YYYY-MM-DD
  start_time: string | null;
  end_time: string | null;
  note: string | null;
  spots_left?: number | null;
};

export type OrderStatus = "pending" | "ready" | "picked_up" | "cancelled" | "no_show";

export type OrderItem = {
  id: string;
  product_name: string;
  product_size: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
};

export const CATEGORY_ORDER = [
  "Peptides",
  "Drops",
  "Sprays",
  "Buccal strips",
  "Skin & hair care",
  "Raw materials",
  "Supplies",
];

/** Sections shown inside a category tab (mainly Peptides), in this order. New groups appear after these. */
export const GROUP_ORDER = [
  "Repair-research peptides",
  "Copper peptides",
  "Growth hormone secretagogues",
  "Growth factors",
  "Bioregulator peptides",
  "Neuropeptides",
  "Metabolic & mitochondrial compounds",
  "Immune & signaling peptides",
  "Melanocortin peptides",
  "Cosmetic peptides",
  "Vitamins, cofactors & blends",
  "Other",
];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Requested",
  ready: "Ready for pickup",
  picked_up: "Picked up",
  cancelled: "Cancelled",
  no_show: "Not picked up",
};
