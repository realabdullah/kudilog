// ─── ExpenseList ───────────────────────────────────────────────────────────────
//
// Renders the list of expenses for a given month with:
//   - Search / filter by name or category
//   - Sort by: date (newest), amount (highest), name (A–Z)
//   - Empty state
//   - Skeleton loading state
//   - Highest-expense highlight passed down to ExpenseItem

import { useState, useMemo, useCallback } from "react";
import ExpenseItem from "./ExpenseItem";
import { EmptyState, Skeleton, KudiIcon } from "../ui/index";
import { getCategoryLabel } from "../../utils/formatters";

// ─── Sort options ──────────────────────────────────────────────────────────────

const SORT_OPTIONS = [
  { id: "date", label: "Newest" },
  { id: "amount", label: "Highest" },
  { id: "name", label: "A–Z" },
];

function sortExpenses(expenses, sortBy) {
  const copy = [...expenses];
  switch (sortBy) {
    case "amount":
      return copy.sort((a, b) => b.amount - a.amount);
    case "name":
      return copy.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      );
    case "date":
    default:
      return copy.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
}

// ─── Search bar ────────────────────────────────────────────────────────────────

function SearchBar({ value, onChange, onClear }) {
  return (
    <div className="relative flex items-center">
      {/* Icon */}
      <svg
        width="13"
        height="13"
        viewBox="0 0 13 13"
        fill="none"
        className="absolute left-3 pointer-events-none text-[#444]"
      >
        <circle
          cx="5.5"
          cy="5.5"
          r="4"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M9 9l2.5 2.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>

      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search expenses…"
        className="
          w-full bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl
          pl-8 pr-8 py-2 text-[13px] text-white
          placeholder:text-[#333]
          outline-none
          transition-colors duration-150
        "
      />

      {/* Clear */}
      {value && (
        <button
          onClick={onClear}
          className="absolute right-2.5 text-[#444] hover:text-[#777] transition-colors"
          aria-label="Clear search"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M1 1l10 10M11 1L1 11"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

// ─── Sort tabs ─────────────────────────────────────────────────────────────────

function SortTabs({ value, onChange }) {
  return (
    <div className="flex items-center gap-0.5 bg-[#0d0d0d] rounded-lg p-0.5 border border-[#1a1a1a]">
      {SORT_OPTIONS.map((opt) => (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          className={`
            px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-150
            ${
              value === opt.id
                ? "bg-[#1f1f1f] text-white"
                : "text-[#444] hover:text-[#777]"
            }
          `}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Loading skeletons ─────────────────────────────────────────────────────────

function LoadingSkeletons({ count = 5 }) {
  return (
    <div className="space-y-0">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-3">
          <Skeleton className="w-1.5 h-1.5 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-1/2 rounded-md" />
            <Skeleton className="h-2.5 w-1/4 rounded-md" />
          </div>
          <Skeleton className="h-4 w-16 rounded-md shrink-0" />
        </div>
      ))}
    </div>
  );
}

// ─── Results summary ───────────────────────────────────────────────────────────

function ResultsSummary({ filtered, total, query }) {
  if (!query) return null;
  return (
    <div className="text-[11px] text-[#444] px-0 pb-1">
      {filtered === 0
        ? `No results for "${query}"`
        : `${filtered} of ${total} expense${total !== 1 ? "s" : ""}`}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

/**
 * @param {{
 *   expenses: import("../../db/db").Expense[] | undefined,
 *   currency: string,
 *   loading?: boolean,
 * }} props
 */
export default function ExpenseList({
  expenses,
  currency = "NGN",
  loading = false,
}) {
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("date");

  const clearSearch = useCallback(() => setQuery(""), []);

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!expenses) return [];

    const q = query.trim().toLowerCase();

    const matched = q
      ? expenses.filter((e) => {
          const nameMatch = e.name.toLowerCase().includes(q);
          const catMatch = getCategoryLabel(e.category)
            .toLowerCase()
            .includes(q);
          const amountMatch = String(e.amount).includes(q);
          return nameMatch || catMatch || amountMatch;
        })
      : expenses;

    return sortExpenses(matched, sortBy);
  }, [expenses, query, sortBy]);

  // ── Highest expense ID ─────────────────────────────────────────────────────
  const highestId = useMemo(() => {
    if (!expenses || expenses.length === 0) return null;
    return expenses.reduce(
      (maxExp, e) => (e.amount > maxExp.amount ? e : maxExp),
      expenses[0],
    ).id;
  }, [expenses]);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading || expenses === undefined) {
    return (
      <div>
        <div className="flex items-center justify-between gap-2 mb-4">
          <Skeleton className="h-8 flex-1 rounded-xl" />
          <Skeleton className="h-8 w-27.5 rounded-lg" />
        </div>
        <LoadingSkeletons count={5} />
      </div>
    );
  }

  // ── Empty month (no expenses at all) ───────────────────────────────────────
  if (expenses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center select-none">
        <div className="mb-5 opacity-25">
          <KudiIcon size={56} />
        </div>
        <p className="text-[14px] font-medium text-[#555] mb-1">
          No expenses yet
        </p>
        <p className="text-[12px] text-[#3a3a3a] max-w-xs leading-relaxed">
          Add your first expense above — try typing{" "}
          <span className="text-[#555] font-medium">"netflix 6500"</span> and
          pressing Enter.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Controls row */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1">
          <SearchBar value={query} onChange={setQuery} onClear={clearSearch} />
        </div>
        <SortTabs value={sortBy} onChange={setSortBy} />
      </div>

      {/* Results summary */}
      <ResultsSummary
        filtered={filtered.length}
        total={expenses.length}
        query={query}
      />

      {/* No search results */}
      {filtered.length === 0 && query ? (
        <EmptyState
          icon="🔍"
          title={`No results for "${query}"`}
          description="Try a different name, category, or amount."
          action={
            <button
              onClick={clearSearch}
              className="text-[12px] text-[#555] hover:text-[#888] underline underline-offset-2 transition-colors"
            >
              Clear search
            </button>
          }
        />
      ) : (
        /* Expense rows */
        <div className="divide-y divide-[#111]">
          {filtered.map((expense) => (
            <ExpenseItem
              key={expense.id}
              expense={expense}
              currency={currency}
              isHighest={expense.id === highestId && expenses.length > 1}
            />
          ))}
        </div>
      )}

      {/* Footer count */}
      {filtered.length > 0 && (
        <div className="mt-3 text-center text-[11px] text-[#2a2a2a]">
          {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
          {query ? ` matching "${query}"` : ""}
        </div>
      )}
    </div>
  );
}
