"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function endTreatment(id: string): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("treatment_end", { t: id });
  if (error) return error.message;
  revalidatePath("/receptionist", "layout");
  revalidatePath("/admin", "layout");
  revalidatePath("/cashier", "layout");
  return null;
}

export async function cancelTreatment(id: string): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_treatment", { t: id });
  if (error) return error.message;
  revalidatePath("/receptionist", "layout");
  revalidatePath("/admin", "layout");
  revalidatePath("/cashier", "layout");
  return null;
}