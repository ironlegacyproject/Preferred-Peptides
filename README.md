# Preferred Peptides — order requests for local pickup

Customers browse the price list, add sizes to an order, pick one of the pickup days you've opened, and send the request. They pay cash at pickup. Each customer has an account that shows their order history and status. You get an admin area to work orders by pickup day, manage pickup days, and edit products and prices.

Built with Next.js 16 (App Router), Supabase (auth + Postgres), and Tailwind CSS 4. Deploys to Vercel as-is.

## Set up (about 15 minutes)

### 1. Supabase

1. Create a new Supabase project.
2. Open **SQL Editor → New query**, paste all of `supabase/schema.sql`, and run it.
3. New query again: paste all of `supabase/seed_products.sql` and run it. This loads the 179 items from your price list.
4. **Authentication → URL Configuration**
   - Site URL: your live site, e.g. `https://yourshop.vercel.app`
   - Redirect URLs: add `https://yourshop.vercel.app/auth/callback` and `http://localhost:3000/auth/callback`
5. Optional: **Authentication → Sign In / Providers → Email**. "Confirm email" is on by default, so new customers must click a link before they can sign in. Turn it off if you'd rather they can order right away.

### 2. Environment variables

Copy `.env.example` to `.env.local` for local work, and add the same values in **Vercel → Project → Settings → Environment Variables**:

| Variable | Where to find it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → API Keys → publishable key (or the legacy anon key) |
| `NEXT_PUBLIC_SHOP_NAME` | Shown in the header |
| `NEXT_PUBLIC_SHOP_PHONE` | Shown in the footer |
| `PICKUP_ADDRESS` | Server-only. Shown only on a customer's order page after they send an order request. Defaults to 21318 Hwy 30, Filer, ID |
| `NEXT_PUBLIC_SHOP_STATE` | Governing law in the Research Use Agreement |

Never put the Supabase secret / service_role key in a `NEXT_PUBLIC_` variable. The only place it is used is the optional daily reorder email, on the server.

### 3. Push and deploy

Commit this folder to your GitHub repo and import it in Vercel (framework preset: Next.js, no build settings to change).

`.env.local` and `node_modules` are in `.gitignore` and won't be committed.

### 4. Make yourself the admin

Sign up on the live site with your own email, then run this in the Supabase SQL Editor:

```sql
update public.profiles set is_admin = true where email = 'you@example.com';
```

Refresh the site and an **Admin** link appears in the header.

### 5. Open pickup days

Go to **Admin → Pickup days** and add the dates customers can choose. Customers only see open days from today forward. You can set an opening window, a note ("use the side door"), and an optional order limit per day.

## Research Use Agreement

At checkout, customers must read the agreement, tick the box, and type their full legal name before they can send an order. Each order stores the signed name, the agreement version, and the time it was signed. When you mark an order **Picked up**, the pickup time is recorded as their final acceptance. You'll see this on every order in the admin area, and customers see it on their order page.

- The wording lives in `src/lib/waiver.ts`. If you change it, update `WAIVER_VERSION` so orders show which version was signed.
- The governing state comes from `NEXT_PUBLIC_SHOP_STATE` (defaults to Idaho).
- The full agreement is also public at `/waiver` and linked in the footer.
- **Already ran `schema.sql` before this was added?** See "Updating an existing database" below.

This agreement is a starting template, not legal advice. Have a lawyer licensed in your state review it before you rely on it.

## Office staff

Staff accounts can see orders and mark them Ready, Picked up, or Not picked up. They can't see inventory, products, pickup days, private notes, or the staff list.

1. Have the staff member create an account on the site.
2. Go to **Admin → Staff**, enter their email, and choose **Give staff access**.
3. They sign out and back in, and an **Orders** link appears in their header.

## Inventory and reorder reminders

**Admin → Inventory** shows every product with:

- **On hand**: what's on the shelf. It drops automatically when an order is marked Picked up, and goes back up if you undo that.
- **In open orders**: quantities in Requested and Ready orders.
- **Available**: on hand minus open orders.
- **Reorder at / Order qty**: set per product. When available drops to the reorder point, the product is flagged.

Choose **Update** on any row to save a shelf count, add a delivery you received, or set reorder levels. Every change is logged under **Recent stock changes**.

Products needing a reorder show in a red list at the top of the Inventory page, and the Inventory tab shows a red count badge everywhere in Admin.

### Daily reorder email (optional)

`vercel.json` runs `/api/cron/reorder` every day at 7 AM Mountain Standard Time (8 AM during daylight time). If anything needs reordering, it emails you the list. Nothing is sent on days when stock is fine. To turn it on, add these in Vercel (all server-only, never `NEXT_PUBLIC_`):

| Variable | Value |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys → secret key. Used only by this daily job, on the server. |
| `CRON_SECRET` | Any long random string. Vercel sends it with each scheduled call so no one else can trigger the job. |
| `RESEND_API_KEY` | From resend.com (free tier is plenty). |
| `REORDER_EMAIL_TO` | Where reminders go. Separate several addresses with commas. |
| `REORDER_EMAIL_FROM` | A sender on a domain you've verified in Resend, e.g. `Preferred Peptides <orders@yourdomain.com>` |

## Day-to-day

**Admin → Orders** shows upcoming orders grouped by pickup day, with each day's expected cash total and a pick list (total quantity of every product needed that day). For each order you can:

- Mark it **Ready**, then **Picked up and paid**
- Set **Not picked up** or **Cancelled**
- Move it to another pickup day
- Leave a private shop note (stored in a separate table customers can't read)

Customers can cancel their own order while it's still **Requested**. Once you mark it Ready, only you can change it.

**Admin → Products**: edit names, sizes, prices, categories, add descriptions, hide items, or add new ones. Orders keep the price that was on the list when they were placed, so price changes never alter past orders.

## Updating an existing database

A fresh setup only needs `schema.sql` and `seed_products.sql`. If you ran an earlier `schema.sql`, run these once, in order, in the SQL Editor:

1. `supabase/migration_002_waiver.sql` (Research Use Agreement)
2. `supabase/migration_003_staff_inventory.sql` (staff accounts and inventory)
3. `supabase/migration_004_product_groups.sql` (product groups and descriptions)

Both are safe to run more than once.

## How the pieces fit

- `supabase/schema.sql` — tables, row-level security, and the `place_order` function. Totals are calculated in the database from the products table, so a customer can't change prices from their browser.
- `src/app/page.tsx` — price list
- `src/app/cart/page.tsx` — order review, pickup day, send request
- `src/app/account` — order history, order details, profile
- `src/app/admin` — orders, pickup days, products
- `src/proxy.ts` — keeps sessions fresh and sends signed-out visitors to the sign-in page for `/account` and `/admin`

Times and "today" use the America/Denver time zone. To change it, edit `shop_today()` in `schema.sql` and `shopToday()` in `src/lib/format.ts`.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.
