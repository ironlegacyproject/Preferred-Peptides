import Link from "next/link";
import { getSession } from "@/lib/supabase/server";
import { CartLink } from "./CartLink";
import { ThemeToggle } from "./ThemeToggle";

export async function Header() {
  const { user, profile } = await getSession();
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-sm font-semibold hover:bg-blue-soft"
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 10.5 12 3l9 7.5" />
            <path d="M5 9.5V21h14V9.5" />
            <path d="M10 21v-6h4v6" />
          </svg>
          Home
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
