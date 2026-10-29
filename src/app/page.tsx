import { createClient } from "@/lib/supabase/server";
import { Catalog } from "@/components/Catalog";
import type { Product } from "@/lib/types";
import { SHOP } from "@/lib/format";

export default async function HomePage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, size, price, category, subcategory, description, is_active, sort_order")
    .eq("is_active", true)
    .order("sort_order")
    .order("name");

  return (
    <div className="mx-auto max-w-6xl px-4 pb-28">
      <section className="grid justify-items-center gap-3.5 pt-8 pb-7 text-center">
        <h1 className="sr-only">{SHOP.name} price list</h1>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-day.webp" alt={SHOP.name} width={720} height={370} className="logo-day h-auto w-full max-w-[19rem]" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-night.webp" alt={SHOP.name} width={720} height={370} className="logo-night h-auto w-full max-w-[19rem]" />
        <p className="max-w-[34rem] text-[1.05rem] text-muted">
          Request online, pay cash when you pick up.
        </p>
      </section>

      {error ? (
        <p className="rounded-md border border-danger bg-surface p-4 text-danger">
          The price list couldn’t load: {error.message}. Check the Supabase settings in your environment variables.
        </p>
      ) : (
        <Catalog products={(data ?? []) as Product[]} />
      )}
    </div>
  );
}
