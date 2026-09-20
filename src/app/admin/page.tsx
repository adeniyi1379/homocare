import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminTabs } from "./admin-tabs";
import { StaffTab, type StaffRow } from "./staff-tab";
import { CategoriesTab, type CategoryRow } from "./categories-tab";
import { TreatmentsTab } from "./treatments-tab";
import {
  PatientsTab,
  type PatientRow,
  type TreatmentBalanceRow,
  type PaymentRow,
  type DispenseRow,
} from "./patients-tab";
import { BranchesTab, type BranchRow, type StaffWithBranchRow } from "./branches-tab";
import { BranchFilter } from "./branch-filter";
import { DonutChart, makeDonutData } from "@/components/donut-chart";
import { Card, Badge, EmptyState, StatCard, PageHeader } from "@/components/ui";
import { formatNaira, formatDateTime, stockBadge, treatmentStatusBadge } from "@/lib/utils";
import { LifecycleActions } from "@/components/lifecycle-actions";

export const dynamic = "force-dynamic";

type Kpis = {
  patients_total: number;
  patients_today: number;
  active_treatments: number;
  admissions_active: number;
  completed_treatments: number;
  revenue_today: number;
  revenue_total: number;
  outstanding_balance: number;
  low_stock_count: number;
  out_of_stock_count: number;
  inventory_value: number;
  inventory_sell_value: number;
  dispensations_total: number;
  dispensations_today: number;
  payments_method_breakdown: Record<string, number>;
  encounter_breakdown: Record<string, number>;
  status_breakdown: Record<string, number>;
  stock_level_breakdown: Record<string, number>;
};

type StockRow = {
  id: string;
  item_name: string;
  item_type: string;
  stock_quantity: number;
  reorder_level: number;
  unit_cost_price: number;
  stock_status: "LOW" | "OK" | "OUT OF STOCK";
};

type ProfitRow = {
  treatment_id: string;
  patient_name: string;
  patient_code: string;
  encounter_type: string;
  status: string;
  total_billed: number;
  total_paid: number;
  cogs: number;
  gross_margin: number;
  created_at: string;
};

type TreatmentRow = {
  treatment_id: string;
  patient_code: string;
  patient_name: string;
  encounter_type: string;
  category: string | null;
  status: string;
  total_treatment_fee: number;
  total_paid: number;
  balance_remaining: number;
  payment_status: string;
  created_at: string;
  branch_id: string | null;
};

const TABS = ["overview", "treatments", "patients", "staff", "categories", "branches"] as const;
type TabId = (typeof TABS)[number];

function isStaffActive(u: { banned_until?: string | null }): boolean {
  if (!u.banned_until) return true;
  const until = Date.parse(u.banned_until);
  return Number.isNaN(until) || until <= Date.now();
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; branch?: string }>;
}) {
  await requireRole(["admin"]);
  const { tab, branch } = await searchParams;
  const activeTab: TabId = TABS.includes(tab as TabId) ? (tab as TabId) : "overview";

  switch (activeTab) {
    case "treatments":
      return (
        <AdminPageShell activeTab={activeTab} overview={null} treatments={await loadTreatments()} />
      );
    case "patients":
      return (
        <AdminPageShell activeTab={activeTab} overview={null} patients={await loadPatients()} />
      );
    case "staff":
      return (
        <AdminPageShell activeTab={activeTab} overview={null} staff={await loadStaff()} />
      );
    case "categories":
      return (
        <AdminPageShell
          activeTab={activeTab}
          overview={null}
          categories={await loadCategories()}
        />
      );
    case "branches":
      return (
        <AdminPageShell activeTab={activeTab} overview={null} branches={await loadBranches()} />
      );
    default:
      return (
        <AdminPageShell
          activeTab={activeTab}
          overview={await loadOverview(branch ?? null)}
          treatments={null}
        />
      );
  }
}

async function loadOverview(branchId: string | null) {
  const supabase = await createClient();

  const [{ data: branchRows }, { data: kpiJson }, { data: profit }, { data: stock }] =
    await Promise.all([
      supabase.from("branches").select("id, name, code").order("name", { ascending: true }),
      supabase.rpc("get_admin_kpis", { p_branch: branchId }),
      supabase.rpc("get_profit_report", { p_branch: branchId, limit_count: 50 }),
      supabase.from("v_stock_status").select("*"),
    ]);

  const branchOptions = (branchRows ?? []) as { id: string; name: string; code: string }[];
  const activeBranchId =
    branchId && branchOptions.some((b) => b.id === branchId) ? branchId : null;

  const kpi = (kpiJson ?? {}) as Kpis;
  const profitRows = (profit ?? []) as ProfitRow[];
  const totalMargin = profitRows.reduce((s, r) => s + Number(r.gross_margin ?? 0), 0);
  const stockRows = (activeBranchId
    ? (stock ?? []).filter((s: { branch_id: string | null }) => s.branch_id === activeBranchId)
    : (stock ?? [])) as StockRow[];
  const alerts = stockRows.filter((s) => s.stock_status !== "OK");

  const paymentChartData = makeDonutData(kpi.payments_method_breakdown ?? {});
  const encounterChartData = makeDonutData(kpi.encounter_breakdown ?? {});

  return (
    <div className="space-y-6">
      <BranchFilter branches={branchOptions} current={activeBranchId} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Patients (total)" value={kpi.patients_total ?? 0} hint={`${kpi.patients_today ?? 0} today`} />
        <StatCard label="Active treatments" value={kpi.active_treatments ?? 0} hint={`${kpi.admissions_active ?? 0} admissions`} />
        <StatCard label="Completed" value={kpi.completed_treatments ?? 0} hint={`${kpi.dispensations_today ?? 0} dispenses today`} />
        <StatCard label="Revenue today" value={formatNaira(kpi.revenue_today ?? 0)} />
        <StatCard label="Total revenue" value={formatNaira(kpi.revenue_total ?? 0)} />
        <StatCard label="Outstanding" value={formatNaira(kpi.outstanding_balance ?? 0)} hint="Across all treatments" />
        <StatCard label="Low stock items" value={kpi.low_stock_count ?? 0} hint={`${kpi.out_of_stock_count ?? 0} out of stock`} />
        <StatCard label="Inventory value" value={formatNaira(kpi.inventory_value ?? 0)} />
        <StatCard label="Drugs sold (COGS)" value={formatNaira(kpi.inventory_sell_value ?? 0)} hint={`${kpi.dispensations_total ?? 0} lines dispensed`} />
        <StatCard label="Est. gross margin" value={formatNaira(totalMargin)} hint="Latest 50 treatments" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Stock Health">
          {alerts.length === 0 ? (
            <EmptyState message="All items are above reorder level." />
          ) : (
            <div className="space-y-2">
              {alerts.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm"
                >
                  <div>
                    <span className="font-medium text-slate-900">{s.item_name}</span>
                    <span className="ml-2 text-xs capitalize text-slate-400">{s.item_type}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-600">{s.stock_quantity} / {s.reorder_level}</span>
                    <Badge className={stockBadge(s.stock_status)}>{s.stock_status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Payment Methods &amp; Encounters">
          {paymentChartData.length === 0 && encounterChartData.length === 0 ? (
            <EmptyState message="No payments or encounters recorded yet." />
          ) : (
            <div className="space-y-6">
              {paymentChartData.length > 0 ? (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">
                    Payment methods
                  </h3>
                  <DonutChart data={paymentChartData} centerSubtitle="Payments" />
                </div>
              ) : null}
              {encounterChartData.length > 0 ? (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">
                    Encounters
                  </h3>
                  <DonutChart data={encounterChartData} centerSubtitle="Encounters" />
                </div>
              ) : null}
            </div>
          )}
        </Card>
      </div>

      <Card title="Profitability (internal - latest treatments)">
        {profitRows.length === 0 ? (
          <EmptyState message="No billed treatments yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-modern w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3 font-medium">Patient</th>
                  <th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 pr-3 font-medium">Billed</th>
                  <th className="py-2 pr-3 font-medium">Paid</th>
                  <th className="py-2 pr-3 font-medium">Drug cost</th>
                  <th className="py-2 pr-3 font-medium">Margin</th>
                  <th className="py-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {profitRows.map((r) => (
                  <tr key={r.treatment_id} className="border-b border-slate-100">
                    <td className="py-2 pr-3">
                      <div className="font-medium text-slate-900">{r.patient_name}</div>
                      <div className="font-mono text-xs text-brand-600">{r.patient_code}</div>
                    </td>
                    <td className="py-2 pr-3 capitalize text-slate-600">
                      {r.encounter_type.replace("_", " ")}
                      <div className="mt-1 flex flex-wrap items-center gap-1 text-xs">
                        <Badge className={treatmentStatusBadge(r.status)}>{r.status}</Badge>
                        <LifecycleActions treatment={{ id: r.treatment_id, status: r.status }} />
                      </div>
                    </td>
                    <td className="py-2 pr-3">{formatNaira(r.total_billed)}</td>
                    <td className="py-2 pr-3">{formatNaira(r.total_paid)}</td>
                    <td className="py-2 pr-3">{formatNaira(r.cogs)}</td>
                    <td
                      className={`py-2 pr-3 font-semibold ${
                        Number(r.gross_margin) < 0 ? "text-red-600" : "text-emerald-700"
                      }`}
                    >
                      {formatNaira(r.gross_margin)}
                    </td>
                    <td className="py-2 text-slate-500">{formatDateTime(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

async function loadTreatments() {
  const supabase = await createClient();
  const [{ data: treatments }, { data: branchRows }] = await Promise.all([
    supabase
      .from("v_treatment_balance")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300),
    supabase.from("branches").select("id, name, code").order("name", { ascending: true }),
  ]);

  const treatmentRows = (treatments ?? []) as TreatmentRow[];
  const branchOptions = (branchRows ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    code: b.code,
  }));
  return <TreatmentsTab treatments={treatmentRows} branches={branchOptions} />;
}

async function loadStaff() {
  const admin = createAdminClient();
  const [branchRes, userRes, profileRes] = await Promise.all([
    admin.from("branches").select("id, name, code").order("name", { ascending: true }),
    admin.auth.admin.listUsers(),
    admin.from("profiles").select("id, full_name, role, branch_id"),
  ]);

  const branchOptions = (branchRes.data ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    code: b.code,
  }));

  const profileById = new Map<string, {
    full_name: string | null;
    role: string;
    branch_id: string | null;
  }>();
  for (const p of profileRes.data ?? []) {
    profileById.set(p.id, { full_name: p.full_name, role: p.role, branch_id: p.branch_id });
  }

  const userRows: StaffRow[] = (userRes.data?.users ?? []).map((u) => {
    const prof = u.id ? profileById.get(u.id) : undefined;
    return {
      id: u.id,
      email: u.email ?? "",
      full_name: prof && prof.full_name?.trim() !== "" ? prof.full_name : (u.user_metadata?.full_name as string | undefined) ?? "",
      role: prof?.role ?? (u.user_metadata?.role as string | undefined) ?? "receptionist",
      is_active: isStaffActive(u),
      created_at: u.created_at ?? new Date(0).toISOString(),
      branch_id: prof?.branch_id ?? null,
    };
  });

  return <StaffTab users={userRows} branches={branchOptions} />;
}

async function loadPatients() {
  const admin = createAdminClient();
  const [patientRes, branchRes, treatmentRes, paymentRes, dispRes, invRes] = await Promise.all([
    admin
      .from("patients")
      .select("id, patient_code, full_name, phone, gender, branch_id, created_at")
      .order("created_at", { ascending: false }),
    admin.from("branches").select("id, name, code").order("name", { ascending: true }),
    admin
      .from("v_treatment_balance")
      .select(
        "treatment_id, patient_id, patient_code, patient_name, encounter_type, category, status, created_at, branch_id, total_treatment_fee, total_paid, balance_remaining"
      )
      .order("created_at", { ascending: false }),
    admin.from("payments").select("treatment_id, receipt_number, amount_paid, payment_method, created_at"),
    admin.from("treatment_dispensations").select("treatment_id, item_id, quantity, handoff_type, dispensed_at"),
    admin.from("pharmacy_inventory").select("id, item_name"),
  ]);

  const itemNameById = new Map((invRes.data ?? []).map((i) => [i.id, i.item_name]));

  const treatmentPatient = new Map(
    (treatmentRes.data ?? []).map((t: { treatment_id: string; patient_id: string }) => [
      t.treatment_id,
      t.patient_id,
    ]),
  );

  const patientRows: PatientRow[] = (patientRes.data ?? []).map((p) => ({
    id: p.id,
    patient_code: p.patient_code,
    full_name: p.full_name,
    phone: p.phone,
    gender: p.gender,
    branch_id: p.branch_id,
    created_at: p.created_at,
  }));

  const treatmentRows: TreatmentBalanceRow[] = (treatmentRes.data ?? []).map((t) => ({
    treatment_id: t.treatment_id,
    patient_id: t.patient_id,
    patient_code: t.patient_code,
    patient_name: t.patient_name,
    encounter_type: t.encounter_type,
    category: t.category,
    status: t.status,
    created_at: t.created_at,
    branch_id: t.branch_id,
    total_treatment_fee: t.total_treatment_fee,
    total_paid: t.total_paid,
    balance_remaining: t.balance_remaining,
  }));

  const paymentRows: PaymentRow[] = (paymentRes.data ?? []).map((pay) => ({
    treatment_id: pay.treatment_id,
    patient_id: treatmentPatient.get(pay.treatment_id) ?? "",
    amount_paid: Number(pay.amount_paid) || 0,
    payment_method: pay.payment_method,
    created_at: pay.created_at,
    receipt_number: pay.receipt_number,
  }));

  const dispenseRows: DispenseRow[] = (dispRes.data ?? [])
    .map((d) => ({
      treatment_id: d.treatment_id,
      patient_id: treatmentPatient.get(d.treatment_id) ?? "",
      item_name: itemNameById.get(d.item_id) ?? "Unknown item",
      quantity: d.quantity,
      handoff_type: d.handoff_type,
      dispensed_at: d.dispensed_at,
    }))
    .filter((d) => d.patient_id !== "");

  const branchOptions = (branchRes.data ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    code: b.code,
  }));

  return (
    <PatientsTab
      patients={patientRows}
      treatments={treatmentRows}
      payments={paymentRows}
      dispensations={dispenseRows}
      branches={branchOptions}
    />
  );
}

async function loadCategories() {
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("treatment_categories")
    .select("*")
    .order("sort_order", { ascending: true });

  const categoryRows = (categories ?? []) as CategoryRow[];
  return <CategoriesTab categories={categoryRows} />;
}

async function loadBranches() {
  const admin = createAdminClient();
  const [branchRes, userRes, profileRes] = await Promise.all([
    admin.from("branches").select("*").order("name", { ascending: true }),
    admin.auth.admin.listUsers(),
    admin.from("profiles").select("id, full_name, role, branch_id, created_at"),
  ]);

  const branchRowsMapped: BranchRow[] = (branchRes.data ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    code: b.code,
    active: b.active,
    created_at: b.created_at,
  }));

  const profileById = new Map<string, {
    full_name: string | null;
    role: string;
    branch_id: string | null;
    created_at: string;
  }>();
  for (const p of profileRes.data ?? []) {
    profileById.set(p.id, {
      full_name: p.full_name,
      role: p.role,
      branch_id: p.branch_id,
      created_at: p.created_at,
    });
  }

  const staffBranchRowsMapped: StaffWithBranchRow[] = (userRes.data?.users ?? [])
    .map((u) => {
      const p = profileById.get(u.id);
      return {
        id: u.id,
        email: u.email ?? "",
        full_name:
          p && p.full_name?.trim() !== ""
            ? p.full_name
            : (u.user_metadata?.full_name as string | undefined) ?? null,
        role: p?.role ?? (u.user_metadata?.role as string | undefined) ?? "receptionist",
        branch_id: p?.branch_id ?? null,
        created_at: p?.created_at ?? u.created_at ?? new Date(0).toISOString(),
      };
    })
    .filter((s) => s.role !== "admin");

  return <BranchesTab branches={branchRowsMapped} staff={staffBranchRowsMapped} />;
}

function AdminPageShell({
  activeTab,
  overview,
  treatments,
  patients,
  staff,
  categories,
  branches,
}: {
  activeTab: TabId;
  overview: React.ReactNode;
  treatments?: React.ReactNode;
  patients?: React.ReactNode;
  staff?: React.ReactNode;
  categories?: React.ReactNode;
  branches?: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Admin Control Centre"
        subtitle="Overview of hospital activity, plus management of staff accounts and intake categories."
      >
        <Badge tone="neutral">Admin</Badge>
      </PageHeader>

      <AdminTabs
        initialTab={activeTab}
        overview={overview ?? <p className="text-sm text-slate-400">No data loaded.</p>}
        treatments={treatments ?? <p className="text-sm text-slate-400">No data loaded.</p>}
        patients={patients ?? <p className="text-sm text-slate-400">No data loaded.</p>}
        staff={staff ?? <p className="text-sm text-slate-400">No data loaded.</p>}
        categories={categories ?? <p className="text-sm text-slate-400">No data loaded.</p>}
        branches={branches ?? <p className="text-sm text-slate-400">No data loaded.</p>}
      />
    </div>
  );
}