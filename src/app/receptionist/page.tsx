import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { RegisterPatientForm, OpenEncounterForm } from "./forms";
import {
  Card,
  Badge,
  inputClass,
  EmptyState,
} from "@/components/ui";
import { formatDate, treatmentStatusBadge, encounterLabel } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ReceptionistPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireRole(["receptionist", "admin"]);
  const { q } = await searchParams;

  const supabase = await createClient();

  const search = (q ?? "").trim();
  let query = supabase
    .from("patients")
    .select(
      `id, patient_code, full_name, phone, gender, created_at, treatments(encounter_type, status)`
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (search) {
    query = query.or(
      `full_name.ilike.%${search}%,patient_code.ilike.%${search}%,phone.ilike.%${search}%`
    );
  }

  const { data: patients, error } = await query;
  const list = (patients ?? []) as unknown as {
    id: string;
    patient_code: string;
    full_name: string;
    phone: string | null;
    gender: string | null;
    created_at: string;
    treatments: { encounter_type: string; status: string }[];
  }[];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Patient Intake &amp; Triage</h1>
          <p className="text-sm text-slate-500">
            Register patients, open treatment encounters and check status.
          </p>
        </div>
        <Badge className="bg-blue-100 text-blue-700">Reception Desk</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Register New Patient">
          <RegisterPatientForm />
        </Card>

        <Card title="Open Treatment Encounter">
          {list.length > 0 ? (
            <OpenEncounterForm patients={list} />
          ) : (
            <EmptyState message="Register a patient first to open an encounter." />
          )}
        </Card>
      </div>

      <Card title={`Patients - ${search ? `search: "${search}"` : "recently registered"}`}>
        <form method="get" className="mb-4 flex gap-2">
          <input
            name="q"
            defaultValue={search}
            className={inputClass}
            placeholder="Search by name, patient code or phone"
          />
          <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            Search
          </button>
        </form>

        {error && (
          <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error.message}
          </div>
        )}

        {!error && list.length === 0 && <EmptyState message="No patients found." />}

        {!error && list.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3 font-medium">Patient Code</th>
                  <th className="py-2 pr-3 font-medium">Name</th>
                  <th className="py-2 pr-3 font-medium">Phone</th>
                  <th className="py-2 pr-3 font-medium">Registered</th>
                  <th className="py-2 font-medium">Encounters</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-3 font-mono text-xs text-teal-700">{p.patient_code}</td>
                    <td className="py-2 pr-3">
                      <div className="font-medium text-slate-900">{p.full_name}</div>
                      {p.gender && (
                        <div className="text-xs capitalize text-slate-400">{p.gender}</div>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-slate-600">{p.phone ?? "-"}</td>
                    <td className="py-2 pr-3 text-slate-500">{formatDate(p.created_at)}</td>
                    <td className="py-2">
                      {p.treatments.length === 0 ? (
                        <span className="text-xs text-slate-400">No encounters</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {p.treatments.slice(0, 3).map((t, i) => (
                            <Badge key={i} className={treatmentStatusBadge(t.status)}>
                              {encounterLabel(t.encounter_type)} - {t.status}
                            </Badge>
                          ))}
                        </div>
                      )}
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