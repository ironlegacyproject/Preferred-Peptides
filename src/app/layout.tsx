import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { CartProvider } from "@/components/CartProvider";
import { Header } from "@/components/Header";
import { SHOP } from "@/lib/format";

const archivo = localFont({
  src: "./fonts/archivo-variable.woff2",
  weight: "100 900",
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  title: SHOP.name,
  description: `Price list and pickup orders for ${SHOP.name}.`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={archivo.variable} suppressHydrationWarning>
      <head>
        {/* Apply the visitor's saved Day/Night choice before the page paints. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("pp-theme");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-dvh">
        <CartProvider>
          <Header />
          <main>{children}</main>
          <footer className="mx-auto max-w-6xl px-4 py-10 text-sm text-muted">
            <p className="font-semibold text-ink">{SHOP.name}</p>
            {SHOP.phone && <p>{SHOP.phone}</p>}
            <p className="mt-2">Local pickup only. Pay with cash when you pick up.</p>
            <p className="mt-2">
              All products are sold for research use only and are not for human or animal use.{" "}
              <a href="/waiver" className="underline">
                Research Use Agreement
              </a>
            </p>
          </footer>
        </CartProvider>
      </body>
    </html>
  );
}
