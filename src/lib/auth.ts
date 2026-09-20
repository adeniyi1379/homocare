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
        branch_id: string | null;
        branch_name: string | null;
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
    .select("id, full_name, role, branch_id, created_at, branches(name)")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return {
    user: { id: user.id, email: user.email ?? "" },
    profile: {
      id: profile.id,
      full_name:
        profile.full_name?.trim() !== ""
          ? profile.full_name
          : ((user.user_metadata?.full_name as string | undefined) ?? ""),
      role: profile.role as Role,
      branch_id: profile.branch_id,
      branch_name: (profile.branches as unknown as { name: string } | null)?.name ?? null,
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