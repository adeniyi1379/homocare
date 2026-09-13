-- ============================================================
-- HOMECARE HOSPITAL MANAGEMENT SYSTEM - Supabase Schema
-- Run this in the Supabase SQL editor (public schema).
-- ============================================================

create extension if not exists pgcrypto;

-- ============================================================
-- ROLES: profiles row drives RBAC. First user bootstrap at bottom.
-- ============================================================
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  full_name     text not null default '',
  role          text not null default 'receptionist'
                check (role in ('receptionist', 'nurse', 'pharmacy', 'cashier', 'admin')),
  created_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'role', 'receptionist')
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
create or replace function public.auth_role()
returns text
language sql
stable
as $$
  select coalesce((select role::text from public.profiles where id = auth.uid()), '');
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

do $$ begin
  create type public.item_type_enum as enum ('tablet', 'syrup', 'injection', 'consumable');
exception when duplicate_object then null; end $$;

-- ============================================================
-- TABLES
-- ============================================================

-- PATIENTS ----------
create table if not exists public.patients (
  id            uuid primary key default gen_random_uuid(),
  patient_code  text unique,
  full_name     text not null,
  phone         text,
  gender        text check (gender in ('male', 'female')),
  registered_by uuid references auth.users (id),
  created_at    timestamptz not null default now()
);

alter table public.patients enable row level security;

create index if not exists idx_patients_created_at on public.patients (created_at desc);

-- Sequential per-year patient codes: HC-YYYY-XXXX
create table if not exists public.patient_code_counters (
  year       integer primary key,
  last_value integer not null default 0
);

create or replace function public.generate_patient_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  y int := extract(year from now());
  n int;
begin
  insert into public.patient_code_counters (year, last_value)
  values (y, 1)
  on conflict (year) do update set last_value = public.patient_code_counters.last_value + 1
  returning last_value into n;
  return format('HC-%s-%s', y, to_char(n, 'FM0000'));
end;
$$;

create or replace function public.set_patient_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.patient_code is null then
    new.patient_code := public.generate_patient_code();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_patient_code on public.patients;
create trigger trg_set_patient_code
  before insert on public.patients
  for each row execute function public.set_patient_code();

-- TREATMENTS (encounter master) ----------
create table if not exists public.treatments (
  id                   uuid primary key default gen_random_uuid(),
  patient_id           uuid not null references public.patients (id) on delete cascade,
  encounter_type       public.encounter_enum not null,
  category             text,
  status               public.status_enum not null default 'active',
  total_treatment_fee  numeric(12, 2) not null default 0.00,
  created_by           uuid references auth.users (id),
  created_at           timestamptz not null default now()
);

alter table public.treatments enable row level security;

create index if not exists idx_treatments_patient on public.treatments (patient_id);
create index if not exists idx_treatments_status on public.treatments (status);

-- PHARMACY INVENTORY ----------
create table if not exists public.pharmacy_inventory (
  id              uuid primary key default gen_random_uuid(),
  item_name       text not null,
  item_type       public.item_type_enum not null default 'tablet',
  stock_quantity  integer not null default 0 check (stock_quantity >= 0),
  reorder_level   integer not null default 10,
  unit_cost_price numeric(10, 2) not null default 0 check (unit_cost_price >= 0),
  updated_at      timestamptz not null default now()
);

alter table public.pharmacy_inventory enable row level security;

-- TREATMENT DISPENSATIONS (internal audit ledger - hidden from client/cashier) ----------
create table if not exists public.treatment_dispensations (
  id                  uuid primary key default gen_random_uuid(),
  treatment_id        uuid not null references public.treatments (id) on delete cascade,
  item_id             uuid not null references public.pharmacy_inventory (id),
  quantity            integer not null check (quantity > 0),
  unit_cost_snapshot  numeric(10, 2) not null,
  dispensed_by        uuid references auth.users (id),
  dispensed_at        timestamptz not null default now()
);

alter table public.treatment_dispensations enable row level security;

create index if not exists idx_disp_treatment on public.treatment_dispensations (treatment_id);

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
-- STOCK CONTROL: dispensing decrements inventory + low-stock flags
-- ============================================================

-- Admit dispensation before insert (insufficient stock -> hard error).
create or replace function public.check_dispense_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  avail int;
  curr_status text;
  check_paid numeric;
  paid numeric;
begin
  select stock_quantity into avail
    from public.pharmacy_inventory
   where id = new.item_id;

  if avail is null then
    raise exception 'Inventory item not found';
  end if;
  if avail < new.quantity then
    raise exception 'Insufficient stock: only % left of item %', avail, new.item_id;
  end if;

  select status into curr_status from public.treatments where id = new.treatment_id;
  if curr_status is null then
    raise exception 'Treatment not found';
  end if;
  if curr_status in ('completed', 'cancelled') then
    raise exception 'Cannot dispense to a % treatment', curr_status;
  end if;

  if new.unit_cost_snapshot is null or new.unit_cost_snapshot = 0 then
    select coalesce(unit_cost_price, 0) into check_paid
      from public.pharmacy_inventory where id = new.item_id;
    new.unit_cost_snapshot := check_paid;
  end if;

  new.dispensed_by := coalesce(new.dispensed_by, auth.uid());
  return new;
end;
$$;

drop trigger if exists trg_check_dispense_stock on public.treatment_dispensations;
create trigger trg_check_dispense_stock
  before insert on public.treatment_dispensations
  for each row execute function public.check_dispense_stock();

-- Decrement stock + audit after dispensation.
create or replace function public.decrement_stock_after_dispense()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.pharmacy_inventory
     set stock_quantity = stock_quantity - new.quantity,
         updated_at = now()
   where id = new.item_id;

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (new.dispensed_by, 'DISPENSE', 'treatment_dispensations', new.id,
          jsonb_build_object(
            'treatment_id', new.treatment_id,
            'item_id', new.item_id,
            'quantity', new.quantity,
            'unit_cost_snapshot', new.unit_cost_snapshot));
  return new;
end;
$$;

drop trigger if exists trg_decrement_stock on public.treatment_dispensations;
create trigger trg_decrement_stock
  after insert on public.treatment_dispensations
  for each row execute function public.decrement_stock_after_dispense();

-- ============================================================
-- PAYMENTS: audit + auto-complete one-time encounters when settled
-- ============================================================
create or replace function public.recalc_treatment_status(t uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  fee   numeric;
  paid  numeric;
  etype text;
  st    text;
begin
  if t is null then return; end if;

  select total_treatment_fee, encounter_type::text, status::text
    into fee, etype, st
    from public.treatments where id = t;
  if fee is null then return; end if;

  select coalesce(sum(amount_paid), 0) into paid
    from public.payments where treatment_id = t;

  perform public.set_treatment_status(t,
    case
      when etype = 'one_time' and paid >= fee and st in ('active', 'discharged') then 'completed'
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

-- ============================================================
-- VIEWS
-- ============================================================

-- Cashier / Admin led see treatment + running balance.
create or replace view public.v_treatment_balance
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

-- Pharmacy stock monitor with low-stock flag.
create or replace view public.v_stock_status
with (security_invoker = true) as
select
  id,
  item_name,
  item_type,
  stock_quantity,
  reorder_level,
  unit_cost_price,
  updated_at,
  (stock_quantity <= reorder_level) as is_low_stock,
  case
    when stock_quantity <= 0 then 'OUT OF STOCK'
    when stock_quantity <= reorder_level then 'LOW'
    else 'OK'
  end as stock_status
from public.pharmacy_inventory;

-- Admin profit / reconciliation ledger.
create or replace view public.v_profit_summary
with (security_invoker = true) as
select
  tr.id                 as treatment_id,
  p.patient_code,
  p.full_name           as patient_name,
  tr.encounter_type,
  tr.category,
  tr.status,
  tr.created_at,
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

-- Cost column is returned ONLY to pharmacy / admin.
create or replace function public.get_pharmacy_log(limit_count int default 50)
returns table (
  treatment_id uuid, patient_code text, patient_name text,
  item_name text, quantity int, unit_cost_snapshot numeric,
  dispensed_by_name text, dispensed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.auth_role() not in ('pharmacy', 'admin') then
    raise exception 'Forbidden';
  end if;
  return query
  select d.treatment_id, p.patient_code, p.full_name,
         i.item_name, d.quantity, d.unit_cost_snapshot,
         pr.full_name, d.dispensed_at
    from public.treatment_dispensations d
    join public.treatments tr on tr.id = d.treatment_id
    join public.patients p on p.id = tr.patient_id
    join public.pharmacy_inventory i on i.id = d.item_id
    left join public.profiles pr on pr.id = d.dispensed_by
   order by d.dispensed_at desc
   limit greatest(limit_count, 1);
end;
$$;

-- Nurse sees own administrations only, WITHOUT internal costs.
create or replace function public.get_dispensable_items()
returns table (
  id uuid, item_name text, item_type text, stock_quantity int
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.auth_role() not in ('nurse', 'pharmacy', 'admin') then
    raise exception 'Forbidden';
  end if;
  return query
  select i.id, i.item_name, i.item_type::text, i.stock_quantity
    from public.pharmacy_inventory i
   where i.stock_quantity > 0
   order by i.item_name;
end;
$$;

create or replace function public.get_my_administrations(limit_count int default 50)
returns table (
  treatment_id uuid, patient_code text, patient_name text,
  item_name text, item_type text, quantity int, dispensed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.auth_role() not in ('nurse', 'admin') then
    raise exception 'Forbidden';
  end if;
  return query
  select d.treatment_id, p.patient_code, p.full_name,
         i.item_name, i.item_type::text, d.quantity, d.dispensed_at
    from public.treatment_dispensations d
    join public.treatments tr on tr.id = d.treatment_id
    join public.patients p on p.id = tr.patient_id
    join public.pharmacy_inventory i on i.id = d.item_id
   where d.dispensed_by = auth.uid()
   order by d.dispensed_at desc
   limit greatest(limit_count, 1);
end;
$$;

-- Admin operational dashboard KPIs.
create or replace function public.get_admin_kpis()
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
      (select count(*) from public.patients),
    'patients_today',
      (select count(*) from public.patients where created_at::date = current_date),
    'active_treatments',
      (select count(*) from public.treatments where status in ('active', 'discharged')),
    'admissions_active',
      (select count(*) from public.treatments where encounter_type = 'admission' and status = 'active'),
    'completed_treatments',
      (select count(*) from public.treatments where status = 'completed'),
    'revenue_today',
      (select coalesce(sum(amount_paid), 0) from public.payments where created_at::date = current_date),
    'revenue_total',
      (select coalesce(sum(amount_paid), 0) from public.payments),
    'outstanding_balance',
      (select coalesce(sum(greatest(tr.total_treatment_fee - coalesce(p.total_paid, 0), 0)), 0)
         from public.treatments tr
         left join (select treatment_id, sum(amount_paid) total_paid
                      from public.payments group by treatment_id) p
           on p.treatment_id = tr.id
        where tr.status <> 'cancelled'),
    'low_stock_count',
      (select count(*) from public.pharmacy_inventory where stock_quantity <= reorder_level),
    'out_of_stock_count',
      (select count(*) from public.pharmacy_inventory where stock_quantity = 0),
    'inventory_value',
      (select coalesce(sum(stock_quantity * unit_cost_price), 0) from public.pharmacy_inventory),
    'inventory_sell_value',
      (select coalesce(sum(quantity * unit_cost_snapshot), 0) from public.treatment_dispensations),
    'dispensations_total',
      (select count(*) from public.treatment_dispensations),
    'dispensations_today',
      (select count(*) from public.treatment_dispensations where dispensed_at::date = current_date),
    'payments_method_breakdown',
      (select coalesce(jsonb_object_agg(method, total), '{}'::jsonb)
         from (select payment_method::text as method, count(*) as total
                 from public.payments group by payment_method) s),
    'encounter_breakdown',
      (select coalesce(jsonb_object_agg(etype, total), '{}'::jsonb)
         from (select encounter_type::text as etype, count(*) as total
                 from public.treatments group by encounter_type) s),
    'status_breakdown',
      (select coalesce(jsonb_object_agg(st, total), '{}'::jsonb)
         from (select status::text as st, count(*) as total
                 from public.treatments group by status) s),
    'stock_level_breakdown',
      (select coalesce(jsonb_object_agg(stock_status, total), '{}'::jsonb)
         from (select case when stock_quantity <= 0 then 'out'
                           when stock_quantity <= reorder_level then 'low'
                           else 'ok' end as stock_status,
                      count(*) as total
                 from public.pharmacy_inventory group by 1) s)
  ) into out;

  return out;
end;
$$;

-- Admin profit report per treatment.
create or replace function public.get_profit_report(limit_count int default 100)
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
   order by v.created_at desc
   limit greatest(limit_count, 1);
end;
$$;

-- Admin audit log.
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

-- Admin user management.
create or replace function public.get_users_admin()
returns table (
  id uuid, email text, full_name text, role text, created_at timestamptz
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
  select pr.id, u.email, pr.full_name, pr.role, u.created_at
    from public.profiles pr
    join auth.users u on u.id = pr.id
   order by u.created_at desc;
end;
$$;

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
  if new_role not in ('receptionist', 'nurse', 'pharmacy', 'cashier', 'admin') then
    raise exception 'Invalid role';
  end if;
  update public.profiles set role = new_role where id = user_id;
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'ROLE_CHANGE', 'profiles', user_id,
          jsonb_build_object('role', new_role));
end;
$$;

-- Inventory restock / adjustment.
create or replace function public.adjust_stock(item uuid, delta int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare curr int;
begin
  if public.auth_role() not in ('pharmacy', 'admin') then
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

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- PROFILES: everyone authenticated can read display names/roles; only admin writes.
create policy "profiles_select_authed" on public.profiles
  for select to authenticated using (true);

create policy "profiles_update_admin" on public.profiles
  for update to authenticated using (public.auth_role() = 'admin');

-- PATIENTS
create policy "patients_select_authed" on public.patients
  for select to authenticated using (true);

create policy "patients_insert_receptionist_admin" on public.patients
  for insert to authenticated with check (public.auth_role() in ('receptionist', 'admin'));

create policy "patients_update_admin" on public.patients
  for update to authenticated using (public.auth_role() = 'admin');

create policy "patients_delete_admin" on public.patients
  for delete to authenticated using (public.auth_role() = 'admin');

-- TREATMENTS
create policy "treatments_select_authed" on public.treatments
  for select to authenticated using (true);

create policy "treatments_insert_receptionist_admin" on public.treatments
  for insert to authenticated with check (public.auth_role() in ('receptionist', 'admin'));

create policy "treatments_update_cashier_admin" on public.treatments
  for update to authenticated using (public.auth_role() in ('cashier', 'admin'));

create policy "treatments_cancel_creator" on public.treatments
  for update to authenticated
  using (public.auth_role() = 'receptionist' and created_by = auth.uid() and status = 'active')
  with check (status = 'cancelled');

create policy "treatments_delete_admin" on public.treatments
  for delete to authenticated using (public.auth_role() = 'admin');

-- PHARMACY INVENTORY: cashier / nurse / receptionist can NEVER see costs or stock.
create policy "inventory_select_pharmacy_admin" on public.pharmacy_inventory
  for select to authenticated using (public.auth_role() in ('pharmacy', 'admin'));

create policy "inventory_insert_pharmacy_admin" on public.pharmacy_inventory
  for insert to authenticated with check (public.auth_role() in ('pharmacy', 'admin'));

create policy "inventory_update_pharmacy_admin" on public.pharmacy_inventory
  for update to authenticated using (public.auth_role() in ('pharmacy', 'admin'));

create policy "inventory_delete_admin" on public.pharmacy_inventory
  for delete to authenticated using (public.auth_role() = 'admin');

-- DISPENSATIONS: no direct SELECT (nurse/pharmacy/admin read via RPC).
create policy "dispense_insert_pharmacy_nurse_admin" on public.treatment_dispensations
  for insert to authenticated with check (public.auth_role() in ('pharmacy', 'nurse', 'admin'));

create policy "dispense_delete_admin" on public.treatment_dispensations
  for delete to authenticated using (public.auth_role() = 'admin');

-- PAYMENTS: only cashier + admin can see/insert; pharmacy never touches money.
create policy "payments_select_cashier_admin" on public.payments
  for select to authenticated using (public.auth_role() in ('cashier', 'admin'));

create policy "payments_insert_cashier_admin" on public.payments
  for insert to authenticated with check (public.auth_role() in ('cashier', 'admin'));

create policy "payments_delete_admin" on public.payments
  for delete to authenticated using (public.auth_role() = 'admin');

-- AUDIT LOG: admin only.
create policy "audit_select_admin" on public.audit_log
  for select to authenticated using (public.auth_role() = 'admin');

-- VITALS: nurses record + read; admin full access.
create policy "vitals_select_nurse_admin" on public.treatment_vitals
  for select to authenticated using (public.auth_role() in ('nurse', 'admin'));

create policy "vitals_insert_nurse_admin" on public.treatment_vitals
  for insert to authenticated with check (public.auth_role() in ('nurse', 'admin'));

create policy "vitals_delete_admin" on public.treatment_vitals
  for delete to authenticated using (public.auth_role() = 'admin');

-- ============================================================
-- GRANTS
-- ============================================================
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.patients to authenticated;
grant select, insert, update, delete on public.treatments to authenticated;
grant select, insert, update, delete on public.pharmacy_inventory to authenticated;
grant insert, delete on public.treatment_dispensations to authenticated;
grant select, insert, delete on public.payments to authenticated;
grant select on public.audit_log to authenticated;
grant select, insert, delete on public.treatment_vitals to authenticated;

grant execute on function public.auth_role() to authenticated;
grant execute on function public.get_pharmacy_log(int) to authenticated;
grant execute on function public.get_dispensable_items() to authenticated;
grant execute on function public.get_my_administrations(int) to authenticated;
grant execute on function public.get_admin_kpis() to authenticated;
grant execute on function public.get_profit_report(int) to authenticated;
grant execute on function public.get_audit_log(int) to authenticated;
grant execute on function public.get_users_admin() to authenticated;
grant execute on function public.set_user_role(uuid, text) to authenticated;
grant execute on function public.adjust_stock(uuid, int) to authenticated;
grant execute on function public.set_treatment_status(uuid, text) to authenticated;

-- ============================================================
-- FIRST ADMIN BOOTSTRAP
-- After creating your very first user in the Supabase dashboard, run:
--
--   update public.profiles
--      set role = 'admin'
--    where id = (select id from auth.users order by created_at asc limit 1);
--
-- ============================================================