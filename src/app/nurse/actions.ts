"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ActionResult = { error: string } | undefined;

export async function administerDose(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const treatment_id = String(formData.get("treatment_id") ?? "");
  const item_id = String(formData.get("item_id") ?? "");
  const quantity = Number(formData.get("quantity") ?? 0);

  if (!treatment_id || !item_id || quantity <= 0) {
    return { error: "Treatment, item and a positive quantity are required." };
  }

  const { error } = await supabase.from("treatment_dispensations").insert({
    treatment_id,
    item_id,
    quantity,
    dispensed_by: user?.id,
    handoff_type: "patient",
  });

  if (error) return { error: error.message };
  revalidatePath("/nurse", "layout");
  return undefined;
}

export type AdministerLine = {
  item_id: string;
  quantity: number;
};

export async function administerBatch(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const treatment_id = String(formData.get("treatment_id") ?? "");
  const linesRaw = String(formData.get("lines") ?? "[]");

  let lines: AdministerLine[];
  try {
    lines = JSON.parse(linesRaw);
  } catch {
    return { error: "Invalid administration data." };
  }

  if (!treatment_id) {
    return { error: "Select a treatment (patient encounter)." };
  }
  if (!Array.isArray(lines) || lines.length === 0) {
    return { error: "Add at least one item to administer." };
  }

  for (const [i, line] of lines.entries()) {
    if (!line.item_id || line.quantity <= 0) {
      return { error: `Line ${i + 1}: item and a positive quantity are required.` };
    }
  }

  const inserts = lines.map((line) => ({
    treatment_id,
    item_id: line.item_id,
    quantity: line.quantity,
    dispensed_by: user?.id,
    handoff_type: "patient",
  }));

  const { error } = await supabase.from("treatment_dispensations").insert(inserts);

  if (error) return { error: error.message };
  revalidatePath("/nurse", "layout");
  return undefined;
}

export async function recordVitals(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const treatment_id = String(formData.get("treatment_id") ?? "");
  const temperature = String(formData.get("temperature") ?? "").trim();
  const systolic = String(formData.get("systolic") ?? "").trim();
  const diastolic = String(formData.get("diastolic") ?? "").trim();
  const pulse = String(formData.get("pulse") ?? "").trim();
  const remarks = String(formData.get("remarks") ?? "").trim();

  if (!treatment_id) return { error: "Treatment is required." };

  const { error } = await supabase.from("treatment_vitals").insert({
    treatment_id,
    temperature: temperature ? Number(temperature) : null,
    systolic: systolic ? Number(systolic) : null,
    diastolic: diastolic ? Number(diastolic) : null,
    pulse: pulse ? Number(pulse) : null,
    remarks: remarks || null,
    recorded_by: user?.id,
  });

  if (error) return { error: error.message };
  revalidatePath("/nurse", "layout");
  return undefined;
}

export async function confirmAdministration(dispenseId: string): Promise<{ error?: string }> {
  const supabase = await createClient();

  if (!dispenseId) return { error: "Missing dispense record." };

  const { error } = await supabase.rpc("confirm_dispense_administration", {
    p_dispense_id: dispenseId,
  });

  if (error) return { error: error.message };
  revalidatePath("/nurse", "layout");
  return {};
}