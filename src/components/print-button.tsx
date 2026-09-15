"use client";

export function PrintButton({ label = "Print Receipt" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print btn btn-primary"
    >
      {label}
    </button>
  );
}