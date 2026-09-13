import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdministerDoseForm, VitalsForm, type TreatmentOption, type ItemOption } from "./forms";
import { Card, Badge, EmptyState } from "@/components/ui";
import { formatDateTime, treatmentStatusBadge, encounterLabel, oneOrNull } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function NursePage() {
  await requireRole(["nurse", "admin"]);

  const supabase = await createClient();

  const [{ data: rawTreatments }, { data: rawItems }, { data: rawAdministrations }] =
    await Promise.all([
      supabase
        .from("treatments")
        .select("id, encounter_type, category, status, patients(id, patient_code, full_name)")
        .in("status", ["active", "discharged"])
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.rpc("get_dispensable_items"),
      supabase.rpc("get_my_administrations", { limit_count: 30 }),
    ]);

  type TreatmentRow = {
    id: string;
    encounter_type: string;
    category: string | null;
    status: string;
    patients:
      | { id: string; patient_code: string; full_name: string }
      | { id: string; patient_code: string; full_name: string }[];
  };

  const treatments = (rawTreatments ?? []) as TreatmentRow[];
  const options: TreatmentOption[] = treatments.map((t) => ({
    id: t.id,
    patient_code: oneOrNull(t.patients)?.patient_code ?? "",
    full_name: oneOrNull(t.patients)?.full_name ?? "Unknown patient",
    encounter_type: t.encounter_type,
  }));
  const items = (rawItems ?? []) as ItemOption[];
  const administrations = (rawAdministrations ?? []) as unknown as {
    treatment_id: string;
    patient_code: string;
    patient_name: string;
    item_name: string;
    item_type: string;
    quantity: number;
    dispensed_at: string;
  }[];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Care &amp; Administration</h1>
          <p className="text-sm text-slate-500">
            Log vitals and record administered injections / ward dosages to an active treatment.
            Drug costs are never shown to you - the stock ledger updates automatically.
          </p>
        </div>
        <Badge className="bg-purple-100 text-purple-700">Nursing Station</Badge>
      </div>

      <Card title="Active Encounters">
        {treatments.length === 0 ? (
          <EmptyState message="No active treatment encounters right now." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3 font-medium">Patient</th>
                  <th className="py-2 pr-3 font-medium">Code</th>
                  <th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 pr-3 font-medium">Category</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {treatments.map((t) => {
                  const patient = oneOrNull(t.patients);
                  return (
                    <tr key={t.id} className="border-b border-slate-100">
                      <td className="py-2 pr-3 font-medium text-slate-900">{patient?.full_name}</td>
                      <td className="py-2 pr-3 font-mono text-xs text-teal-700">
                        {patient?.patient_code}
                      </td>
                      <td className="py-2 pr-3">{encounterLabel(t.encounter_type)}</td>
                      <td className="py-2 pr-3 text-slate-600">{t.category ?? "-"}</td>
                      <td className="py-2">
                        <Badge className={treatmentStatusBadge(t.status)}>{t.status}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Record Administration / Injection">
          {options.length > 0 && items.length > 0 ? (
            <AdministerDoseForm treatments={options} items={items} />
          ) : (
            <EmptyState message="No in-stock items or active treatments available for administration." />
          )}
        </Card>

        <Card title="Log Patient Vitals">
          {options.length > 0 ? (
            <VitalsForm treatments={options} />
          ) : (
            <EmptyState message="Open an encounter first to log vitals." />
          )}
        </Card>
      </div>

      <Card title="My Administration Log">
        {administrations.length === 0 ? (
          <EmptyState message="Nothing administered by you yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3 font-medium">Patient</th>
                  <th className="py-2 pr-3 font-medium">Item</th>
                  <th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 pr-3 font-medium">Qty</th>
                  <th className="py-2 font-medium">At</th>
                </tr>
              </thead>
              <tbody>
                {administrations.map((a, idx) => (
                  <tr key={idx} className="border-b border-slate-100">
                    <td className="py-2 pr-3">
                      <span className="font-mono text-xs text-teal-700">{a.patient_code}</span>{" "}
                      {a.patient_name}
                    </td>
                    <td className="py-2 pr-3 font-medium text-slate-900">{a.item_name}</td>
                    <td className="py-2 pr-3 text-slate-600">{a.item_type}</td>
                    <td className="py-2 pr-3">{a.quantity}</td>
                    <td className="py-2 text-slate-500">{formatDateTime(a.dispensed_at)}</td>
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