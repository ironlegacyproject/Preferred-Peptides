"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useCart } from "@/components/CartProvider";
import { formatDate, formatMoney, formatWindow } from "@/lib/format";
import type { PickupDate } from "@/lib/types";
import { WaiverText } from "@/components/WaiverText";
import { WAIVER_TITLE, WAIVER_VERSION } from "@/lib/waiver";

export default function CartPage() {
  const cart = useCart();
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [dates, setDates] = useState<PickupDate[] | null>(null);
  const [pickupId, setPickupId] = useState("");
  const [note, setNote] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [signature, setSignature] = useState("");
  const signed = agreed && signature.trim().length >= 3;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    supabase.rpc("available_pickup_dates").then(({ data, error }) => {
      if (error) setError(`Pickup dates couldn’t load: ${error.message}`);
      setDates((data as PickupDate[]) ?? []);
    });
  }, []);

  async function submit() {
    setError("");
    if (!pickupId) {
      setError("Choose a pickup day.");
      return;
    }
    if (!signed) {
      setError("Read the Research Use Agreement, tick the box, and type your full legal name to sign it.");
      return;
    }
    setSubmitting(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("place_order", {
      p_pickup_date_id: pickupId,
      p_items: cart.lines.map((l) => ({ product_id: l.id, quantity: l.qty })),
      p_note: note,
      p_waiver_name: signature.trim(),
      p_waiver_version: WAIVER_VERSION,
    });
    if (error) {
      setError(error.message);
      setSubmitting(false);
      return;
    }
    cart.clear();
    router.push(`/account/orders/${data}?placed=1`);
    router.refresh();
  }

  if (!cart.ready) return null;

  if (cart.lines.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="display text-3xl">Your order is empty</h1>
        <p className="mt-2 text-muted">Add sizes from the price list, then come back here to choose a pickup day.</p>
        <Link href="/" className="btn btn-primary mt-6">
          Browse the price list
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[1fr_22rem]">
      <section>
        <h1 className="display text-3xl sm:text-4xl">Your order</h1>
        <ul className="mt-6 divide-y divide-line rounded-lg border border-line bg-surface">
          {cart.lines.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{l.name}</p>
                <p className="text-sm text-muted">
                  {l.size ? `${l.size}, ` : ""}
                  {formatMoney(l.price)} each
                </p>
              </div>
              <div className="flex items-center rounded-md border border-line">
                <button className="px-3 py-1.5 text-lg" onClick={() => cart.setQty(l.id, l.qty - 1)} aria-label={`One fewer ${l.name}`}>
                  −
                </button>
                <span className="w-8 text-center font-semibold tabular-nums" aria-live="polite">
                  {l.qty}
                </span>
                <button className="px-3 py-1.5 text-lg" onClick={() => cart.setQty(l.id, l.qty + 1)} aria-label={`One more ${l.name}`}>
                  +
                </button>
              </div>
              <p className="w-20 text-right font-semibold tabular-nums">{formatMoney(l.qty * l.price)}</p>
              <button className="text-sm text-muted underline hover:text-danger" onClick={() => cart.setQty(l.id, 0)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
        <Link href="/" className="mt-4 inline-block text-sm font-semibold text-blue underline">
          Add more from the price list
        </Link>
      </section>

      <aside className="h-fit rounded-lg border border-line bg-surface p-5 lg:sticky lg:top-6">
        <div className="flex items-baseline justify-between border-b border-line pb-4">
          <span className="font-semibold">Cash due at pickup</span>
          <span className="display text-2xl tabular-nums">{formatMoney(cart.total)}</span>
        </div>

        {user === null ? (
          <div className="pt-4">
            <p className="text-sm text-muted">Sign in so we know who the order is for. Your cart stays saved.</p>
            <div className="mt-4 grid gap-2">
              <Link href="/login?next=/cart" className="btn btn-primary">
                Sign in
              </Link>
              <Link href="/signup?next=/cart" className="btn btn-quiet">
                Create an account
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 pt-4">
            <fieldset>
              <legend className="label">Pickup day</legend>
              {dates === null ? (
                <p className="text-sm text-muted">Loading pickup days…</p>
              ) : dates.length === 0 ? (
                <p className="rounded-md bg-note p-3 text-sm">
                  No pickup days are open right now. Check back soon, or call the shop.
                </p>
              ) : (
                <div className="grid gap-2">
                  {dates.map((d) => (
                    <label
                      key={d.id}
                      className={`flex cursor-pointer gap-3 rounded-md border px-3 py-2 ${
                        pickupId === d.id ? "border-blue bg-blue-soft" : "border-line hover:bg-paper"
                      }`}
                    >
                      <input
                        type="radio"
                        name="pickup"
                        value={d.id}
                        checked={pickupId === d.id}
                        onChange={() => setPickupId(d.id)}
                        className="mt-1 accent-blue"
                      />
                      <span>
                        <span className="block font-semibold">{formatDate(d.pickup_date)}</span>
                        <span className="block text-sm text-muted">
                          {[formatWindow(d.start_time, d.end_time), d.note].filter(Boolean).join(". ")}
                          {d.spots_left != null && d.spots_left <= 5 && ` ${d.spots_left} left.`}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </fieldset>

            <div>
              <label htmlFor="note" className="label">
                Note for the shop <span className="font-normal text-muted">(optional)</span>
              </label>
              <textarea id="note" rows={3} maxLength={1000} className="field" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>

            <fieldset className="grid gap-3 rounded-lg border border-line p-3">
              <legend className="px-1 text-sm font-semibold">{WAIVER_TITLE}</legend>
              <div
                className="max-h-56 overflow-y-auto rounded-md bg-head p-3"
                tabIndex={0}
                role="region"
                aria-label={WAIVER_TITLE}
              >
                <WaiverText showTitle={false} />
              </div>
              <label className="flex gap-2.5 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 shrink-0 accent-blue"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                />
                <span>
                  I have read and agree to the {WAIVER_TITLE}. I confirm I am 21 or older and that these products are for
                  research use only, not for human or animal use.
                </span>
              </label>
              <div>
                <label htmlFor="signature" className="label">
                  Full legal name (your signature)
                </label>
                <input
                  id="signature"
                  className="field font-semibold"
                  autoComplete="name"
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  placeholder="First and last name"
                />
              </div>
              <p className="text-xs text-muted">
                Picking up your order confirms your acceptance of this agreement.{" "}
                <a href="/waiver" target="_blank" className="underline">
                  Open full agreement
                </a>
              </p>
            </fieldset>

            {error && (
              <p role="alert" className="rounded-md bg-danger-soft p-3 text-sm text-danger">
                {error}
              </p>
            )}

            <button className="btn btn-primary w-full" onClick={submit} disabled={submitting || !dates?.length || user === undefined || !signed}>
              {submitting ? "Sending request…" : "Sign and send order request"}
            </button>
            <p className="text-xs text-muted">Nothing is charged online. You pay cash when you pick up.</p>
          </div>
        )}
      </aside>
    </div>
  );
}
