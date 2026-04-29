// ─── App ───────────────────────────────────────────────────────────────────────
//
// Root component. Manages:
//   - Active tab state ("dashboard" | "analytics" | "settings")
//   - Active month state ("YYYY-MM")
//   - Settings subscription (currency, budget)
//   - View orchestration

import { useEffect, useState } from "react"
import AnalyticsView from "./components/analytics/AnalyticsView"
import ExpenseInput from "./components/expenses/ExpenseInput"
import ExpenseList from "./components/expenses/ExpenseList"
import AppLayout from "./components/layout/AppLayout"
import SettingsView from "./components/settings/SettingsView"
import { KudiLogo, ToastContainer } from "./components/ui/index"
import { seedDefaultSettings } from "./db/db"
import {
  useAllSettings,
  useMonthExpenses,
  useMonthStats,
  useRecurringTemplates,
} from "./hooks/useExpenses"
import {
  currentMonth,
  formatCurrency,
  formatMonthLabel,
  isCurrentMonth,
} from "./utils/formatters"
import { syncRecurringExpensesToMonth } from "./utils/recurring"

const recurringAutomationEnabled =
  (/** @type {any} */ (import.meta)).env?.VITE_RECURRING_AUTOMATION !==
  "false";

/**
 * @typedef {{
 *   total: number,
 *   count: number,
 *   highest: { amount: number, name: string } | null,
 * }} MonthStatsSummary
 */

/**
 * @typedef {{
 *   currency?: string,
 *   monthlyBudget?: number | null,
 *   categoryBudgets?: Record<string, number>,
 *   theme?: string,
 * }} AppSettings
 */

// ─── Hero total for the dashboard ─────────────────────────────────────────────

/** @param {{ month: string, stats: MonthStatsSummary | undefined, currency: string, monthlyBudget: number | null }} props */
function MonthlyHero({ month, stats, currency, monthlyBudget }) {
  const isThisMonth = isCurrentMonth(month);

  // Budget percentage
  const budgetPct =
    monthlyBudget && stats?.total
      ? Math.min((stats.total / monthlyBudget) * 100, 100)
      : null;

  const budgetColour =
    budgetPct == null
      ? ""
      : budgetPct >= 90
        ? "text-red-400"
        : budgetPct >= 70
          ? "text-amber-400"
          : "text-emerald-400";

  return (
    <div className="pt-2 pb-6">
      {/* Month label */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[11px] font-medium text-[#666] uppercase tracking-widest">
          {isThisMonth ? "This month" : formatMonthLabel(month, "long")}
        </span>
        {isThisMonth && (
          <span
            className="text-[9px] font-semibold tracking-[0.15em] uppercase px-1.5 py-0.5 rounded"
            style={{
              color: "#6bbf4e",
              background: "rgba(107,191,78,0.08)",
              border: "1px solid rgba(107,191,78,0.15)",
            }}
          >
            Live
          </span>
        )}
      </div>

      {/* Total amount — the hero number */}
      <div className="flex items-end gap-3 mb-1.5">
        <span className="text-[44px] font-bold tracking-tighter leading-none text-white tabular-nums">
          {stats
            ? formatCurrency(stats.total, currency, stats.total >= 1_000_000)
            : "—"}
        </span>

        {/* Transaction count badge */}
        {stats && stats.count > 0 && (
          <span className="text-[13px] text-[#6a6a6a] font-medium mb-1.5 tabular-nums">
            {stats.count} {stats.count === 1 ? "entry" : "entries"}
          </span>
        )}
      </div>

      {/* Budget progress (compact) */}
      {monthlyBudget != null && stats && (
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[#666]">
              of {formatCurrency(monthlyBudget, currency)} budget
            </span>
            <span
              className={`text-[11px] font-semibold tabular-nums ${budgetColour}`}
            >
              {budgetPct != null ? `${budgetPct.toFixed(0)}%` : ""}
            </span>
          </div>
          <div className="h-1 bg-[#141414] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${
                (budgetPct ?? 0) >= 90
                  ? "bg-red-500"
                  : (budgetPct ?? 0) >= 70
                    ? "bg-amber-500"
                    : "bg-[#6bbf4e]"
              }`}
              style={{ width: `${budgetPct?.toFixed(1) ?? 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Divider */}
      <div className="mt-5 h-px bg-[#111]" />
    </div>
  );
}

// ─── Dashboard view ────────────────────────────────────────────────────────────

/** @param {{ month: string, currency: string, monthlyBudget: number | null }} props */
function DashboardView({ month, currency, monthlyBudget }) {
  const expenses = useMonthExpenses(month);
  const stats = useMonthStats(month);

  return (
    <div>
      {/* Hero total */}
      <MonthlyHero
        month={month}
        stats={stats}
        currency={currency}
        monthlyBudget={monthlyBudget}
      />

      {/* Fast expense input */}
      <div className="mb-6">
        <ExpenseInput currency={currency} currentMonth={month} />
      </div>

      {/* Expense list */}
      <ExpenseList
        expenses={expenses}
        currency={currency}
        loading={expenses === undefined}
      />
    </div>
  );
}

function SplashScreen() {
  return (
    <div className="fixed inset-0 z-50 bg-[#0a0a0a] flex items-center justify-center">
      <div className="flex flex-col items-center gap-5">
        <KudiLogo size="lg" showTagline />
        <div className="flex items-center gap-2 text-[12px] text-[#7a7a7a]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#6bbf4e] animate-pulse" />
          <span>Loading…</span>
        </div>
      </div>
    </div>
  );
}

// ─── Root App ──────────────────────────────────────────────────────────────────

export default function App() {
  const [activeTab, setActiveTab] = useState(/** @type {"dashboard" | "analytics" | "settings"} */ ("dashboard"));
  const [month, setMonth] = useState(currentMonth);
  const [minSplashDone, setMinSplashDone] = useState(false);

  /** @type {AppSettings | undefined} */
  const settings = useAllSettings();
  const recurringTemplates = useRecurringTemplates();
  const currency = settings?.currency ?? "NGN";
  const monthlyBudget = settings?.monthlyBudget ?? null;
  const categoryBudgets = settings?.categoryBudgets ?? {};

  // ── Minimum splash duration (prevents UI flicker) ─────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setMinSplashDone(true), 1300);
    return () => clearTimeout(t);
  }, []);

  // ── Seed default settings on first load ──────────────────────────────────
  useEffect(() => {
    seedDefaultSettings().catch(console.error);
  }, []);

  // ── Apply theme from settings ─────────────────────────────────────────────
  useEffect(() => {
    if (!settings) return;
    const isLight = settings.theme === "light";
    document.documentElement.classList.toggle("light", isLight);
  }, [settings?.theme]);

  const appReady = settings !== undefined && minSplashDone;

  useEffect(() => {
    if (
      !recurringAutomationEnabled ||
      !appReady ||
      recurringTemplates === undefined
    ) {
      return;
    }
    syncRecurringExpensesToMonth(currentMonth()).catch(console.error);
  }, [appReady, recurringTemplates]);

  return (
    <>
      {!appReady ? <SplashScreen /> : null}

      <AppLayout
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(/** @type {"dashboard" | "analytics" | "settings"} */ (tab))}
        month={month}
        onMonthChange={setMonth}
      >
        {appReady && activeTab === "dashboard" && (
          <DashboardView
            month={month}
            currency={currency}
            monthlyBudget={monthlyBudget}
          />
        )}

        {appReady && activeTab === "analytics" && (
          <AnalyticsView
            month={month}
            currency={currency}
            monthlyBudget={monthlyBudget}
            categoryBudgets={categoryBudgets}
          />
        )}

        {appReady && activeTab === "settings" && <SettingsView />}
      </AppLayout>

      {/* Global toast notifications */}
      <ToastContainer />
    </>
  );
}
