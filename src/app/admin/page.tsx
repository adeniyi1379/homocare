import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { RoleForm } from "./forms";
import { Card, Badge, EmptyState } from "@/components/ui";
import { formatNaira, formatDateTime, stockBadge } from "@/lib/utils";

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

export default async function AdminPage() {
  await requireRole(["admin"]);

  const supabase = await createClient();

  const [{ data: kpiJson }, { data: profit }, { data: audit }, { data: users }, { data: stock }] =
    await Promise.all([
      supabase.rpc("get_admin_kpis"),
      supabase.rpc("get_profit_report", { limit_count: 50 }),
      supabase.rpc("get_audit_log", { limit_count: 100 }),
      supabase.rpc("get_users_admin"),
      supabase.from("v_stock_status").select("*"),
    ]);

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

  const userRows = (users ?? []) as unknown as {
    id: string;
    full_name: string | null;
    email: string;
    created_at: string;
    role: string;
  }[];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Operations Dashboard</h1>
          <p className="text-sm text-slate-500">
            Overall hospital activity, revenue, stock health and profitability at a glance.
          </p>
        </div>
        <Badge className="bg-slate-900 text-white">Admin</Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="Patients (total)" value={kpi.patients_total ?? 0} hint={`${kpi.patients_today ?? 0} today`} />
        <Stat label="Active treatments" value={kpi.active_treatments ?? 0} hint={`${kpi.admissions_active ?? 0} admissions`} />
        <Stat label="Completed" value={kpi.completed_treatments ?? 0} hint={`${kpi.dispensations_today ?? 0} dispenses today`} />
        <Stat label="Revenue today" value={formatNaira(kpi.revenue_today ?? 0)} />
        <Stat label="Total revenue" value={formatNaira(kpi.revenue_total ?? 0)} />
        <Stat label="Outstanding" value={formatNaira(kpi.outstanding_balance ?? 0)} hint="Across all treatments" />
        <Stat label="Low stock items" value={kpi.low_stock_count ?? 0} hint={`${kpi.out_of_stock_count ?? 0} out of stock`} />
        <Stat label="Inventory value" value={formatNaira(kpi.inventory_value ?? 0)} />
        <Stat label="Drugs sold (COGS)" value={formatNaira(kpi.inventory_sell_value ?? 0)} hint={`${kpi.dispensations_total ?? 0} lines dispensed`} />
        <Stat label="Est. gross margin" value={formatNaira(totalMargin)} hint="Latest 50 treatments" />
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
            <table className="w-full text-left text-sm">
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
                      <div className="font-mono text-xs text-teal-700">{r.patient_code}</div>
                    </td>
                    <td className="py-2 pr-3 capitalize text-slate-600">
                      {r.encounter_type.replace("_", " ")}
                      <div className="text-xs text-slate-400">{r.status}</div>
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

      <Card title="Staff &amp; Roles">
        {userRows.length === 0 ? (
          <EmptyState message="No staff accounts yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3 font-medium">Name</th>
                  <th className="py-2 pr-3 font-medium">Email</th>
                  <th className="py-2 pr-3 font-medium">Joined</th>
                  <th className="py-2 font-medium">Role</th>
                </tr>
              </thead>
              <tbody>
                {userRows.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100">
                    <td className="py-2 pr-3 font-medium text-slate-900">
                      {u.full_name ?? "Unnamed staff"}
                    </td>
                    <td className="py-2 pr-3 text-slate-600">{u.email}</td>
                    <td className="py-2 pr-3 text-slate-500">{formatDateTime(u.created_at)}</td>
                    <td className="py-2">
                      <RoleForm userId={u.id} currentRole={u.role} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Audit Trail">
        {auditRows.length === 0 ? (
          <EmptyState message="No audit events yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
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
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-bold text-slate-900">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}