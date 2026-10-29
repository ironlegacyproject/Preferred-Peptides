import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/supabase/server";
import { AdminNav } from "./AdminNav";

// Admin and office staff both use this area. Staff only see Orders.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, profile } = await getSession();
  if (!user) redirect("/login?next=/admin");
  if (!profile?.is_admin && !profile?.is_staff) notFound();

  let reorderCount = 0;
  if (profile.is_admin) {
    const { data } = await supabase.rpc("inventory_overview");
    reorderCount = ((data ?? []) as { needs_reorder: boolean; is_active: boolean }[]).filter(
      (r) => r.needs_reorder && r.is_active,
    ).length;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <AdminNav isAdmin={!!profile.is_admin} reorderCount={reorderCount} />
      {children}
    </div>
  );
}
