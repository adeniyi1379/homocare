import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminTabs } from "./admin-tabs";
import { StaffTab, type StaffRow } from "./staff-tab";
import { CategoriesTab, type CategoryRow } from "./categories-tab";
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

function isStaffActive(u: { banned_until?: string | null }): boolean {
  if (!u.banned_until) return true;
  const until = Date.parse(u.banned_until);
  return Number.isNaN(until) || until <= Date.now();
}

export default async function AdminPage() {
  await requireRole(["admin"]);

  const supabase = await createClient();
  const admin = createAdminClient();

  const [{ data: kpiJson }, { data: profit }, { data: audit }, { data: staffUsers }, { data: stock }, { data: categories }] =
    await Promise.all([
      supabase.rpc("get_admin_kpis"),
      supabase.rpc("get_profit_report", { limit_count: 50 }),
      supabase.rpc("get_audit_log", { limit_count: 100 }),
      admin.auth.admin.listUsers(),
      supabase.from("v_stock_status").select("*"),
      supabase.from("treatment_categories").select("*").order("sort_order", { ascending: true }),
    ]);

  const userRows: StaffRow[] = (staffUsers?.users ?? []).map((u) => ({
    id: u.id,
    email: u.email ?? "",
    full_name: (u.user_metadata?.full_name as string | undefined) ?? "",
    role: (u.user_metadata?.role as string | undefined) ?? "receptionist",
    is_active: isStaffActive(u),
    created_at: u.created_at ?? new Date(0).toISOString(),
  }));

  const kpi = (kpiJson ?? {}) as Kpis;
  const profitRows = (profit ?? []) as unknown as {
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
  }[];
  const totalMargin = profitRows.reduce((s, r) => s + Number(r.gross_margin ?? 0), 0);
  const stockRows = (stock ?? []) as StockRow[];
  const alerts = stockRows.filter((s) => s.stock_status !== "OK");

  const auditRows = (audit ?? []) as unknown as {
    id: string;
    created_at: string;
    actor_name: string;
    action: string;
    entity: string;
    details: Record<string, unknown> | null;
  }[];

  const categoryRows = (categories ?? []) as CategoryRow[];

  const overview = (
    <div className="space-y-6">
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
          {Object.keys(kpi.payments_method_breakdown ?? {}).length === 0 ? (
            <EmptyState message="No payments recorded yet." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">
                  Payment methods
                </h3>
                <ul className="space-y-1 text-sm">
                  {Object.entries(kpi.payments_method_breakdown ?? {}).map(([m, c]) => (
                    <li key={m} className="flex justify-between">
                      <span className="capitalize text-slate-600">{m}</span>
                      <span className="font-semibold">{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">Encounters</h3>
                <ul className="space-y-1 text-sm">
                  {Object.entries(kpi.encounter_breakdown ?? {}).map(([e, c]) => (
                    <li key={e} className="flex justify-between">
                      <span className="capitalize text-slate-600">{e.replace("_", " ")}</span>
                      <span className="font-semibold">{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
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

      {/* <Card title="Audit Trail">
        {auditRows.length === 0 ? (
          <EmptyState message="No audit events yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-modern w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3 font-medium">When</th>
                  <th className="py-2 pr-3 font-medium">Actor</th>
                  <th className="py-2 pr-3 font-medium">Action</th>
                  <th className="py-2 pr-3 font-medium">Entity</th>
                  <th className="py-2 font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {auditRows.map((a) => (
                  <tr key={a.id} className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-3 whitespace-nowrap text-slate-500">
                      {formatDateTime(a.created_at)}
                    </td>
                    <td className="py-2 pr-3 text-slate-600">{a.actor_name}</td>
                    <td className="py-2 pr-3">
                      <Badge className="bg-slate-100 text-slate-700">{a.action}</Badge>
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs text-slate-500">{a.entity}</td>
                    <td className="py-2 font-mono text-xs text-slate-500">
                      {a.details ? JSON.stringify(a.details) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card> */}
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Admin Control Centre"
        subtitle="Overview of hospital activity, plus management of staff accounts and intake categories."
      >
        <Badge tone="neutral">Admin</Badge>
      </PageHeader>

      <AdminTabs overview={overview} staff={<StaffTab users={userRows} />} categories={<CategoriesTab categories={categoryRows} />} />
    </div>
  );
}