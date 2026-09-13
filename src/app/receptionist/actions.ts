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

  const full_name = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const gender = String(formData.get("gender") ?? "");

  if (!full_name) return { error: "Patient name is required." };

  const { error } = await supabase.from("patients").insert({
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