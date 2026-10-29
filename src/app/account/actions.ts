"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { ok?: boolean; error?: string };

export async function updateProfile(_: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in again to save changes." };
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: String(formData.get("full_name") ?? "").trim().slice(0, 120),
      phone: String(formData.get("phone") ?? "").trim().slice(0, 40),
    })
    .eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/account");
  return { ok: true };
}

export async function cancelOrder(orderId: string): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_my_order", { p_order_id: orderId });
  if (error) return { error: error.message };
  revalidatePath("/account");
  revalidatePath(`/account/orders/${orderId}`);
  return { ok: true };
}
