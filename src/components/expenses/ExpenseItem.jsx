// ─── ExpenseItem ───────────────────────────────────────────────────────────────
//
// A single expense row with:
//   - Inline display of name, amount, category badge, relative time
//   - Tap to expand actions (edit / delete)
//   - Swipe-left on touch devices to reveal delete
//   - Smooth animations

import { useState, useRef, useCallback, useEffect } from "react";
import {
  formatCurrency,
  formatRelativeTime,
  getCategoryEmoji,
  getCategoryLabel,
} from "../../utils/formatters";
import { useExpenseMutations } from "../../hooks/useExpenses";
import { ConfirmDialog, showToast } from "../ui/index";

// ─── Category dot colour map ───────────────────────────────────────────────────

const CATEGORY_COLORS = {
  food: "bg-orange-500",
  transport: "bg-blue-500",
  entertainment: "bg-indigo-500",
  shopping: "bg-pink-500",
  health: "bg-green-500",
  bills: "bg-yellow-500",
  education: "bg-cyan-500",
  personal: "bg-rose-400",
  travel: "bg-teal-500",
  other: "bg-[#444]",
};

function CategoryDot({ category }) {
  const colour = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.other;
  return <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${colour}`} />;
}

// ─── Inline Edit Form ──────────────────────────────────────────────────────────

function InlineEditForm({ expense, currency, onDone, onCancel }) {
  const { updateExpense } = useExpenseMutations();
  const [name, setName] = useState(expense.name);
  const [amount, setAmount] = useState(String(expense.amount));
  const [saving, setSaving] = useState(false);
  const nameRef = useRef(null);

  useEffect(() => {
    nameRef.current?.select();
  }, []);

  const handleSave = useCallback(async () => {
    const trimmedName = name.trim();
    const parsedAmount = parseFloat(amount.replace(/,/g, ""));

    if (!trimmedName) {
      showToast({ message: "Name cannot be empty", type: "warning" });
      return;
    }
    if (!parsedAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
      showToast({ message: "Enter a valid amount", type: "warning" });
      return;
    }

    setSaving(true);
    try {
      await updateExpense(expense.id, {
        name: trimmedName,
        amount: parsedAmount,
      });
      showToast({ message: "Expense updated", type: "success" });
      onDone();
    } catch {
      showToast({ message: "Failed to update expense", type: "error" });
    } finally {
      setSaving(false);
    }
  }, [name, amount, expense.id, updateExpense, onDone]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSave();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    },
    [handleSave, onCancel],
  );

  const currencySymbol =
    currency === "NGN"
      ? "₦"
      : currency === "USD"
        ? "$"
        : currency === "EUR"
          ? "€"
          : currency === "GBP"
            ? "£"
            : currency;

  return (
    <div className="flex items-center gap-2 w-full animate-fade-in">
      {/* Name */}
      <input
        ref={nameRef}
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={handleKeyDown}
        className="
          flex-1 min-w-0
          bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg
          px-2.5 py-1.5 text-[13px] text-white
          placeholder:text-[#333] outline-none
          transition-colors
        "
      />

      {/* Amount */}
      <div className="relative shrink-0 w-28">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-[#444] pointer-events-none">
          {currencySymbol}
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={handleKeyDown}
          className="
            w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg
            pl-6 pr-2.5 py-1.5 text-[13px] text-white tabular-nums
            placeholder:text-[#333] outline-none
            transition-colors
          "
        />
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        aria-label="Save"
        className="
          shrink-0 w-7 h-7 rounded-lg flex items-center justify-center
          bg-emerald-500/10 text-emerald-400 border border-emerald-500/20
          hover:bg-emerald-500/20 transition-colors disabled:opacity-40
        "
      >
        {saving ? (
          <svg
            width="11"
            height="11"
            viewBox="0 0 11 11"
            fill="none"
            className="animate-spin"
          >
            <circle
              cx="5.5"
              cy="5.5"
              r="4"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeOpacity="0.3"
            />
            <path
              d="M9.5 5.5a4 4 0 00-4-4"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path
              d="M1.5 5.5l2.5 2.5 5.5-5.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      {/* Cancel */}
      <button
        onClick={onCancel}
        aria-label="Cancel edit"
        className="
          shrink-0 w-7 h-7 rounded-lg flex items-center justify-center
          text-[#555] hover:text-[#888] hover:bg-[#1a1a1a]
          transition-colors
        "
      >
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path
            d="M1 1l9 9M10 1L1 10"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

/**
 * @param {{
 *   expense: import("../../db/db").Expense,
 *   currency: string,
 *   isHighest?: boolean,
 * }} props
 */
export default function ExpenseItem({
  expense,
  currency = "NGN",
  isHighest = false,
}) {
  const { deleteExpense } = useExpenseMutations();

  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Touch swipe state ──────────────────────────────────────────────────────
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const SWIPE_THRESHOLD = 64; // px before action triggers
  const MAX_SWIPE = 80;

  const handleTouchStart = useCallback((e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (touchStartX.current === null) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;

    // Ignore mostly-vertical scrolls
    if (Math.abs(dy) > Math.abs(dx)) return;

    if (dx < 0) {
      e.preventDefault();
      setSwipeOffset(Math.max(dx, -MAX_SWIPE));
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (swipeOffset < -SWIPE_THRESHOLD) {
      setExpanded(true);
    }
    setSwipeOffset(0);
    touchStartX.current = null;
    touchStartY.current = null;
  }, [swipeOffset]);

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await deleteExpense(expense.id);
      showToast({ message: `Deleted "${expense.name}"`, type: "info" });
    } catch {
      showToast({ message: "Failed to delete expense", type: "error" });
      setDeleting(false);
    }
  }, [expense.id, expense.name, deleteExpense]);

  // ── Toggle expand ───────────────────────────────────────────────────────────
  const handleRowClick = useCallback(() => {
    if (editing) return;
    setExpanded((prev) => !prev);
  }, [editing]);

  // ── Close on outside click ──────────────────────────────────────────────────
  const rowRef = useRef(null);
  useEffect(() => {
    if (!expanded) return;
    const handler = (e) => {
      if (rowRef.current && !rowRef.current.contains(e.target)) {
        setExpanded(false);
        setEditing(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [expanded]);

  const hasCategory = Boolean(expense.category);

  return (
    <>
      <div
        ref={rowRef}
        className={`
          relative overflow-hidden
          transition-opacity duration-300
          ${deleting ? "opacity-0 pointer-events-none" : "opacity-100"}
        `}
      >
        {/* Swipe-reveal delete background */}
        <div
          className="absolute inset-y-0 right-0 flex items-center justify-end pr-4 w-20 pointer-events-none"
          aria-hidden="true"
        >
          <div
            className={`
            flex items-center gap-1.5 text-red-400 text-[11px] font-medium
            transition-opacity duration-150
            ${swipeOffset < -20 ? "opacity-100" : "opacity-0"}
          `}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path
                d="M2 3.5h9M5 3.5V2h3v1.5M5.5 6v3.5M7.5 6v3.5M3 3.5l.5 7h6l.5-7"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Delete
          </div>
        </div>

        {/* Main row */}
        <div
          style={{ transform: `translateX(${swipeOffset}px)` }}
          className="relative bg-transparent transition-transform duration-100 ease-out will-change-transform"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Clickable row content */}
          <div
            role="button"
            tabIndex={0}
            onClick={handleRowClick}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") handleRowClick();
            }}
            className="
              flex items-center gap-3 py-3 px-0
              cursor-pointer select-none
              group
              outline-none
            "
          >
            {/* Category colour dot */}
            <CategoryDot category={expense.category || "other"} />

            {/* Name + meta */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[14px] text-[#e0e0e0] font-medium truncate leading-snug">
                  {expense.name}
                </span>
                {isHighest && (
                  <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wider text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded">
                    Highest
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 mt-0.5">
                {hasCategory && (
                  <>
                    <span className="text-[11px] text-[#444]">
                      {getCategoryEmoji(expense.category)}{" "}
                      {getCategoryLabel(expense.category)}
                    </span>
                    <span className="text-[#2a2a2a] text-[10px]">·</span>
                  </>
                )}
                <span className="text-[11px] text-[#3a3a3a]">
                  {formatRelativeTime(expense.createdAt)}
                </span>
              </div>
            </div>

            {/* Amount */}
            <div className="shrink-0 flex items-center gap-2">
              <span className="text-[15px] font-semibold text-white tabular-nums tracking-tight">
                {formatCurrency(expense.amount, currency)}
              </span>

              {/* Chevron */}
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                className={`
                  text-[#333] transition-transform duration-200
                  ${expanded ? "rotate-180 text-[#555]" : ""}
                `}
              >
                <path
                  d="M3 5l4 4 4-4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>

          {/* Expanded action bar */}
          {expanded && !editing && (
            <div className="flex items-center gap-2 pb-3 animate-fade-in">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditing(true);
                }}
                className="
                  flex items-center gap-1.5 h-7 px-2.5 rounded-lg
                  text-[11px] font-medium text-[#666]
                  bg-[#1a1a1a] border border-[#222]
                  hover:text-white hover:border-[#333]
                  transition-colors
                "
              >
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <path
                    d="M7.5 1.5l2 2L3 10H1V8L7.5 1.5z"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Edit
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDelete(true);
                }}
                className="
                  flex items-center gap-1.5 h-7 px-2.5 rounded-lg
                  text-[11px] font-medium text-red-400
                  bg-red-500/5 border border-red-500/15
                  hover:bg-red-500/15 hover:border-red-500/25
                  transition-colors
                "
              >
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <path
                    d="M1.5 3h8M4 3V2h3v1M4.5 5v3.5M6.5 5v3.5M2.5 3l.5 6h5l.5-6"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Delete
              </button>

              <div className="ml-auto">
                <span className="text-[10px] text-[#2a2a2a] tabular-nums">
                  {new Date(expense.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          )}

          {/* Inline edit form */}
          {editing && (
            <div className="pb-3">
              <InlineEditForm
                expense={expense}
                currency={currency}
                onDone={() => {
                  setEditing(false);
                  setExpanded(false);
                }}
                onCancel={() => {
                  setEditing(false);
                }}
              />
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-px bg-[#111] mx-0" />
      </div>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete this expense?"
        description={`"${expense.name}" (${formatCurrency(expense.amount, currency)}) will be permanently removed.`}
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deleting}
      />
    </>
  );
}
