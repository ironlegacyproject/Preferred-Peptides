"use client";

import { useActionState } from "react";
import { updateProfile, type ActionState } from "@/app/account/actions";

export function ProfileForm({ fullName, phone, email }: { fullName: string; phone: string; email: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updateProfile, {});
  return (
    <form action={action} className="grid gap-3">
      <div>
        <label className="label" htmlFor="full_name">Full name</label>
        <input id="full_name" name="full_name" defaultValue={fullName} required className="field" />
      </div>
      <div>
        <label className="label" htmlFor="phone">Phone</label>
        <input id="phone" name="phone" type="tel" defaultValue={phone} className="field" />
      </div>
      <p className="text-sm text-muted">Signed in as {email}</p>
      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      {state.ok && <p role="status" className="text-sm text-blue">Details saved.</p>}
      <button className="btn btn-quiet" disabled={pending}>{pending ? "Saving…" : "Save details"}</button>
    </form>
  );
}
