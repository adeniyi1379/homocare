-- ============================================================
-- HOMECARE HOSPITAL MANAGEMENT SYSTEM - Supabase Schema
-- Run this in the Supabase SQL editor (public schema).
-- ============================================================

create extension if not exists pgcrypto;

-- ============================================================
-- BRANCHES: two locations; staff + all org data are branch-scoped.
-- Admin has NO branch (branch_id null) and sees everything.
-- ============================================================
create table if not exists public.branches (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  code        text not null unique,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.branches enable row level security;

insert into public.branches (name, code) values
  ('Branch A', 'A'),
  ('Branch B', 'B')
on conflict (code) do nothing;

-- ============================================================
-- ROLES: profiles row drives RBAC. First user bootstrap at bottom.
-- ============================================================
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  full_name     text not null default '',
  role          text not null default 'receptionist'
                check (role in ('receptionist', 'nurse', 'dispenser', 'cashier', 'admin')),
  branch_id     uuid references public.branches (id),
  created_at    timestamptz not null default now()
);

-- Migration for installs that already ran the older schema.
alter table public.profiles add column if not exists branch_id uuid references public.branches (id);
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('receptionist', 'nurse', 'dispenser', 'cashier', 'admin'));

-- Any legacy 'pharmacy' role becomes 'dispenser'.
update public.profiles set role = 'dispenser' where role = 'pharmacy';

alter table public.profiles enable row level security;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, branch_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'role', 'receptionist'),
    nullif(new.raw_user_meta_data ->> 'branch_id', '')::uuid
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Role of the signed-in user ('' if anonymous / no profile).
-- security definer so RLS on profiles never recurses into itself.
create or replace function public.auth_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role::text from public.profiles where id = auth.uid()), '');
$$;

-- Branch of the signed-in user (null for admin / unassigned staff).
create or replace function public.user_branch()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select branch_id from public.profiles where id = auth.uid();
$$;

-- ============================================================
-- ENUMS
-- ============================================================
do $$ begin
  create type public.encounter_enum as enum ('one_time', 'admission', 'recurring');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.status_enum as enum ('active', 'discharged', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_enum as enum ('cash', 'pos_terminal', 'bank_transfer');
exception when duplicate_object then null; end $$;

-- Dispense item categories. 'drugs' + 'injection' consume stock; the
-- rest are charge-only service lines (still priced, no inventory decrement).
do $$ begin
  create type public.item_category_enum as enum (
    'laboratory', 'drugs', 'injection', 'scanning', 'services', 'miscellaneous'
  );
exception when duplicate_object then null; end $$;

-- ============================================================
-- TABLES
-- ============================================================

-- PATIENTS ----------
create table if not exists public.patients (
  id            uuid primary key default gen_random_uuid(),
  patient_code  text not null,
  full_name     text not null,
  phone         text,
  gender        text check (gender in ('male', 'female')),
  branch_id     uuid references public.branches (id),
  registered_by uuid references auth.users (id),
  created_at    timestamptz not null default now(),
  unique (branch_id, patient_code)
);

-- In case the older schema (nullable code + auto-gen trigger) was already applied.
alter table public.patients alter column patient_code set not null;

-- Migration: add branch scoping; file numbers become unique per branch so the
-- two branches can both use their own numbering (e.g. HGC-0001 in each).
alter table public.patients add column if not exists branch_id uuid references public.branches (id);
alter table public.patients drop constraint if exists patients_patient_code_key;
create unique index if not exists uq_patients_branch_code on public.patients (branch_id, patient_code);

alter table public.patients enable row level security;

create index if not exists idx_patients_created_at on public.patients (created_at desc);

-- Patient ID / file number is ENTERED MANUALLY by reception staff at registration
-- (the hospital already operates with its own ID scheme). It is NOT auto-generated.
drop trigger if exists trg_set_patient_code on public.patients;
drop function if exists public.set_patient_code();
drop function if exists public.generate_patient_code();
drop table if exists public.patient_code_counters;

-- INTAKE / TREATMENT CATEGORIES (admin-managed lookup for the reception encounter form) ----------
create table if not exists public.treatment_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  sort_order  integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.treatment_categories enable row level security;

insert into public.treatment_categories (name, description, sort_order) values
  ('General Outpatient', 'Routine non-emergency consultations', 1),
  ('Emergency', 'Urgent / life-threatening care', 2),
  ('Antenatal', 'Pregnancy follow-up and check-ups', 3),
  ('Immunization', 'Routine and catch-up vaccinations', 4),
  ('Minor Surgery', 'Dressings, stitches, small procedures', 5),
  ('Admission / Ward', 'Inpatient ward stay and monitoring', 6),
  ('Chronic Care', 'Ongoing management of long-term conditions', 7)
on conflict (name) do nothing;

-- TREATMENTS (encounter master) ----------
create table if not exists public.treatments (
  id                   uuid primary key default gen_random_uuid(),
  patient_id           uuid not null references public.patients (id) on delete cascade,
  encounter_type       public.encounter_enum not null,
  category             text,
  status               public.status_enum not null default 'active',
  total_treatment_fee  numeric(12, 2) not null default 0.00,
  branch_id            uuid references public.branches (id),
  created_by           uuid references auth.users (id),
  created_at           timestamptz not null default now()
);

alter table public.treatments add column if not exists branch_id uuid references public.branches (id);

alter table public.treatments enable row level security;

create index if not exists idx_treatments_patient on public.treatments (patient_id);
create index if not exists idx_treatments_status on public.treatments (status);

-- Store the acting user's branch on rows that are created inside a branch
-- context. Branches never interact: a treatment opened at Branch A is only
-- visible and payable to staff of Branch A.
create or replace function public.set_row_branch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.branch_id is null then
    new.branch_id := public.user_branch();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_patient_branch on public.patients;
create trigger trg_set_patient_branch
  before insert on public.patients
  for each row execute function public.set_row_branch();

drop trigger if exists trg_set_treatment_branch on public.treatments;
create trigger trg_set_treatment_branch
  before insert on public.treatments
  for each row execute function public.set_row_branch();

drop trigger if exists trg_set_inventory_branch on public.pharmacy_inventory;
create trigger trg_set_inventory_branch
  before insert on public.pharmacy_inventory
  for each row execute function public.set_row_branch();

-- DISPENSE INVENTORY ----------
create table if not exists public.pharmacy_inventory (
  id              uuid primary key default gen_random_uuid(),
  item_name       text not null,
  category        public.item_category_enum not null default 'drugs',
  stock_quantity  integer not null default 0 check (stock_quantity >= 0),
  reorder_level   integer not null default 10,
  unit_cost_price numeric(10, 2) not null default 0 check (unit_cost_price >= 0),
  sell_price      numeric(10, 2) not null default 0 check (sell_price >= 0),
  branch_id       uuid references public.branches (id),
  updated_at      timestamptz not null default now()
);

-- Migration: replace item_type (tablet/syrup/injection/consumable) with the
-- new category model and add the patient-facing sell price.
alter table public.pharmacy_inventory add column if not exists branch_id uuid references public.branches (id);
alter table public.pharmacy_inventory add column if not exists category public.item_category_enum;
alter table public.pharmacy_inventory add column if not exists sell_price numeric(10, 2) not null default 0 check (sell_price >= 0);

do $$
begin
  -- Only migrate tables that still have the legacy item_type column (fresh
  -- installs create the table directly with category/sell_price, so item_type
  -- never exists and this guard keeps the migration idempotent on re-runs).
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pharmacy_inventory'
      and column_name = 'item_type'
  ) then
    update public.pharmacy_inventory set category =
      (case item_type::text
        when 'tablet' then 'drugs'
        when 'syrup' then 'drugs'
        when 'injection' then 'injection'
        when 'consumable' then 'miscellaneous'
        else 'miscellaneous'
      end)::public.item_category_enum
    where category is null;
  end if;
end $$;

alter table public.pharmacy_inventory alter column category set default 'drugs';
alter table public.pharmacy_inventory alter column category set not null;
alter table public.pharmacy_inventory drop column if exists item_type;

alter table public.pharmacy_inventory enable row level security;

-- TREATMENT DISPENSATIONS (billing + internal audit ledger) ----------
-- Movement chain: dispensed_by (dispenser) -> dispensed_to (nurse who takes it)
-- -> administered_by (nurse who confirms giving it) for that treatment.
-- Each line snapshots BOTH the internal purchase cost (margins only) and the
-- patient-facing sell price. The treatment fee is the sum of qty x sell price.
create table if not exists public.treatment_dispensations (
  id                   uuid primary key default gen_random_uuid(),
  treatment_id         uuid not null references public.treatments (id) on delete cascade,
  item_id              uuid not null references public.pharmacy_inventory (id),
  quantity             integer not null check (quantity > 0),
  unit_cost_snapshot   numeric(10, 2) not null default 0,
  sell_price_snapshot  numeric(10, 2) not null default 0,
  dispensed_by         uuid references auth.users (id),
  dispensed_at         timestamptz not null default now(),
  dispensed_to         uuid references auth.users (id),
  administered_by      uuid references auth.users (id),
  administered_at      timestamptz
);

alter table public.treatment_dispensations add column if not exists dispensed_to uuid references auth.users (id);
alter table public.treatment_dispensations add column if not exists administered_by uuid references auth.users (id);
alter table public.treatment_dispensations add column if not exists administered_at timestamptz;
alter table public.treatment_dispensations add column if not exists unit_cost_snapshot numeric(10, 2) not null default 0;
alter table public.treatment_dispensations add column if not exists sell_price_snapshot numeric(10, 2) not null default 0;

-- Backfill snapshots for dispensations created before sell pricing existed.
update public.treatment_dispensations d
   set sell_price_snapshot = coalesce((select i.sell_price from public.pharmacy_inventory i where i.id = d.item_id), 0)
 where sell_price_snapshot = 0;

-- handoff_type: 'nurse' = handed to a staff nurse for them to administer on the ward;
-- 'patient' = handed directly to the patient, who takes it home (no nurse involved).
alter table public.treatment_dispensations add column if not exists handoff_type text not null default 'nurse' check (handoff_type in ('nurse', 'patient'));

alter table public.treatment_dispensations enable row level security;

create index if not exists idx_disp_treatment on public.treatment_dispensations (treatment_id);
create index if not exists idx_disp_to on public.treatment_dispensations (dispensed_to);

-- PAYMENTS (cashier ledger) ----------
create table if not exists public.payments (
  id              uuid primary key default gen_random_uuid(),
  receipt_number  text unique,
  treatment_id    uuid not null references public.treatments (id) on delete cascade,
  amount_paid     numeric(12, 2) not null check (amount_paid > 0),
  payment_method  public.payment_enum not null default 'cash',
  cashier_id      uuid references auth.users (id),
  created_at      timestamptz not null default now()
);

alter table public.payments enable row level security;

create index if not exists idx_payments_treatment on public.payments (treatment_id);

create sequence if not exists public.receipt_number_seq;

create or replace function public.generate_receipt_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  return 'REC-' || to_char(now(), 'YYYYMMDD') || '-' ||
         to_char(nextval('public.receipt_number_seq'), 'FM0000');
end;
$$;

create or replace function public.set_receipt_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.receipt_number is null then
    new.receipt_number := public.generate_receipt_number();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_receipt_number on public.payments;
create trigger trg_set_receipt_number
  before insert on public.payments
  for each row execute function public.set_receipt_number();

-- TREATMENT VITALS (nurse recordings) ----------
create table if not exists public.treatment_vitals (
  id            uuid primary key default gen_random_uuid(),
  treatment_id  uuid not null references public.treatments (id) on delete cascade,
  temperature   numeric(4, 1),
  systolic      integer,
  diastolic     integer,
  pulse         integer,
  remarks       text,
  recorded_by   uuid references auth.users (id),
  recorded_at   timestamptz not null default now()
);

alter table public.treatment_vitals enable row level security;

create index if not exists idx_vitals_treatment on public.treatment_vitals (treatment_id);

-- AUDIT LOG (written by triggers, read by admin) ----------
create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid,
  action      text not null,
  entity      text not null,
  entity_id   uuid,
  details     jsonb,
  created_at  timestamptz not null default now()
);

alter table public.audit_log enable row level security;

-- ============================================================
-- STOCK CONTROL: dispensing decrements inventory (drug/injection lines
-- only), snapshots prices, and recomputes the treatment fee.
-- ============================================================

-- Validate a dispensation before insert:
--  - stock-tracking categories must have enough stock
--  - treatment must be active
--  - snapshots are taken from the item's current prices
--  - hand-off rules live here too
--  - a dispenser can only work items from the same branch as the treatment
create or replace function public.check_dispense_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  avail int;
  curr_status text;
  item_cost numeric;
  item_sell numeric;
  item_category text;
  item_branch uuid;
  tx_branch uuid;
begin
  select stock_quantity, unit_cost_price, sell_price, category::text, branch_id
    into avail, item_cost, item_sell, item_category, item_branch
    from public.pharmacy_inventory
   where id = new.item_id;

  if avail is null then
    raise exception 'Inventory item not found';
  end if;

  -- Only drugs and injections consume stock; other categories are service lines.
  if item_category in ('drugs', 'injection') and avail < new.quantity then
    raise exception 'Insufficient stock: only % left of item %', avail, new.item_id;
  end if;

  select status, branch_id into curr_status, tx_branch
    from public.treatments where id = new.treatment_id;
  if curr_status is null then
    raise exception 'Treatment not found';
  end if;
  if curr_status in ('completed', 'cancelled') then
    raise exception 'Cannot dispense to a % treatment', curr_status;
  end if;

  -- Branch isolation: an assigned dispenser can only use items and treatments
  -- from their own branch.
  if public.auth_role() <> 'admin' then
    if item_branch is not null and tx_branch is not null and item_branch <> tx_branch then
      raise exception 'This item belongs to a different branch than the treatment';
    end if;
  end if;

  if coalesce(new.unit_cost_snapshot, 0) = 0 then
    new.unit_cost_snapshot := coalesce(item_cost, 0);
  end if;
  if coalesce(new.sell_price_snapshot, 0) = 0 then
    new.sell_price_snapshot := coalesce(item_sell, 0);
  end if;

  new.handoff_type := coalesce(new.handoff_type, 'nurse');
  if new.handoff_type = 'nurse' and new.dispensed_to is null then
    raise exception 'Select the nurse the item is handed to';
  end if;
  if new.handoff_type = 'patient' then
    new.dispensed_to := null;
  end if;

  new.dispensed_by := coalesce(new.dispensed_by, auth.uid());
  return new;
end;
$$;

drop trigger if exists trg_check_dispense_stock on public.treatment_dispensations;
create trigger trg_check_dispense_stock
  before insert on public.treatment_dispensations
  for each row execute function public.check_dispense_stock();

-- Decrement stock (stock categories only) + audit after dispensation.
create or replace function public.decrement_stock_after_dispense()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select category::text from public.pharmacy_inventory where id = new.item_id) in ('drugs', 'injection') then
    update public.pharmacy_inventory
       set stock_quantity = stock_quantity - new.quantity,
           updated_at = now()
     where id = new.item_id;
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (new.dispensed_by, 'DISPENSE', 'treatment_dispensations', new.id,
          jsonb_build_object(
            'treatment_id', new.treatment_id,
            'item_id', new.item_id,
            'quantity', new.quantity,
            'unit_cost_snapshot', new.unit_cost_snapshot,
            'sell_price_snapshot', new.sell_price_snapshot));
  return new;
end;
$$;

drop trigger if exists trg_decrement_stock on public.treatment_dispensations;
create trigger trg_decrement_stock
  after insert on public.treatment_dispensations
  for each row execute function public.decrement_stock_after_dispense();

-- Recompute a treatment's fee as the sum of its dispensed line totals.
create or replace function public.recalc_treatment_fee(t uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if t is null then return; end if;
  update public.treatments
     set total_treatment_fee = coalesce((
       select sum(quantity * coalesce(sell_price_snapshot, 0))
         from public.treatment_dispensations
        where treatment_id = t
     ), 0)
   where id = t;
  perform public.recalc_treatment_status(t);
end;
$$;

-- The treatment fee is FULLY COMPUTED from dispensed items, never typed in.
create or replace function public.after_dispense_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalc_treatment_fee(new.treatment_id);
  return new;
end;
$$;

drop trigger if exists trg_recalc_fee_dispense_insert on public.treatment_dispensations;
create trigger trg_recalc_fee_dispense_insert
  after insert on public.treatment_dispensations
  for each row execute function public.after_dispense_change();

-- Admin removing a dispense: restock (stock categories) + recompute the fee.
create or replace function public.handle_dispense_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select category::text from public.pharmacy_inventory where id = old.item_id) in ('drugs', 'injection') then
    update public.pharmacy_inventory
       set stock_quantity = stock_quantity + old.quantity,
           updated_at = now()
     where id = old.item_id;
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'DISPENSE_REMOVE', 'treatment_dispensations', old.id,
          jsonb_build_object(
            'treatment_id', old.treatment_id,
            'item_id', old.item_id,
            'quantity', old.quantity));

  perform public.recalc_treatment_fee(old.treatment_id);
  return old;
end;
$$;

drop trigger if exists trg_dispense_delete on public.treatment_dispensations;
create trigger trg_dispense_delete
  after delete on public.treatment_dispensations
  for each row execute function public.handle_dispense_delete();

-- ============================================================
-- PAYMENTS: audit + auto-complete ANY treatment once fully settled.
-- A treatment is no longer active the moment it is paid in full
-- (only a progressing admission may stay 'discharged' until settled).
-- ============================================================
create or replace function public.recalc_treatment_status(t uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  fee  numeric;
  paid numeric;
  st   text;
begin
  if t is null then return; end if;

  select total_treatment_fee, status::text
    into fee, st
    from public.treatments where id = t;
  if fee is null then return; end if;

  select coalesce(sum(amount_paid), 0) into paid
    from public.payments where treatment_id = t;

  perform public.set_treatment_status(t,
    case
      when paid >= fee and st in ('active', 'discharged') then 'completed'
      else st
    end);
end;
$$;

create or replace function public.audit_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (new.cashier_id, 'PAYMENT', 'payments', new.id,
          jsonb_build_object(
            'receipt_number', new.receipt_number,
            'treatment_id', new.treatment_id,
            'amount_paid', new.amount_paid,
            'payment_method', new.payment_method::text));
  return new;
end;
$$;

drop trigger if exists trg_audit_payment on public.payments;
create trigger trg_audit_payment
  after insert on public.payments
  for each row execute function public.audit_payment();

-- Audit log for payment edits (cashier corrections).
create or replace function public.audit_payment_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.amount_paid is distinct from new.amount_paid
     or old.payment_method is distinct from new.payment_method then
    insert into public.audit_log (actor_id, action, entity, entity_id, details)
    values (auth.uid(), 'PAYMENT_EDIT', 'payments', new.id,
            jsonb_build_object(
              'receipt_number', new.receipt_number,
              'treatment_id', new.treatment_id,
              'old_amount', old.amount_paid,
              'new_amount', new.amount_paid,
              'old_method', old.payment_method::text,
              'new_method', new.payment_method::text));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_audit_payment_update on public.payments;
create trigger trg_audit_payment_update
  after update on public.payments
  for each row execute function public.audit_payment_update();

-- Status guard: completed only reachable when balance <= 0.
create or replace function public.set_treatment_status(t uuid, new_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  fee  numeric;
  paid numeric;
begin
  select total_treatment_fee into fee from public.treatments where id = t;
  if fee is null then raise exception 'Treatment not found'; end if;

  if new_status = 'completed' then
    select coalesce(sum(amount_paid), 0) into paid from public.payments where treatment_id = t;
    if fee - paid > 0 then
      raise exception 'Cannot complete: balance of % remains unpaid', fee - paid;
    end if;
  end if;

  update public.treatments set status = new_status::public.status_enum where id = t;

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'STATUS_CHANGE', 'treatments', t,
          jsonb_build_object('status', new_status));
end;
$$;

-- ------------------------------------------------------------------
-- LIFECYCLE TRANSITIONS (role-guarded front doors for the UI).
-- set_treatment_status above stays internal (used by triggers below);
-- staff NEVER call it directly.
-- ------------------------------------------------------------------

-- End a treatment: full settle -> completed; still owes -> discharged
-- (care over, billing stays open until paid, then it auto-completes).
create or replace function public.treatment_end(t uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  fee  numeric;
  paid numeric;
  st   text;
  tb   uuid;
begin
  if public.auth_role() not in ('receptionist', 'cashier', 'admin') then
    raise exception 'Forbidden: only receptionist, cashier or admin can end a treatment';
  end if;

  select total_treatment_fee, status::text, branch_id into fee, st, tb
    from public.treatments where id = t;
  if fee is null then raise exception 'Treatment not found'; end if;

  -- Branch isolation for non-admin staff.
  if public.auth_role() <> 'admin' then
    if tb is not null and tb <> public.user_branch() then
      raise exception 'This treatment belongs to another branch';
    end if;
  end if;

  if st = 'completed' then return; end if;
  if st not in ('active', 'discharged') then
    raise exception 'Cannot end a treatment in state %, only active or discharged', st;
  end if;

  select coalesce(sum(amount_paid), 0) into paid
    from public.payments where treatment_id = t;

  if paid >= fee then
    perform public.set_treatment_status(t, 'completed');
  else
    perform public.set_treatment_status(t, 'discharged');
  end if;
end;
$$;

-- Cancel an ACTIVE treatment, only when nothing has happened yet
-- (no payments recorded, no items dispensed).
create or replace function public.cancel_treatment(t uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  st      text;
  tb      uuid;
  cnt_pay bigint;
  cnt_dsp bigint;
begin
  if public.auth_role() not in ('receptionist', 'cashier', 'admin') then
    raise exception 'Forbidden: only receptionist, cashier or admin can cancel a treatment';
  end if;

  select status::text, branch_id into st, tb from public.treatments where id = t;
  if st is null then raise exception 'Treatment not found'; end if;

  if public.auth_role() <> 'admin' then
    if tb is not null and tb <> public.user_branch() then
      raise exception 'This treatment belongs to another branch';
    end if;
  end if;

  if st <> 'active' then
    raise exception 'Only active treatments can be cancelled';
  end if;

  select count(*) into cnt_pay from public.payments where treatment_id = t;
  if cnt_pay > 0 then
    raise exception 'Cannot cancel: payments have already been recorded for this treatment';
  end if;

  select count(*) into cnt_dsp from public.treatment_dispensations where treatment_id = t;
  if cnt_dsp > 0 then
    raise exception 'Cannot cancel: items have already been dispensed for this treatment';
  end if;

  perform public.set_treatment_status(t, 'cancelled');
end;
$$;

create or replace function public.after_payment_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalc_treatment_status(new.treatment_id);
  return new;
end;
$$;

drop trigger if exists trg_after_payment_insert on public.payments;
create trigger trg_after_payment_insert
  after insert on public.payments
  for each row execute function public.after_payment_insert();

-- After a payment edit, recompute the treatment status too.
create or replace function public.after_payment_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalc_treatment_status(new.treatment_id);
  return new;
end;
$$;

drop trigger if exists trg_after_payment_update on public.payments;
create trigger trg_after_payment_update
  after update on public.payments
  for each row execute function public.after_payment_update();

-- ============================================================
-- VIEWS  (security_invoker: they inherit branch-scoped RLS)
-- ============================================================

-- Cashier / Admin led see treatment + running balance.
drop view if exists public.v_treatment_balance;
create view public.v_treatment_balance
with (security_invoker = true) as
select
  tr.id                      as treatment_id,
  tr.patient_id,
  p.patient_code,
  p.full_name                as patient_name,
  p.phone,
  tr.encounter_type,
  tr.category,
  tr.status,
  tr.created_at,
  tr.branch_id,
  tr.total_treatment_fee,
  coalesce(pay.total_paid, 0) as total_paid,
  tr.total_treatment_fee - coalesce(pay.total_paid, 0) as balance_remaining,
  case
    when coalesce(pay.total_paid, 0) = 0 then 'UNPAID'
    when coalesce(pay.total_paid, 0) < tr.total_treatment_fee then 'PARTIAL'
    else 'PAID IN FULL'
  end as payment_status
from public.treatments tr
join public.patients p on p.id = tr.patient_id
left join (
  select treatment_id, sum(amount_paid) as total_paid
    from public.payments
   group by treatment_id
) pay on pay.treatment_id = tr.id;

-- Dispense stock monitor with low-stock flag. The internal purchase cost is
-- only exposed to dispenser / admin roles; nurses and other staff see null.
drop view if exists public.v_stock_status;
create view public.v_stock_status
with (security_invoker = true) as
select
  id,
  item_name,
  category,
  stock_quantity,
  reorder_level,
  case
    when public.auth_role() in ('dispenser', 'admin') then unit_cost_price
    else null
  end as unit_cost_price,
  sell_price,
  branch_id,
  updated_at,
  (category in ('drugs', 'injection') and stock_quantity <= reorder_level) as is_low_stock,
  case
    when category not in ('drugs', 'injection') then 'OK'
    when stock_quantity <= 0 then 'OUT OF STOCK'
    when stock_quantity <= reorder_level then 'LOW'
    else 'OK'
  end as stock_status
from public.pharmacy_inventory;

-- Admin profit / reconciliation ledger.
drop view if exists public.v_profit_summary;
create view public.v_profit_summary
with (security_invoker = true) as
select
  tr.id                 as treatment_id,
  p.patient_code,
  p.full_name           as patient_name,
  tr.encounter_type,
  tr.category,
  tr.status,
  tr.created_at,
  tr.branch_id,
  tr.total_treatment_fee,
  coalesce(pay.total_paid, 0) as total_paid,
  coalesce(cogs.total_cost, 0) as cogs,
  coalesce(pay.total_paid, 0) - coalesce(cogs.total_cost, 0) as gross_margin
from public.treatments tr
join public.patients p on p.id = tr.patient_id
left join (
  select treatment_id, sum(amount_paid) as total_paid
    from public.payments group by treatment_id
) pay on pay.treatment_id = tr.id
left join (
  select treatment_id, sum(quantity * unit_cost_snapshot) as total_cost
    from public.treatment_dispensations
   group by treatment_id
) cogs on cogs.treatment_id = tr.id;

-- ============================================================
-- RPC FUNCTIONS (security definer - internal data stays hidden)
-- ============================================================

-- Branch scope predicate used across the security-definer functions below.
-- Returns true when the row's branch is visible to the caller (admin sees all).
create or replace function public.branch_visible(b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.auth_role() = 'admin'
      or b is null
      or b = public.user_branch();
$$;

-- Dispensing ledger. Cost column is hidden from nurses (dispenser/ admin only).
drop function if exists public.get_pharmacy_log(int);
create or replace function public.get_pharmacy_log(limit_count int default 50)
returns table (
  treatment_id uuid, patient_code text, patient_name text,
  item_name text, category text, quantity int, unit_cost_snapshot numeric,
  handoff_type text,
  dispensed_by_name text, dispensed_at timestamptz,
  dispensed_to_name text, administered_by_name text, administered_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.auth_role() not in ('dispenser', 'nurse', 'admin') then
    raise exception 'Forbidden';
  end if;
  return query
  select d.treatment_id, p.patient_code, p.full_name,
         i.item_name, i.category::text, d.quantity,
         case when public.auth_role() in ('dispenser', 'admin') then d.unit_cost_snapshot else null end,
         d.handoff_type::text,
         pr.full_name, d.dispensed_at,
         dr.full_name, ar.full_name, d.administered_at
    from public.treatment_dispensations d
    join public.treatments tr on tr.id = d.treatment_id
    join public.patients p on p.id = tr.patient_id
    join public.pharmacy_inventory i on i.id = d.item_id
    left join public.profiles pr on pr.id = d.dispensed_by
    left join public.profiles dr on dr.id = d.dispensed_to
    left join public.profiles ar on ar.id = d.administered_by
   where public.branch_visible(tr.branch_id)
   order by d.dispensed_at desc
   limit greatest(limit_count, 1);
end;
$$;

-- Per-item dispensing history for the Stock Monitoring drill-down.
-- Costs are internal (dispenser / admin only), never patient- or cashier-facing.
drop function if exists public.get_item_usage(uuid);
create or replace function public.get_item_usage(p_item_id uuid)
returns table (
  item_name text, category text, quantity int, unit_cost_snapshot numeric,
  handoff_type text,
  patient_code text, patient_name text,
  treatment_id uuid, encounter_label text,
  dispensed_by_name text, dispensed_at timestamptz,
  dispensed_to_name text, administered_by_name text, administered_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.auth_role() not in ('dispenser', 'nurse', 'admin') then
    raise exception 'Forbidden';
  end if;
  return query
  select i.item_name, i.category::text, d.quantity,
         case when public.auth_role() in ('dispenser', 'admin') then d.unit_cost_snapshot else null end,
         d.handoff_type::text,
         p.patient_code, p.full_name,
         tr.id,
         case tr.encounter_type
           when 'one_time' then 'One-Time Treatment'
           when 'admission' then 'Admission'
           when 'recurring' then 'Recurring Care'
           else tr.encounter_type
         end,
         pr.full_name, d.dispensed_at,
         dr.full_name, ar.full_name, d.administered_at
    from public.treatment_dispensations d
    join public.treatments tr on tr.id = d.treatment_id
    join public.patients p on p.id = tr.patient_id
    join public.pharmacy_inventory i on i.id = d.item_id
    left join public.profiles pr on pr.id = d.dispensed_by
    left join public.profiles dr on dr.id = d.dispensed_to
    left join public.profiles ar on ar.id = d.administered_by
   where d.item_id = p_item_id
     and public.branch_visible(i.branch_id)
   order by d.dispensed_at desc;
end;
$$;

-- Item picker for doctors/nurses: charge-only lines have no stock, so they
-- are always available; drugs/injections must have stock on hand.
drop function if exists public.get_dispensable_items();
create or replace function public.get_dispensable_items()
returns table (
  id uuid, item_name text, category text, stock_quantity int, sell_price numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.auth_role() not in ('nurse', 'dispenser', 'admin') then
    raise exception 'Forbidden';
  end if;
  return query
  select i.id, i.item_name, i.category::text, i.stock_quantity, i.sell_price
    from public.pharmacy_inventory i
   where public.branch_visible(i.branch_id)
     and (i.category::text not in ('drugs', 'injection') or i.stock_quantity > 0)
   order by i.item_name;
end;
$$;

drop function if exists public.get_my_administrations(int);
create or replace function public.get_my_administrations(limit_count int default 50)
returns table (
  treatment_id uuid, patient_code text, patient_name text,
  item_name text, category text, quantity int, dispensed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.auth_role() not in ('nurse', 'dispenser', 'admin') then
    raise exception 'Forbidden';
  end if;
  return query
  select d.treatment_id, p.patient_code, p.full_name,
         i.item_name, i.category::text, d.quantity, d.dispensed_at
    from public.treatment_dispensations d
    join public.treatments tr on tr.id = d.treatment_id
    join public.patients p on p.id = tr.patient_id
    join public.pharmacy_inventory i on i.id = d.item_id
   where d.dispensed_by = auth.uid()
     and public.branch_visible(tr.branch_id)
   order by d.dispensed_at desc
   limit greatest(limit_count, 1);
end;
$$;

-- Registered nurses in the caller's branch that a dispenser can hand items to.
drop function if exists public.get_dispense_recipients();
create or replace function public.get_dispense_recipients()
returns table (id uuid, full_name text, role text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.auth_role() not in ('dispenser', 'nurse', 'admin') then
    raise exception 'Forbidden';
  end if;
  return query
  select p.id, p.full_name, p.role::text
    from public.profiles p
   where p.role = 'nurse'
     and public.branch_visible(p.branch_id)
   order by p.full_name;
end;
$$;

-- Items handed to the CURRENT nurse that have not been administered yet.
drop function if exists public.get_my_pending_dispensations(int);
create or replace function public.get_my_pending_dispensations(limit_count int default 50)
returns table (
  id uuid, treatment_id uuid, patient_code text, patient_name text,
  item_name text, quantity int,
  dispensed_by_name text, dispensed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.auth_role() not in ('nurse', 'dispenser', 'admin') then
    raise exception 'Forbidden';
  end if;
  return query
  select d.id, d.treatment_id, p.patient_code, p.full_name,
         i.item_name, d.quantity, pr.full_name, d.dispensed_at
    from public.treatment_dispensations d
    join public.treatments tr on tr.id = d.treatment_id
    join public.patients p on p.id = tr.patient_id
    join public.pharmacy_inventory i on i.id = d.item_id
    left join public.profiles pr on pr.id = d.dispensed_by
   where d.dispensed_to = auth.uid()
     and d.administered_at is null
     and public.branch_visible(tr.branch_id)
   order by d.dispensed_at desc
   limit greatest(limit_count, 1);
end;
$$;

-- Nurse confirms they administered the item. Only the designated nurse (or an admin)
-- can confirm, and only once.
drop function if exists public.confirm_dispense_administration(uuid);
create or replace function public.confirm_dispense_administration(p_dispense_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  designated_to uuid;
  already_done timestamptz;
begin
  if public.auth_role() not in ('nurse', 'dispenser', 'admin') then
    raise exception 'Forbidden';
  end if;
  select dispensed_to, administered_at into designated_to, already_done
    from public.treatment_dispensations
   where id = p_dispense_id;
  if not found then
    raise exception 'Unknown dispense record';
  end if;
  if already_done is not null then
    raise exception 'This item was already administered';
  end if;
  if public.auth_role() <> 'admin' and designated_to <> auth.uid() then
    raise exception 'This item was not handed to you';
  end if;
  update public.treatment_dispensations
     set administered_by = auth.uid(),
         administered_at = now()
   where id = p_dispense_id;
end;
$$;

-- The nurse's own history of dispenser-dispensed items they administered.
drop function if exists public.get_my_dispense_history(int);
create or replace function public.get_my_dispense_history(limit_count int default 50)
returns table (
  treatment_id uuid, patient_code text, patient_name text,
  item_name text, category text, quantity int,
  dispensed_by_name text, dispensed_at timestamptz, administered_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.auth_role() not in ('nurse', 'dispenser', 'admin') then
    raise exception 'Forbidden';
  end if;
  return query
  select d.treatment_id, p.patient_code, p.full_name,
         i.item_name, i.category::text, d.quantity, pr.full_name, d.dispensed_at, d.administered_at
    from public.treatment_dispensations d
    join public.treatments tr on tr.id = d.treatment_id
    join public.patients p on p.id = tr.patient_id
    join public.pharmacy_inventory i on i.id = d.item_id
    left join public.profiles pr on pr.id = d.dispensed_by
   where d.administered_by = auth.uid()
     and public.branch_visible(tr.branch_id)
   order by d.administered_at desc
   limit greatest(limit_count, 1);
end;
$$;

-- Admin operational dashboard KPIs.
-- p_branch filters strictly to one branch (admin-only); null = global view.
drop function if exists public.get_admin_kpis(uuid);
drop function if exists public.get_admin_kpis();
create or replace function public.get_admin_kpis(p_branch uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  out jsonb;
begin
  if public.auth_role() <> 'admin' then
    raise exception 'Forbidden';
  end if;

  select jsonb_build_object(
    'patients_total',
      (select count(*) from public.patients where p_branch is null or branch_id = p_branch),
    'patients_today',
      (select count(*) from public.patients
        where created_at::date = current_date
          and (p_branch is null or branch_id = p_branch)),
    'active_treatments',
      (select count(*) from public.treatments
        where status in ('active', 'discharged')
          and (p_branch is null or branch_id = p_branch)),
    'admissions_active',
      (select count(*) from public.treatments
        where encounter_type = 'admission' and status = 'active'
          and (p_branch is null or branch_id = p_branch)),
    'completed_treatments',
      (select count(*) from public.treatments
        where status = 'completed'
          and (p_branch is null or branch_id = p_branch)),
    'revenue_today',
      (select coalesce(sum(pay.amount_paid), 0)
         from public.payments pay
         join public.treatments tr on tr.id = pay.treatment_id
        where pay.created_at::date = current_date
          and (p_branch is null or tr.branch_id = p_branch)),
    'revenue_total',
      (select coalesce(sum(pay.amount_paid), 0)
         from public.payments pay
         join public.treatments tr on tr.id = pay.treatment_id
        where p_branch is null or tr.branch_id = p_branch),
    'outstanding_balance',
      (select coalesce(sum(greatest(tr.total_treatment_fee - coalesce(p.total_paid, 0), 0)), 0)
         from public.treatments tr
         left join (select treatment_id, sum(amount_paid) total_paid
                      from public.payments group by treatment_id) p
           on p.treatment_id = tr.id
        where tr.status <> 'cancelled'
          and (p_branch is null or tr.branch_id = p_branch)),
    'low_stock_count',
      (select count(*) from public.pharmacy_inventory
        where stock_quantity <= reorder_level
          and (p_branch is null or branch_id = p_branch)),
    'out_of_stock_count',
      (select count(*) from public.pharmacy_inventory
        where stock_quantity = 0
          and (p_branch is null or branch_id = p_branch)),
    'inventory_value',
      (select coalesce(sum(stock_quantity * unit_cost_price), 0)
         from public.pharmacy_inventory
        where p_branch is null or branch_id = p_branch),
    'inventory_sell_value',
      (select coalesce(sum(d.quantity * d.unit_cost_snapshot), 0)
         from public.treatment_dispensations d
         join public.treatments tr on tr.id = d.treatment_id
        where p_branch is null or tr.branch_id = p_branch),
    'dispensations_total',
      (select count(*) from public.treatment_dispensations d
         join public.treatments tr on tr.id = d.treatment_id
        where p_branch is null or tr.branch_id = p_branch),
    'dispensations_today',
      (select count(*) from public.treatment_dispensations d
         join public.treatments tr on tr.id = d.treatment_id
        where d.dispensed_at::date = current_date
          and (p_branch is null or tr.branch_id = p_branch)),
    'payments_method_breakdown',
      (select coalesce(jsonb_object_agg(method, total), '{}'::jsonb)
         from (select pay.payment_method::text as method, count(*) as total
                 from public.payments pay
                 join public.treatments tr on tr.id = pay.treatment_id
                where p_branch is null or tr.branch_id = p_branch
                group by pay.payment_method) s),
    'encounter_breakdown',
      (select coalesce(jsonb_object_agg(etype, total), '{}'::jsonb)
         from (select encounter_type::text as etype, count(*) as total
                 from public.treatments tr
                where p_branch is null or tr.branch_id = p_branch
                group by tr.encounter_type) s),
    'status_breakdown',
      (select coalesce(jsonb_object_agg(st, total), '{}'::jsonb)
         from (select status::text as st, count(*) as total
                 from public.treatments tr
                where p_branch is null or tr.branch_id = p_branch
                group by tr.status) s),
    'stock_level_breakdown',
      (select coalesce(jsonb_object_agg(stock_status, total), '{}'::jsonb)
         from (select case when stock_quantity <= 0 then 'out'
                           when stock_quantity <= reorder_level then 'low'
                           else 'ok' end as stock_status,
                      count(*) as total
                 from public.pharmacy_inventory
                where p_branch is null or branch_id = p_branch
                group by 1) s)
  ) into out;

  return out;
end;
$$;

-- Admin profit report per treatment.
-- p_branch filters strictly to one branch (admin-only); null = global view.
drop function if exists public.get_profit_report(uuid, int);
drop function if exists public.get_profit_report(uuid);
drop function if exists public.get_profit_report(int);
drop function if exists public.get_profit_report();
create or replace function public.get_profit_report(p_branch uuid default null, limit_count int default 100)
returns table (
  treatment_id uuid, patient_code text, patient_name text,
  encounter_type text, status text, created_at timestamptz,
  total_billed numeric, total_paid numeric, cogs numeric, gross_margin numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.auth_role() <> 'admin' then
    raise exception 'Forbidden';
  end if;
  return query
  select v.treatment_id, v.patient_code, v.patient_name,
         v.encounter_type::text, v.status::text, v.created_at,
         v.total_treatment_fee, v.total_paid, v.cogs, v.gross_margin
    from public.v_profit_summary v
   where p_branch is null or v.branch_id = p_branch
   order by v.created_at desc
   limit greatest(limit_count, 1);
end;
$$;

-- Admin: full detail for one treatment (patient, dispensed items, payments, staff).
drop function if exists public.get_treatment_detail(uuid);
create or replace function public.get_treatment_detail(t uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  out jsonb;
begin
  if public.auth_role() <> 'admin' then
    raise exception 'Forbidden';
  end if;

  select jsonb_build_object(
    'treatment_id', tr.id,
    'patient_id', tr.patient_id,
    'patient_code', p.patient_code,
    'patient_name', p.full_name,
    'phone', p.phone,
    'gender', p.gender,
    'encounter_type', tr.encounter_type::text,
    'category', tr.category,
    'status', tr.status::text,
    'branch_id', tr.branch_id,
    'total_treatment_fee', tr.total_treatment_fee,
    'total_paid', coalesce(pay.total_paid, 0),
    'balance_remaining', tr.total_treatment_fee - coalesce(pay.total_paid, 0),
    'payment_status', case
      when coalesce(pay.total_paid, 0) = 0 then 'UNPAID'
      when coalesce(pay.total_paid, 0) < tr.total_treatment_fee then 'PARTIAL'
      else 'PAID IN FULL'
    end,
    'created_at', tr.created_at,
    'opened_by_name', opr.full_name,
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'item_id', d.item_id,
        'item_name', i.item_name,
        'category', i.category::text,
        'quantity', d.quantity,
        'unit_cost_snapshot', d.unit_cost_snapshot,
        'sell_price_snapshot', d.sell_price_snapshot,
        'handoff_type', d.handoff_type,
        'dispensed_by_name', pr.full_name,
        'dispensed_at', d.dispensed_at,
        'dispensed_to_name', dr.full_name,
        'administered_by_name', ar.full_name,
        'administered_at', d.administered_at
      ) order by d.dispensed_at), '[]'::jsonb)
      from public.treatment_dispensations d
      join public.pharmacy_inventory i on i.id = d.item_id
      left join public.profiles pr on pr.id = d.dispensed_by
      left join public.profiles dr on dr.id = d.dispensed_to
      left join public.profiles ar on ar.id = d.administered_by
      where d.treatment_id = tr.id
    ),
    'payments', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'payment_id', pm.id,
        'receipt_number', pm.receipt_number,
        'amount_paid', pm.amount_paid,
        'payment_method', pm.payment_method::text,
        'cashier_name', cr.full_name,
        'created_at', pm.created_at
      ) order by pm.created_at), '[]'::jsonb)
      from public.payments pm
      left join public.profiles cr on cr.id = pm.cashier_id
      where pm.treatment_id = tr.id
    ),
    'staff', coalesce((
      select jsonb_agg(jsonb_build_object('role', role, 'action', action, 'full_name', full_name))
      from (
        select 'receptionist' as role, 'opened' as action, opr.full_name as full_name
        union all
        select 'dispenser', 'dispensed', pr.full_name
          from public.treatment_dispensations d
          join public.profiles pr on pr.id = d.dispensed_by
         where d.treatment_id = tr.id
        union all
        select 'nurse', 'collected', dr.full_name
          from public.treatment_dispensations d
          join public.profiles dr on dr.id = d.dispensed_to
         where d.treatment_id = tr.id
        union all
        select 'nurse', 'administered', ar.full_name
          from public.treatment_dispensations d
          join public.profiles ar on ar.id = d.administered_by
         where d.treatment_id = tr.id
        union all
        select 'cashier', 'collected payment', cr.full_name
          from public.payments pm
          join public.profiles cr on cr.id = pm.cashier_id
         where pm.treatment_id = tr.id
      ) s
      where s.full_name is not null and s.full_name <> ''
    ), '[]'::jsonb)
  ) into out
  from public.treatments tr
  join public.patients p on p.id = tr.patient_id
  left join public.profiles opr on opr.id = tr.created_by
  left join (
    select treatment_id, sum(amount_paid) as total_paid
      from public.payments group by treatment_id
  ) pay on pay.treatment_id = tr.id
  where tr.id = t;

  if out is null then
    raise exception 'Treatment not found';
  end if;

  return out;
end;
$$;

-- Itemized bill for a treatment. Only patient-facing sell prices - internal
-- purchase costs are never exposed here. Available to cashier, receptionist,
-- dispenser, nurse and admin; scoped to the caller's branch.
drop function if exists public.get_treatment_invoice(uuid);
create or replace function public.get_treatment_invoice(t uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  out jsonb;
begin
  if public.auth_role() not in ('cashier', 'receptionist', 'dispenser', 'nurse', 'admin') then
    raise exception 'Forbidden';
  end if;
  if not public.branch_visible((select branch_id from public.treatments where id = t)) then
    raise exception 'This treatment belongs to another branch';
  end if;

  select jsonb_build_object(
    'treatment_id', tr.id,
    'patient_code', p.patient_code,
    'patient_name', p.full_name,
    'encounter_type', tr.encounter_type::text,
    'status', tr.status::text,
    'total_treatment_fee', tr.total_treatment_fee,
    'total_paid', coalesce(pay.total_paid, 0),
    'balance_remaining', tr.total_treatment_fee - coalesce(pay.total_paid, 0),
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'category', i.category::text,
        'item_name', i.item_name,
        'quantity', d.quantity,
        'sell_price_snapshot', d.sell_price_snapshot,
        'line_total', d.quantity * d.sell_price_snapshot
      ) order by i.category, i.item_name), '[]'::jsonb)
      from public.treatment_dispensations d
      join public.pharmacy_inventory i on i.id = d.item_id
      where d.treatment_id = tr.id
    )
  ) into out
  from public.treatments tr
  join public.patients p on p.id = tr.patient_id
  left join (
    select treatment_id, sum(amount_paid) as total_paid
      from public.payments group by treatment_id
  ) pay on pay.treatment_id = tr.id
  where tr.id = t;

  if out is null then
    raise exception 'Treatment not found';
  end if;

  return out;
end;
$$;

-- Unified receipt / invoice document lookup for the cashier's three paper
-- documents. Returns sell-price itemization only - never purchase costs.
-- Works for finance roles via payments, and for dispenser / nurse review too.
drop function if exists public.get_receipt_document(text);
create or replace function public.get_receipt_document(p_receipt text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tr_branch uuid;
  doc jsonb;
begin
  if public.auth_role() not in ('cashier', 'receptionist', 'dispenser', 'nurse', 'admin') then
    raise exception 'Forbidden';
  end if;

  select t.branch_id into tr_branch
    from public.payments pm
    join public.treatments t on t.id = pm.treatment_id
   where pm.receipt_number = p_receipt;

  if tr_branch is null then
    raise exception 'Receipt not found';
  end if;
  if public.auth_role() <> 'admin' and not public.branch_visible(tr_branch) then
    raise exception 'This receipt belongs to another branch';
  end if;

  select jsonb_build_object(
    'receipt_number', pm.receipt_number,
    'payment_id', pm.id,
    'amount_paid', pm.amount_paid,
    'payment_method', pm.payment_method::text,
    'paid_at', pm.created_at,
    'treatment_id', tr.id,
    'patient_code', p.patient_code,
    'patient_name', p.full_name,
    'encounter_type', tr.encounter_type::text,
    'category', tr.category,
    'status', tr.status::text,
    'total_treatment_fee', tr.total_treatment_fee,
    'total_paid', coalesce(pay.total_paid, 0),
    'balance_remaining', tr.total_treatment_fee - coalesce(pay.total_paid, 0),
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'category', i.category::text,
        'item_name', i.item_name,
        'quantity', d.quantity,
        'sell_price_snapshot', d.sell_price_snapshot,
        'line_total', d.quantity * d.sell_price_snapshot
      ) order by i.category, i.item_name), '[]'::jsonb)
      from public.treatment_dispensations d
      join public.pharmacy_inventory i on i.id = d.item_id
      where d.treatment_id = tr.id
    )
  ) into doc
  from public.payments pm
  join public.treatments tr on tr.id = pm.treatment_id
  join public.patients p on p.id = tr.patient_id
  left join (
    select treatment_id, sum(amount_paid) as total_paid
      from public.payments group by treatment_id
  ) pay on pay.treatment_id = tr.id
  where pm.receipt_number = p_receipt;

  return doc;
end;
$$;

-- Admin audit log.
drop function if exists public.get_audit_log(int);
create or replace function public.get_audit_log(limit_count int default 200)
returns table (
  id bigint, actor_name text, action text, entity text,
  details jsonb, created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.auth_role() <> 'admin' then
    raise exception 'Forbidden';
  end if;
  return query
  select a.id, coalesce(p.full_name, 'system'), a.action, a.entity,
         a.details, a.created_at
    from public.audit_log a
    left join public.profiles p on p.id = a.actor_id
   order by a.created_at desc
   limit greatest(limit_count, 1);
end;
$$;

-- Admin user management (now also carries each staff member's branch).
drop function if exists public.get_users_admin();
create or replace function public.get_users_admin()
returns table (
  id uuid, email text, full_name text, role text, is_active boolean, created_at timestamptz,
  branch_id uuid, branch_name text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.auth_role() <> 'admin' then
    raise exception 'Forbidden';
  end if;
  return query
  select pr.id, u.email, pr.full_name, pr.role,
         (u.banned_until is null), u.created_at,
         pr.branch_id, br.name
    from public.profiles pr
    join auth.users u on u.id = pr.id
    left join public.branches br on br.id = pr.branch_id
   order by u.created_at desc;
end;
$$;

drop function if exists public.set_user_role(uuid, text);
create or replace function public.set_user_role(user_id uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.auth_role() <> 'admin' then
    raise exception 'Forbidden';
  end if;
  if new_role not in ('receptionist', 'nurse', 'dispenser', 'cashier', 'admin') then
    raise exception 'Invalid role';
  end if;
  update public.profiles set role = new_role where id = user_id;
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'ROLE_CHANGE', 'profiles', user_id,
          jsonb_build_object('role', new_role));
end;
$$;

-- Admin assigns a staff member to a branch (null clears the assignment).
drop function if exists public.admin_set_user_branch(uuid, uuid);
create or replace function public.admin_set_user_branch(user_id uuid, new_branch uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.auth_role() <> 'admin' then
    raise exception 'Forbidden';
  end if;
  if new_branch is not null and not exists (select 1 from public.branches where id = new_branch) then
    raise exception 'Unknown branch';
  end if;
  update public.profiles set branch_id = new_branch where id = user_id;
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'BRANCH_CHANGE', 'profiles', user_id,
          jsonb_build_object('branch_id', new_branch));
end;
$$;

-- Admin creates a staff account (email + password login, profile auto-created by trigger).
drop function if exists public.admin_create_user(text, text, text, text);
create or replace function public.admin_create_user(
  p_email text, p_full_name text, p_role text, p_password text
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  new_id uuid := gen_random_uuid();
  clean_email text := lower(btrim(p_email));
begin
  if public.auth_role() <> 'admin' then
    raise exception 'Forbidden';
  end if;
  if p_role not in ('receptionist', 'nurse', 'dispenser', 'cashier', 'admin') then
    raise exception 'Invalid role';
  end if;
  if clean_email not like '%_@__%.__%' then
    raise exception 'Invalid email';
  end if;
  if length(p_password) < 8 then
    raise exception 'Password must be at least 8 characters';
  end if;
  if exists (select 1 from auth.users where lower(email) = clean_email) then
    raise exception 'An account with that email already exists';
  end if;

  insert into auth.users (id, email, encrypted_password, email_confirmed_at,
                          raw_user_meta_data, aud, role, created_at, updated_at)
  values (
    new_id, clean_email, extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    jsonb_build_object('full_name', p_full_name, 'role', p_role),
    'authenticated', 'authenticated', now(), now()
  );

  insert into auth.identities (id, user_id, identity_data, provider, provider_id,
                               last_sign_in_at, created_at, updated_at)
  values (
    new_id, new_id,
    jsonb_build_object('sub', new_id::text, 'email', clean_email),
    'email', clean_email, now(), now(), now()
  );

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'USER_CREATE', 'users', new_id,
          jsonb_build_object('email', clean_email, 'role', p_role));

  return new_id;
end;
$$;

-- Admin edits a staff member's full name + role in one save.
drop function if exists public.admin_update_user(uuid, text, text);
create or replace function public.admin_update_user(p_user_id uuid, p_full_name text, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.auth_role() <> 'admin' then
    raise exception 'Forbidden';
  end if;
  if p_role not in ('receptionist', 'nurse', 'dispenser', 'cashier', 'admin') then
    raise exception 'Invalid role';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Staff member not found';
  end if;
  update public.profiles
     set full_name = p_full_name, role = p_role
   where id = p_user_id;
  update auth.users
     set raw_user_meta_data = jsonb_build_object('full_name', p_full_name, 'role', p_role)
   where id = p_user_id;
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'USER_UPDATE', 'profiles', p_user_id,
          jsonb_build_object('full_name', p_full_name, 'role', p_role));
end;
$$;

-- Admin sets a temporary/known password (must be re-confirmed on next normal reset).
drop function if exists public.admin_reset_password(uuid, text);
create or replace function public.admin_reset_password(p_user_id uuid, p_new_password text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if public.auth_role() <> 'admin' then
    raise exception 'Forbidden';
  end if;
  if length(p_new_password) < 8 then
    raise exception 'Password must be at least 8 characters';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Staff member not found';
  end if;
  update auth.users
     set encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
         updated_at = now()
   where id = p_user_id;
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'USER_PASSWORD_RESET', 'users', p_user_id,
          jsonb_build_object('method', 'admin'));
end;
$$;

-- Admin activates / deactivates a staff member (deactivated accounts cannot sign in).
drop function if exists public.admin_set_user_active(uuid, boolean);
create or replace function public.admin_set_user_active(p_user_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.auth_role() <> 'admin' then
    raise exception 'Forbidden';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Staff member not found';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot deactivate your own account';
  end if;
  update auth.users
     set banned_until = case when p_active then null else '2099-01-01'::timestamptz end,
         updated_at = now()
   where id = p_user_id;
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'USER_' || case when p_active then 'ACTIVATE' else 'DEACTIVATE' end,
          'users', p_user_id, '{}'::jsonb);
end;
$$;

-- Inventory restock / adjustment.
drop function if exists public.adjust_stock(uuid, int);
create or replace function public.adjust_stock(item uuid, delta int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare curr int;
begin
  if public.auth_role() not in ('dispenser', 'nurse', 'admin') then
    raise exception 'Forbidden';
  end if;
  select stock_quantity into curr from public.pharmacy_inventory where id = item;
  if curr is null then raise exception 'Item not found'; end if;
  if curr + delta < 0 then
    raise exception 'Cannot adjust below zero (current: %, delta: %)', curr, delta;
  end if;
  update public.pharmacy_inventory
     set stock_quantity = curr + delta, updated_at = now()
   where id = item;
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'STOCK_ADJUST', 'pharmacy_inventory', item,
          jsonb_build_object('delta', delta, 'new_quantity', curr + delta));
end;
$$;

-- Change the internal unit cost price of an item (price fluctuations).
drop function if exists public.set_item_cost(uuid, numeric);
create or replace function public.set_item_cost(item uuid, new_cost numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  old_cost numeric;
  item_branch uuid;
begin
  if public.auth_role() not in ('dispenser', 'admin') then
    raise exception 'Forbidden';
  end if;
  if new_cost < 0 then
    raise exception 'Unit cost cannot be negative';
  end if;
  select unit_cost_price, branch_id into old_cost, item_branch from public.pharmacy_inventory where id = item;
  if old_cost is null then
    raise exception 'Item not found';
  end if;
  if public.auth_role() <> 'admin' and not public.branch_visible(item_branch) then
    raise exception 'This item belongs to another branch';
  end if;
  update public.pharmacy_inventory
     set unit_cost_price = new_cost, updated_at = now()
   where id = item;
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'STOCK_COST_CHANGE', 'pharmacy_inventory', item,
          jsonb_build_object('old_cost', old_cost, 'new_cost', new_cost));
end;
$$;

-- Change the patient-facing sell price of an item.
drop function if exists public.set_item_sell_price(uuid, numeric);
create or replace function public.set_item_sell_price(item uuid, new_price numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  old_price numeric;
  item_branch uuid;
begin
  if public.auth_role() not in ('dispenser', 'nurse', 'admin') then
    raise exception 'Forbidden';
  end if;
  if new_price < 0 then
    raise exception 'Sell price cannot be negative';
  end if;
  select sell_price, branch_id into old_price, item_branch from public.pharmacy_inventory where id = item;
  if old_price is null then
    raise exception 'Item not found';
  end if;
  if public.auth_role() <> 'admin' and not public.branch_visible(item_branch) then
    raise exception 'This item belongs to another branch';
  end if;
  update public.pharmacy_inventory
     set sell_price = new_price, updated_at = now()
   where id = item;
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'STOCK_SELL_PRICE_CHANGE', 'pharmacy_inventory', item,
          jsonb_build_object('old_price', old_price, 'new_price', new_price));
end;
$$;

-- ============================================================
-- RLS POLICIES (drop-first so the script is re-runnable)
-- Branch semantics: admin sees all; unassigned/legacy rows (branch_id null)
-- stay visible to everyone until an admin assigns branches.
-- ============================================================

-- BRANCHES
drop policy if exists "branches_select_authed" on public.branches;
create policy "branches_select_authed" on public.branches
  for select to authenticated using (true);

drop policy if exists "branches_admin_write" on public.branches;
create policy "branches_admin_write" on public.branches
  for all to authenticated using (public.auth_role() = 'admin')
  with check (public.auth_role() = 'admin');

-- PROFILES
drop policy if exists "profiles_select_authed" on public.profiles;
create policy "profiles_select_authed" on public.profiles
  for select to authenticated
  using (
    public.auth_role() = 'admin'
    or id = auth.uid()
    or branch_id is null
    or branch_id = public.user_branch()
  );

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles
  for update to authenticated using (public.auth_role() = 'admin');

-- PATIENTS
drop policy if exists "patients_select_authed" on public.patients;
create policy "patients_select_authed" on public.patients
  for select to authenticated
  using (
    public.auth_role() = 'admin'
    or branch_id is null
    or branch_id = public.user_branch()
  );

drop policy if exists "patients_insert_receptionist_admin" on public.patients;
create policy "patients_insert_receptionist_admin" on public.patients
  for insert to authenticated
  with check (
    public.auth_role() in ('receptionist', 'cashier', 'admin')
    and (public.auth_role() = 'admin'
         or branch_id is null
         or branch_id = public.user_branch())
  );

drop policy if exists "patients_update_admin" on public.patients;
create policy "patients_update_admin" on public.patients
  for update to authenticated using (public.auth_role() = 'admin');

drop policy if exists "patients_delete_admin" on public.patients;
create policy "patients_delete_admin" on public.patients
  for delete to authenticated using (public.auth_role() = 'admin');

-- INTAKE / TREATMENT CATEGORIES
drop policy if exists "category_select_authed" on public.treatment_categories;
create policy "category_select_authed" on public.treatment_categories
  for select to authenticated using (true);

drop policy if exists "category_admin_write" on public.treatment_categories;
create policy "category_admin_write" on public.treatment_categories
  for all to authenticated
  using (public.auth_role() = 'admin')
  with check (public.auth_role() = 'admin');

-- TREATMENTS
drop policy if exists "treatments_select_authed" on public.treatments;
create policy "treatments_select_authed" on public.treatments
  for select to authenticated
  using (
    public.auth_role() = 'admin'
    or branch_id is null
    or branch_id = public.user_branch()
  );

drop policy if exists "treatments_insert_receptionist_admin" on public.treatments;
create policy "treatments_insert_receptionist_admin" on public.treatments
  for insert to authenticated
  with check (
    public.auth_role() in ('receptionist', 'cashier', 'admin')
    and (public.auth_role() = 'admin'
         or branch_id is null
         or branch_id = public.user_branch())
  );

drop policy if exists "treatments_update_cashier_admin" on public.treatments;
create policy "treatments_update_cashier_admin" on public.treatments
  for update to authenticated
  using (
    public.auth_role() in ('cashier', 'receptionist', 'admin')
    and (public.auth_role() = 'admin'
         or branch_id is null
         or branch_id = public.user_branch())
  );

drop policy if exists "treatments_cancel_creator" on public.treatments;
create policy "treatments_cancel_creator" on public.treatments
  for update to authenticated
  using (
    public.auth_role() = 'receptionist' and created_by = auth.uid() and status = 'active'
    and (branch_id is null or branch_id = public.user_branch())
  )
  with check (
    status = 'cancelled'
    or encounter_type in ('one_time', 'admission', 'recurring')
  );

drop policy if exists "treatments_update_encounter_receptionist_admin" on public.treatments;
create policy "treatments_update_encounter_receptionist_admin" on public.treatments
  for update to authenticated
  using (
    public.auth_role() in ('receptionist', 'cashier', 'admin')
    and (public.auth_role() = 'admin'
         or branch_id is null
         or branch_id = public.user_branch())
  )
  with check (
    public.auth_role() in ('receptionist', 'cashier', 'admin')
    and status = 'active'
    and (public.auth_role() = 'admin'
         or branch_id is null
         or branch_id = public.user_branch())
  );

drop policy if exists "treatments_delete_admin" on public.treatments;
create policy "treatments_delete_admin" on public.treatments
  for delete to authenticated using (public.auth_role() = 'admin');

-- DISPENSE INVENTORY
drop policy if exists "inventory_select_all" on public.pharmacy_inventory;
create policy "inventory_select_all" on public.pharmacy_inventory
  for select to authenticated
  using (
    public.auth_role() in ('dispenser', 'nurse', 'admin')
    and (public.auth_role() = 'admin'
         or branch_id is null
         or branch_id = public.user_branch())
  );

drop policy if exists "inventory_insert_all" on public.pharmacy_inventory;
create policy "inventory_insert_all" on public.pharmacy_inventory
  for insert to authenticated
  with check (
    public.auth_role() in ('dispenser', 'nurse', 'admin')
    and (public.auth_role() = 'admin'
         or branch_id is null
         or branch_id = public.user_branch())
  );

drop policy if exists "inventory_update_all" on public.pharmacy_inventory;
create policy "inventory_update_all" on public.pharmacy_inventory
  for update to authenticated
  using (
    public.auth_role() in ('dispenser', 'nurse', 'admin')
    and (public.auth_role() = 'admin'
         or branch_id is null
         or branch_id = public.user_branch())
  );

drop policy if exists "inventory_delete_admin" on public.pharmacy_inventory;
create policy "inventory_delete_admin" on public.pharmacy_inventory
  for delete to authenticated using (public.auth_role() = 'admin');

-- DISPENSATIONS
drop policy if exists "dispense_insert_staff" on public.treatment_dispensations;
create policy "dispense_insert_staff" on public.treatment_dispensations
  for insert to authenticated
  with check (
    public.auth_role() in ('dispenser', 'nurse', 'admin')
    and (public.auth_role() = 'admin'
         or exists (
           select 1 from public.treatments tt
            where tt.id = treatment_id
              and (tt.branch_id is null or tt.branch_id = public.user_branch())
         ))
  );

drop policy if exists "dispense_delete_admin" on public.treatment_dispensations;
create policy "dispense_delete_admin" on public.treatment_dispensations
  for delete to authenticated using (public.auth_role() = 'admin');

-- PAYMENTS
drop policy if exists "payments_select_cashier_admin" on public.payments;
create policy "payments_select_cashier_admin" on public.payments
  for select to authenticated
  using (
    public.auth_role() in ('cashier', 'receptionist', 'admin')
    and (public.auth_role() = 'admin'
         or exists (
           select 1 from public.treatments tt
            where tt.id = treatment_id
              and (tt.branch_id is null or tt.branch_id = public.user_branch())
         ))
  );

drop policy if exists "payments_insert_cashier_admin" on public.payments;
create policy "payments_insert_cashier_admin" on public.payments
  for insert to authenticated
  with check (
    public.auth_role() in ('cashier', 'receptionist', 'admin')
    and (public.auth_role() = 'admin'
         or exists (
           select 1 from public.treatments tt
            where tt.id = treatment_id
              and (tt.branch_id is null or tt.branch_id = public.user_branch())
         ))
  );

drop policy if exists "payments_update_cashier_admin" on public.payments;
create policy "payments_update_cashier_admin" on public.payments
  for update to authenticated
  using (
    public.auth_role() in ('cashier', 'receptionist', 'admin')
    and (public.auth_role() = 'admin'
         or exists (
           select 1 from public.treatments tt
            where tt.id = treatment_id
              and (tt.branch_id is null or tt.branch_id = public.user_branch())
         ))
  );

drop policy if exists "payments_delete_admin" on public.payments;
create policy "payments_delete_admin" on public.payments
  for delete to authenticated using (public.auth_role() = 'admin');

-- AUDIT LOG
drop policy if exists "audit_select_admin" on public.audit_log;
create policy "audit_select_admin" on public.audit_log
  for select to authenticated using (public.auth_role() = 'admin');

-- VITALS
drop policy if exists "vitals_select_nurse_admin" on public.treatment_vitals;
create policy "vitals_select_nurse_admin" on public.treatment_vitals
  for select to authenticated
  using (
    public.auth_role() in ('nurse', 'admin')
    and (public.auth_role() = 'admin'
         or exists (
           select 1 from public.treatments tt
            where tt.id = treatment_id
              and (tt.branch_id is null or tt.branch_id = public.user_branch())
         ))
  );

drop policy if exists "vitals_insert_nurse_admin" on public.treatment_vitals;
create policy "vitals_insert_nurse_admin" on public.treatment_vitals
  for insert to authenticated
  with check (
    public.auth_role() in ('nurse', 'admin')
    and (public.auth_role() = 'admin'
         or exists (
           select 1 from public.treatments tt
            where tt.id = treatment_id
              and (tt.branch_id is null or tt.branch_id = public.user_branch())
         ))
  );

drop policy if exists "vitals_delete_admin" on public.treatment_vitals;
create policy "vitals_delete_admin" on public.treatment_vitals
  for delete to authenticated using (public.auth_role() = 'admin');

-- ============================================================
-- GRANTS
-- ============================================================
grant usage on schema public to anon, authenticated;

grant select on public.branches to authenticated;
grant select, insert, update, delete on public.branches to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.patients to authenticated;
grant select, insert, update, delete on public.treatments to authenticated;
grant select, insert, update, delete on public.pharmacy_inventory to authenticated;
grant insert, delete, select on public.treatment_dispensations to authenticated;
grant select, insert, update, delete on public.payments to authenticated;
grant select on public.v_treatment_balance to authenticated;
grant select on public.v_stock_status to authenticated;
grant select on public.v_profit_summary to authenticated;
grant select on public.audit_log to authenticated;
grant select, insert, delete on public.treatment_vitals to authenticated;

grant execute on function public.auth_role() to authenticated;
grant execute on function public.user_branch() to authenticated;
grant execute on function public.branch_visible(uuid) to authenticated;
grant execute on function public.get_pharmacy_log(int) to authenticated;
grant execute on function public.get_item_usage(uuid) to authenticated;
grant execute on function public.get_dispensable_items() to authenticated;
grant execute on function public.get_my_administrations(int) to authenticated;
grant execute on function public.get_dispense_recipients() to authenticated;
grant execute on function public.get_my_pending_dispensations(int) to authenticated;
grant execute on function public.confirm_dispense_administration(uuid) to authenticated;
grant execute on function public.get_my_dispense_history(int) to authenticated;
grant execute on function public.get_admin_kpis(uuid) to authenticated;
grant execute on function public.get_profit_report(uuid, int) to authenticated;
grant execute on function public.get_treatment_detail(uuid) to authenticated;
grant execute on function public.get_treatment_invoice(uuid) to authenticated;
grant execute on function public.get_receipt_document(text) to authenticated;
grant execute on function public.get_audit_log(int) to authenticated;
grant execute on function public.get_users_admin() to authenticated;
grant execute on function public.set_user_role(uuid, text) to authenticated;
grant execute on function public.admin_set_user_branch(uuid, uuid) to authenticated;
grant execute on function public.admin_create_user(text, text, text, text) to authenticated;
grant execute on function public.admin_update_user(uuid, text, text) to authenticated;
grant execute on function public.admin_reset_password(uuid, text) to authenticated;
grant execute on function public.admin_set_user_active(uuid, boolean) to authenticated;
grant execute on function public.adjust_stock(uuid, int) to authenticated;
grant execute on function public.set_item_cost(uuid, numeric) to authenticated;
grant execute on function public.set_item_sell_price(uuid, numeric) to authenticated;
grant execute on function public.treatment_end(uuid) to authenticated;
grant execute on function public.cancel_treatment(uuid) to authenticated;

-- ============================================================
-- FIRST ADMIN BOOTSTRAP
-- After creating your very first user in the Supabase dashboard, run:
--
--   update public.profiles
--      set role = 'admin'
--    where id = (select id from auth.users order by created_at asc limit 1);
--
-- ============================================================