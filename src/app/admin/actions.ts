"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ActionResult = { error: string } | undefined;

export async function setRole(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();

  const user_id = String(formData.get("user_id") ?? "");
  const role = String(formData.get("role") ?? "");

  if (!user_id || !role) return { error: "User and role are required." };

  const { error } = await supabase.rpc("set_user_role", { user_id, new_role: role });

  if (error) return { error: error.message };
  revalidatePath("/admin", "layout");
  return undefined;
}