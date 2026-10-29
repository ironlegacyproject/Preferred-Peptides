import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="display text-3xl">Page not found</h1>
      <p className="mt-2 text-muted">This page doesn’t exist or you don’t have access to it.</p>
      <Link href="/" className="btn btn-primary mt-6">Go to the price list</Link>
    </div>
  );
}
