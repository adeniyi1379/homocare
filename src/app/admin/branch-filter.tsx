"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function BranchFilter({
  branches,
  current,
}: {
  branches: { id: string; name: string; code: string }[];
  current: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(branchId: string) {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("tab", "overview");
    if (branchId) {
      sp.set("branch", branchId);
    } else {
      sp.delete("branch");
    }
    router.replace(`?${sp.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <span className="font-medium">Branch:</span>
        <select
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none"
          value={current ?? ""}
          onChange={(e) => handleChange(e.target.value)}
        >
          <option value="">All branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} ({b.code})
            </option>
          ))}
        </select>
      </label>
      {current && (
        <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
          Showing: {branches.find((b) => b.id === current)?.name ?? "Unknown branch"}
        </span>
      )}
    </div>
  );
}