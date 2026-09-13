"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type ActionResult = { error: string } | undefined;

export async function setFee(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();

  const treatment_id = String(formData.get("treatment_id") ?? "");
  const total_treatment_fee = Number(formData.get("total_treatment_fee") ?? 0);

  if (!treatment_id || total_treatment_fee < 0) {
    return { error: "Select a treatment and enter a valid fee." };
  }

  const { error } = await supabase
    .from("treatments")
    .update({ total_treatment_fee: Math.round(total_treatment_fee * 100) / 100 })
    .eq("id", treatment_id);

  if (error) return { error: error.message };
  revalidatePath("/cashier", "layout");
  return undefined;
}

export async function recordPayment(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const treatment_id = String(formData.get("treatment_id") ?? "");
  const amount_paid = Number(formData.get("amount_paid") ?? 0);
  const payment_method = String(formData.get("payment_method") ?? "cash");

  if (!treatment_id || amount_paid <= 0) {
    return { error: "Select a treatment and enter an amount greater than zero." };
  }

  const { data, error } = await supabase
    .from("payments")
    .insert({
      treatment_id,
      amount_paid: Math.round(amount_paid * 100) / 100,
      payment_method,
      cashier_id: user?.id,
    })
    .select("receipt_number")
    .single();

  if (error) return { error: error.message };
  if (!data?.receipt_number) return { error: "Receipt could not be generated." };

  revalidatePath("/cashier", "layout");
  redirect(`/cashier/receipt/${data.receipt_number}`);
}