import Link from "next/link";
import { getSession } from "@/lib/supabase/server";
import { SHOP } from "@/lib/format";
import { CartLink } from "./CartLink";
import { ThemeToggle } from "./ThemeToggle";

export async function Header() {
  const { user, profile } = await getSession();
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="display text-lg sm:text-xl">
          {SHOP.name}
        </Link>
        <nav className="ml-auto flex items-center gap-1 whitespace-nowrap text-sm font-semibold sm:gap-3">
          {(profile?.is_admin || profile?.is_staff) && (
            <Link href="/admin" className="rounded px-2 py-2 hover:bg-blue-soft">
              {profile?.is_admin ? "Admin" : "Orders"}
            </Link>
          )}
          {user ? (
            <Link href="/account" className="rounded px-2 py-2 hover:bg-blue-soft">
              My account
            </Link>
          ) : (
            <Link href="/login" className="rounded px-2 py-2 hover:bg-blue-soft">
              Sign in
            </Link>
          )}
          <ThemeToggle />
          <CartLink />
        </nav>
      </div>
    </header>
  );
}
