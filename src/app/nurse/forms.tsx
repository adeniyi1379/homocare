"use client";

import { useEffect, useMemo, useRef, useState, useActionState } from "react";
import { administerBatch, recordVitals } from "./actions";
import { Field, inputClass, selectClass } from "@/components/ui";
import { FormError, SubmitButton } from "@/components/form-ui";
import { SearchPicker } from "@/components/search-picker";
import { encounterLabel, itemCategoryLabel, isStockedCategory } from "@/lib/utils";

export type TreatmentOption = {
  id: string;
  patient_code: string;
  full_name: string;
  encounter_type: string;
  branch_id?: string | null;
};

export type ItemOption = {
  id: string;
  item_name: string;
  category: string;
  stock_quantity: number;
  sell_price: number;
  branch_id?: string | null;
};

export function AdministerDoseForm({
  treatments,
  items,
}: {
  treatments: TreatmentOption[];
  items: ItemOption[];
}) {
  const [state, action] = useActionState(administerBatch, undefined);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [lines, setLines] = useState<{ item_id: string; quantity: number }[]>([]);
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);

  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const treatmentOptions = treatments.map((t) => ({
    id: t.id,
    primary: t.patient_code,
    secondary: t.full_name,
    detail: `${encounterLabel(t.encounter_type)}`,
  }));

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    const inCart = new Set(lines.map((l) => l.item_id));
    return items.filter((i) => {
      if (inCart.has(i.id)) return false;
      if (isStockedCategory(i.category) && i.stock_quantity <= 0) return false;
      return !q || i.item_name.toLowerCase().includes(q);
    });
  }, [query, lines, items]);

  function scheduleClose() {
    blurTimer.current = setTimeout(() => setShowResults(false), 150);
  }

  function cancelClose() {
    if (blurTimer.current) clearTimeout(blurTimer.current);
  }

  function addItemToCart(item: ItemOption) {
    setLines((prev) => [...prev, { item_id: item.id, quantity: 1 }]);
    setQuery("");
    setShowResults(false);
    inputRef.current?.focus();
  }

  function removeLine(itemId: string) {
    setLines((prev) => prev.filter((l) => l.item_id !== itemId));
  }

  function maxQty(item: ItemOption) {
    return isStockedCategory(item.category) ? Math.max(1, item.stock_quantity) : 9999;
  }

  function changeQty(itemId: string, delta: number) {
    const item = itemsById.get(itemId);
    const max = item ? maxQty(item) : 1;
    setLines((prev) =>
      prev.map((l) =>
        l.item_id === itemId
          ? { ...l, quantity: Math.min(max, Math.max(1, l.quantity + delta)) }
          : l
      )
    );
  }

  function setQty(itemId: string, raw: number) {
    const item = itemsById.get(itemId);
    const max = item ? maxQty(item) : 1;
    const qty = Number.isFinite(raw) ? Math.min(max, Math.max(1, Math.trunc(raw))) : 1;
    setLines((prev) => prev.map((l) => (l.item_id === itemId ? { ...l, quantity: qty } : l)));
  }

  const submitLines = lines.map((l) => ({ item_id: l.item_id, quantity: l.quantity }));

  return (
    <form action={action} className="space-y-4">
      <FormError message={state?.error} />
      <Field label="Treatment">
        <SearchPicker
          options={treatmentOptions}
          name="treatment_id"
          placeholder="Type patient name or ID, then select the encounter..."
          emptyText="No matching active encounters."
        />
      </Field>

      <div>
        <Field label="Search item">
          <div className="relative">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                const value = e.target.value;
                setQuery(value);
                setShowResults(value.trim().length > 1);
              }}
              onFocus={cancelClose}
              onBlur={scheduleClose}
              placeholder="Type an item name, then tap a result to add it..."
              className={inputClass}
              autoComplete="off"
            />
            {showResults && query.trim().length > 1 && (
              <ul
                className="absolute z-20 mt-1 max-h-44 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
                onMouseDown={cancelClose}
              >
                {suggestions.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-slate-400">
                    {query.trim() ? "No matching in-stock items." : "Type an item name to search."}
                  </li>
                ) : (
                  suggestions.map((i) => (
                    <li key={i.id}>
                      <button
                        type="button"
                        onClick={() => addItemToCart(i)}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-brand-50"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-slate-800">{i.item_name}</span>
                          <span className="text-xs text-slate-400">
                            {itemCategoryLabel(i.category)}
                            {!isStockedCategory(i.category)
                              ? " (charge-only)"
                              : ` · ${i.stock_quantity} in stock`}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        </Field>
      </div>

      {lines.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center text-sm text-slate-400">
          Nothing selected - search and add items above to record this administration.
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">
              Items to administer ({lines.length})
            </p>
            <button
              type="button"
              onClick={() => setLines([])}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700"
            >
              Clear
            </button>
          </div>

          {lines.map((line) => {
            const item = itemsById.get(line.item_id);
            if (!item) return null;
            return (
              <div
                key={line.item_id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900">
                    {item.item_name}
                  </div>
                  <div className="text-xs text-slate-400">{itemCategoryLabel(item.category)}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => changeQty(line.item_id, -1)}
                    aria-label={`Decrease quantity of ${item.item_name}`}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50"
                  >
                    &minus;
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={maxQty(item)}
                    required
                    value={line.quantity}
                    onChange={(e) => setQty(line.item_id, Number(e.target.value))}
                    className="h-7 w-14 rounded-md border border-slate-200 bg-white text-center text-sm font-semibold text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                  <button
                    type="button"
                    onClick={() => changeQty(line.item_id, 1)}
                    aria-label={`Increase quantity of ${item.item_name}`}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => removeLine(line.item_id)}
                  aria-label={`Remove ${item.item_name}`}
                  className="shrink-0 text-slate-300 transition-colors hover:text-rose-600"
                >
                  &times;
                </button>
              </div>
            );
          })}
        </div>
      )}

      <input type="hidden" name="lines" value={JSON.stringify(submitLines)} />
      {lines.length === 0 ? (
        <div className="text-center">
          <button
            type="submit"
            disabled
            className="btn btn-primary cursor-not-allowed opacity-60"
          >
            Administer 0 items
          </button>
          <p className="mt-1 text-xs text-slate-400">Add at least one item above.</p>
        </div>
      ) : (
        <SubmitButton
          pendingLabel={`Recording ${lines.length} item${lines.length > 1 ? "s" : ""}...`}
        >
          Administer {lines.length} item{lines.length > 1 ? "s" : ""}
        </SubmitButton>
      )}
    </form>
  );
}

export function VitalsForm({ treatments }: { treatments: TreatmentOption[] }) {
  const [state, action] = useActionState(recordVitals, undefined);

  return (
    <form action={action} className="space-y-3">
      <FormError message={state?.error} />
      <Field label="Treatment">
        <select name="treatment_id" required className={selectClass} defaultValue="">
          <option value="" disabled>
            Select active care...
          </option>
          {treatments.map((t) => (
            <option key={t.id} value={t.id}>
              {t.patient_code} - {t.full_name}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Temp (°C)">
          <input
            name="temperature"
            type="number"
            step="0.1"
            className={inputClass}
            placeholder="36.5"
          />
        </Field>
        <Field label="BP Sys">
          <input name="systolic" type="number" className={inputClass} placeholder="120" />
        </Field>
        <Field label="BP Dia">
          <input name="diastolic" type="number" className={inputClass} placeholder="80" />
        </Field>
      </div>
      <Field label="Pulse (bpm)">
        <input name="pulse" type="number" className={inputClass} placeholder="72" />
      </Field>
      <Field label="Remarks">
        <textarea
          name="remarks"
          rows={2}
          className={inputClass}
          placeholder="Clinical notes"
        />
      </Field>
      <SubmitButton pendingLabel="Saving...">Save Vitals</SubmitButton>
    </form>
  );
}