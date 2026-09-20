"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type ActionResult = { error: string } | undefined;

export async function collectPayment(
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

  if (!treatment_id) {
    return { error: "Select a treatment." };
  }
  if (amount_paid <= 0) {
    return { error: "Amount must be greater than zero." };
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

  revalidatePath("/receptionist", "layout");
  revalidatePath("/cashier", "layout");
  redirect(`/cashier/receipt/${data.receipt_number}`);
}

export async function updatePayment(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();

  const payment_id = String(formData.get("payment_id") ?? "");
  const amount_paid = Number(formData.get("amount_paid") ?? 0);
  const payment_method = String(formData.get("payment_method") ?? "cash");

  if (!payment_id) return { error: "Payment ID missing." };
  if (amount_paid <= 0) return { error: "Amount must be greater than zero." };

  const { error } = await supabase
    .from("payments")
    .update({
      amount_paid: Math.round(amount_paid * 100) / 100,
      payment_method,
    })
    .eq("id", payment_id);

  if (error) return { error: error.message };

  revalidatePath("/receptionist", "layout");
  revalidatePath("/cashier", "layout");
  return undefined;
}
