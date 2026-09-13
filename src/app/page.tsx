import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { homeForRole } from "@/lib/roles";

export default async function Home() {
  const current = await getCurrentUser();
  redirect(homeForRole(current?.profile.role ?? null));
}