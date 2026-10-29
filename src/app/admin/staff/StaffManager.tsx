"use client";

import { useState, useTransition } from "react";
import { setStaff } from "../actions";

type Staff = { id: string; full_name: string; email: string | null; phone: string };

export function StaffManager({ staff }: { staff: Staff[] }) {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [confirming, setConfirming] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (target: string, on: boolean, done: string) =>
    start(async () => {
      setMsg({});
      const r = await setStaff(target, on);
      if (r.error) setMsg({ error: r.error });
      else {
        setMsg({ ok: done });
        setEmail("");
        setConfirming(null);
      }
    });

  return (
    <div className="mt-6 grid gap-6">
      <form
        className="flex flex-wrap items-end gap-2 rounded-lg border border-line bg-surface p-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(email, true, `${email.trim()} now has staff access.`);
        }}
      >
        <div className="min-w-0 flex-1">
          <label className="label" htmlFor="staff-email">Email</label>
          <input id="staff-email" type="email" required className="field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="staff@example.com" />
        </div>
        <button className="btn btn-primary" disabled={pending}>
          Give staff access
        </button>
      </form>

      {msg.error && <p role="alert" className="text-sm text-danger">{msg.error}</p>}
      {msg.ok && <p role="status" className="text-sm text-blue">{msg.ok}</p>}

      {staff.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line bg-surface p-8 text-center text-muted">
          No staff accounts yet. Add one with the form above.
        </p>
      ) : (
        <ul className="grid gap-2">
          {staff.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-line bg-surface p-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{s.full_name || "No name"}</p>
                <p className="text-sm text-muted">
                  {s.email}
                  {s.phone ? `, ${s.phone}` : ""}
                </p>
              </div>
              {confirming === s.id ? (
                <span className="flex flex-wrap items-center gap-2 text-sm">
                  Remove staff access?
                  <button className="btn btn-quiet !py-1 text-sm !text-danger" disabled={pending} onClick={() => run(s.email ?? "", false, `Removed staff access for ${s.email}.`)}>
                    Remove
                  </button>
                  <button className="btn btn-quiet !py-1 text-sm" onClick={() => setConfirming(null)}>
                    Keep
                  </button>
                </span>
              ) : (
                <button className="text-sm text-muted underline hover:text-danger" onClick={() => setConfirming(s.id)}>
                  Remove access
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
