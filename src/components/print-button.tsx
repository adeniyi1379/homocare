"use client";

export function PrintButton({ label = "Print Receipt" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
    >
      {label}
    </button>
  );
}