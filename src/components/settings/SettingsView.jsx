// ─── SettingsView ──────────────────────────────────────────────────────────────
//
// Settings panel with:
//   - Currency selection
//   - Monthly budget limit
//   - Theme toggle (dark / light)
//   - Export / Import data
//   - Danger zone: clear all data

import { useCallback, useRef, useState } from "react"
import { db } from "../../db/db"
import {
  useAllSettings,
  useBudgetMutations,
  useCategories,
  useCategoryBudgetMutations,
  useCategoryMutations,
  useMonthBudget,
  useRecurringTemplateMutations,
  useRecurringTemplates,
  useSettingMutation,
} from "../../hooks/useExpenses"
import {
  exportToCSV,
  importData,
  previewImport
} from "../../utils/exportImport"
import {
  currentMonth,
  formatCurrency,
  getCategoryLabel,
} from "../../utils/formatters"
import {
  Badge,
  ConfirmDialog,
  KudiIcon,
  KudiLogo,
  Modal,
  Select,
  showToast,
  Skeleton
} from "../ui/index"
import { LockSettingsEditor } from "./LockSettingsEditor"

/**
 * @typedef {{
 *   currency?: string,
 *   monthlyBudget?: number | null,
 *   categoryBudgets?: Record<string, number>,
 *   theme?: string,
 *   hideMonetaryValues?: boolean,
 * }} AppSettings
 */

/**
 * @typedef {{
 *   format?: string,
 *   meta: { exportedAt?: string | null, schemaVersion?: number } | null,
 *   expenseCount: number,
 *   settingCount: number,
 *   valid: boolean,
 *   error: string | null,
 *   skippedCount?: number,
 *   sampleRows?: Array<{ name: string, amount: number, category?: string, month?: string, createdAt?: string }>,
 *   warnings?: string[],
 * }} ImportPreview
 */

const typedDb = /** @type {any} */ (db)

/** @param {unknown} error */
function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

// ─── Currency options ──────────────────────────────────────────────────────────

const CURRENCIES = [
  { value: "NGN", label: "Nigerian Naira (₦)", sub: "₦", icon: "🇳🇬" },
  { value: "USD", label: "US Dollar ($)", sub: "$", icon: "🇺🇸" },
  { value: "EUR", label: "Euro (€)", sub: "€", icon: "🇪🇺" },
  { value: "GBP", label: "British Pound (£)", sub: "£", icon: "🇬🇧" },
  { value: "GHS", label: "Ghanaian Cedi (₵)", sub: "₵", icon: "🇬🇭" },
  { value: "KES", label: "Kenyan Shilling (KSh)", sub: "KSh", icon: "🇰🇪" },
  { value: "ZAR", label: "South African Rand (R)", sub: "R", icon: "🇿🇦" },
  { value: "INR", label: "Indian Rupee (₹)", sub: "₹", icon: "🇮🇳" },
  { value: "CAD", label: "Canadian Dollar (C$)", sub: "C$", icon: "🇨🇦" },
  { value: "AUD", label: "Australian Dollar (A$)", sub: "A$", icon: "🇦🇺" },
  { value: "JPY", label: "Japanese Yen (¥)", sub: "¥", icon: "🇯🇵" },
  { value: "CNY", label: "Chinese Yuan (¥)", sub: "¥", icon: "🇨🇳" },
  { value: "CHF", label: "Swiss Franc (Fr)", sub: "Fr", icon: "🇨🇭" },
  { value: "AED", label: "UAE Dirham (د.إ)", sub: "د.إ", icon: "🇦🇪" },
  { value: "SAR", label: "Saudi Riyal (﷼)", sub: "﷼", icon: "🇸🇦" },
  { value: "QAR", label: "Qatari Riyal (﷼)", sub: "﷼", icon: "🇶🇦" },
];

// ─── Section wrapper ───────────────────────────────────────────────────────────

/** @param {{ title: string, children: import("react").ReactNode }} props */
function Section({ title, children }) {
  return (
    <div className="space-y-3">
      <h2 className="text-[11px] font-semibold text-[#6a6a6a] uppercase tracking-widest px-0">
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

// ─── Settings row ──────────────────────────────────────────────────────────────

/** @param {{ label: string, description?: string, children: import("react").ReactNode, danger?: boolean }} props */
function SettingRow({ label, description, children, danger = false }) {
  return (
    <div
      className={`
        flex items-center justify-between gap-4
        px-4 py-3.5 rounded-xl border
        ${
          danger
            ? "bg-red-500/5 border-red-500/10"
            : "bg-[#0d0d0d] border-[#1a1a1a]"
        }
      `}
    >
      <div className="flex-1 min-w-0">
        <div
          className={`text-[13px] font-medium leading-snug ${danger ? "text-red-400" : "text-[#ddd]"}`}
        >
          {label}
        </div>
        {description && (
          <div className="text-[11px] text-[#666] mt-0.5 leading-relaxed">
            {description}
          </div>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

// ─── Toggle switch ─────────────────────────────────────────────────────────────

/** @param {{ checked: boolean, onChange: (value: boolean) => void, disabled?: boolean }} props */
function Toggle({ checked, onChange, disabled = false }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={`
        relative w-9 h-5 rounded-full transition-colors duration-200
        focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6bbf4e]
        disabled:opacity-40 disabled:cursor-not-allowed
        ${checked ? "bg-[#6bbf4e]" : "bg-[#2a2a2a]"}
      `}
    >
      <span
        className={`
          absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm
          transition-transform duration-200
          ${checked ? "translate-x-4" : "translate-x-0"}
        `}
      />
    </button>
  );
}

// ─── Nav row (drill-down to sub-screen) ───────────────────────────────────────

/** @param {{ label: string, description?: string, badge?: string | number | null, onClick: () => void }} props */
function SettingNavRow({ label, description, badge, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between gap-4 px-4 py-3.5 rounded-xl border bg-[#0d0d0d] border-[#1a1a1a] hover:border-[#222] transition-colors text-left"
    >
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-[#ddd] leading-snug">{label}</div>
        {description && (
          <div className="text-[11px] text-[#666] mt-0.5 leading-relaxed">{description}</div>
        )}
      </div>
      <div className="shrink-0 flex items-center gap-2">
        {badge != null && (
          <span className="text-[11px] tabular-nums text-[#7a7a7a]">{badge}</span>
        )}
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M5 3l4 4-4 4" stroke="#3a3a3a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </button>
  );
}

// ─── Sub-screen header ─────────────────────────────────────────────────────────

/** @param {{ title: string, onBack: () => void }} props */
function SubScreenHeader({ title, onBack }) {
  return (
    <div className="flex items-center gap-3 mb-2">
      <button
        onClick={onBack}
        className="w-8 h-8 rounded-xl bg-[#0d0d0d] border border-[#1a1a1a] flex items-center justify-center text-[#888] hover:text-white hover:border-[#222] transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <h2 className="text-[15px] font-semibold text-white">{title}</h2>
    </div>
  );
}

function PrivacyContentPage() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#1a1a1a] bg-[#0d0d0d] p-4 space-y-3">
        <div className="text-[14px] font-semibold text-white">Your financial data stays with you</div>
        <p className="text-[12px] leading-relaxed text-[#9a9a9a]">
          KudiLog is designed as a local-first personal finance app. Your expenses,
          budgets, recurring entries, and settings are stored on your device for your
          use alone.
        </p>
        <p className="text-[12px] leading-relaxed text-[#9a9a9a]">
          KudiLog does not send your personal financial data to external servers, does
          not sell it, and does not use it for advertising, profiling, or third-party
          analytics.
        </p>
      </div>

      <div className="rounded-xl border border-[#1a1a1a] bg-[#0d0d0d] p-4 space-y-3">
        <div className="text-[11px] uppercase tracking-widest text-[#7a7a7a]">Privacy Commitment</div>
        <div className="space-y-2.5 text-[12px] leading-relaxed text-[#9a9a9a]">
          <p>
            Your information belongs to you. KudiLog treats your spending records as
            private personal data and is built to keep that information under your
            control.
          </p>
          <p>
            By default, entries are kept locally in your browser storage on this device.
            Unless you choose to export or share your data yourself, it remains on your
            device.
          </p>
          <p>
            This means you can track your finances with confidence, knowing that the app
            is intended to support your decisions without transferring your records away
            from you.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-[#1a1a1a] bg-[#0d0d0d] p-4 space-y-3">
        <div className="text-[11px] uppercase tracking-widest text-[#7a7a7a]">What this means in practice</div>
        <div className="space-y-2.5 text-[12px] text-[#9a9a9a] leading-relaxed">
          <p>
            Your expense records remain on your device unless you choose to export
            them yourself.
          </p>
          <p>
            Your budgets, recurring entries, and personal settings are kept locally
            as part of your private app data.
          </p>
          <p>
            Any sharing of information happens only when you deliberately choose to
            export or copy data for your own use.
          </p>
          <p>
            Your personal finance history is not used for advertising, resale, or
            third-party profiling.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-[#1a1a1a] bg-[#0d0d0d] p-4 space-y-2">
        <div className="text-[12px] font-medium text-white">Professional assurance</div>
        <p className="text-[12px] leading-relaxed text-[#9a9a9a]">
          KudiLog is built with privacy as a product principle, not an afterthought.
          The app is intended to help you understand your money while keeping your data
          private, local, and within your control.
        </p>
      </div>
    </div>
  );
}

// ─── Import preview modal ──────────────────────────────────────────────────────

/** @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   preview: ImportPreview | null,
 *   onConfirmMerge: () => void,
 *   onConfirmReplace: () => void,
 *   loading: false | "merge" | "replace",
 *   hideMonetaryValues: boolean,
 *   currency: string,
 * }} props */
function ImportPreviewModal({
  open,
  onClose,
  preview,
  onConfirmMerge,
  onConfirmReplace,
  loading,
  hideMonetaryValues,
  currency,
}) {
  if (!preview) return null;

  return (
    <Modal open={open} onClose={onClose} title="Import Data" size="sm">
      {preview.valid ? (
        <div className="space-y-4">
          {/* File summary */}
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[12px] text-[#7a7a7a]">Format</span>
              <Badge variant="muted" size="xs">
                {(preview.format || "unknown").toUpperCase()}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[12px] text-[#7a7a7a]">Expenses</span>
              <span className="text-[13px] font-semibold text-white tabular-nums">
                {preview.expenseCount}
              </span>
            </div>
            {(preview.skippedCount ?? 0) > 0 ? (
              <div className="flex justify-between items-center">
                <span className="text-[12px] text-[#7a7a7a]">Skipped rows</span>
                <span className="text-[12px] text-amber-400 tabular-nums">
                  {preview.skippedCount}
                </span>
              </div>
            ) : null}
            <div className="flex justify-between items-center">
              <span className="text-[12px] text-[#7a7a7a]">Exported at</span>
              <span className="text-[12px] text-[#888] tabular-nums">
                {preview.meta?.exportedAt
                  ? new Date(preview.meta.exportedAt).toLocaleDateString(
                      "en-US",
                      {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      },
                    )
                  : "—"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[12px] text-[#7a7a7a]">Schema version</span>
              <Badge variant="muted" size="xs">
                {preview.meta?.schemaVersion ? `v${preview.meta.schemaVersion}` : "—"}
              </Badge>
            </div>
          </div>

          {preview.warnings?.length ? (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2">
              {preview.warnings.map((warning) => (
                <p key={warning} className="text-[12px] text-amber-300 leading-relaxed">
                  {warning}
                </p>
              ))}
            </div>
          ) : null}

          {preview.sampleRows?.length ? (
            <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-3 space-y-2">
              <p className="text-[11px] uppercase tracking-wider text-[#7a7a7a]">
                Preview rows
              </p>
              <div className="space-y-1">
                {preview.sampleRows.map((row, idx) => (
                  <div
                    key={`${row.name}-${idx}`}
                    className="grid grid-cols-[1fr_auto] gap-3 text-[12px]"
                  >
                    <span className="text-[#bcbcbc] truncate">{row.name}</span>
                    <span className="text-[#888] tabular-nums">
                      {hideMonetaryValues
                        ? formatCurrency(row.amount, currency, true)
                        : row.amount}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <p className="text-[12px] text-[#7a7a7a] leading-relaxed">
            Choose how to import this data:
          </p>

          <div className="space-y-2">
            <button
              onClick={onConfirmMerge}
              disabled={Boolean(loading)}
              className="
                w-full h-10 rounded-xl text-[13px] font-medium
                bg-[#1a1a1a] border border-[#222] text-[#ccc]
                hover:border-[#333] hover:text-white
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-colors flex items-center justify-center gap-2
              "
            >
              {loading === "merge" ? (
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
              ) : null}
              Merge with existing data
            </button>

            <button
              onClick={onConfirmReplace}
              disabled={Boolean(loading)}
              className="
                w-full h-10 rounded-xl text-[13px] font-medium
                bg-red-500/10 border border-red-500/20 text-red-400
                hover:bg-red-500/20 hover:border-red-500/30
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-colors flex items-center justify-center gap-2
              "
            >
              {loading === "replace" ? (
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
              ) : null}
              Replace all data
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center py-4">
          <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-3">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 5v4M8 11v1"
                stroke="#f87171"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
              <path
                d="M6.5 2h3L14 14H2L6.5 2z"
                stroke="#f87171"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <p className="text-[14px] font-semibold text-white mb-2">
            Invalid file
          </p>
          <p className="text-[12px] text-[#7a7a7a] leading-relaxed">
            {preview.error}
          </p>
          <button
            onClick={onClose}
            className="mt-5 h-9 px-5 rounded-xl text-[13px] font-medium bg-[#1a1a1a] border border-[#222] text-[#888] hover:text-white hover:border-[#333] transition-colors"
          >
            OK
          </button>
        </div>
      )}
    </Modal>
  );
}

// ─── Budget input ──────────────────────────────────────────────────────────────

/** @param {{ currentBudget?: number | null, currency: string, onSave: (value: number | null) => Promise<void> }} props */
function BudgetInput({ currentBudget, currency, onSave, label = "Set limit" }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");

  const currencySymbol =
    CURRENCIES.find((c) => c.value === currency)?.sub ?? currency;

  const handleOpen = useCallback(() => {
    setValue(currentBudget ? String(currentBudget) : "");
    setEditing(true);
  }, [currentBudget]);

  const handleSave = useCallback(async () => {
    const parsed = parseFloat(value.replace(/,/g, ""));
    if (value === "" || value === "0") {
      await onSave(null);
      showToast({ message: "Budget limit removed", type: "info" });
    } else if (!isNaN(parsed) && parsed > 0) {
      await onSave(parsed);
      showToast({ message: "Budget updated", type: "success" });
    } else {
      showToast({ message: "Enter a valid amount", type: "warning" });
      return;
    }
    setEditing(false);
  }, [value, onSave]);

  const handleKeyDown = useCallback(
    /** @param {import("react").KeyboardEvent<HTMLInputElement>} e */
    (e) => {
      if (e.key === "Enter") handleSave();
      if (e.key === "Escape") setEditing(false);
    },
    [handleSave],
  );

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-[#6a6a6a] pointer-events-none">
            {currencySymbol}
          </span>
          <input
            autoFocus
            type="text"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="0"
            className="
              w-28 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg
              pl-6 pr-2.5 py-1.5 text-[13px] text-white tabular-nums
              outline-none
            "
          />
        </div>
        <button
          onClick={handleSave}
          className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center hover:bg-emerald-500/20 transition-colors"
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path
              d="M1.5 5.5l2.5 2.5 5.5-5.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          onClick={() => setEditing(false)}
          className="w-7 h-7 rounded-lg text-[#7a7a7a] hover:text-[#888] hover:bg-[#1a1a1a] flex items-center justify-center transition-colors"
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

  return (
    <button
      onClick={handleOpen}
      className="
        flex items-center gap-1.5 h-8 px-3 rounded-lg
        text-[12px] font-medium
        bg-[#1a1a1a] border border-[#222] text-[#888]
        hover:text-white hover:border-[#333]
        transition-colors
      "
    >
      {currentBudget ? formatCurrency(currentBudget, currency) : label}
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="none"
        className="opacity-50"
      >
        <path
          d="M6.5 1.5l2 2L2 9H0V7L6.5 1.5z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function CategoriesManager() {
  const categories = useCategories() ?? [];
  const { addCategory, deleteCategory } = useCategoryMutations();
  const [newLabel, setNewLabel] = useState("");
  const [newEmoji, setNewEmoji] = useState("📦");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const emojis = [
    "🍽️", "🚗", "🎬", "🛍️", "💊", "💡", "📚", "✨", "✈️", "📦", "🏠", "🎁", "💻", "🎨", "🏋️", "🐾",
    "☕", "🍺", "🥂", "🍕", "🍔", "🍎", "🥦", "🍦", "🎂", "🎸", "🎮", "🕹️", "⚽", "🏀", "🚲", "🛴",
    "📱", "🎧", "📸", "⌚", "🛠️", "🩹", "🧼", "👕", "👗", "👟", "👜", "💄", "💍", "👓", "🧢", "⛱️",
    "💰", "💳", "📈", "📉", "📄", "📧", "📫", "📞", "🔔", "⭐", "🔥", "🌈", "❤️", "📍", "🛡️", "🔑"
  ];

  const handleAdd = async () => {
    if (!newLabel.trim()) {
      showToast({ message: "Enter a category name", type: "warning" });
      return;
    }
    try {
      await addCategory({ label: newLabel, emoji: newEmoji });
      setNewLabel("");
      setNewEmoji("📦");
      showToast({ message: "Category added", type: "success" });
    } catch (err) {
      showToast({ message: "Failed to add category: " + getErrorMessage(err), type: "error" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-4 space-y-3">
        <div className="text-[13px] font-medium text-white">Add New Category</div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="w-11 h-11 shrink-0 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl flex items-center justify-center text-[20px] hover:border-[#3a3a3a] transition-colors"
          >
            {newEmoji}
          </button>
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Category name (e.g. Subscriptions)"
            className="flex-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-3 text-[13px] text-white outline-none focus:border-[#6bbf4e]/50"
          />
          <button
            onClick={handleAdd}
            className="h-11 px-4 rounded-xl bg-[#6bbf4e] text-[#17311a] text-[13px] font-semibold hover:bg-[#7cd65e] transition-colors"
          >
            Add
          </button>
        </div>
        {showEmojiPicker && (
          <div className="grid grid-cols-8 gap-1.5 p-2 bg-[#0a0a0a] rounded-lg border border-[#1a1a1a]">
            {emojis.map((e) => (
              <button
                key={e}
                onClick={() => {
                  setNewEmoji(e);
                  setShowEmojiPicker(false);
                }}
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-[18px] hover:bg-[#1a1a1a] transition-colors ${newEmoji === e ? "bg-[#6bbf4e]/20 ring-1 ring-[#6bbf4e]/30" : ""}`}
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl overflow-hidden divide-y divide-[#131313]">
        {categories.map((cat) => (
          <div key={cat.id} className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-[18px]">{cat.emoji}</span>
              <span className="text-[13px] font-medium text-[#ddd]">{cat.label}</span>
            </div>
            <button
              onClick={() => deleteCategory(cat.id)}
              className="p-2 rounded-lg text-red-500/60 hover:text-red-400 hover:bg-red-500/10 transition-all"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2.5 3.5h9M5.5 3.5V2.5a1 1 0 011-1h1a1 1 0 011 1v1M3.5 3.5l.5 8h6l.5-8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoryBudgetsEditor({
  currency,
  budgets,
  onSetBudget,
  onClearBudget,
}) {
  /** @type {[Record<string, string>, import("react").Dispatch<import("react").SetStateAction<Record<string, string>>>]} */
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState("");
  const categories = useCategories() ?? [];

  const currencySymbol =
    CURRENCIES.find((c) => c.value === currency)?.sub ?? currency;

  const handleSave = useCallback(
    /** @param {import("../../hooks/useExpenses").Category} cat */
    async (cat) => {
      const draftValue = String(drafts[cat.id] ?? "").trim();
      const parsed = Number(draftValue.replace(/,/g, ""));

      if (!draftValue) {
        await onClearBudget(cat.id);
        showToast({ message: `${cat.label} budget removed`, type: "info" });
        return;
      }

      if (!Number.isFinite(parsed) || parsed <= 0) {
        showToast({ message: "Enter a valid budget amount", type: "warning" });
        return;
      }

      setSaving(cat.id);
      try {
        await onSetBudget(cat.id, parsed);
        setDrafts((prev) => {
          const next = { ...prev };
          delete next[cat.id];
          return next;
        });
        showToast({ message: `${cat.label} budget updated`, type: "success" });
      } catch (err) {
        showToast({ message: "Could not save category budget: " + getErrorMessage(err), type: "error" });
      } finally {
        setSaving("");
      }
    },
    [drafts, onSetBudget, onClearBudget],
  );

  const handleClear = useCallback(
    /** @param {import("../../hooks/useExpenses").Category} cat */
    async (cat) => {
      setSaving(cat.id);
      try {
        await onClearBudget(cat.id);
        setDrafts((prev) => {
          const next = { ...prev };
          delete next[cat.id];
          return next;
        });
        showToast({ message: `${cat.label} budget removed`, type: "info" });
      } catch (err) {
        showToast({ message: "Could not remove budget: " + getErrorMessage(err), type: "error" });
      } finally {
        setSaving("");
      }
    },
    [onClearBudget],
  );

  return (
    <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[#131313]">
        <div className="text-[13px] font-medium text-[#ddd]">Category Budgets</div>
        <div className="text-[11px] text-[#666] mt-0.5">
          Set monthly limits per category for better control
        </div>
      </div>

      <div className="divide-y divide-[#131313]">
        {categories.map((cat) => {
          const currentValue = budgets?.[cat.id];
          const displayValue = drafts[cat.id] ?? (currentValue ? String(currentValue) : "");
          const isSaving = saving === cat.id;

          return (
            <div key={cat.id} className="px-4 py-2.5 flex items-center gap-2.5">
              <span className="text-[14px]" aria-hidden>
                {cat.emoji}
              </span>
              <span className="text-[12px] text-[#aaa] w-28 shrink-0 truncate">
                {cat.label}
              </span>

              <div className="relative flex-1 min-w-0">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-[#6a6a6a] pointer-events-none">
                  {currencySymbol}
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={displayValue}
                  onChange={(e) =>
                    setDrafts((prev) => ({
                      ...prev,
                      [cat.id]: e.target.value,
                    }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSave(cat);
                    }
                  }}
                  placeholder={currentValue ? String(currentValue) : "No limit"}
                  className="
                    w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg
                    pl-6 pr-2.5 py-1.5 text-[12px] text-white tabular-nums
                    outline-none
                  "
                />
              </div>

              <button
                onClick={() => handleSave(cat)}
                disabled={isSaving}
                className="h-7 px-2 rounded-lg text-[11px] font-medium bg-[#1a1a1a] border border-[#222] text-[#888] hover:text-white hover:border-[#333] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Save
              </button>

              <button
                onClick={() => handleClear(cat)}
                disabled={isSaving || !currentValue}
                className="h-7 px-2 rounded-lg text-[11px] font-medium bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Clear
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** @param {{
 *   currency: string,
 *   templates: Array<{ id: string, name: string, amount: number, category: string, startMonth: string, enabled: boolean }>,
 *   onCreate: (input: { name: string, amount: number, category?: string, startMonth?: string }) => Promise<string>,
 *   onToggle: (id: string, enabled: boolean) => Promise<number>,
 *   onDelete: (id: string) => Promise<void>,
 * }} props */
function RecurringTemplatesEditor({
  currency,
  templates,
  onCreate,
  onToggle,
  onDelete,
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [startMonth, setStartMonth] = useState(currentMonth());
  const [busyId, setBusyId] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = useCallback(async () => {
    const trimmedName = name.trim();
    const parsedAmount = Number(amount.replace(/,/g, ""));

    if (!trimmedName) {
      showToast({ message: "Enter a recurring expense name", type: "warning" });
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      showToast({ message: "Enter a valid recurring amount", type: "warning" });
      return;
    }

    setCreating(true);
    try {
      await onCreate({
        name: trimmedName,
        amount: parsedAmount,
        category,
        startMonth,
      });
      setName("");
      setAmount("");
      setCategory("");
      setStartMonth(currentMonth());
      showToast({ message: "Recurring template created", type: "success" });
    } catch (err) {
      showToast({ message: "Could not create recurring template: " + getErrorMessage(err), type: "error" });
    } finally {
      setCreating(false);
    }
  }, [amount, category, name, onCreate, startMonth]);

  const handleToggle = useCallback(
    /** @param {string} id @param {boolean} enabled */
    async (id, enabled) => {
      setBusyId(id);
      try {
        await onToggle(id, enabled);
      } catch (err) {
        showToast({ message: "Could not update recurring template: " + getErrorMessage(err), type: "error" });
      } finally {
        setBusyId("");
      }
    },
    [onToggle],
  );

  const handleDelete = useCallback(
    /** @param {string} id */
    async (id) => {
      setBusyId(id);
      try {
        await onDelete(id);
        showToast({ message: "Recurring template deleted", type: "info" });
      } catch (err) {
        showToast({ message: "Could not delete recurring template: " + getErrorMessage(err), type: "error" });
      } finally {
        setBusyId("");
      }
    },
    [onDelete],
  );

  return (
    <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[#131313]">
        <div className="text-[13px] font-medium text-[#ddd]">Recurring Expenses</div>
        <div className="text-[11px] text-[#666] mt-0.5">
          Auto-add monthly expenses like rent, subscriptions, and bills
        </div>
      </div>

      <div className="p-4 space-y-3 border-b border-[#131313]">
        <div className="grid grid-cols-1 gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-[12px] text-white outline-none"
          />
          <div className="grid grid-cols-[1fr_1fr] gap-2">
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Amount (${currency})`}
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-[12px] text-white outline-none"
            />
            <input
              type="month"
              value={startMonth}
              onChange={(e) => setStartMonth(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-[12px] text-white outline-none"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setCategory("")}
              className={`px-2.5 py-1 rounded-lg text-[11px] border whitespace-nowrap ${category === "" ? "bg-[#6bbf4e]/15 text-[#6bbf4e] border-[#6bbf4e]/30" : "text-[#7a7a7a] border-[#1f1f1f]"}`}
            >
              No category
            </button>
            {(useCategories() ?? []).map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] border whitespace-nowrap ${category === cat.id ? "bg-[#6bbf4e]/15 text-[#6bbf4e] border-[#6bbf4e]/30" : "text-[#7a7a7a] border-[#1f1f1f]"}`}
              >
                {cat.emoji} {cat.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className="h-9 px-3 rounded-lg text-[12px] font-medium bg-[#6bbf4e] text-[#17311a] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {creating ? "Creating…" : "Add recurring template"}
          </button>
        </div>
      </div>

      <div className="divide-y divide-[#131313]">
        {templates.length === 0 ? (
          <div className="px-4 py-4 text-[12px] text-[#6a6a6a]">
            No recurring templates yet.
          </div>
        ) : (
          templates.map((template) => (
            <div key={template.id} className="px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] text-[#ddd] font-medium truncate">{template.name}</span>
                  <span className="text-[10px] uppercase tracking-wide text-[#6bbf4e] bg-[#6bbf4e]/10 border border-[#6bbf4e]/20 px-1.5 py-0.5 rounded">
                    Monthly
                  </span>
                </div>
                <div className="text-[11px] text-[#6a6a6a] mt-0.5">
                  {formatCurrency(template.amount, currency)}
                  {template.category ? ` · ${getCategoryLabel(template.category)}` : ""}
                  {` · from ${template.startMonth}`}
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleToggle(template.id, !template.enabled)}
                disabled={busyId === template.id}
                className={`h-7 px-2 rounded-lg text-[11px] font-medium border ${template.enabled ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-[#1a1a1a] border-[#222] text-[#888]"}`}
              >
                {template.enabled ? "On" : "Off"}
              </button>

              <button
                type="button"
                onClick={() => handleDelete(template.id)}
                disabled={busyId === template.id}
                className="h-7 px-2 rounded-lg text-[11px] font-medium bg-red-500/10 border border-red-500/20 text-red-400"
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function SettingsView() {
  /** @type {AppSettings | undefined} */
  const settings = useAllSettings();
  const setSetting = useSettingMutation();
  const { setCategoryBudget, clearCategoryBudget } = useCategoryBudgetMutations();
  const recurringTemplates = useRecurringTemplates() ?? [];
  const {
    createRecurringTemplate,
    toggleRecurringTemplate,
    deleteRecurringTemplate,
  } = useRecurringTemplateMutations();

  const [activeMonth, setActiveMonth] = useState(currentMonth());
  const monthBudget = useMonthBudget(activeMonth);
  const { setMonthBudget } = useBudgetMutations();
  const categories = useCategories() ?? [];

  // ── Export state ──────────────────────────────────────────────────────────
  const [exportingCSV, setExportingCSV] = useState(false);
  // const [exportingJSON, setExportingJSON] = useState(false);

  // ── Import state ──────────────────────────────────────────────────────────
  const [importPreview, setImportPreview] = useState(/** @type {ImportPreview | null} */ (null));
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(/** @type {false | "merge" | "replace"} */ (false)); // "merge"|"replace"|false
  const [pendingFile, setPendingFile] = useState(/** @type {File | null} */ (null));
  const fileInputRef = useRef(/** @type {HTMLInputElement | null} */ (null));

  // ── Danger zone state ─────────────────────────────────────────────────────
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [confirmClearRecurring, setConfirmClearRecurring] = useState(false);
  const [clearingRecurring, setClearingRecurring] = useState(false);

  // ── Sub-screen navigation ──────────────────────────────────────────────────
  /** @type {[null | "category-budgets" | "recurring" | "privacy" | "categories", import("react").Dispatch<import("react").SetStateAction<null | "category-budgets" | "recurring" | "privacy" | "categories">>]} */
  const [subscreen, setSubscreen] = useState(/** @type {null | "category-budgets" | "recurring" | "privacy" | "categories"} */ (null));

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleExportCSV = useCallback(async () => {
    setExportingCSV(true);
    try {
      const { count } = await exportToCSV();
      showToast({
        message: `Exported ${count} expense${count !== 1 ? "s" : ""} for Excel`,
        type: "success",
      });
    } catch (err) {
      showToast({ message: "Export failed: " + getErrorMessage(err), type: "error" });
    } finally {
      setExportingCSV(false);
    }
  }, []);

  // const handleExportJSON = useCallback(async () => {
  //   setExportingJSON(true);
  //   try {
  //     const { count } = await exportToJSON();
  //     showToast({
  //       message: `Exported ${count} expense${count !== 1 ? "s" : ""} backup`,
  //       type: "success",
  //     });
  //   } catch (err) {
  //     showToast({ message: "Export failed: " + err.message, type: "error" });
  //   } finally {
  //     setExportingJSON(false);
  //   }
  // }, []);

  const handleFileSelect = useCallback(async (/** @type {import("react").ChangeEvent<HTMLInputElement>} */ e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so the same file can be re-selected
    e.target.value = "";

    setPendingFile(file);
    const preview = await previewImport(file);
    setImportPreview(preview);
    setImportModalOpen(true);
  }, []);

  const handleImport = useCallback(
    /** @param {"merge" | "replace"} mode */
    async (mode) => {
      if (!pendingFile) return;

      setImportLoading(mode);
      try {
        const result = await importData(pendingFile, mode);
        const skippedMessage =
          result.skipped > 0
            ? `, ${result.skipped} row${result.skipped !== 1 ? "s" : ""} skipped`
            : "";
        showToast({
          message:
            `Imported ${result.imported} expense${result.imported !== 1 ? "s" : ""} (${mode})` +
            skippedMessage,
          type: "success",
        });
        if (result.skipped > 0) {
          showToast({ message: "Some rows were skipped", type: "warning" });
        }
        setImportModalOpen(false);
        setPendingFile(null);
        setImportPreview(null);
      } catch (err) {
        showToast({ message: "Import failed: " + getErrorMessage(err), type: "error" });
      } finally {
        setImportLoading(false);
      }
    },
    [pendingFile],
  );

  const handleClearRecurringExpenses = useCallback(async () => {
    setClearingRecurring(true);
    try {
      await typedDb.transaction("rw", typedDb.expenses, typedDb.recurring, async () => {
        const all = await typedDb.expenses.toArray();
        const recurringIds = all
          .filter((/** @type {any} */ e) => typeof e.recurringId === "string" && e.recurringId)
          .map((/** @type {any} */ e) => e.id);
        if (recurringIds.length > 0) {
          await typedDb.expenses.bulkDelete(recurringIds);
        }
        await typedDb.recurring.clear();
      });
      showToast({ message: "Recurring templates and generated expenses cleared", type: "info" });
      setConfirmClearRecurring(false);
    } catch (err) {
      showToast({ message: "Failed to clear recurring data: " + getErrorMessage(err), type: "error" });
    } finally {
      setClearingRecurring(false);
    }
  }, []);

  const handleClearAll = useCallback(async () => {
    setClearing(true);
    try {
      await typedDb.transaction("rw", typedDb.expenses, async () => {
        await typedDb.expenses.clear();
      });
      showToast({ message: "All expenses deleted", type: "info" });
      setConfirmClear(false);
    } catch (err) {
      showToast({
        message: "Failed to clear data: " + getErrorMessage(err),
        type: "error",
      });
    } finally {
      setClearing(false);
    }
  }, []);

  const handleCurrencyChange = useCallback(
    /** @param {string} code */
    async (code) => {
      await setSetting("currency", code);
      showToast({ message: `Currency set to ${code}`, type: "success" });
    },
    [setSetting],
  );

  const handleBudgetSave = useCallback(
    /** @param {number | null} value */
    async (value) => {
      await setSetting("monthlyBudget", value);
    },
    [setSetting],
  );

  const handleThemeToggle = useCallback(
    /** @param {boolean} isDark */
    async (isDark) => {
      const theme = isDark ? "dark" : "light";
      await setSetting("theme", theme);
      // Apply to document root
      document.documentElement.classList.toggle("light", !isDark);
      showToast({
        message: `${isDark ? "Dark" : "Light"} mode enabled`,
        type: "info",
      });
    },
    [setSetting],
  );

  const handleHideMonetaryValuesToggle = useCallback(
    /** @param {boolean} hideValues */
    async (hideValues) => {
      await setSetting("hideMonetaryValues", hideValues);
      showToast({
        message: hideValues ? "Monetary values hidden" : "Monetary values shown",
        type: "info",
      });
    },
    [setSetting],
  );

  // ── Loading state ──────────────────────────────────────────────────────────
  if (!settings) {
    return (
      <div className="space-y-6 pb-8">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-3 w-16 rounded" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  const isDark = settings.theme !== "light";
  const hideMonetaryValues = settings.hideMonetaryValues === true;

  // ── Sub-screen renders (early return) ─────────────────────────────────────
  if (subscreen === "category-budgets") {
    return (
      <div className="space-y-5 pb-10">
        <SubScreenHeader title="Category Budgets" onBack={() => setSubscreen(null)} />
        <CategoryBudgetsEditor
          currency={settings.currency ?? "NGN"}
          budgets={settings.categoryBudgets ?? {}}
          onSetBudget={setCategoryBudget}
          onClearBudget={clearCategoryBudget}
        />
      </div>
    );
  }

  if (subscreen === "recurring") {
    return (
      <div className="space-y-5 pb-10">
        <SubScreenHeader title="Recurring Expenses" onBack={() => setSubscreen(null)} />
        <RecurringTemplatesEditor
          currency={settings.currency ?? "NGN"}
          templates={recurringTemplates}
          onCreate={createRecurringTemplate}
          onToggle={toggleRecurringTemplate}
          onDelete={deleteRecurringTemplate}
        />
      </div>
    );
  }

  if (subscreen === "privacy") {
    return (
      <div className="space-y-5 pb-10">
        <SubScreenHeader title="Privacy" onBack={() => setSubscreen(null)} />
        <PrivacyContentPage />
      </div>
    );
  }

  if (subscreen === "categories") {
    return (
      <div className="space-y-5 pb-10">
        <SubScreenHeader title="Categories" onBack={() => setSubscreen(null)} />
        <CategoriesManager />
      </div>
    );
  }

  if (subscreen === "app-lock") {
    return (
      <div className="space-y-5 pb-10">
        <SubScreenHeader title="App Lock" onBack={() => setSubscreen(null)} />
        <LockSettingsEditor />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-7 pb-10">
        {/* ── Preferences ─────────────────────────────────────────────────── */}
        <Section title="Preferences">
          {/* Currency Card */}
          <div className="space-y-2 px-1">
            <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl shadow-sm">
              {/* Primary Grid */}
              <div className="grid grid-cols-2">
                <div className="px-4 py-3 border-b border-[#131313] col-span-2 rounded-t-2xl">
                  <div className="text-[13px] font-medium text-[#ddd]">
                    Currency
                  </div>
                  <div className="text-[11px] text-[#666] mt-0.5">
                    Used for all amount displays
                  </div>
                </div>

                {CURRENCIES.slice(0, 4).map((c, idx) => {
                  const selected = settings.currency === c.value;
                  const isTop = idx < 2;
                  const isLeft = idx % 2 === 0;
                  
                  return (
                    <button
                      key={c.value}
                      onClick={() => handleCurrencyChange(c.value)}
                      className={`
                        flex items-center gap-3 p-4 transition-all duration-200 text-left
                        ${isTop ? "border-b border-[#1a1a1a]" : ""}
                        ${isLeft ? "border-r border-[#1a1a1a]" : ""}
                        ${selected ? "bg-[#6bbf4e]/5" : "hover:bg-white/[0.02]"}
                      `}
                    >
                      <span className="text-[20px]">{c.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className={`text-[13px] font-bold leading-tight ${selected ? "text-[#6bbf4e]" : "text-[#bcbcbc]"}`}>
                          {c.value}
                        </div>
                        <div className="text-[11px] text-[#555]">{c.sub}</div>
                      </div>
                      {selected && (
                        <div className="w-1.5 h-1.5 rounded-full bg-[#6bbf4e]" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Others Dropdown — integrated into the card */}
              <div className="border-t border-[#1a1a1a] p-3 bg-[#0d0d0d] rounded-b-2xl">
                <Select
                  placeholder="More options…"
                  value={CURRENCIES.slice(0, 4).some(c => c.value === settings.currency) ? "" : settings.currency}
                  onChange={handleCurrencyChange}
                  options={CURRENCIES}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Monthly budget */}
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl overflow-hidden p-4 space-y-4">
            <div>
              <div className="text-[13px] font-medium text-[#ddd]">Budget Management</div>
              <div className="text-[11px] text-[#666] mt-0.5 leading-relaxed">
                Set global defaults or specific overrides for individual months
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl">
                <div>
                  <div className="text-[12px] font-medium text-[#aaa]">Global Default</div>
                  <div className="text-[10px] text-[#666]">Fallback for all months</div>
                </div>
                <BudgetInput
                  currentBudget={settings.monthlyBudget}
                  currency={settings.currency ?? "NGN"}
                  onSave={handleBudgetSave}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl">
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="month"
                      value={activeMonth}
                      onChange={(e) => setActiveMonth(e.target.value)}
                      className="bg-transparent text-[12px] font-medium text-[#aaa] border-none outline-none p-0 w-24"
                    />
                    <Badge variant="accent" size="xs">Override</Badge>
                  </div>
                  <div className="text-[10px] text-[#666]">Budget for this specific month</div>
                </div>
                <BudgetInput
                  label="Override"
                  currentBudget={monthBudget}
                  currency={settings.currency ?? "NGN"}
                  onSave={(val) => setMonthBudget(activeMonth, val)}
                />
              </div>
            </div>
          </div>

          <SettingNavRow
            label="Categories"
            description="Manage custom categories and icons"
            badge={categories.length || null}
            onClick={() => setSubscreen("categories")}
          />

          <SettingNavRow
            label="Category Budgets"
            description="Set monthly limits per category"
            badge={
              Object.values(settings.categoryBudgets ?? {}).filter((v) => v > 0).length || null
            }
            onClick={() => setSubscreen("category-budgets")}
          />

          <SettingNavRow
            label="Recurring Expenses"
            description="Auto-add monthly expenses like subscriptions and bills"
            badge={recurringTemplates.length || null}
            onClick={() => setSubscreen("recurring")}
          />

          {/* Dark mode */}
          <SettingRow
            label="Dark Mode"
            description="Toggle between dark and light appearance"
          >
            <Toggle checked={isDark} onChange={handleThemeToggle} />
          </SettingRow>

          <SettingRow
            label="Hide Monetary Values"
            description="Mask visible amounts across the app for privacy"
          >
            <Toggle checked={hideMonetaryValues} onChange={handleHideMonetaryValuesToggle} />
          </SettingRow>
        </Section>

        {/* ── Security ──────────────────────────────────────────────────────── */}
        <Section title="Security">
          <SettingNavRow
            label="App Lock"
            description="Secure the app with a PIN and recovery questions"
            onClick={() => setSubscreen("app-lock")}
          />
        </Section>

        {/* ── Data ────────────────────────────────────────────────────────── */}
        <Section title="Data">
          {/* Export */}
          <SettingRow
            label="Export for Excel (CSV)"
            description="Download a spreadsheet-friendly file for Excel or Google Sheets"
          >
            <button
              onClick={handleExportCSV}
              disabled={exportingCSV}
              className="
                flex items-center gap-1.5 h-8 px-3 rounded-lg
                text-[12px] font-medium
                bg-[#1a1a1a] border border-[#222] text-[#888]
                hover:text-white hover:border-[#333]
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-colors
              "
            >
              {exportingCSV ? (
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
                    d="M5.5 1v6M2.5 5l3 3 3-3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M1 8.5v1a.5.5 0 00.5.5h8a.5.5 0 00.5-.5v-1"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              )}
              {exportingCSV ? "Exporting…" : "Export CSV"}
            </button>
          </SettingRow>

          {/* <SettingRow
            label="Export Backup (JSON)"
            description="Download spendings and budget data for safekeeping"
          >
            <button
              onClick={handleExportJSON}
              disabled={exportingJSON}
              className="
                flex items-center gap-1.5 h-8 px-3 rounded-lg
                text-[12px] font-medium
                bg-[#1a1a1a] border border-[#222] text-[#888]
                hover:text-white hover:border-[#333]
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-colors
              "
            >
              {exportingJSON ? "Exporting…" : "Export JSON"}
            </button>
          </SettingRow> */}

          {/* <SettingRow
            label="Export backup (JSON)"
            description="Full backup for exact restore and migration"
          >
            <button
              onClick={handleExportJSON}
              disabled={exportingJSON}
              className="
                flex items-center gap-1.5 h-8 px-3 rounded-lg
                text-[12px] font-medium
                bg-[#1a1a1a] border border-[#222] text-[#888]
                hover:text-white hover:border-[#333]
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-colors
              "
            >
              {exportingJSON ? (
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
                    d="M5.5 1v6M2.5 5l3 3 3-3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M1 8.5v1a.5.5 0 00.5.5h8a.5.5 0 00.5-.5v-1"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              )}
              {exportingJSON ? "Exporting…" : "Export JSON"}
            </button>
          </SettingRow> */}

          {/* Import */}
          <SettingRow
            label="Import Data"
            description="Import a CSV or JSON file, then choose merge or replace"
          >
            <button
              onClick={() => fileInputRef.current?.click()}
              className="
                flex items-center gap-1.5 h-8 px-3 rounded-lg
                text-[12px] font-medium
                bg-[#1a1a1a] border border-[#222] text-[#888]
                hover:text-white hover:border-[#333]
                transition-colors
              "
            >
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path
                  d="M5.5 7.5V1.5M2.5 3.5l3-3 3 3"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M1 8.5v1a.5.5 0 00.5.5h8a.5.5 0 00.5-.5v-1"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              Import file
            </button>
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json,.csv,text/csv"
              onChange={handleFileSelect}
              className="sr-only"
              aria-hidden="true"
            />
          </SettingRow>
        </Section>

        {/* ── About ───────────────────────────────────────────────────────── */}
        <Section title="About">
          <SettingNavRow
            label="Privacy"
            description="How KudiLog protects your data and keeps it under your control"
            onClick={() => setSubscreen("privacy")}
          />

          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl overflow-hidden">
            {/* Brand block */}
            <div className="flex flex-col items-center justify-center px-4 py-6 border-b border-[#131313] gap-3">
              <KudiLogo size="lg" showTagline />
            </div>
            {/* App details */}
            <div className="px-4 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-[#7a7a7a]">Version</span>
                <Badge variant="muted" size="xs">
                  1.0.0
                </Badge>
              </div>
              <div className="h-px bg-[#131313]" />
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-[#7a7a7a]">Storage</span>
                <span className="text-[12px] text-[#888]">
                  Local · IndexedDB
                </span>
              </div>
              <div className="h-px bg-[#131313]" />
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-[#7a7a7a]">Schema</span>
                <Badge variant="muted" size="xs">
                  v1
                </Badge>
              </div>
            </div>
          </div>

          {/* PWA install hint */}
          <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl border border-[#1a1a1a] bg-[#0d0d0d]">
            <div className="shrink-0 mt-0.5">
              <KudiIcon size={22} />
            </div>
            <div>
              <div className="text-[12px] font-medium text-[#888] mb-0.5">
                Install as App
              </div>
              <div className="text-[11px] text-[#666] leading-relaxed">
                On iOS: tap the Share button then "Add to Home Screen". On
                Android: tap the menu and select "Install app".
              </div>
            </div>
          </div>
        </Section>

        {/* ── Danger Zone ─────────────────────────────────────────────────── */}
        <Section title="Danger Zone">
          {/* <SettingRow
            label="Clear Recurring Data"
            description="Delete all recurring templates and auto-generated expenses. Manually added expenses are kept."
            danger
          >
            <button
              onClick={() => setConfirmClearRecurring(true)}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium bg-red-500/10 border border-red-500/15 text-red-400 hover:bg-red-500/20 hover:border-red-500/25 transition-colors"
            >
              Clear
            </button>
          </SettingRow> */}

          <SettingRow
            label="Clear All Expenses"
            description="Permanently delete every expense. This cannot be undone."
            danger
          >
            <button
              onClick={() => setConfirmClear(true)}
              className="
                flex items-center gap-1.5 h-8 px-3 rounded-lg
                text-[12px] font-medium
                bg-red-500/10 border border-red-500/15 text-red-400
                hover:bg-red-500/20 hover:border-red-500/25
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
              Delete All
            </button>
          </SettingRow>
        </Section>
      </div>

      {/* ── Import preview modal ─────────────────────────────────────────── */}
      <ImportPreviewModal
        open={importModalOpen}
        onClose={() => {
          setImportModalOpen(false);
          setPendingFile(null);
          setImportPreview(null);
        }}
        preview={importPreview}
        onConfirmMerge={() => handleImport("merge")}
        onConfirmReplace={() => handleImport("replace")}
        loading={importLoading}
        hideMonetaryValues={hideMonetaryValues}
        currency={settings.currency ?? "NGN"}
      />

      {/* ── Confirm clear all ────────────────────────────────────────────── */}
      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={handleClearAll}
        title="Delete all expenses?"
        description="Every expense across all months will be permanently deleted. Export your data first if you want a backup."
        confirmLabel="Delete Everything"
        confirmVariant="danger"
        loading={clearing}
      />

      {/* ── Confirm clear recurring ──────────────────────────────────────── */}
      <ConfirmDialog
        open={confirmClearRecurring}
        onClose={() => setConfirmClearRecurring(false)}
        onConfirm={handleClearRecurringExpenses}
        title="Clear recurring data?"
        description="All recurring templates and their auto-generated expenses will be deleted. Expenses you added manually are not affected."
        confirmLabel="Clear Recurring"
        confirmVariant="danger"
        loading={clearingRecurring}
      />
    </>
  );
}
