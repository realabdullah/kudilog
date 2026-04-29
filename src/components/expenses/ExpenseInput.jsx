// ─── ExpenseInput ──────────────────────────────────────────────────────────────
//
// The primary fast-input component. Supports:
//   - "netflix 6500"  →  name: netflix, amount: 6500
//   - Manual fields (name + amount + category) via expanded form
//   - Live preview of parsed input
//   - Keyboard-first: Enter to submit, Escape to clear

import { useCallback, useRef, useState } from "react"
import { useCategories, useExpenseMutations } from "../../hooks/useExpenses"
import { formatCurrency, getCurrencySymbol } from "../../utils/formatters"
import { parseExpenseInput, previewInput } from "../../utils/parseInput"
import { showToast } from "../ui/index"

// ─── Category Pill ─────────────────────────────────────────────────────────────

function CategoryPill({ category, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick(category.id)}
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium
        border transition-all duration-150 whitespace-nowrap
        ${
          selected
            ? "bg-[#6bbf4e]/15 text-[#6bbf4e] border-[#6bbf4e]/30"
            : "bg-transparent text-[#7a7a7a] border-[#1f1f1f] hover:border-[#333] hover:text-[#888]"
        }
      `}
    >
      <span>{category.emoji}</span>
      <span>{category.label}</span>
    </button>
  );
}

// ─── Input Preview ─────────────────────────────────────────────────────────────

function InputPreview({ raw, currency }) {
  const preview = previewInput(raw);

  if (!raw || raw.trim().length < 2) return null;

  if (!preview.valid) {
    return (
      <div className="flex items-center gap-2 px-1 py-1.5 text-[12px] text-[#6a6a6a]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#333] shrink-0" />
        <span>Type a name and amount — e.g. &quot;netflix 6500&quot;</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-1 py-1.5 text-[12px] animate-fade-in">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
      <span className="text-[#888] truncate max-w-35">{preview.name}</span>
      <span className="text-[#5e5e5e] mx-0.5">·</span>
      <span className="text-emerald-400 font-semibold tabular-nums">
        {formatCurrency(preview.amount, currency)}
      </span>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

/**
 * @param {{
 *   currency: string,
 *   currentMonth: string,
 *   onSuccess?: () => void,
 * }} props
 */
export default function ExpenseInput({
  currency = "NGN",
  currentMonth,
  onSuccess,
}) {
  const { addExpense } = useExpenseMutations();
  const categories = useCategories() ?? [];

  // ── State ──────────────────────────────────────────────────────────────────
  const [raw, setRaw] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [shake, setShake] = useState(false);

  // Expanded / manual form state
  const [manualName, setManualName] = useState("");
  const [manualAmount, setManualAmount] = useState("");

  const inputRef = useRef(null);
  const manualNameRef = useRef(null);

  // ── Category toggle ────────────────────────────────────────────────────────
  const toggleCategory = useCallback((id) => {
    setSelectedCategory((prev) => (prev === id ? "" : id));
  }, []);

  // ── Clear form ─────────────────────────────────────────────────────────────
  const clearForm = useCallback(() => {
    setRaw("");
    setManualName("");
    setManualAmount("");
    setSelectedCategory("");
    setExpanded(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  // ── Trigger shake animation ────────────────────────────────────────────────
  const triggerShake = useCallback(() => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  }, []);

  // ── Submit (fast mode) ─────────────────────────────────────────────────────
  const handleFastSubmit = useCallback(async () => {
    const parsed = parseExpenseInput(raw);
    if (!parsed) {
      triggerShake();
      showToast({
        message: "Enter a name and amount — e.g. uber 3400",
        type: "warning",
      });
      return;
    }

    setSubmitting(true);
    try {
      await addExpense({
        name: parsed.name,
        amount: parsed.amount,
        category: selectedCategory || parsed.categoryHint || "",
        month: currentMonth,
      });
      showToast({ message: `Added ${parsed.name}`, type: "success" });
      clearForm();
      onSuccess?.();
    } catch (err) {
      showToast({ message: "Failed to add expense", type: "error" });
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }, [
    raw,
    selectedCategory,
    currentMonth,
    addExpense,
    clearForm,
    triggerShake,
    onSuccess,
  ]);

  // ── Submit (manual mode) ──────────────────────────────────────────────────
  const handleManualSubmit = useCallback(async () => {
    const name = manualName.trim();
    const amount = parseFloat(manualAmount.replace(/,/g, ""));

    if (!name) {
      triggerShake();
      showToast({ message: "Please enter a name", type: "warning" });
      return;
    }
    if (!amount || isNaN(amount) || amount <= 0) {
      triggerShake();
      showToast({ message: "Please enter a valid amount", type: "warning" });
      return;
    }

    setSubmitting(true);
    try {
      await addExpense({
        name,
        amount,
        category: selectedCategory || "",
        month: currentMonth,
      });
      showToast({ message: `Added ${name}`, type: "success" });
      clearForm();
      onSuccess?.();
    } catch (err) {
      showToast({ message: "Failed to add expense", type: "error" });
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }, [
    manualName,
    manualAmount,
    selectedCategory,
    currentMonth,
    addExpense,
    clearForm,
    triggerShake,
    onSuccess,
  ]);

  // ── Keyboard handler (fast input) ─────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleFastSubmit();
      } else if (e.key === "Escape") {
        clearForm();
      }
    },
    [handleFastSubmit, clearForm],
  );

  // ── Switch to expanded and pre-fill from parsed raw ───────────────────────
  const expandForm = useCallback(() => {
    const parsed = parseExpenseInput(raw);
    if (parsed) {
      setManualName(parsed.name);
      setManualAmount(String(parsed.amount));
      if (!selectedCategory && parsed.categoryHint) {
        setSelectedCategory(parsed.categoryHint);
      }
    }
    setExpanded(true);
    setTimeout(() => manualNameRef.current?.focus(), 50);
  }, [raw, selectedCategory]);

  // ── Derived state ──────────────────────────────────────────────────────────
  const fastPreview = previewInput(raw);
  const canSubmitFast = fastPreview.valid;
  const canSubmitManual =
    manualName.trim().length > 0 &&
    parseFloat(manualAmount.replace(/,/g, "")) > 0;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="w-full">
      {!expanded ? (
        // ── Fast Input Mode ────────────────────────────────────────────────
        <div
          className={`
            relative bg-[#111] border rounded-2xl overflow-hidden
            transition-all duration-200
            ${shake ? "animate-shake" : ""}
            ${canSubmitFast ? "border-[#2a2a2a]" : "border-[#1a1a1a]"}
          `}
        >
          {/* Main input row */}
          <div className="flex items-center gap-2 px-4 py-3.5">
            <div className="w-5 h-5 shrink-0 flex items-center justify-center">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path
                  d="M7.5 1v13M1 7.5h13"
                  stroke={canSubmitFast ? "#6bbf4e" : "#333"}
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  className="transition-colors duration-200"
                />
              </svg>
            </div>

            <input
              ref={inputRef}
              data-focus-unstyled="true"
              type="text"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="netflix 6500"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className="
                flex-1 bg-transparent border-0 text-white text-[15px] font-medium
                placeholder:text-[#5e5e5e] placeholder:font-normal
                outline-none caret-[#6bbf4e]
                focus-visible:shadow-none
                min-w-0
              "
            />

            {/* Submit button */}
            <button
              type="button"
              onClick={handleFastSubmit}
              disabled={!canSubmitFast || submitting}
              className={`
                shrink-0 w-8 h-8 rounded-xl flex items-center justify-center
                transition-all duration-200
                ${
                  canSubmitFast && !submitting
                    ? "bg-[#6bbf4e] hover:bg-[#7fd460] text-[#1a3a2a] shadow-lg shadow-[#6bbf4e]/20"
                    : "bg-[#1a1a1a] text-[#5e5e5e]"
                }
              `}
              aria-label="Add expense"
            >
              {submitting ? (
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 13 13"
                  fill="none"
                  className="animate-spin"
                >
                  <circle
                    cx="6.5"
                    cy="6.5"
                    r="5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeOpacity="0.3"
                  />
                  <path
                    d="M11.5 6.5a5 5 0 00-5-5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path
                    d="M6.5 1.5v10M1.5 6.5l5-5 5 5"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          </div>

          {/* Preview + controls row */}
          <div className="flex items-center justify-between px-4 pb-3 -mt-1">
            <InputPreview raw={raw} currency={currency} />

            <button
              type="button"
              onClick={expandForm}
              className="text-[11px] text-[#6a6a6a] hover:text-[#666] transition-colors ml-auto"
            >
              More options
            </button>
          </div>

          {/* Category pills row — shown when input has content */}
          {raw.trim().length > 0 && (
            <div className="px-4 pb-3.5 flex gap-1.5 overflow-x-auto scrollbar-none">
              {categories.map((cat) => (
                <CategoryPill
                  key={cat.id}
                  category={cat}
                  selected={selectedCategory === cat.id}
                  onClick={toggleCategory}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        // ── Expanded / Manual Mode ─────────────────────────────────────────
        <div
          className={`
            bg-[#111] border border-[#1f1f1f] rounded-2xl overflow-hidden
            ${shake ? "animate-shake" : ""}
          `}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[#1a1a1a]">
            <span className="text-[12px] font-medium text-[#7a7a7a] uppercase tracking-widest">
              Add Expense
            </span>
            <button
              type="button"
              onClick={clearForm}
              className="text-[11px] text-[#6a6a6a] hover:text-[#666] transition-colors"
            >
              Cancel
            </button>
          </div>

          <div className="p-4 space-y-3">
            {/* Name field */}
            <div>
              <label className="block text-[11px] text-[#6a6a6a] mb-1.5 uppercase tracking-widest">
                Name
              </label>
              <input
                ref={manualNameRef}
                type="text"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleManualSubmit();
                  if (e.key === "Escape") clearForm();
                }}
                placeholder="e.g. Netflix"
                className="
                  w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-xl
                  px-3.5 py-2.5 text-[14px] text-white
                  placeholder:text-[#5e5e5e]
                  outline-none transition-colors
                "
              />
            </div>

            {/* Amount field */}
            <div>
              <label className="block text-[11px] text-[#6a6a6a] mb-1.5 uppercase tracking-widest">
                Amount
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] text-[#6a6a6a] font-medium pointer-events-none select-none">
                  {getCurrencySymbol(currency)}
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={manualAmount}
                  onChange={(e) => setManualAmount(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleManualSubmit();
                    if (e.key === "Escape") clearForm();
                  }}
                  placeholder="0.00"
                  className="
                    w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-xl
                    pl-8 pr-3.5 py-2.5 text-[14px] text-white tabular-nums
                    placeholder:text-[#5e5e5e]
                    outline-none transition-colors
                  "
                />
              </div>
            </div>

            {/* Category selector */}
            <div>
              <label className="block text-[11px] text-[#6a6a6a] mb-1.5 uppercase tracking-widest">
                Category{" "}
                <span className="normal-case text-[#5e5e5e]">(optional)</span>
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {categories.map((cat) => (
                  <CategoryPill
                    key={cat.id}
                    category={cat}
                    selected={selectedCategory === cat.id}
                    onClick={toggleCategory}
                  />
                ))}
              </div>
            </div>

            {/* Submit */}
            <button
              type="button"
              onClick={handleManualSubmit}
              disabled={!canSubmitManual || submitting}
              className="
                w-full h-11 rounded-xl text-[13px] font-semibold
                bg-white text-black
                hover:bg-[#e8e8e8]
                disabled:opacity-30 disabled:cursor-not-allowed
                transition-colors duration-150
                flex items-center justify-center gap-2
              "
            >
              {submitting ? (
                <>
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 13 13"
                    fill="none"
                    className="animate-spin"
                  >
                    <circle
                      cx="6.5"
                      cy="6.5"
                      r="5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeOpacity="0.3"
                    />
                    <path
                      d="M11.5 6.5a5 5 0 00-5-5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                  Adding…
                </>
              ) : (
                "Add Expense"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
