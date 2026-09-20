"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function DispenseBranchSwitch({
  branches,
  current,
}: {
  branches: { id: string; name: string; code: string }[];
  current: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function select(branchId: string) {
    const sp = new URLSearchParams(searchParams.toString());
    if (branchId) {
      sp.set("branch", branchId);
    } else {
      sp.delete("branch");
    }
    router.replace(`?${sp.toString()}`, { scroll: false });
  }

  const btnBase =
    "px-3 py-1.5 text-sm font-semibold transition-colors active:scale-[0.98]";
  const btnActive = "bg-brand-600 text-white shadow-brand-900/20";
  const btnIdle = "bg-white text-slate-500 hover:text-slate-700";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-semibold text-slate-600">Branch:</span>
      <div className="flex flex-wrap overflow-hidden rounded-lg border border-slate-200 text-sm shadow-sm">
        <button
          type="button"
          onClick={() => select("")}
          className={`${btnBase} ${current ? btnIdle : btnActive}`}
        >
          All
        </button>
        {branches.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => select(b.id)}
            className={`${btnBase} ${
              current === b.id ? btnActive : btnIdle
            } border-l border-slate-200`}
          >
            {b.name}
          </button>
        ))}
      </div>
    </div>
  );
}