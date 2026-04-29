// ─── SettingsView ──────────────────────────────────────────────────────────────
//
// Settings panel with:
//   - Currency selection
//   - Monthly budget limit
//   - Theme toggle (dark / light)
//   - Export / Import data
//   - Danger zone: clear all data

import { useState, useRef, useCallback } from "react";
import { useAllSettings, useSettingMutation } from "../../hooks/useExpenses";
import {
  exportToJSON,
  importFromJSON,
  previewImport,
} from "../../utils/exportImport";
import { formatCurrency } from "../../utils/formatters";
import {
  KudiIcon,
  KudiLogo,
  ConfirmDialog,
  showToast,
  Modal,
  Skeleton,
  Badge,
} from "../ui/index";
import { db } from "../../db/db";

// ─── Currency options ──────────────────────────────────────────────────────────

const CURRENCIES = [
  { code: "NGN", label: "Nigerian Naira", symbol: "₦" },
  { code: "USD", label: "US Dollar", symbol: "$" },
  { code: "EUR", label: "Euro", symbol: "€" },
  { code: "GBP", label: "British Pound", symbol: "£" },
  { code: "GHS", label: "Ghanaian Cedi", symbol: "₵" },
  { code: "KES", label: "Kenyan Shilling", symbol: "KSh" },
  { code: "ZAR", label: "South African Rand", symbol: "R" },
  { code: "INR", label: "Indian Rupee", symbol: "₹" },
  { code: "CAD", label: "Canadian Dollar", symbol: "C$" },
  { code: "AUD", label: "Australian Dollar", symbol: "A$" },
];

// ─── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div className="space-y-3">
      <h2 className="text-[11px] font-semibold text-[#444] uppercase tracking-widest px-0">
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

// ─── Settings row ──────────────────────────────────────────────────────────────

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
          <div className="text-[11px] text-[#3a3a3a] mt-0.5 leading-relaxed">
            {description}
          </div>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

// ─── Toggle switch ─────────────────────────────────────────────────────────────

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

// ─── Import preview modal ──────────────────────────────────────────────────────

function ImportPreviewModal({
  open,
  onClose,
  preview,
  onConfirmMerge,
  onConfirmReplace,
  loading,
}) {
  if (!preview) return null;

  return (
    <Modal open={open} onClose={onClose} title="Import Data" size="sm">
      {preview.valid ? (
        <div className="space-y-4">
          {/* File summary */}
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[12px] text-[#555]">Expenses</span>
              <span className="text-[13px] font-semibold text-white tabular-nums">
                {preview.expenseCount}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[12px] text-[#555]">Exported at</span>
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
              <span className="text-[12px] text-[#555]">Schema version</span>
              <Badge variant="muted" size="xs">
                v{preview.meta?.schemaVersion}
              </Badge>
            </div>
          </div>

          <p className="text-[12px] text-[#555] leading-relaxed">
            Choose how to import this data:
          </p>

          <div className="space-y-2">
            <button
              onClick={onConfirmMerge}
              disabled={loading}
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
              disabled={loading}
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
          <p className="text-[12px] text-[#555] leading-relaxed">
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

function BudgetInput({ currentBudget, currency, onSave }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");

  const currencySymbol =
    CURRENCIES.find((c) => c.code === currency)?.symbol ?? currency;

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
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-[#444] pointer-events-none">
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
          className="w-7 h-7 rounded-lg text-[#555] hover:text-[#888] hover:bg-[#1a1a1a] flex items-center justify-center transition-colors"
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
      {currentBudget ? formatCurrency(currentBudget, currency) : "Set limit"}
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

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function SettingsView() {
  const settings = useAllSettings();
  const setSetting = useSettingMutation();

  // ── Export state ──────────────────────────────────────────────────────────
  const [exporting, setExporting] = useState(false);

  // ── Import state ──────────────────────────────────────────────────────────
  const [importPreview, setImportPreview] = useState(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false); // "merge"|"replace"|false
  const [pendingFile, setPendingFile] = useState(null);
  const fileInputRef = useRef(null);

  // ── Danger zone state ─────────────────────────────────────────────────────
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const { count } = await exportToJSON();
      showToast({
        message: `Exported ${count} expense${count !== 1 ? "s" : ""}`,
        type: "success",
      });
    } catch (err) {
      showToast({ message: "Export failed: " + err.message, type: "error" });
    } finally {
      setExporting(false);
    }
  }, []);

  const handleFileSelect = useCallback(async (e) => {
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
    async (mode) => {
      if (!pendingFile) return;

      setImportLoading(mode);
      try {
        const result = await importFromJSON(pendingFile, mode);
        showToast({
          message: `Imported ${result.imported} expense${result.imported !== 1 ? "s" : ""} (${mode})`,
          type: "success",
        });
        setImportModalOpen(false);
        setPendingFile(null);
        setImportPreview(null);
      } catch (err) {
        showToast({ message: "Import failed: " + err.message, type: "error" });
      } finally {
        setImportLoading(false);
      }
    },
    [pendingFile],
  );

  const handleClearAll = useCallback(async () => {
    setClearing(true);
    try {
      await db.transaction("rw", db.expenses, async () => {
        await db.expenses.clear();
      });
      showToast({ message: "All expenses deleted", type: "info" });
      setConfirmClear(false);
    } catch (err) {
      showToast({
        message: "Failed to clear data: " + err.message,
        type: "error",
      });
    } finally {
      setClearing(false);
    }
  }, []);

  const handleCurrencyChange = useCallback(
    async (code) => {
      await setSetting("currency", code);
      showToast({ message: `Currency set to ${code}`, type: "success" });
    },
    [setSetting],
  );

  const handleBudgetSave = useCallback(
    async (value) => {
      await setSetting("monthlyBudget", value);
    },
    [setSetting],
  );

  const handleThemeToggle = useCallback(
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

  return (
    <>
      <div className="space-y-7 pb-10">
        {/* ── Preferences ─────────────────────────────────────────────────── */}
        <Section title="Preferences">
          {/* Currency */}
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#131313]">
              <div className="text-[13px] font-medium text-[#ddd]">
                Currency
              </div>
              <div className="text-[11px] text-[#3a3a3a] mt-0.5">
                Used for all amount displays
              </div>
            </div>
            <div className="grid grid-cols-2 divide-x divide-y divide-[#131313]">
              {CURRENCIES.map((c) => {
                const isSelected = settings.currency === c.code;
                return (
                  <button
                    key={c.code}
                    onClick={() => handleCurrencyChange(c.code)}
                    className={`
                      flex items-center gap-2.5 px-3.5 py-2.5
                      text-left transition-colors duration-150
                      ${isSelected ? "bg-[#6bbf4e]/10" : "hover:bg-[#111]"}
                    `}
                  >
                    <span
                      className={`
                        text-[15px] font-bold w-6 text-center tabular-nums shrink-0
                        ${isSelected ? "text-[#6bbf4e]" : "text-[#333]"}
                      `}
                    >
                      {c.symbol}
                    </span>
                    <div className="min-w-0">
                      <div
                        className={`text-[12px] font-medium leading-tight truncate ${isSelected ? "text-[#6bbf4e]" : "text-[#888]"}`}
                      >
                        {c.code}
                      </div>
                      <div className="text-[10px] text-[#333] truncate">
                        {c.label}
                      </div>
                    </div>
                    {isSelected && (
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        className="ml-auto shrink-0 text-[#6bbf4e]"
                      >
                        <path
                          d="M1.5 6l3 3 6-6"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Monthly budget */}
          <SettingRow
            label="Monthly Budget"
            description={
              settings.monthlyBudget
                ? `Limit set — progress shown in Analytics`
                : "Set a spending limit to track budget usage"
            }
          >
            <BudgetInput
              currentBudget={settings.monthlyBudget}
              currency={settings.currency ?? "NGN"}
              onSave={handleBudgetSave}
            />
          </SettingRow>

          {/* Dark mode */}
          <SettingRow
            label="Dark Mode"
            description="Toggle between dark and light appearance"
          >
            <Toggle checked={isDark} onChange={handleThemeToggle} />
          </SettingRow>
        </Section>

        {/* ── Data ────────────────────────────────────────────────────────── */}
        <Section title="Data">
          {/* Export */}
          <SettingRow
            label="Export Data"
            description="Download all expenses as a JSON file — backup or migrate anytime"
          >
            <button
              onClick={handleExport}
              disabled={exporting}
              className="
                flex items-center gap-1.5 h-8 px-3 rounded-lg
                text-[12px] font-medium
                bg-[#1a1a1a] border border-[#222] text-[#888]
                hover:text-white hover:border-[#333]
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-colors
              "
            >
              {exporting ? (
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
              {exporting ? "Exporting…" : "Export JSON"}
            </button>
          </SettingRow>

          {/* Import */}
          <SettingRow
            label="Import Data"
            description="Restore from a KudiLog JSON export — merge or replace"
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
              Import JSON
            </button>
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileSelect}
              className="sr-only"
              aria-hidden="true"
            />
          </SettingRow>
        </Section>

        {/* ── About ───────────────────────────────────────────────────────── */}
        <Section title="About">
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl overflow-hidden">
            {/* Brand block */}
            <div className="flex flex-col items-center justify-center px-4 py-6 border-b border-[#131313] gap-3">
              <KudiLogo size="lg" showTagline />
            </div>
            {/* App details */}
            <div className="px-4 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-[#555]">Version</span>
                <Badge variant="muted" size="xs">
                  1.0.0
                </Badge>
              </div>
              <div className="h-px bg-[#131313]" />
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-[#555]">Storage</span>
                <span className="text-[12px] text-[#888]">
                  Local · IndexedDB
                </span>
              </div>
              <div className="h-px bg-[#131313]" />
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-[#555]">Schema</span>
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
              <div className="text-[11px] text-[#3a3a3a] leading-relaxed">
                On iOS: tap the Share button then "Add to Home Screen". On
                Android: tap the menu and select "Install app".
              </div>
            </div>
          </div>
        </Section>

        {/* ── Danger Zone ─────────────────────────────────────────────────── */}
        <Section title="Danger Zone">
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
    </>
  );
}
