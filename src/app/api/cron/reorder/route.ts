import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { SHOP } from "@/lib/format";

/**
 * Daily reorder reminder. Vercel Cron calls this once a day (see vercel.json).
 * It emails a list of products whose available stock is at or below their
 * reorder point. Nothing is sent when nothing needs reordering.
 *
 * Needs these server-only environment variables:
 *   SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET, RESEND_API_KEY, REORDER_EMAIL_TO, REORDER_EMAIL_FROM
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set." }, { status: 500 });
  }
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  const [products, inventory, open] = await Promise.all([
    db.from("products").select("id, name, size, sort_order").eq("is_active", true),
    db.from("inventory").select("product_id, on_hand, reorder_point, reorder_qty"),
    db.from("order_items").select("product_id, quantity, orders!inner(status)").in("orders.status", ["pending", "ready"]),
  ]);
  const err = products.error || inventory.error || open.error;
  if (err) return NextResponse.json({ error: err.message }, { status: 500 });

  const committed = new Map<string, number>();
  for (const i of open.data ?? []) {
    if (i.product_id) committed.set(i.product_id, (committed.get(i.product_id) ?? 0) + i.quantity);
  }
  const inv = new Map((inventory.data ?? []).map((r) => [r.product_id, r]));

  const low = (products.data ?? [])
    .map((p) => {
      const r = inv.get(p.id);
      const onHand = r?.on_hand ?? 0;
      const point = r?.reorder_point ?? 0;
      const available = onHand - (committed.get(p.id) ?? 0);
      const orderQty = r?.reorder_qty || Math.max(point * 2 - available, 1);
      return { ...p, onHand, point, available, orderQty };
    })
    .filter((p) => p.point > 0 && p.available <= p.point)
    .sort((a, b) => a.sort_order - b.sort_order);

  if (low.length === 0) return NextResponse.json({ sent: false, lowStock: 0 });

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.REORDER_EMAIL_TO;
  const from = process.env.REORDER_EMAIL_FROM;
  if (!apiKey || !to || !from) {
    return NextResponse.json({ sent: false, lowStock: low.length, note: "Email settings are not configured." });
  }

  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const rows = low
    .map(
      (p) =>
        `<tr><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${esc(p.name)} ${esc(p.size ?? "")}</td>` +
        `<td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right">${p.available}</td>` +
        `<td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right">${p.point}</td>` +
        `<td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right"><b>${p.orderQty}</b></td></tr>`,
    )
    .join("");
  const html = `<div style="font-family:Arial,sans-serif;color:#172033">
    <h2 style="margin:0 0 8px">${low.length} ${low.length === 1 ? "product needs" : "products need"} reordering</h2>
    <p style="margin:0 0 16px;color:#5d6779">Available stock is at or below the reorder point you set.</p>
    <table style="border-collapse:collapse;font-size:14px">
      <tr style="background:#f6f8fa"><th style="padding:6px 10px;text-align:left">Product</th><th style="padding:6px 10px">Available</th><th style="padding:6px 10px">Reorder at</th><th style="padding:6px 10px">Order qty</th></tr>
      ${rows}
    </table></div>`;
  const text = low.map((p) => `${p.name} ${p.size ?? ""}: ${p.available} available, reorder at ${p.point}, order ${p.orderQty}`).join("\n");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: to.split(",").map((s) => s.trim()),
      subject: `${SHOP.name}: ${low.length} ${low.length === 1 ? "product" : "products"} to reorder`,
      html,
      text,
    }),
  });
  if (!res.ok) return NextResponse.json({ sent: false, error: await res.text() }, { status: 502 });
  return NextResponse.json({ sent: true, lowStock: low.length });
}
