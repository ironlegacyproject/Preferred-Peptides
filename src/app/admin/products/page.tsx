import { requireAdmin } from "@/lib/supabase/server";
import type { Product } from "@/lib/types";
import { ProductManager } from "./ProductManager";

export default async function AdminProductsPage() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, size, price, category, subcategory, description, is_active, sort_order")
    .order("sort_order")
    .order("name");
  if (error) return <p className="text-danger">Products couldn’t load: {error.message}</p>;
  return <ProductManager products={(data ?? []) as Product[]} />;
}
