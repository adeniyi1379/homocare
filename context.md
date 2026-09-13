## Context
- User builds the Homecare Hospital Management System (Osogbo, Nigeria) as Next.js 16 (App Router, Vercel) + Supabase: patient intake/triage, nursing (vitals + administrations), pharmacy stock + dispensing, cashier billing with decoupled receipts, and an admin operations dashboard, with RBAC (receptionist/nurse/pharmacy/cashier/admin).
- Privacy constraints are a hard requirement (enforced at DB and UI): drug names/quantities/internal costs NEVER appear on receipts or to the cashier; each dispense decrements stock automatically and flags low/out-of-stock at the reorder level.

## Important Details
- Versions: next `16.3.5`, react `19.2.8`, `@supabase/ssr ^0.12.7`, tailwind `^4`, TS, Turbopack default for dev/build.
- Next 16: session middleware is `src/proxy.ts` (`export function proxy`); `cookies()`, `params`, `searchParams` are async and must be awaited.
- Server actions consumed by `useActionState` MUST have signature `(prevState: ActionResult, formData: FormData) => Promise<ActionResult>` where `ActionResult = { error: string } | undefined`. React 19 `<form action={fn}>` prop only accepts `(formData) => void | Promise<void>` — never bind a value-returning action directly to a form.
- Client components must NOT import `@/lib/auth` (`import "server-only"` → pulls `next/headers` into the client bundle, Turbopack build error). Client-safe helpers live in `@/lib/roles` (Role, ROLES, ROLE_LABELS, homeForRole).
- Supabase is untyped (no generated `Database` types): nested relations in selects are typed as arrays but PostgREST many-to-one embeds (treatments.patients) return an object at runtime — normalize with `oneOrNull(v)` (in `src/lib/utils.ts`, handles array-or-object). RPC/payload collections are cast with `as unknown as …[]` pattern. Match RPC named-arg keys to schema param names exactly (tested: `limit_count`, `user_id`+`new_role`, `item`+`delta`).
- Privacy enforced in schema: `treatment_dispensations` has NO direct SELECT (reads only via security-definer RPCs `get_my_administrations` (nurse, no cost), `get_pharmacy_log` (pharmacy/admin)); `payments` visible only to cashier/admin; `pharmacy_inventory.unit_cost_price` not API-readable (RPC-only for pharmacy/admin).
- Codes: patient `HC-YYYY-XXXX` (trigger/counter), receipt `REC-YYYYMMDD-XXXX` (sequence). Dispense triggers reject insufficient stock and decrement stock + audit; single manual `total_treatment_fee` paid via `payments`.
- `formatNaira` already includes the ₦ symbol (never prefix again); badge/label helpers (`encounterLabel`, `treatmentStatusBadge`, `stockBadge`) live in `@/lib/utils`, NOT `@/components/ui`.
- Turbopack package-lock warning was silenced by setting `turbopack: { root: process.cwd() }` in `next.config.ts` (verified: warning gone).
- No Supabase credentials provided (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`), so DB-backed flows cannot be exercised end-to-end; schema not yet run against a real project.

## Work State
### Completed - build green (last verification)
- `npm run lint` → clean (0 errors, 0 warnings).
- `npm run build` → passes (Turbopack + TypeScript + static generation). Routes: /, /_not-found, /admin, /cashier, /cashier/receipt/[receipt], /login, /nurse, /pharmacy, /receptionist. No warnings.
- `supabase/schema.sql` + `supabase/seed.sql`: enums, tables, triggers, views `v_treatment_balance`/`v_stock_status`/`v_profit_summary`, RPCs (`get_pharmacy_log(limit_count)`, `get_dispensable_items()`, `get_my_administrations(limit_count)`, `get_admin_kpis()`, `get_profit_report(limit_count)`, `get_audit_log(limit_count)`, `get_users_admin()`, `set_user_role(user_id,new_role)`, `adjust_stock(item,delta)`, `set_treatment_status(t,new_status)`), RLS, grants — all signatures align with app calls (verified via grep).
- Schema additions while building: `treatment_vitals` table + RLS (vitals_select_nurse_admin / vitals_insert_nurse_admin / vitals_delete_admin) + grants; `get_dispensable_items` RPC + grant; `treatments_cancel_creator` update policy (receptionist cancels own active treatments).
- ALL server actions migrated to `(prevState, formData) => Promise<ActionResult>`: receipt of pattern → `src/app/{receptionist,nurse,pharmacy,cashier,admin}/actions.ts`, plus `src/lib/actions/auth.ts` signIn. signOut stays `Promise<void>` (fine for `<form action={signOut}>`).
- Client form components with `useActionState` at `src/app/{receptionist,nurse,pharmacy,cashier,admin}/forms.tsx`; shared `src/components/form-ui.tsx` (FormError + SubmitButton via useFormStatus). Pages render these instead of binding actions directly.
- `oneOrNull` normalizer added to `src/lib/utils.ts`; nested `patients` normalized in nurse/pharmacy pages; RPC payloads cast to explicit row types in admin/cashier/nurse/pharmacy.
- `src/lib/roles.ts` split from `src/lib/auth.ts` (client/server boundary build fix); imports updated in shell-nav.tsx, actions/auth.ts, login/page.tsx, page.tsx.
- Receipt route verified: `params: Promise<{receipt:string}>`, async awaited, no drug line items, PrintButton + `.receipt` print CSS, redirects from cashier payment; balance = max(0, fee - paid).
- Wiring: `package.json` name → `homocare`, `.env.local.example`, README rewritten (setup/roles/bootstrap), shell-nav shows all modules for admin.
- Cancelled openEncounter's cancel path: `cancelEncounter` action removed (receptionist page no longer offers cancel; policy `treatments_cancel_creator` remains inert-but-available in schema if re-enabled).

### Blocked
- No Supabase project URL/anon key → login and DB flows untested; `schema.sql`+`seed.sql` not executed against a live project.

## Next Move
1. (Only when creds exist) Create Supabase project, run `schema.sql` then `seed.sql`, set `.env.local` values, verify seed admin login and each role flow live.
2. Optional polish if requested: field-level `required` on plan fields, pagination on long ledger/audit tables, or converting Profitability/Stock tables to charts.
3. If the user wants git initialization (repo is not a git repo): decide init + commit strategy.

## Relevant Files
- `Homecare Hospital System Specification.pdf` at project root.
- `supabase/schema.sql` (run first; includes first-admin bootstrap) and `supabase/seed.sql`.
- `src/proxy.ts` (Next 16 session guard), `next.config.ts` (turbopack.root set).
- `src/lib/roles.ts` (client-safe) / `src/lib/auth.ts` (server-only) / `src/lib/actions/auth.ts`.
- `src/lib/supabase/server.ts` & `client.ts`; `src/lib/utils.ts` (formatNaira, formatDate/Time, badges, oneOrNull).
- Route pages + `actions.ts` + `forms.tsx`: `src/app/{receptionist,nurse,pharmacy,cashier,cashier/receipt/[receipt],admin}/`.
- `src/components/`: `ui.tsx`, `form-ui.tsx`, `shell-nav.tsx`, `app-shell.tsx`, `print-button.tsx`.
- `package.json` (name `homocare`), `.env.local.example`, `README.md`, `src/app/globals.css` (receipt print styles).