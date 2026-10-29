export function AuthCard({ title, children, footer }: { title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="display text-3xl">{title}</h1>
      <div className="mt-6 rounded-lg border border-line bg-surface p-5">{children}</div>
      {footer && <div className="mt-4 text-sm text-muted">{footer}</div>}
    </div>
  );
}

/** Only allow same-site relative redirects. */
export function safeNext(next: string | null | undefined, fallback = "/account") {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
