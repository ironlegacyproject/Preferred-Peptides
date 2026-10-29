import { requireAdmin } from "@/lib/supabase/server";
import { StaffManager } from "./StaffManager";

export default async function StaffPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone")
    .eq("is_staff", true)
    .order("full_name");

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <section>
        <h1 className="display text-3xl sm:text-4xl">Office staff</h1>
        <p className="mt-2 max-w-xl text-muted">
          Staff sign in like customers and see an Orders link in the header. They can view orders and mark them ready,
          picked up, or not picked up. They can’t see inventory, products, pickup days, private notes, or this page.
        </p>
        <StaffManager staff={data ?? []} />
      </section>
      <aside className="h-fit rounded-lg border border-line bg-surface p-5 text-sm">
        <h2 className="mb-2 text-base font-bold">Adding someone</h2>
        <ol className="grid list-decimal gap-1.5 pl-5 text-muted">
          <li>Have them create an account on the site with their work email.</li>
          <li>Enter that email here and choose Give staff access.</li>
          <li>They sign out and back in to see the Orders link.</li>
        </ol>
      </aside>
    </div>
  );
}
