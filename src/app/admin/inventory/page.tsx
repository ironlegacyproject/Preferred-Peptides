import { requireAdmin } from "@/lib/supabase/server";
import { InventoryManager, type InvRow, type Move } from "./InventoryManager";

export default async function InventoryPage() {
  const { supabase } = await requireAdmin();
  const [{ data, error }, { data: moves }] = await Promise.all([
    supabase.rpc("inventory_overview"),
    supabase
      .from("inventory_moves")
      .select("id, change, on_hand_after, reason, note, created_at, order_id, products(name, size), orders(order_number)")
      .order("id", { ascending: false })
      .limit(30),
  ]);
  if (error) return <p className="text-danger">Inventory couldn’t load: {error.message}</p>;
  return <InventoryManager rows={(data ?? []) as InvRow[]} moves={(moves ?? []) as unknown as Move[]} />;
}
