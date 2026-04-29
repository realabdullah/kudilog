// ─── ExpenseList ───────────────────────────────────────────────────────────────
//
// Renders the list of expenses for a given month with:
//   - Search / filter by name or category
//   - Sort by: date (newest), amount (highest), name (A–Z)
//   - Empty state
//   - Skeleton loading state
//   - Highest-expense highlight passed down to ExpenseItem

import { useCallback, useMemo, useState } from "react"
import {
  countActiveExpenseFilters,
  createEmptyExpenseFilters,
  getFilteredExpenses,
} from "../../utils/expenseFilters"
import { CATEGORIES, getCategoryLabel } from "../../utils/formatters"
import { EmptyState, KudiIcon, Skeleton } from "../ui/index"
import ExpenseItem from "./ExpenseItem"

/** @typedef {"date" | "amount" | "name"} SortBy */
/** @typedef {{ query: string, categories: string[], minAmount: string, maxAmount: string, startDate: string, endDate: string }} ExpenseFilters */

// ─── Sort options ──────────────────────────────────────────────────────────────

const SORT_OPTIONS = [
  { id: "date", label: "Newest" },
  { id: "amount", label: "Highest" },
  { id: "name", label: "A–Z" },
];

// ─── Search bar ────────────────────────────────────────────────────────────────

/** @param {{ value: string, onChange: (value: string) => void, onClear: () => void }} props */
function SearchBar({ value, onChange, onClear }) {
  return (
    <div className="relative flex items-center">
      {/* Icon */}
      <svg
        width="13"
        height="13"
        viewBox="0 0 13 13"
        fill="none"
        className="absolute left-3 pointer-events-none text-[#6a6a6a]"
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
          placeholder:text-[#5e5e5e]
          outline-none
          transition-colors duration-150
        "
      />

      {/* Clear */}
      {value && (
        <button
          onClick={onClear}
          className="absolute right-2.5 text-[#6a6a6a] hover:text-[#777] transition-colors"
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

/** @param {{ activeCount: number, open: boolean, onClick: () => void }} props */
function FilterToggle({ activeCount, open, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[11px] font-medium transition-colors
        ${open || activeCount > 0 ? "bg-[#6bbf4e]/10 border-[#6bbf4e]/20 text-[#6bbf4e]" : "bg-[#0d0d0d] border-[#1a1a1a] text-[#7a7a7a] hover:text-[#888]"}
      `}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path
          d="M1.5 2.5h9M3.5 6h5M5 9.5h2"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
      Filters
      {activeCount > 0 ? (
        <span className="min-w-4 h-4 px-1 rounded-full bg-[#6bbf4e] text-[#17311a] text-[10px] leading-4 text-center">
          {activeCount}
        </span>
      ) : null}
    </button>
  );
}

// ─── Sort tabs ─────────────────────────────────────────────────────────────────

/** @param {{ value: SortBy, onChange: (value: SortBy) => void }} props */
function SortTabs({ value, onChange }) {
  return (
    <div className="flex items-center gap-0.5 bg-[#0d0d0d] rounded-lg p-0.5 border border-[#1a1a1a]">
      {SORT_OPTIONS.map((opt) => (
        <button
          key={opt.id}
          onClick={() => onChange(/** @type {SortBy} */ (opt.id))}
          className={`
            px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-150
            ${
              value === opt.id
                ? "bg-[#1f1f1f] text-white"
                : "text-[#6a6a6a] hover:text-[#777]"
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

/** @param {{ filtered: number, total: number, query: string }} props */
function ResultsSummary({ filtered, total, query }) {
  if (!query) return null;
  return (
    <div className="text-[11px] text-[#6a6a6a] px-0 pb-1">
      {filtered === 0
        ? `No results for "${query}"`
        : `${filtered} of ${total} expense${total !== 1 ? "s" : ""}`}
    </div>
  );
}

/** @param {{ label: string, onRemove: () => void }} props */
function FilterChip({ label, onRemove }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[#1a1a1a] border border-[#222] text-[#aaa] hover:text-white hover:border-[#333] transition-colors"
    >
      <span>{label}</span>
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path
          d="M1 1l8 8M9 1L1 9"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}

/** @param {{ filters: ExpenseFilters, onChange: (value: ExpenseFilters) => void, onReset: () => void }} props */
function FilterPanel({ filters, onChange, onReset }) {
  const toggleCategory = (/** @type {string} */ categoryId) => {
    const nextCategories = filters.categories.includes(categoryId)
      ? filters.categories.filter((/** @type {string} */ id) => id !== categoryId)
      : [...filters.categories, categoryId];
    onChange({ ...filters, categories: nextCategories });
  };

  return (
    <div className="mb-3 rounded-xl border border-[#1a1a1a] bg-[#0d0d0d] p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-[#7a7a7a]">
          Filter expenses
        </span>
        <button
          type="button"
          onClick={onReset}
          className="text-[11px] text-[#7a7a7a] hover:text-[#888] transition-colors"
        >
          Reset all
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block text-[10px] font-medium text-[#666] uppercase tracking-wider ml-1">Min Amount</label>
          <input
            type="text"
            inputMode="decimal"
            value={filters.minAmount}
            onChange={(e) => onChange({ ...filters, minAmount: e.target.value })}
            placeholder="0.00"
            className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg px-3 py-2 text-[12px] text-white outline-none focus:border-[#333]"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-[10px] font-medium text-[#666] uppercase tracking-wider ml-1">Max Amount</label>
          <input
            type="text"
            inputMode="decimal"
            value={filters.maxAmount}
            onChange={(e) => onChange({ ...filters, maxAmount: e.target.value })}
            placeholder="0.00"
            className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg px-3 py-2 text-[12px] text-white outline-none focus:border-[#333]"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-[10px] font-medium text-[#666] uppercase tracking-wider ml-1">Start Date</label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => onChange({ ...filters, startDate: e.target.value })}
            className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg px-3 py-2 text-[12px] text-white outline-none focus:border-[#333]"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-[10px] font-medium text-[#666] uppercase tracking-wider ml-1">End Date</label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => onChange({ ...filters, endDate: e.target.value })}
            className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg px-3 py-2 text-[12px] text-white outline-none focus:border-[#333]"
          />
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
        {CATEGORIES.map((category) => {
          const selected = filters.categories.includes(category.id);
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => toggleCategory(category.id)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border whitespace-nowrap transition-colors ${selected ? "bg-[#6bbf4e]/15 text-[#6bbf4e] border-[#6bbf4e]/30" : "text-[#7a7a7a] border-[#1f1f1f] hover:text-[#888] hover:border-[#333]"}`}
            >
              <span>{category.emoji}</span>
              <span>{category.label}</span>
            </button>
          );
        })}
      </div>
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
  /** @type {[ExpenseFilters, import("react").Dispatch<import("react").SetStateAction<ExpenseFilters>>]} */
  const [filters, setFilters] = useState(createEmptyExpenseFilters);
  /** @type {[SortBy, import("react").Dispatch<import("react").SetStateAction<SortBy>>]} */
  const [sortBy, setSortBy] = useState(/** @type {SortBy} */ ("date"));
  const [filtersOpen, setFiltersOpen] = useState(false);

  const clearSearch = useCallback(
    () => setFilters((prev) => ({ ...prev, query: "" })),
    [],
  );

  const resetFilters = useCallback(() => {
    setFilters(createEmptyExpenseFilters());
  }, []);

  const activeFilterCount = useMemo(
    () => countActiveExpenseFilters(filters),
    [filters],
  );

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return /** @type {import("../../db/db").Expense[]} */ (
      getFilteredExpenses(expenses, filters, sortBy)
    );
  }, [expenses, filters, sortBy]);

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
        <p className="text-[14px] font-medium text-[#7a7a7a] mb-1">
          No expenses yet
        </p>
        <p className="text-[12px] text-[#666] max-w-xs leading-relaxed">
          Add your first expense above — try typing{" "}
          <span className="text-[#7a7a7a] font-medium">"netflix 6500"</span> and
          pressing Enter.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Controls — search + filter on first row; sort wraps below on small screens */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex-1 min-w-0">
            <SearchBar
              value={filters.query}
              onChange={(/** @type {string} */ value) =>
                setFilters((prev) => ({ ...prev, query: value }))
              }
              onClear={clearSearch}
            />
          </div>
          <FilterToggle
            activeCount={activeFilterCount}
            open={filtersOpen}
            onClick={() => setFiltersOpen((prev) => !prev)}
          />
        </div>
        <div className="flex items-center w-full sm:w-auto">
          <SortTabs value={sortBy} onChange={setSortBy} />
        </div>
      </div>

      {filtersOpen ? (
        <FilterPanel
          filters={filters}
          onChange={setFilters}
          onReset={resetFilters}
        />
      ) : null}

      {activeFilterCount > 0 ? (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {filters.query ? (
            <FilterChip
              label={`Search: ${filters.query}`}
              onRemove={() => setFilters((prev) => ({ ...prev, query: "" }))}
            />
          ) : null}
          {filters.categories.map((categoryId) => (
            <FilterChip
              key={categoryId}
              label={getCategoryLabel(categoryId)}
              onRemove={() =>
                setFilters((prev) => ({
                  ...prev,
                  categories: prev.categories.filter((id) => id !== categoryId),
                }))
              }
            />
          ))}
          {filters.minAmount ? (
            <FilterChip
              label={`Min ${filters.minAmount}`}
              onRemove={() => setFilters((prev) => ({ ...prev, minAmount: "" }))}
            />
          ) : null}
          {filters.maxAmount ? (
            <FilterChip
              label={`Max ${filters.maxAmount}`}
              onRemove={() => setFilters((prev) => ({ ...prev, maxAmount: "" }))}
            />
          ) : null}
          {filters.startDate ? (
            <FilterChip
              label={`From ${filters.startDate}`}
              onRemove={() => setFilters((prev) => ({ ...prev, startDate: "" }))}
            />
          ) : null}
          {filters.endDate ? (
            <FilterChip
              label={`To ${filters.endDate}`}
              onRemove={() => setFilters((prev) => ({ ...prev, endDate: "" }))}
            />
          ) : null}
        </div>
      ) : null}

      {/* Results summary */}
      <ResultsSummary
        filtered={filtered.length}
        total={expenses.length}
        query={filters.query}
      />

      {/* No search results */}
      {filtered.length === 0 && activeFilterCount > 0 ? (
        <EmptyState
          icon="🔍"
          title="No matching expenses"
          description="Try a different search, category, amount range, or date range."
          action={
            <div className="flex items-center gap-3">
              <button
                onClick={clearSearch}
                className="text-[12px] text-[#7a7a7a] hover:text-[#888] underline underline-offset-2 transition-colors"
              >
                Clear search
              </button>
              <button
                onClick={resetFilters}
                className="text-[12px] text-[#7a7a7a] hover:text-[#888] underline underline-offset-2 transition-colors"
              >
                Reset filters
              </button>
            </div>
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
          {filters.query ? ` matching "${filters.query}"` : ""}
        </div>
      )}
    </div>
  );
}
