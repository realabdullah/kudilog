// ─── AnalyticsView ─────────────────────────────────────────────────────────────
//
// Displays:
//   - Summary stats (total, highest, average, count)
//   - Category breakdown with proportion bars
//   - Month-over-month trend (last 6 months)
//   - Spending insight message
//   - Recurring expenses detection

import { useMemo } from "react";
import {
  useMonthStats,
  useMonthlyTrend,
  useRecurringExpenses,
} from "../../hooks/useExpenses";
import {
  formatCurrency,
  formatMonthShort,
  formatPercentChange,
  percentChange,
  getCategoryEmoji,
  getCategoryLabel,
  clamp,
} from "../../utils/formatters";
import { Skeleton, EmptyState, Badge } from "../ui/index";

// ─── Stat Card ─────────────────────────────────────────────────────────────────

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
      <span className="text-[11px] text-[#444] uppercase tracking-widest font-medium">
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
        <span className="text-[11px] text-[#3a3a3a] leading-tight mt-0.5">
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
          <span className="text-[11px] text-[#444] tabular-nums">
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

// ─── Trend Bar Chart ───────────────────────────────────────────────────────────

function TrendChart({ trend, currency, currentMonth }) {
  const max = useMemo(() => Math.max(...trend.map((t) => t.total), 1), [trend]);

  return (
    <div className="flex items-end gap-1.5 h-20">
      {trend.map((point) => {
        const heightPct = max > 0 ? (point.total / max) * 100 : 0;
        const isCurrent = point.month === currentMonth;
        const isEmpty = point.total === 0;

        return (
          <div
            key={point.month}
            className="flex-1 flex flex-col items-center gap-1.5"
            title={`${formatMonthShort(point.month)}: ${formatCurrency(point.total, currency)}`}
          >
            {/* Bar */}
            <div className="w-full flex items-end flex-1">
              <div
                className={`
                  w-full rounded-t-sm transition-all duration-700 ease-out
                  ${
                    isEmpty
                      ? "bg-[#1a1a1a] opacity-40"
                      : isCurrent
                        ? "bg-[#6bbf4e]"
                        : "bg-[#2a2a2a]"
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
                isCurrent ? "text-[#6bbf4e]" : "text-[#333]"
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
          className={`flex items-start gap-2.5 px-3.5 py-3 rounded-xl border text-[12px] leading-relaxed ${variantClasses[ins.variant]}`}
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

function RecurringSection({ recurring, currency }) {
  if (!recurring || recurring.length === 0) return null;

  return (
    <div>
      <SectionHeader title="Recurring" subtitle="Appears in 2+ months" />
      <div className="space-y-0 divide-y divide-[#111]">
        {recurring.slice(0, 5).map((item) => (
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
              <span className="text-[11px] text-[#3a3a3a]">
                avg {formatCurrency(item.avgAmount, currency)} / month
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Section Header ────────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }) {
  return (
    <div className="flex items-baseline justify-between mb-3">
      <h3 className="text-[12px] font-semibold text-[#555] uppercase tracking-widest">
        {title}
      </h3>
      {subtitle && <span className="text-[11px] text-[#333]">{subtitle}</span>}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

/**
 * @param {{
 *   month: string,       // "YYYY-MM" – the month being analysed
 *   currency: string,
 *   monthlyBudget?: number | null,
 * }} props
 */
export default function AnalyticsView({
  month,
  currency = "NGN",
  monthlyBudget = null,
}) {
  const stats = useMonthStats(month);
  const trend = useMonthlyTrend(month, 6);
  const recurring = useRecurringExpenses(2);

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

  // ── Budget progress ────────────────────────────────────────────────────────
  const budgetPct = useMemo(() => {
    if (!monthlyBudget || !stats) return null;
    return clamp((stats.total / monthlyBudget) * 100, 0, 100);
  }, [monthlyBudget, stats]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (!stats || !trend) {
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
              <Skeleton
                key={i}
                className="flex-1 rounded-t-sm"
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

  return (
    <div className="space-y-7 pb-8">
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
          value={prevMonthTotal === 0 ? "—" : formatPercentChange(mom)}
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
            <span className="text-[11px] text-[#444] uppercase tracking-widest font-medium">
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
              <span className="text-[11px] text-[#333]">
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
            <span className="text-[10px] text-[#333] tabular-nums">
              {formatCurrency(stats.total, currency, true)} spent
            </span>
            <span className="text-[10px] text-[#333] tabular-nums">
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

      {/* ── Insights ──────────────────────────────────────────────────────── */}
      <InsightBanner
        currentTotal={stats.total}
        prevTotal={prevMonthTotal}
        topCategory={topCategory}
        topCategoryAmount={topCategoryAmount}
        totalExpenses={stats.count}
      />

      {/* ── 6-Month Trend ─────────────────────────────────────────────────── */}
      <div>
        <SectionHeader
          title="6-Month Trend"
          subtitle={formatMonthShort(month)}
        />
        <TrendChart trend={trend} currency={currency} currentMonth={month} />

        {/* Trend totals row */}
        <div className="flex gap-1.5 mt-3 overflow-x-auto scrollbar-none pb-1">
          {trend.map((point) => {
            const isCurrent = point.month === month;
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

      {/* ── Recurring Expenses ────────────────────────────────────────────── */}
      <RecurringSection recurring={recurring} currency={currency} />
    </div>
  );
}
