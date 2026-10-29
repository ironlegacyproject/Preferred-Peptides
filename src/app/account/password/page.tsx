"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AuthCard } from "@/components/AuthCard";

export default function NewPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password });
    setBusy(false);
    if (error) setError(error.message);
    else router.push("/account?password=updated");
  }

  return (
    <AuthCard title="Set a new password">
      <form onSubmit={onSubmit} className="grid gap-4">
        <div>
          <label className="label" htmlFor="password">New password</label>
          <input id="password" type="password" autoComplete="new-password" minLength={8} required className="field" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Save password"}</button>
      </form>
    </AuthCard>
  );
}
