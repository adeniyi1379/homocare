-- ============================================================
-- HOMECARE HOSPITAL - Seed data (optional)
-- Sample pharmacy inventory so the Pharmacy screen & Admin
-- low-stock dashboard show immediately.
-- ============================================================

insert into public.pharmacy_inventory (item_name, item_type, stock_quantity, reorder_level, unit_cost_price)
values
  ('Paracetamol 500mg',  'tablet',     240, 100, 3500),
  ('Amodiaquine 300mg',  'tablet',      60,  50, 4200),
  ('Ibuprofen 400mg',    'tablet',     120,  50, 3800),
  ('ORS Sachet',         'consumable',  18,  25,  950),
  ('IV Normal Saline 1L','consumable',  12,  20, 1800),
  ('Diclofenac Injection','injection',   8,  15, 2500),
  ('Vitamin C Syrup 100ml','syrup',     22,  10, 2800),
  ('Amoxicillin Cap 250mg','tablet',    35,  60, 4600),
  ('Metronidazole Infusion','injection', 5,  10, 2100)
on conflict do nothing;

-- ============================================================
-- LOCAL DEMO USERS (only if you use the create-user script)
-- Run these against your Supabase project AFTER enabling
-- `enable_signups` under Auth settings:
--
--  1. Create users through the app sign-up page, OR
--  2. Insert auth users, then promote the first one to admin:
--
--     update public.profiles
--        set role = 'admin'
--      where id = (select id from auth.users order by created_at asc limit 1);
--
--  Then assign staff roles from the Admin -> Users screen.
-- ============================================================