export function formatNaira(amount: number | string | null | undefined): string {
  const n = Number(amount ?? 0);
  return `\u20A6${n.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function oneOrNull<T>(v: T | T[] | null | undefined): T | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  return d.toLocaleDateString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  return d.toLocaleString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function paymentStatusBadge(
  status: "UNPAID" | "PARTIAL" | "PAID IN FULL"
): string {
  switch (status) {
    case "UNPAID":
      return "bg-red-100 text-red-700";
    case "PARTIAL":
      return "bg-amber-100 text-amber-700";
    case "PAID IN FULL":
      return "bg-emerald-100 text-emerald-700";
  }
}

export function stockBadge(status: "LOW" | "OK" | "OUT OF STOCK"): string {
  switch (status) {
    case "OK":
      return "bg-emerald-100 text-emerald-700";
    case "LOW":
      return "bg-amber-100 text-amber-700";
    case "OUT OF STOCK":
      return "bg-red-100 text-red-700";
  }
}

export function treatmentStatusBadge(status: string): string {
  switch (status) {
    case "active":
      return "bg-blue-100 text-blue-700";
    case "discharged":
      return "bg-purple-100 text-purple-700";
    case "completed":
      return "bg-emerald-100 text-emerald-700";
    case "cancelled":
      return "bg-gray-200 text-gray-600";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

export function encounterLabel(type: string): string {
  switch (type) {
    case "one_time":
      return "One-Time";
    case "admission":
      return "Admission";
    case "recurring":
      return "Recurring";
    default:
      return type;
  }
}