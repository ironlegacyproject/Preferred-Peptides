"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminNav({ isAdmin, reorderCount }: { isAdmin: boolean; reorderCount: number }) {
  const path = usePathname();
  const links = isAdmin
    ? [
        { href: "/admin", label: "Orders" },
        { href: "/admin/inventory", label: "Inventory", badge: reorderCount },
        { href: "/admin/pickup-days", label: "Pickup days" },
        { href: "/admin/products", label: "Products" },
        { href: "/admin/staff", label: "Staff" },
      ]
    : [{ href: "/admin", label: "Orders" }];

  return (
    <nav className="mb-8 flex gap-1 overflow-x-auto border-b border-line" aria-label="Admin">
      {links.map((l) => {
        const active = l.href === "/admin" ? path === "/admin" : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 font-semibold ${
              active ? "border-blue text-blue" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {l.label}
            {!!l.badge && (
              <span
                className="rounded-full bg-danger px-1.5 text-xs font-bold text-surface tabular-nums"
                title={`${l.badge} ${l.badge === 1 ? "product needs" : "products need"} reordering`}
              >
                {l.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
