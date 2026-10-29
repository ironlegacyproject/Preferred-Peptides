"use client";

import { useState, useTransition } from "react";
import { cancelOrder } from "@/app/account/actions";

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <div>
      <button
        className="btn btn-quiet !text-danger"
        disabled={pending}
        onClick={() => {
          if (!confirm("Cancel this order request?")) return;
          start(async () => {
            const res = await cancelOrder(orderId);
            if (res.error) setError(res.error);
          });
        }}
      >
        {pending ? "Cancelling…" : "Cancel order"}
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
