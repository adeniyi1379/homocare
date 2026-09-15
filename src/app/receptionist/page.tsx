import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ReceptionistActions } from "./receptionist-actions";
import { EncounterCell } from "./encounter-cell";
import { CollectPaymentForm, type LedgerTreatment } from "@/app/cashier/forms";
import {
  Card,
  Badge,
  inputClass,
  EmptyState,
  PageHeader,
  type BadgeTone,
} from "@/components/ui";
import {
  formatDate,
  formatNaira,
  encounterLabel,
  formatDateTime,
  treatmentStatusBadge,
} from "@/lib/utils";
import { LifecycleActions } from "@/components/lifecycle-actions";

export const dynamic = "force-dynamic";

type LedgerRow = {
  treatment_id: string;
  patient_code: string;
  patient_name: string;
  phone: string | null;
  encounter_type: string;
  category: string | null;
  status: string;
  total_treatment_fee: number | null;
  total_paid: number;
  balance_remaining: number;
  payment_status: "UNPAID" | "PARTIAL" | "PAID IN FULL";
};

type ReceiptRow = {
  id: string;
  receipt_number: string;
  amount_paid: number;
  payment_method: string;
  created_at: string;
  patient_code: string | null;
  patient_name: string | null;
  encounter_type: string | null;
};

type PaymentWithEmbeds = {
  id: string;
  receipt_number: string;
  amount_paid: number;
  payment_method: string;
  created_at: string;
  treatments?: {
    encounter_type?: string;
    patients?: { patient_code?: string; full_name?: string }[];
  }[];
};

export default async function ReceptionistPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireRole(["receptionist", "cashier", "admin"]);
  const { q } = await searchParams;

  const supabase = await createClient();

  const search = (q ?? "").trim();
  let patientQuery = supabase
    .from("patients")
    .select(
      `id, patient_code, full_name, phone, gender, created_at, treatments(id, encounter_type, status)`
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (search) {
    patientQuery = patientQuery.or(
      `full_name.ilike.%${search}%,patient_code.ilike.%${search}%,phone.ilike.%${search}%`
    );
  }

  const [
    { data: patients, error },
    { data: pickerPatients },
    { data: categories },
    { data: ledger },
    { data: recentPayments },
  ] = await Promise.all([
    patientQuery,
    supabase
      .from("patients")
      .select("id, patient_code, full_name, phone")
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("treatment_categories")
      .select("id, name")
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    supabase.from("v_treatment_balance").select("*").order("total_paid", { ascending: false }),
    supabase
      .from("payments")
      .select(
        `id, receipt_number, amount_paid, payment_method, created_at,
         treatments!inner(id, encounter_type, patients!inner(patient_code, full_name))`
      )
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const list = (patients ?? []) as unknown as {
    id: string;
    patient_code: string;
    full_name: string;
    phone: string | null;
    gender: string | null;
    created_at: string;
    treatments: { id: string; encounter_type: string; status: string }[];
  }[];

  const pickerList = (pickerPatients ?? []) as unknown as {
    id: string;
    patient_code: string;
    full_name: string;
    phone: string | null;
  }[];

  const categoryList = (categories ?? []) as unknown as { id: string; name: string }[];

  const rows = (ledger ?? []) as LedgerRow[];
  const bailable = rows.filter(
    (r) => r.payment_status !== "PAID IN FULL" && r.status !== "cancelled"
  );
  const hasFee = bailable.filter((r) => Number(r.total_treatment_fee ?? 0) > 0);
  const totalCollectible = hasFee.reduce(
    (sum, r) => sum + Number(r.balance_remaining ?? 0),
    0
  );

  const receipts: ReceiptRow[] = ((recentPayments ?? []) as PaymentWithEmbeds[]).map((p) => {
    const tr = p.treatments?.[0];
    const pt = tr?.patients?.[0];
    return {
      id: p.id,
      receipt_number: p.receipt_number,
      amount_paid: Number(p.amount_paid),
      payment_method: p.payment_method,
      created_at: p.created_at,
      patient_code: pt?.patient_code ?? null,
      patient_name: pt?.full_name ?? null,
      encounter_type: tr?.encounter_type ?? null,
    };
  });

  const dueLabel = (r: LedgerRow): { text: string; tone: BadgeTone } => {
    if (r.status === "cancelled") return { text: "CANCELLED", tone: "neutral" };
    switch (r.payment_status) {
      case "UNPAID":
        return { text: "UNPAID", tone: "danger" };
      case "PARTIAL":
        return { text: "PARTIAL", tone: "warning" };
      default:
        return { text: "PAID IN FULL", tone: "success" };
    }
  };

  const binding = (r: LedgerRow): LedgerTreatment => ({
    treatment_id: r.treatment_id,
    patient_code: r.patient_code,
    patient_name: r.patient_name,
    encounter_type: r.encounter_type,
    category: r.category,
    status: r.status,
    total_treatment_fee: r.total_treatment_fee,
    total_paid: r.total_paid,
    balance_remaining: r.balance_remaining,
    payment_status: r.payment_status,
  });

  const methodLabel = (m: string) =>
    m === "pos_terminal" ? "POS" : m === "bank_transfer" ? "Transfer" : "Cash";

  return (
    <div className="space-y-6">
      <div className="reveal">
        <PageHeader
          title="Patient Intake &amp; Billing"
          subtitle="One desk for the whole visit - register patients, open encounters, collect payments and print receipts."
        >
          <Badge tone="info">Front Desk</Badge>
          <Badge tone="success">Collecting {formatNaira(totalCollectible)}</Badge>
        </PageHeader>
      </div>

      <div className="reveal reveal-2 grid gap-6 lg:grid-cols-3">
        <Card title="Quick Actions" className="lg:col-span-1">
          <ReceptionistActions patients={pickerList} categories={categoryList} />
        </Card>

        <Card title="Collect Payment" className="lg:col-span-2">
          {bailable.length > 0 ? (
            <CollectPaymentForm treatments={bailable.map(binding)} />
          ) : (
            <EmptyState message="No outstanding balances to collect." />
          )}
        </Card>
      </div>

      <div className="reveal reveal-3">
        <Card title={`Patients - ${search ? `search: "${search}"` : "recently registered"}`}>
          <form method="get" className="mb-4 flex gap-2">
            <input
              name="q"
              defaultValue={search}
              className={inputClass}
              placeholder="Search by name, patient code or phone"
            />
            <button className="btn btn-primary">Search</button>
          </form>

          {error && (
            <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error.message}
            </div>
          )}

          {!error && list.length === 0 && <EmptyState message="No patients found." />}

          {!error && list.length > 0 && (
            <div className="overflow-x-auto">
              <table className="table-modern w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-brand-50/60 text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-3 font-medium">Patient Code</th>
                    <th className="py-2 pr-3 font-medium">Name</th>
                    <th className="py-2 pr-3 font-medium">Phone</th>
                    <th className="py-2 pr-3 font-medium">Registered</th>
                    <th className="py-2 font-medium">Encounters</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-slate-100 align-top transition-colors hover:bg-brand-50/40"
                    >
                      <td className="py-2 pr-3 font-mono text-xs text-brand-600">{p.patient_code}</td>
                      <td className="py-2 pr-3">
                        <div className="font-medium text-slate-900">{p.full_name}</div>
                        {p.gender && (
                          <div className="text-xs capitalize text-slate-400">{p.gender}</div>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-slate-600">{p.phone ?? "-"}</td>
                      <td className="py-2 pr-3 text-slate-500">{formatDate(p.created_at)}</td>
                      <td className="py-2">
                        <EncounterCell encounters={p.treatments} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div className="reveal reveal-4">
        <Card title="Latest Receipts">
          {receipts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="table-modern w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-3 font-medium">Receipt</th>
                    <th className="py-2 pr-3 font-medium">Patient</th>
                    <th className="py-2 pr-3 font-medium">Amount</th>
                    <th className="py-2 pr-3 font-medium">Method</th>
                    <th className="py-2 pr-3 font-medium">Date</th>
                    <th className="py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {receipts.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100">
                      <td className="py-2 pr-3">
                        <span className="font-mono text-xs font-semibold text-brand-600">
                          {p.receipt_number}
                        </span>
                      </td>
                      <td className="py-2 pr-3">
                        <div className="font-medium text-slate-900">{p.patient_name ?? "-"}</div>
                        {p.patient_code && (
                          <div className="font-mono text-xs text-brand-600">{p.patient_code}</div>
                        )}
                      </td>
                      <td className="py-2 pr-3 font-semibold text-slate-900">
                        {formatNaira(p.amount_paid)}
                      </td>
                      <td className="py-2 pr-3 text-slate-600">{methodLabel(p.payment_method)}</td>
                      <td className="py-2 pr-3 text-slate-500">{formatDateTime(p.created_at)}</td>
                      <td className="py-2">
                        <a
                          href={`/cashier/receipt/${p.receipt_number}`}
                          className="btn btn-ghost btn-sm"
                        >
                          View
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState message="No receipts yet. Collect a payment to print the first one." />
          )}
        </Card>
      </div>

      <div className="reveal reveal-5">
        <Card title="Treatment Ledger">
          {rows.length === 0 ? (
            <EmptyState message="No treatments yet." />
          ) : (
            <div className="overflow-x-auto">
              <table className="table-modern w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-3 font-medium">Patient</th>
                    <th className="py-2 pr-3 font-medium">Type</th>
                    <th className="py-2 pr-3 font-medium">Fee</th>
                    <th className="py-2 pr-3 font-medium">Paid</th>
                    <th className="py-2 pr-3 font-medium">Balance</th>
                    <th className="py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const due = dueLabel(r);
                    return (
                      <tr key={r.treatment_id} className="border-b border-slate-100">
                        <td className="py-2 pr-3">
                          <div className="font-medium text-slate-900">{r.patient_name}</div>
                          <div className="font-mono text-xs text-brand-600">{r.patient_code}</div>
                        </td>
                        <td className="py-2 pr-3 text-slate-600">
                          {encounterLabel(r.encounter_type)}
                          {r.category && <div className="text-xs text-slate-400">{r.category}</div>}
                        </td>
                        <td className="py-2 pr-3 text-slate-900">
                          {r.total_treatment_fee === null || r.total_treatment_fee === undefined
                            ? "—"
                            : formatNaira(r.total_treatment_fee)}
                        </td>
                        <td className="py-2 pr-3 text-slate-600">{formatNaira(r.total_paid)}</td>
                        <td
                          className={`py-2 pr-3 font-semibold ${
                            Number(r.balance_remaining) > 0 ? "text-red-600" : "text-emerald-700"
                          }`}
                        >
                          {formatNaira(r.balance_remaining)}
                        </td>
                        <td className="py-2">
                          <div className="flex flex-wrap items-center gap-1">
                            <Badge tone={due.tone}>{due.text}</Badge>
                            <Badge className={treatmentStatusBadge(r.status)}>{r.status}</Badge>
                            <LifecycleActions treatment={{ id: r.treatment_id, status: r.status }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}