export type Role = "receptionist" | "nurse" | "dispenser" | "cashier" | "admin";

export const ROLES: Role[] = [
  "receptionist",
  "nurse",
  "dispenser",
  "cashier",
  "admin",
];

export const ROLE_LABELS: Record<Role, string> = {
  receptionist: "Receptionist",
  nurse: "Nurse",
  dispenser: "Dispenser",
  cashier: "Cashier",
  admin: "Admin",
};

export const ITEM_CATEGORY_LABELS: Record<string, string> = {
  laboratory: "Laboratory",
  drugs: "Drugs",
  injection: "Injection",
  scanning: "Scanning",
  services: "Services",
  miscellaneous: "Miscellaneous",
};

export function homeForRole(role: string | null | undefined): string {
  switch (role) {
    case "receptionist":
      return "/receptionist";
    case "nurse":
      return "/nurse";
    case "dispenser":
      return "/dispense";
    case "cashier":
      return "/receptionist";
    case "admin":
      return "/admin";
    default:
      return "/login";
  }
}