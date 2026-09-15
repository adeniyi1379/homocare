"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export type ActionResult = { error: string } | undefined;

export async function createStaff(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const full_name = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const role = String(formData.get("role") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!full_name || !email || !role || !password) {
    return { error: "Name, email, role and password are required." };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role },
  });

  if (error) return { error: error.message };
  revalidatePath("/admin", "layout");
  return undefined;
}

export async function updateStaff(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();

  const user_id = String(formData.get("user_id") ?? "");
  const full_name = String(formData.get("full_name") ?? "").trim();
  const role = String(formData.get("role") ?? "");

  if (!user_id || !full_name || !role) {
    return { error: "Name and role are required." };
  }

  const { error } = await supabase.rpc("admin_update_user", {
    p_user_id: user_id,
    p_full_name: full_name,
    p_role: role,
  });

  if (error) return { error: error.message };
  revalidatePath("/admin", "layout");
  return undefined;
}

export async function resetStaffPassword(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const user_id = String(formData.get("user_id") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!user_id || !password) return { error: "User and new password are required." };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(user_id, { password });

  if (error) return { error: error.message };
  revalidatePath("/admin", "layout");
  return undefined;
}

export async function toggleStaffActive(
  userId: string,
  active: boolean
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase.rpc("admin_set_user_active", {
    p_user_id: userId,
    p_active: active,
  });

  if (error) return { error: error.message };
  revalidatePath("/admin", "layout");
  return {};
}

export async function addCategory(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const sort_order = Math.max(0, Math.floor(Number(formData.get("sort_order") ?? 0)));

  if (!name) return { error: "Category name is required." };

  const { error } = await supabase
    .from("treatment_categories")
    .insert({ name, description: description || null, sort_order });

  if (error) return { error: error.message };
  revalidatePath("/admin", "layout");
  return undefined;
}

export async function updateCategory(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const sort_order = Math.max(0, Math.floor(Number(formData.get("sort_order") ?? 0)));

  if (!id || !name) return { error: "Category name is required." };

  const { error } = await supabase
    .from("treatment_categories")
    .update({ name, description: description || null, sort_order })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/admin", "layout");
  return undefined;
}

export async function toggleCategoryActive(
  id: string,
  active: boolean
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("treatment_categories")
    .update({ active })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/admin", "layout");
  return {};
}

export async function deleteCategory(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase.from("treatment_categories").delete().eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/admin", "layout");
  return {};
}