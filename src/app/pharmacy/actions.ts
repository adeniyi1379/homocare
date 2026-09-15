"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ActionResult = { error: string } | undefined;

export async function addItem(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();

  const item_name = String(formData.get("item_name") ?? "").trim();
  const item_type = String(formData.get("item_type") ?? "");
  const stock_quantity = Number(formData.get("stock_quantity") ?? 0);
  const reorder_level = Number(formData.get("reorder_level") ?? 10);
  const unit_cost_price = Number(formData.get("unit_cost_price") ?? 0);

  if (!item_name || unit_cost_price < 0) {
    return { error: "Item name and valid unit cost are required." };
  }

  const { error } = await supabase.from("pharmacy_inventory").insert({
    item_name,
    item_type,
    stock_quantity: Math.max(0, Math.floor(stock_quantity)),
    reorder_level: Math.max(0, Math.floor(reorder_level)),
    unit_cost_price,
  });

  if (error) return { error: error.message };
  revalidatePath("/pharmacy", "layout");
  return undefined;
}

export async function adjustStock(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();

  const item_id = String(formData.get("item_id") ?? "");
  const deltaRaw = Number(formData.get("delta") ?? 0);
  const delta = Number.isInteger(deltaRaw) ? deltaRaw : Math.trunc(deltaRaw);

  if (!item_id || delta === 0) {
    return { error: "Select an item and provide a non-zero adjustment." };
  }

  const { error } = await supabase.rpc("adjust_stock", { item: item_id, delta });

  if (error) return { error: error.message };
  revalidatePath("/pharmacy", "layout");
  return undefined;
}

export async function changeItemCost(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();

  const item_id = String(formData.get("item_id") ?? "");
  const new_cost = Number(formData.get("unit_cost_price") ?? 0);

  if (!item_id || !Number.isFinite(new_cost) || new_cost < 0) {
    return { error: "Select an item and provide a valid unit cost." };
  }

  const { error } = await supabase.rpc("set_item_cost", {
    item: item_id,
    new_cost,
  });

  if (error) return { error: error.message };
  revalidatePath("/pharmacy", "layout");
  return undefined;
}

export type DispenseLine = {
  handoff: "nurse" | "patient";
  item_id: string;
  quantity: number;
  dispensed_to: string;
};

export async function dispenseBatch(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const treatment_id = String(formData.get("treatment_id") ?? "");
  const linesRaw = String(formData.get("lines") ?? "[]");

  let lines: DispenseLine[];
  try {
    lines = JSON.parse(linesRaw);
  } catch {
    return { error: "Invalid dispense data." };
  }

  if (!treatment_id) {
    return { error: "Select a treatment (patient encounter)." };
  }
  if (!Array.isArray(lines) || lines.length === 0) {
    return { error: "Add at least one item to dispense." };
  }

  for (const [i, line] of lines.entries()) {
    if (!line.item_id || line.quantity <= 0) {
      return { error: `Line ${i + 1}: item and a positive quantity are required.` };
    }
    const handoff = line.handoff === "patient" ? "patient" : "nurse";
    if (handoff === "nurse" && !line.dispensed_to) {
      return { error: `Line ${i + 1}: select the nurse the item is handed to.` };
    }
  }

  const inserts = lines.map((line) => {
    const handoff = line.handoff === "patient" ? "patient" : "nurse";
    return {
      treatment_id,
      item_id: line.item_id,
      quantity: line.quantity,
      dispensed_by: user?.id,
      handoff_type: handoff,
      dispensed_to: handoff === "nurse" ? line.dispensed_to : null,
    };
  });

  const { error } = await supabase
    .from("treatment_dispensations")
    .insert(inserts);

  if (error) return { error: error.message };
  revalidatePath("/pharmacy", "layout");
  return undefined;
}

export type StaffRecipient = {
  id: string;
  full_name: string;
  role: string;
};

export type ItemUsageRow = {
  item_name: string;
  quantity: number;
  unit_cost_snapshot: number;
  handoff_type: string | null;
  patient_code: string;
  patient_name: string;
  treatment_id: string;
  encounter_label: string;
  dispensed_by_name: string | null;
  dispensed_at: string;
  dispensed_to_name: string | null;
  administered_by_name: string | null;
  administered_at: string | null;
};

export async function getItemUsage(
  itemId: string
): Promise<{ rows?: ItemUsageRow[]; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_item_usage", { p_item_id: itemId });

  if (error) return { error: error.message };
  return { rows: (data ?? []) as unknown as ItemUsageRow[] };
}