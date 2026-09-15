"use client";

import { useState } from "react";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "staff", label: "Staff & Users" },
  { id: "categories", label: "Intake Categories" },
] as const;

export function AdminTabs({
  overview,
  staff,
  categories,
}: {
  overview: React.ReactNode;
  staff: React.ReactNode;
  categories: React.ReactNode;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("overview");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
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
      {tab === "staff" && <div>{staff}</div>}
      {tab === "categories" && <div>{categories}</div>}
    </div>
  );
}