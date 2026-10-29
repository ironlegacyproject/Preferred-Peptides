"use client";

import Link from "next/link";
import { useCart } from "./CartProvider";

export function CartLink() {
  const { count, ready } = useCart();
  return (
    <Link href="/cart" className="btn btn-primary !py-2" aria-label={`Order request, ${count} items`}>
      Order
      <span className="min-w-6 rounded-full bg-surface px-1.5 text-center text-sm font-bold text-blue tabular-nums">
        {ready ? count : 0}
      </span>
    </Link>
  );
}
