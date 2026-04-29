// ─── AnalyticsView ─────────────────────────────────────────────────────────────
//
// Displays:
//   - Summary stats (total, highest, average, count)
//   - Category breakdown with proportion bars
//   - Month-over-month trend (last 6 months)
//   - Spending insight message
//   - Recurring expenses detection

import { useMemo, useState } from "react"
import {
    useAnalyticsExportSnapshot,
    useBudgetHealth,
    useBudgetVariance,
    useCategoryTrend,
    useDailyBurnRate,
    useMonthForecast,
    useMonthStats,
    useMonthlyTrend,
    useRecurringExpenses,
    useSpendingAnomalies,
    useWeekdaySpendDistribution,
} from "../../hooks/useExpenses"
import {
  buildAnalyticsLLMPrompt,
    exportAnalyticsSnapshotCSV,
    exportAnalyticsSnapshotJSON,
} from "../../utils/analyticsExport"
import {
    clamp,
    currentMonth,
    formatCurrency,
    formatMonthShort,
    formatPercentChange,
    getCategoryEmoji,
    getCategoryLabel,
    percentChange,
} from "../../utils/formatters"
import { Badge, EmptyState, Skeleton, showToast } from "../ui/index"

/** @param {unknown} value */
function isValidMonthKey(value) {
  return typeof value === "string" && /^\d{4}-\d{2}$/.test(value)
}

/** @typedef {{ month: string, total: number }} TrendPoint */
/** @typedef {{ total: number, count: number, highest: { amount: number, name: string } | null, average: number, byCategory: Record<string, number> }} StatsShape */

// ─── Stat Card ─────────────────────────────────────────────────────────────────

/** @param {{ label: string, value: string, sub?: string, accent?: boolean }} props */
function StatCard({ label, value, sub, accent = false }) {
  return (
    <div
      className={`
        flex flex-col gap-1 px-4 py-3.5 rounded-xl border
        ${
          accent
            ? "bg-[#6bbf4e]/5 border-[#6bbf4e]/15"
            : "bg-[#0d0d0d] border-[#1a1a1a]"
        }
      `}
    >
      <span className="text-[11px] text-[#6a6a6a] uppercase tracking-widest font-medium">
        {label}
      </span>
      <span
        className={`text-[22px] font-bold tracking-tight leading-none tabular-nums ${
          accent ? "text-[#6bbf4e]" : "text-white"
        }`}
      >
        {value}
      </span>
      {sub && (
        <span className="text-[11px] text-[#666] leading-tight mt-0.5">
          {sub}
        </span>
      )}
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="px-4 py-3.5 rounded-xl border border-[#1a1a1a] bg-[#0d0d0d] space-y-2">
      <Skeleton className="h-2.5 w-14 rounded" />
      <Skeleton className="h-6 w-24 rounded-md" />
      <Skeleton className="h-2 w-16 rounded" />
    </div>
  );
}

// ─── Category Row ──────────────────────────────────────────────────────────────

/** @param {{ categoryId: string, amount: number, total: number, currency: string, rank: number }} props */
function CategoryRow({ categoryId, amount, total, currency, rank }) {
  const pct = total > 0 ? (amount / total) * 100 : 0;
  const barWidth = `${clamp(pct, 0, 100).toFixed(1)}%`;

  // Colour progression: top category is more vivid
  const barColours = [
    "bg-[#6bbf4e]",
    "bg-blue-500",
    "bg-emerald-500",
    "bg-amber-500",
    "bg-rose-500",
    "bg-cyan-500",
    "bg-pink-500",
    "bg-orange-500",
    "bg-teal-500",
    "bg-[#444]",
  ];
  const barColour = barColours[rank] ?? barColours[barColours.length - 1];

  return (
    <div className="flex flex-col gap-1.5">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[13px] leading-none">
            {getCategoryEmoji(categoryId)}
          </span>
          <span className="text-[13px] text-[#c0c0c0] font-medium truncate">
            {getCategoryLabel(categoryId)}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-[#6a6a6a] tabular-nums">
            {pct.toFixed(1)}%
          </span>
          <span className="text-[13px] font-semibold text-white tabular-nums">
            {formatCurrency(amount, currency)}
          </span>
        </div>
      </div>

      {/* Bar */}
      <div className="h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${barColour}`}
          style={{ width: barWidth }}
        />
      </div>
    </div>
  );
}

/** @param {{ categoryId: string, spent: number, budget: number, currency: string }} props */
function CategoryBudgetRow({ categoryId, spent, budget, currency }) {
  const pct = budget > 0 ? (spent / budget) * 100 : 0;
  const capped = clamp(pct, 0, 100);
  const remaining = Math.max(budget - spent, 0);
  const over = Math.max(spent - budget, 0);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[13px] leading-none">
            {getCategoryEmoji(categoryId)}
          </span>
          <span className="text-[13px] text-[#c0c0c0] font-medium truncate">
            {getCategoryLabel(categoryId)}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`text-[11px] tabular-nums ${
              pct >= 100 ? "text-red-400" : pct >= 80 ? "text-amber-400" : "text-emerald-400"
            }`}
          >
            {pct.toFixed(0)}%
          </span>
          <span className="text-[12px] text-[#999] tabular-nums">
            {formatCurrency(spent, currency, true)} / {formatCurrency(budget, currency, true)}
          </span>
        </div>
      </div>

      <div className="h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${
            pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500"
          }`}
          style={{ width: `${capped.toFixed(1)}%` }}
        />
      </div>

      <div className="flex justify-between text-[10px] text-[#666] tabular-nums">
        <span>
          {over > 0 ? `${formatCurrency(over, currency, true)} over` : `${formatCurrency(remaining, currency, true)} left`}
        </span>
        <span>{formatCurrency(spent, currency, true)} spent</span>
      </div>
    </div>
  );
}

// ─── Trend Bar Chart ───────────────────────────────────────────────────────────

/** @param {{ trend: TrendPoint[], currency: string, currentMonth: string }} props */
function TrendChart({ trend, currency, currentMonth }) {
  const max = useMemo(() => Math.max(...trend.map((t) => t.total), 1), [trend]);

  return (
    <div className="flex items-end gap-1.5 h-24">
      {trend.map((point) => {
        const heightPct = max > 0 ? (point.total / max) * 100 : 0;
        const isCurrent = point.month === currentMonth;
        const isEmpty = point.total === 0;

        return (
          <div
            key={point.month}
            className="flex-1 h-full flex flex-col items-center justify-end gap-1.5"
            title={`${formatMonthShort(point.month)}: ${formatCurrency(point.total, currency)}`}
          >
            {/* Bar */}
            <div className="w-full h-16 flex items-end">
              <div
                className={`
                  w-full rounded-t-sm transition-all duration-700 ease-out
                  ${
                    isEmpty
                      ? "bg-[#242424] opacity-60"
                      : isCurrent
                        ? "bg-[#6bbf4e]"
                        : "bg-[#4a4a4a]"
                  }
                `}
                style={{
                  height: isEmpty ? "4px" : `${clamp(heightPct, 4, 100)}%`,
                }}
              />
            </div>

            {/* Label */}
            <span
              className={`text-[9px] tabular-nums font-medium leading-none ${
                isCurrent ? "text-[#6bbf4e]" : "text-[#5e5e5e]"
              }`}
            >
              {formatMonthShort(point.month).split(" ")[0]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Insight Banner ────────────────────────────────────────────────────────────

/** @param {{ currentTotal: number, prevTotal: number, topCategory: string | null, topCategoryAmount: number, totalExpenses: number }} props */
function InsightBanner({
  currentTotal,
  prevTotal,
  topCategory,
  topCategoryAmount,
  totalExpenses,
}) {
  const change = percentChange(currentTotal, prevTotal);

  const insights = [];

  // Month-over-month change
  if (prevTotal > 0 && change !== null) {
    const direction = change > 0 ? "more" : "less";
    const abs = Math.abs(change).toFixed(1);
    insights.push({
      icon: change > 0 ? "📈" : "📉",
      text: `You spent ${abs}% ${direction} than last month`,
      variant: change > 20 ? "warning" : change < -10 ? "success" : "default",
    });
  }

  // Top category insight
  if (topCategory && totalExpenses > 0) {
    const pct = ((topCategoryAmount / currentTotal) * 100).toFixed(0);
    insights.push({
      icon: getCategoryEmoji(topCategory),
      text: `${getCategoryLabel(topCategory)} accounts for ${pct}% of your spending`,
      variant: "default",
    });
  }

  // No previous data
  if (prevTotal === 0 && currentTotal > 0) {
    insights.push({
      icon: "✨",
      text: "First full month of tracking — keep it up!",
      variant: "accent",
    });
  }

  if (insights.length === 0) return null;

  const variantClasses = {
    default: "bg-[#0d0d0d] border-[#1a1a1a] text-[#888]",
    warning: "bg-amber-500/5 border-amber-500/15 text-amber-400/80",
    success: "bg-emerald-500/5 border-emerald-500/15 text-emerald-400/80",
    accent: "bg-[#6bbf4e]/5 border-[#6bbf4e]/15 text-[#6bbf4e]/80",
  };

  return (
    <div className="space-y-2">
      {insights.map((ins, i) => (
        <div
          key={i}
          className={`flex items-start gap-2.5 px-3.5 py-3 rounded-xl border text-[12px] leading-relaxed ${variantClasses[/** @type {keyof typeof variantClasses} */ (ins.variant)]}`}
        >
          <span className="text-[14px] leading-tight shrink-0 mt-px">
            {ins.icon}
          </span>
          <span>{ins.text}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Recurring Expenses ────────────────────────────────────────────────────────

/** @param {{ recurring: Array<{ name: string, months: string[], avgAmount: number }> | undefined, currency: string }} props */
function RecurringSection({ recurring, currency }) {
  const [showAll, setShowAll] = useState(false);

  if (!recurring || recurring.length === 0) return null;
  const visible = showAll ? recurring : recurring.slice(0, 5);

  return (
    <div>
      <SectionHeader
        title="Recurring"
        subtitle={`${recurring.length} detected entries`}
      />
      <div className="space-y-0 divide-y divide-[#111]">
        {visible.map((item) => (
          <div
            key={item.name}
            className="flex items-center justify-between py-3 gap-3"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-[#c0c0c0] font-medium truncate">
                  {item.name}
                </span>
                <Badge variant="muted" size="xs">
                  {item.months.length}× months
                </Badge>
              </div>
              <span className="text-[11px] text-[#666]">
                avg {formatCurrency(item.avgAmount, currency)} / month
              </span>
            </div>
          </div>
        ))}
      </div>
      {recurring.length > 5 ? (
        <button
          type="button"
          onClick={() => setShowAll((prev) => !prev)}
          className="mt-2.5 text-[11px] text-[#666] hover:text-[#9a9a9a] transition-colors"
        >
          {showAll ? "Show less" : `View all (${recurring.length})`}
        </button>
      ) : null}
    </div>
  );
}

/** @param {{ anomalies: { monthly: { kind: "spike" | "drop", current: number, baseline: number, changePct: number } | null, categories: Array<{ categoryId: string, current: number, baseline: number, changePct: number }> }, currency: string }} props */
function AnomalySection({ anomalies, currency }) {
  const hasMonthly = anomalies.monthly !== null;
  const hasCategory = anomalies.categories.length > 0;
  if (!hasMonthly && !hasCategory) return null;

  return (
    <div>
      <SectionHeader title="Anomaly Signals" subtitle="unusual changes" />
      <div className="space-y-2.5">
        {anomalies.monthly ? (
          <div className="rounded-xl border border-[#1a1a1a] bg-[#0d0d0d] px-3.5 py-3">
            <div className="text-[12px] text-[#d0d0d0]">
              {anomalies.monthly.kind === "spike" ? "Monthly spend spike" : "Monthly spend drop"}
            </div>
            <div className="mt-1 text-[11px] text-[#5a5a5a] tabular-nums">
              {formatCurrency(anomalies.monthly.current, currency, true)} vs {formatCurrency(anomalies.monthly.baseline, currency, true)} baseline
            </div>
            <div
              className={`mt-1.5 text-[11px] font-semibold tabular-nums ${
                anomalies.monthly.kind === "spike" ? "text-red-400" : "text-emerald-400"
              }`}
            >
              {anomalies.monthly.changePct >= 0 ? "+" : ""}{anomalies.monthly.changePct.toFixed(1)}%
            </div>
          </div>
        ) : null}

        {anomalies.categories.map((row) => (
          <div
            key={row.categoryId}
            className="rounded-xl border border-[#171717] bg-[#0b0b0b] px-3 py-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] text-[#c0c0c0] flex items-center gap-1.5">
                <span>{getCategoryEmoji(row.categoryId)}</span>
                <span>{getCategoryLabel(row.categoryId)}</span>
              </span>
              <span className="text-[11px] text-red-400 tabular-nums font-semibold">
                +{row.changePct.toFixed(1)}%
              </span>
            </div>
            <div className="mt-1 text-[10px] text-[#4a4a4a] tabular-nums">
              {formatCurrency(row.current, currency, true)} now vs {formatCurrency(row.baseline, currency, true)} typical
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Section Header ────────────────────────────────────────────────────────────

/** @param {{ title: string, subtitle?: string }} props */
function SectionHeader({ title, subtitle }) {
  return (
    <div className="flex items-baseline justify-between mb-3">
      <h3 className="text-[12px] font-semibold text-[#7a7a7a] uppercase tracking-widest">
        {title}
      </h3>
      {subtitle && <span className="text-[11px] text-[#5e5e5e]">{subtitle}</span>}
    </div>
  );
}

/** @param {{ health: any, burn: any, forecast: any, currency: string }} props */
function HealthAndForecast({ health, burn, forecast, currency }) {
  if (!health || !burn || !forecast) return null;

  const pacePct = burn.paceRatio !== null ? burn.paceRatio * 100 : null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      <div className="rounded-xl border border-[#1a1a1a] bg-[#0d0d0d] p-3">
        <div className="text-[11px] uppercase tracking-widest text-[#7a7a7a]">Budget Health</div>
        <div className="mt-1 text-[14px] font-semibold text-white tabular-nums">
          {health.budget !== null
            ? formatCurrency(health.remaining ?? 0, currency, true)
            : "No budget"}
        </div>
        <div className="mt-1 text-[11px] text-[#666] tabular-nums">
          {health.budget !== null
            ? `${formatCurrency(health.spent, currency, true)} spent`
            : `${formatCurrency(health.spent, currency, true)} this month`}
        </div>
      </div>

      <div className="rounded-xl border border-[#1a1a1a] bg-[#0d0d0d] p-3">
        <div className="text-[11px] uppercase tracking-widest text-[#7a7a7a]">Daily Pace</div>
        <div
          className={`mt-1 text-[14px] font-semibold tabular-nums ${
            burn.warning === "critical"
              ? "text-red-400"
              : burn.warning === "watch"
                ? "text-amber-400"
                : "text-emerald-400"
          }`}
        >
          {pacePct !== null ? `${pacePct.toFixed(0)}% pace` : "No pace baseline"}
        </div>
        <div className="mt-1 text-[11px] text-[#666] tabular-nums">
          {burn.allowedDaily !== null
            ? `${formatCurrency(burn.actualDaily, currency, true)} / day vs ${formatCurrency(burn.allowedDaily, currency, true)} target`
            : `${formatCurrency(burn.actualDaily, currency, true)} / day`}
        </div>
      </div>

      <div className="rounded-xl border border-[#1a1a1a] bg-[#0d0d0d] p-3">
        <div className="text-[11px] uppercase tracking-widest text-[#7a7a7a]">Forecast</div>
        <div className="mt-1 text-[14px] font-semibold text-white tabular-nums">
          {formatCurrency(forecast.forecast, currency, true)}
        </div>
        <div className="mt-1 text-[11px] text-[#666] tabular-nums">
          {forecast.deltaVsBudget !== null
            ? `${forecast.deltaVsBudget >= 0 ? "+" : ""}${formatCurrency(forecast.deltaVsBudget, currency, true)} vs budget · ${forecast.confidence} confidence`
            : `${forecast.confidence} confidence`}
        </div>
      </div>
    </div>
  );
}

/** @param {{ variance: { budget: number, spent: number, variance: number, pct: number } | null, currency: string }} props */
function GlobalVariance({ variance, currency }) {
  if (!variance) return null;

  const over = variance.variance < 0;
  return (
    <div className="rounded-xl border border-[#1a1a1a] bg-[#0d0d0d] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-[#7a7a7a] uppercase tracking-widest font-medium">
          Global Variance
        </span>
        <span
          className={`text-[12px] font-semibold tabular-nums ${
            over ? "text-red-400" : "text-emerald-400"
          }`}
        >
          {over ? "Over" : "Under"} {formatCurrency(Math.abs(variance.variance), currency, true)}
        </span>
      </div>
      <div className="mt-1.5 text-[11px] text-[#666]">
        {formatCurrency(variance.spent, currency, true)} spent of {formatCurrency(variance.budget, currency, true)}
      </div>
      <div className="mt-2 h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${over ? "bg-red-500" : "bg-emerald-500"}`}
          style={{ width: `${clamp(variance.pct, 0, 100).toFixed(1)}%` }}
        />
      </div>
    </div>
  );
}

/** @param {{ rows: Array<{ categoryId: string, budget: number, spent: number, variance: number, pct: number }>, currency: string }} props */
function CategoryVariance({ rows, currency }) {
  if (!rows.length) return null;

  return (
    <div className="space-y-2.5">
      {rows.slice(0, 4).map((row) => {
        const over = row.variance < 0;
        return (
          <div
            key={row.categoryId}
            className="flex items-center justify-between gap-3 rounded-lg border border-[#171717] bg-[#0b0b0b] px-3 py-2"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span>{getCategoryEmoji(row.categoryId)}</span>
              <span className="text-[12px] text-[#b5b5b5] truncate">
                {getCategoryLabel(row.categoryId)}
              </span>
            </div>
            <div className="text-right shrink-0">
              <div
                className={`text-[11px] tabular-nums font-semibold ${
                  over ? "text-red-400" : "text-emerald-400"
                }`}
              >
                {over ? "-" : "+"}{formatCurrency(Math.abs(row.variance), currency, true)}
              </div>
              <div className="text-[10px] text-[#666] tabular-nums">
                {formatCurrency(row.spent, currency, true)} / {formatCurrency(row.budget, currency, true)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** @param {{ weekdays: Array<{ day: number, total: number, count: number }>, currency: string }} props */
function WeekdayDistribution({ weekdays, currency }) {
  if (!weekdays.length) return null;

  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const max = Math.max(...weekdays.map((d) => d.total), 1);

  return (
    <div className="space-y-2.5">
      {weekdays.map((item) => {
        const width = max > 0 ? clamp((item.total / max) * 100, 0, 100) : 0;
        return (
          <div key={item.day} className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#666]">{labels[item.day]}</span>
              <span className="text-[#9a9a9a] tabular-nums">
                {item.total > 0 ? formatCurrency(item.total, currency, true) : "—"}
              </span>
            </div>
            <div className="h-1 bg-[#191919] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#6bbf4e] rounded-full"
                style={{ width: `${width.toFixed(1)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** @param {{ trend: { months: string[], series: Array<{ categoryId: string, total: number, points: Array<{ month: string, total: number }> }> }, currency: string }} props */
function CategoryMomentum({ trend, currency }) {
  if (!trend.series.length) return null;

  const max = Math.max(
    ...trend.series.flatMap((series) => series.points.map((p) => p.total)),
    1,
  );

  return (
    <div className="space-y-3">
      {trend.series.map((series) => (
        <div key={series.categoryId} className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-[#bcbcbc] font-medium flex items-center gap-1.5">
              <span>{getCategoryEmoji(series.categoryId)}</span>
              <span>{getCategoryLabel(series.categoryId)}</span>
            </span>
            <span className="text-[10px] text-[#666] tabular-nums">
              {series.points[series.points.length - 1]?.total > 0
                ? formatCurrency(series.points[series.points.length - 1].total, currency, true)
                : "—"}
            </span>
          </div>
          <div className="flex items-end gap-1 h-10">
            {series.points.map((point) => (
              <div key={point.month} className="flex-1 h-full flex items-end">
                <div
                  className="w-full bg-[#2a2a2a] rounded-sm"
                  style={{ height: `${clamp((point.total / max) * 100, 6, 100).toFixed(1)}%` }}
                  title={`${formatMonthShort(point.month)}: ${point.total}`}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

/**
 * @param {{
 *   month: string,
 *   currency?: string,
 *   monthlyBudget?: number | null,
 *   categoryBudgets?: Record<string, number>,
 * }} props
 */
export default function AnalyticsView({
  month,
  currency = "NGN",
  monthlyBudget = null,
  categoryBudgets = {},
}) {
  const safeMonth = isValidMonthKey(month) ? month : currentMonth();
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  /** @type {StatsShape | undefined} */
  const stats = useMonthStats(safeMonth);
  /** @type {TrendPoint[] | undefined} */
  const trend = useMonthlyTrend(safeMonth, 6);
  const recurring = useRecurringExpenses(2);
  const anomalies = useSpendingAnomalies(safeMonth, 6);
  const categoryTrend = useCategoryTrend(safeMonth, 6, 4);
  const weekdaySpend = useWeekdaySpendDistribution(safeMonth);
  const budgetVariance = useBudgetVariance(safeMonth, monthlyBudget, categoryBudgets);
  const budgetHealth = useBudgetHealth(safeMonth, monthlyBudget);
  const dailyBurn = useDailyBurnRate(safeMonth, monthlyBudget);
  const monthForecast = useMonthForecast(safeMonth, monthlyBudget, 6);
  const exportSnapshot = useAnalyticsExportSnapshot(
    safeMonth,
    currency,
    monthlyBudget,
    categoryBudgets,
  );

  // ── Derived: prev month total for comparison ──────────────────────────────
  const prevMonthTotal = useMemo(() => {
    if (!trend || trend.length < 2) return 0;
    // trend is oldest → newest; current is last item
    const prevPoint = trend[trend.length - 2];
    return prevPoint?.total ?? 0;
  }, [trend]);

  // ── Derived: sorted categories ────────────────────────────────────────────
  const sortedCategories = useMemo(() => {
    if (!stats?.byCategory) return [];
    return Object.entries(stats.byCategory)
      .sort(([, a], [, b]) => b - a)
      .filter(([, amount]) => amount > 0);
  }, [stats]);

  const topCategory = sortedCategories[0]?.[0] ?? null;
  const topCategoryAmount = sortedCategories[0]?.[1] ?? 0;

  const categoryBudgetRows = useMemo(() => {
    const entries = Object.entries(categoryBudgets || {}).filter(
      ([, value]) => Number.isFinite(Number(value)) && Number(value) > 0,
    );

    return entries
      .map(([categoryId, budget]) => {
        const spent = Number(stats?.byCategory?.[categoryId] ?? 0);
        return {
          categoryId,
          spent,
          budget: Number(budget),
          pct: Number(budget) > 0 ? (spent / Number(budget)) * 100 : 0,
        };
      })
      .sort((a, b) => b.pct - a.pct);
  }, [categoryBudgets, stats]);

  // ── Budget progress ────────────────────────────────────────────────────────
  const budgetPct = useMemo(() => {
    if (!monthlyBudget || !stats) return null;
    return clamp((stats.total / monthlyBudget) * 100, 0, 100);
  }, [monthlyBudget, stats]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (
    !stats ||
    !trend ||
    !categoryTrend ||
    !weekdaySpend ||
    !budgetVariance ||
    !anomalies ||
    !budgetHealth ||
    !dailyBurn ||
    !monthForecast ||
    !exportSnapshot
  ) {
    return (
      <div className="space-y-6 pb-8">
        {/* Stats grid skeleton */}
        <div className="grid grid-cols-2 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>

        {/* Chart skeleton */}
        <div>
          <Skeleton className="h-3 w-20 mb-3 rounded" />
          <div className="flex items-end gap-1.5 h-20">
            {[65, 40, 80, 30, 90, 55].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-sm bg-[#111]"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>

        {/* Category skeleton */}
        <div className="space-y-4">
          <Skeleton className="h-3 w-24 rounded" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-28 rounded" />
                <Skeleton className="h-3 w-14 rounded" />
              </div>
              <Skeleton className="h-1 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  if (stats.count === 0) {
    return (
      <EmptyState
        icon="📊"
        title="No data for this month"
        description="Add some expenses to see your analytics and spending patterns."
      />
    );
  }

  const mom = percentChange(stats.total, prevMonthTotal);

  const handleExportCSV = () => {
    try {
      exportAnalyticsSnapshotCSV(exportSnapshot);
      setShowMoreOptions(false);
      showToast({ message: "Analytics CSV downloaded", type: "success" });
    } catch (err) {
      showToast({ message: "Could not export CSV", type: "error" });
      console.error(err);
    }
  };

  const handleExportJSON = () => {
    try {
      exportAnalyticsSnapshotJSON(exportSnapshot);
      setShowMoreOptions(false);
      showToast({ message: "Analytics JSON downloaded", type: "success" });
    } catch (err) {
      showToast({ message: "Could not export JSON", type: "error" });
      console.error(err);
    }
  };

  const handleCopyLLMPrompt = async () => {
    try {
      const prompt = buildAnalyticsLLMPrompt(exportSnapshot);
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(prompt);
      } else {
        const ta = document.createElement("textarea");
        ta.value = prompt;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setShowMoreOptions(false);
      showToast({ message: "Prompt copied", type: "success" });
    } catch (err) {
      showToast({ message: "Could not copy LLM prompt", type: "error" });
      console.error(err);
    }
  };

  return (
    <div className="space-y-7 pb-8">
      <div className="relative flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setShowMoreOptions((prev) => !prev)}
          className="h-8 px-3 rounded-lg text-[11px] font-medium bg-[#0d0d0d] border border-[#1a1a1a] text-[#9a9a9a] hover:text-white hover:border-[#333] transition-colors"
        >
          More options
        </button>

        {showMoreOptions ? (
          <div className="absolute top-10 right-0 z-20 w-56 rounded-xl border border-[#1a1a1a] bg-[#0d0d0d] shadow-[0_8px_24px_rgba(0,0,0,0.4)] p-1.5">
            <button
              type="button"
              onClick={handleExportCSV}
              className="w-full text-left px-2.5 py-2 rounded-lg text-[12px] text-[#bcbcbc] hover:bg-[#151515] hover:text-white transition-colors"
            >
              Download CSV
            </button>
            <button
              type="button"
              onClick={handleExportJSON}
              className="w-full text-left px-2.5 py-2 rounded-lg text-[12px] text-[#bcbcbc] hover:bg-[#151515] hover:text-white transition-colors"
            >
              Download JSON
            </button>
            <button
              type="button"
              onClick={handleCopyLLMPrompt}
              className="w-full text-left px-2.5 py-2 rounded-lg text-[12px] text-[#bcbcbc] hover:bg-[#151515] hover:text-white transition-colors"
            >
              Copy as prompt
            </button>
          </div>
        ) : null}
      </div>

      <HealthAndForecast
        health={budgetHealth}
        burn={dailyBurn}
        forecast={monthForecast}
        currency={currency}
      />

      {/* ── Summary Stats Grid ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          label="Total Spent"
          value={formatCurrency(stats.total, currency, true)}
          sub={`${stats.count} transaction${stats.count !== 1 ? "s" : ""}`}
          accent
        />
        <StatCard
          label="Avg. per Entry"
          value={formatCurrency(stats.average, currency, true)}
          sub="mean transaction"
        />
        <StatCard
          label="Highest"
          value={formatCurrency(stats.highest?.amount ?? 0, currency, true)}
          sub={stats.highest?.name ?? "—"}
        />
        <StatCard
          label="vs Last Month"
          value={prevMonthTotal === 0 ? "—" : formatPercentChange(mom ?? 0)}
          sub={
            prevMonthTotal > 0
              ? formatCurrency(prevMonthTotal, currency, true) + " last mo."
              : "no prior data"
          }
        />
      </div>

      {/* ── Budget progress bar ────────────────────────────────────────────── */}
      {monthlyBudget && budgetPct !== null && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-[#6a6a6a] uppercase tracking-widest font-medium">
              Budget
            </span>
            <div className="flex items-center gap-1.5">
              <span
                className={`text-[12px] font-semibold tabular-nums ${
                  budgetPct >= 90
                    ? "text-red-400"
                    : budgetPct >= 70
                      ? "text-amber-400"
                      : "text-emerald-400"
                }`}
              >
                {budgetPct.toFixed(0)}%
              </span>
              <span className="text-[11px] text-[#5e5e5e]">
                of {formatCurrency(monthlyBudget, currency, true)}
              </span>
            </div>
          </div>

          {/* Track */}
          <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
            <div
              className={`
                h-full rounded-full transition-all duration-700 ease-out
                ${
                  budgetPct >= 90
                    ? "bg-red-500"
                    : budgetPct >= 70
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                }
              `}
              style={{ width: `${budgetPct.toFixed(1)}%` }}
            />
          </div>

          {/* Labels */}
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px] text-[#5e5e5e] tabular-nums">
              {formatCurrency(stats.total, currency, true)} spent
            </span>
            <span className="text-[10px] text-[#5e5e5e] tabular-nums">
              {formatCurrency(
                Math.max(monthlyBudget - stats.total, 0),
                currency,
                true,
              )}{" "}
              left
            </span>
          </div>
        </div>
      )}

      {categoryBudgetRows.length > 0 && (
        <div>
          <SectionHeader
            title="Category Budgets"
            subtitle={`${categoryBudgetRows.length} active`}
          />
          <div className="space-y-4">
            {categoryBudgetRows.map((row) => (
              <CategoryBudgetRow
                key={row.categoryId}
                categoryId={row.categoryId}
                spent={row.spent}
                budget={row.budget}
                currency={currency}
              />
            ))}
          </div>
        </div>
      )}

      {(budgetVariance.global || budgetVariance.categories.length > 0) && (
        <div>
          <SectionHeader title="Budget Variance" subtitle="target vs actual" />
          <div className="space-y-3">
            <GlobalVariance variance={budgetVariance.global} currency={currency} />
            <CategoryVariance rows={budgetVariance.categories} currency={currency} />
          </div>
        </div>
      )}

      {/* ── Insights ──────────────────────────────────────────────────────── */}
      <InsightBanner
        currentTotal={stats.total}
        prevTotal={prevMonthTotal}
        topCategory={topCategory}
        topCategoryAmount={topCategoryAmount}
        totalExpenses={stats.count}
      />

      <AnomalySection anomalies={anomalies} currency={currency} />

      {/* ── 6-Month Trend ─────────────────────────────────────────────────── */}
      <div>
        <SectionHeader
          title="6-Month Trend"
          subtitle={formatMonthShort(safeMonth)}
        />
        <TrendChart trend={trend} currency={currency} currentMonth={safeMonth} />

        {/* Trend totals row */}
        <div className="flex gap-1.5 mt-3 overflow-x-auto scrollbar-none pb-1">
          {trend.map((point) => {
            const isCurrent = point.month === safeMonth;
            return (
              <div key={point.month} className="flex-1 min-w-0 text-center">
                <div
                  className={`text-[10px] tabular-nums font-medium truncate ${
                    isCurrent ? "text-[#6bbf4e]" : "text-[#2a2a2a]"
                  }`}
                >
                  {point.total > 0
                    ? formatCurrency(point.total, currency, true)
                    : "—"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Category Breakdown ────────────────────────────────────────────── */}
      {sortedCategories.length > 0 && (
        <div>
          <SectionHeader
            title="By Category"
            subtitle={`${sortedCategories.length} categor${sortedCategories.length !== 1 ? "ies" : "y"}`}
          />
          <div className="space-y-4">
            {sortedCategories.map(([catId, amount], rank) => (
              <CategoryRow
                key={catId}
                categoryId={catId}
                amount={amount}
                total={stats.total}
                currency={currency}
                rank={rank}
              />
            ))}

            {/* Uncategorised */}
            {(() => {
              const categorisedTotal = sortedCategories.reduce(
                (sum, [, a]) => sum + a,
                0,
              );
              const uncategorised = stats.total - categorisedTotal;
              if (uncategorised <= 0.01) return null;
              return (
                <CategoryRow
                  key="__none__"
                  categoryId="other"
                  amount={uncategorised}
                  total={stats.total}
                  currency={currency}
                  rank={sortedCategories.length}
                />
              );
            })()}
          </div>
        </div>
      )}

      <div>
        <SectionHeader title="Spending Rhythm" subtitle="by weekday" />
        <WeekdayDistribution weekdays={weekdaySpend} currency={currency} />
      </div>

      {categoryTrend.series.length > 0 && (
        <div>
          <SectionHeader title="Category Momentum" subtitle="last 6 months" />
          <CategoryMomentum trend={categoryTrend} currency={currency} />
        </div>
      )}

      {/* ── Recurring Expenses ────────────────────────────────────────────── */}
      <RecurringSection recurring={recurring} currency={currency} />
    </div>
  );
}
