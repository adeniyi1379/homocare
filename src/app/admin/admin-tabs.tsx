"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "treatments", label: "Treatments" },
  { id: "staff", label: "Staff & Users" },
  { id: "categories", label: "Intake Categories" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const VALID_TABS = new Set<string>(TABS.map((t) => t.id));

export function AdminTabs({
  overview,
  staff,
  categories,
  treatments,
  initialTab = "overview",
}: {
  overview: React.ReactNode;
  staff: React.ReactNode;
  categories: React.ReactNode;
  treatments: React.ReactNode;
  initialTab?: string;
}) {
  const [tab, setTab] = useState<TabId>(
    VALID_TABS.has(initialTab) ? (initialTab as TabId) : "overview",
  );
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const next = searchParams.get("tab");
    if (next && VALID_TABS.has(next) && next !== tab) {
      setTab(next as TabId);
    }
  }, [searchParams]);

  function selectTab(next: TabId) {
    setTab(next);
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("tab", next);
    router.replace(`?${sp.toString()}`, { scroll: false });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => selectTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              tab === t.id
                ? "bg-brand-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-brand-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && overview}
      {tab === "treatments" && <div>{treatments}</div>}
      {tab === "staff" && <div>{staff}</div>}
      {tab === "categories" && <div>{categories}</div>}
    </div>
  );
}
