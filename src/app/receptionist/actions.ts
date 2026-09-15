"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type ActionResult = { error: string } | undefined;

export async function registerPatient(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const patient_code = String(formData.get("patient_code") ?? "").trim();
  const full_name = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const gender = String(formData.get("gender") ?? "");

  if (!patient_code) return { error: "Patient ID / file number is required." };
  if (!full_name) return { error: "Patient name is required." };

  const { error } = await supabase.from("patients").insert({
    patient_code,
    full_name,
    phone: phone || null,
    gender: gender || null,
    registered_by: user?.id,
  });

  if (error) return { error: error.message };
  revalidatePath("/receptionist", "layout");
  return undefined;
}

export async function openEncounter(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const patient_id = String(formData.get("patient_id") ?? "");
  const encounter_type = String(formData.get("encounter_type") ?? "");
  const category = String(formData.get("category") ?? "").trim();

  if (!patient_id || !encounter_type) {
    return { error: "Patient and encounter type are required." };
  }

  const { error } = await supabase.from("treatments").insert({
    patient_id,
    encounter_type,
    category: category || null,
    created_by: user?.id,
  });

  if (error) return { error: error.message };
  revalidatePath("/receptionist", "layout");
  redirect("/receptionist");
}

export async function updateEncounter(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();

  const treatment_id = String(formData.get("treatment_id") ?? "");
  const encounter_type = String(formData.get("encounter_type") ?? "");

  if (!treatment_id || !["one_time", "admission", "recurring"].includes(encounter_type)) {
    return { error: "Select a valid encounter type." };
  }

  const { error } = await supabase
    .from("treatments")
    .update({ encounter_type })
    .eq("id", treatment_id);

  if (error) return { error: error.message };
  revalidatePath("/receptionist", "layout");
  return undefined;
}