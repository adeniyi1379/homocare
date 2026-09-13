import { getCurrentUser, type Role } from "@/lib/auth";
import { ShellNav } from "@/components/shell-nav";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const current = await getCurrentUser();

  return (
    <ShellNav
      user={
        current
          ? {
              email: current.user.email,
              fullName: current.profile.full_name,
              role: current.profile.role as Role,
            }
          : null
      }
    >
      {children}
    </ShellNav>
  );
}