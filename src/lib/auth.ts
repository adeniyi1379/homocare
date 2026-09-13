import "server-only";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { homeForRole, type Role } from "@/lib/roles";

export type { Role } from "@/lib/roles";

export type CurrentUser =
  | {
      user: { id: string; email: string };
      profile: {
        id: string;
        full_name: string;
        role: Role;
        created_at: string;
      };
    }
  | null;

export async function getCurrentUser(): Promise<CurrentUser> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, created_at")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return {
    user: { id: user.id, email: user.email ?? "" },
    profile: {
      id: profile.id,
      full_name: profile.full_name,
      role: profile.role as Role,
      created_at: profile.created_at,
    },
  };
}

export async function requireRole(allowed: Role[]): Promise<NonNullable<CurrentUser>> {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  if (!allowed.includes(current.profile.role)) redirect(homeForRole(current.profile.role));
  return current;
}