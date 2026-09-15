# Homecare Hospital Management System

Patient intake, treatment encounters, nursing care, pharmacy inventory & dispensing, cashier
billing with thermal POS receipts, and an admin operations dashboard - built for a private clinic
in Osogbo, Nigeria.

Stack: **Next.js 16 (App Router) + Tailwind v4 + Supabase** (Postgres schema, Auth, Row Level
Security). Deploys to Vercel.

## Roles

| Role         | Can do                                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------------------------- |
| receptionist | Register patients (staff enters the patient ID / file number), open encounters                                                                 |
| nurse        | View active encounters, log vitals, administer injections / ward dosages (no costs shown)                     |
| pharmacy     | Manage inventory, restock/adjust stock, flag low/out-of-stock, dispense to encounters, internal cost log      |
| cashier      | Set the manual treatment fee, collect payments (auto `REC-YYYYMMDD-XXXX` receipt), view ledger, thermal receipt |
| admin        | All of the above + operation KPIs, profitability, staff roles, audit trail                                    |

## Billing & confidentiality rules

- **Drug names, quantities and costs NEVER appear on receipts or the cashier view.** The treatment
  fee is a single manual amount set by the cashier; item costs are absorbed into it.
- Dispensing **automatically decrements stock** and writes an audit trail (no manual stock edits by
  ward staff).
- Items at or below `reorder_level` are flagged **LOW**; zero stock is flagged **OUT OF STOCK**.
- `PHARMACY_INVENTORY.unit_cost_price` and dispensation unit costs are only readable through
  restricted RPCs (pharmacy/admin) - the column is not directly selectable via the API.

## Getting started

1. Create a Supabase project and copy your URL + anon key.
2. Copy `.env.local.example` to `.env.local` and fill in the values.
3. In the Supabase SQL editor, run the whole file:

   - `supabase/schema.sql` - tables, triggers, views, RPCs, RLS. Drop policies first if re-running.
   - `supabase/seed.sql` - sample inventory (includes items at/below reorder level to demo the
     low-stock flags).

4. Enable **Email** auth provider (or change the auth provider) in Supabase Auth settings, then:

   - Register your first staff account through the app's sign-up (or via the Supabase dashboard).
   - Promote that user to admin (run once, in the SQL editor):

     ```sql
     update public.profiles
        set role = 'admin'
      where id = (select id from auth.users order by created_at asc limit 1);
     ```

5. Add more staff from `Admin -> Staff & Roles`, then run:

   ```sh
   npm install
   npm run dev
   ```

## Scripts

```sh
npm run dev    # dev server (Turbopack)
npm run build  # production build (Turbopack)
npm run start  # serve production build
npm run lint   # ESLint
```

## Printing receipts

The receipt page (`/cashier/receipt/[receipt]`) has a Print button and 80mm/58mm thermal styles in
`src/app/globals.css` (`.receipt`, `@media print`). Print to Thermal 80 or a 58mm receipt printer
configured in the browser.