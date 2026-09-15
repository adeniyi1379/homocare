"use client";

import { useMemo, useRef, useState } from "react";
import { inputClass } from "@/components/ui";

export type PickerOption = {
  id: string;
  primary: string;
  secondary: string;
  detail?: string | null;
};

export function SearchPicker({
  options,
  name,
  placeholder,
  emptyText,
}: {
  options: PickerOption[];
  name: string;
  placeholder: string;
  emptyText: string;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PickerOption | null>(null);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 6);
    return options
      .filter(
        (o) =>
          o.primary.toLowerCase().includes(q) ||
          o.secondary.toLowerCase().includes(q) ||
          (o.detail ?? "").toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [query, options]);

  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleClose() {
    blurTimer.current = setTimeout(() => setOpen(false), 150);
  }

  function cancelClose() {
    if (blurTimer.current) clearTimeout(blurTimer.current);
  }

  function choose(o: PickerOption) {
    cancelClose();
    setSelected(o);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }

  return (
    <div className="relative">
      <input type="hidden" name={name} value={selected?.id ?? ""} />

      {selected && !open ? (
        <div className="flex items-center justify-between rounded-lg border border-brand-200 bg-brand-50 px-3 py-2">
          <div className="min-w-0">
            <div className="font-mono text-xs font-semibold text-brand-700">{selected.primary}</div>
            <div className="truncate text-sm font-medium text-slate-800">{selected.secondary}</div>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              inputRef.current?.focus();
            }}
            className="ml-3 shrink-0 text-xs font-semibold text-brand-600 hover:underline"
          >
            Change
          </button>
        </div>
      ) : (
        <>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => {
              cancelClose();
              setOpen(true);
            }}
            onBlur={scheduleClose}
            placeholder={placeholder}
            className={inputClass}
            autoComplete="off"
          />
          {open && (
            <ul
              className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
              onMouseDown={cancelClose}
            >
              {results.length === 0 ? (
                <li className="px-3 py-2 text-sm text-slate-400">{emptyText}</li>
              ) : (
                results.map((o) => (
                  <li key={o.id}>
                    <button
                      type="button"
                      onClick={() => choose(o)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-brand-50"
                    >
                      <span className="min-w-0">
                        <span className="font-mono text-xs font-semibold text-brand-600">
                          {o.primary}
                        </span>
                        <span className="ml-2 truncate text-sm text-slate-800">{o.secondary}</span>
                      </span>
                      {o.detail ? (
                        <span className="shrink-0 text-xs text-slate-400">{o.detail}</span>
                      ) : null}
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </>
      )}
    </div>
  );
}