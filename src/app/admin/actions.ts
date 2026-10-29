"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/lib/types";

export type AdminResult = { ok?: boolean; error?: string };

async function staffClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_staff");
  if (error || !data) throw new Error("Shop staff only.");
  return supabase;
}

async function adminClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_admin");
  if (error || !data) throw new Error("Admins only.");
  return supabase;
}

function fail(e: unknown): AdminResult {
  return { error: e instanceof Error ? e.message : String(e) };
}

const STATUSES: OrderStatus[] = ["pending", "ready", "picked_up", "cancelled", "no_show"];

// ---------- Orders ----------
export async function setOrderStatus(orderId: string, status: OrderStatus, location?: string): Promise<AdminResult> {
  try {
    if (!STATUSES.includes(status)) throw new Error("Unknown status.");
    const supabase = await staffClient();
    const { error } = await supabase.rpc("set_order_status", {
      p_order_id: orderId,
      p_status: status,
      p_location: location ?? null,
    });
    if (error) throw error;
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function setOrderAdminNote(orderId: string, note: string): Promise<AdminResult> {
  try {
    const supabase = await adminClient();
    const text = note.trim().slice(0, 2000);
    const { error } = text
      ? await supabase.from("order_admin_notes").upsert({ order_id: orderId, note: text, updated_at: new Date().toISOString() })
      : await supabase.from("order_admin_notes").delete().eq("order_id", orderId);
    if (error) throw error;
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function moveOrderPickup(orderId: string, pickupDateId: string): Promise<AdminResult> {
  try {
    const supabase = await adminClient();
    const { error } = await supabase.from("orders").update({ pickup_date_id: pickupDateId }).eq("id", orderId);
    if (error) throw error;
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------- Pickup days ----------
export async function addPickupDay(_: AdminResult, formData: FormData): Promise<AdminResult> {
  try {
    const supabase = await adminClient();
    const date = String(formData.get("pickup_date") ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Choose a date.");
    const max = String(formData.get("max_orders") ?? "").trim();
    const { error } = await supabase.from("pickup_dates").insert({
      pickup_date: date,
      start_time: String(formData.get("start_time") ?? "") || null,
      end_time: String(formData.get("end_time") ?? "") || null,
      note: String(formData.get("note") ?? "").trim() || null,
      max_orders: max ? Math.max(1, parseInt(max, 10)) : null,
    });
    if (error) throw new Error(error.code === "23505" ? "That date is already on the list." : error.message);
    revalidatePath("/admin/pickup-days");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function setPickupDayOpen(id: string, isOpen: boolean): Promise<AdminResult> {
  try {
    const supabase = await adminClient();
    const { error } = await supabase.from("pickup_dates").update({ is_open: isOpen }).eq("id", id);
    if (error) throw error;
    revalidatePath("/admin/pickup-days");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deletePickupDay(id: string): Promise<AdminResult> {
  try {
    const supabase = await adminClient();
    const { count } = await supabase.from("orders").select("id", { count: "exact", head: true }).eq("pickup_date_id", id);
    if (count) throw new Error("This day has orders. Close it instead, or move its orders first.");
    const { error } = await supabase.from("pickup_dates").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/admin/pickup-days");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------- Products ----------
export type ProductInput = {
  name: string;
  size: string;
  price: string;
  category: string;
  subcategory: string;
  description: string;
  is_active: boolean;
  /** Copy the group and description to every other size with the same name. */
  applyToAllSizes: boolean;
};

function cleanProduct(p: ProductInput) {
  const name = p.name.trim();
  const price = Number(p.price);
  if (!name) throw new Error("Enter a product name.");
  if (!Number.isFinite(price) || price < 0) throw new Error("Enter a price of 0 or more.");
  return {
    name: name.slice(0, 120),
    size: p.size.trim().slice(0, 40) || null,
    price: Math.round(price * 100) / 100,
    category: p.category.trim().slice(0, 60) || "Peptides",
    subcategory: p.subcategory.trim().slice(0, 60) || null,
    description: p.description.trim().slice(0, 1000) || null,
    is_active: p.is_active,
  };
}

export async function saveProduct(id: string | null, input: ProductInput): Promise<AdminResult> {
  try {
    const supabase = await adminClient();
    const row = cleanProduct(input);
    if (id) {
      const { error } = await supabase.from("products").update(row).eq("id", id);
      if (error) throw error;
    } else {
      // New products go to the end of their category.
      const { data: last } = await supabase
        .from("products")
        .select("sort_order")
        .eq("category", row.category)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      const { error } = await supabase.from("products").insert({ ...row, sort_order: (last?.sort_order ?? 0) + 1 });
      if (error) throw error;
    }
    if (input.applyToAllSizes) {
      const { error } = await supabase
        .from("products")
        .update({ subcategory: row.subcategory, description: row.description })
        .eq("name", row.name)
        .eq("category", row.category);
      if (error) throw error;
    }
    revalidatePath("/admin/products");
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteProduct(id: string): Promise<AdminResult> {
  try {
    const supabase = await adminClient();
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/admin/products");
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------- Staff ----------
export async function setStaff(email: string, isStaff: boolean): Promise<AdminResult> {
  try {
    const supabase = await adminClient();
    if (!email.trim()) throw new Error("Enter the email they signed up with.");
    const { error } = await supabase.rpc("set_staff", { p_email: email, p_is_staff: isStaff });
    if (error) throw new Error(error.message);
    revalidatePath("/admin/staff");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------- Inventory ----------
export async function setCount(productId: string, count: number, note: string): Promise<AdminResult> {
  try {
    const supabase = await adminClient();
    const { error } = await supabase.rpc("inventory_set_count", { p_product: productId, p_count: count, p_note: note });
    if (error) throw new Error(error.message);
    revalidatePath("/admin", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function receiveStock(productId: string, qty: number, note: string): Promise<AdminResult> {
  try {
    const supabase = await adminClient();
    const { error } = await supabase.rpc("inventory_receive", { p_product: productId, p_qty: qty, p_note: note });
    if (error) throw new Error(error.message);
    revalidatePath("/admin", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function setLevels(productId: string, reorderPoint: number, reorderQty: number): Promise<AdminResult> {
  try {
    const supabase = await adminClient();
    const { error } = await supabase.rpc("inventory_set_levels", {
      p_product: productId,
      p_reorder_point: reorderPoint,
      p_reorder_qty: reorderQty,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/admin", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
