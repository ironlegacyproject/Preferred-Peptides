import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_KEY, SUPABASE_URL } from "./config";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component; the proxy refreshes the session instead.
        }
      },
    },
  });
}

/** Returns the signed-in user and their profile, or nulls. */
export async function getSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, phone, is_admin, is_staff")
    .eq("id", user.id)
    .single();
  return { supabase, user, profile };
}

/** For admin-only pages: returns the session or a 404 for everyone else. */
export async function requireAdmin() {
  const session = await getSession();
  if (!session.profile?.is_admin) {
    const { notFound } = await import("next/navigation");
    notFound();
  }
  return session;
}
