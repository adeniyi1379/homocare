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

export async function dispenseToTreatment(
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
  });

  if (error) return { error: error.message };
  revalidatePath("/pharmacy", "layout");
  return undefined;
}