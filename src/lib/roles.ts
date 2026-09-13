export type Role = "receptionist" | "nurse" | "pharmacy" | "cashier" | "admin";

export const ROLES: Role[] = [
  "receptionist",
  "nurse",
  "pharmacy",
  "cashier",
  "admin",
];

export const ROLE_LABELS: Record<Role, string> = {
  receptionist: "Receptionist",
  nurse: "Nurse",
  pharmacy: "Pharmacy",
  cashier: "Cashier",
  admin: "Admin",
};

export function homeForRole(role: string | null | undefined): string {
  switch (role) {
    case "receptionist":
      return "/receptionist";
    case "nurse":
      return "/nurse";
    case "pharmacy":
      return "/pharmacy";
    case "cashier":
      return "/cashier";
    case "admin":
      return "/admin";
    default:
      return "/login";
  }
}