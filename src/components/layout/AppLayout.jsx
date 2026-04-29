// ─── AppLayout ─────────────────────────────────────────────────────────────────
//
// Top-level shell:
//   - Fixed header with app name, current month label, and month navigation
//   - Scrollable content area
//   - Fixed bottom navigation bar (Dashboard | Analytics | Settings)

import { useCallback } from "react";
import {
  formatMonthLabel,
  prevMonth,
  nextMonth,
  isCurrentMonth,
} from "../../utils/formatters";
import { KudiIcon } from "../ui/index";

// ─── Nav items ─────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  {
    id: "dashboard",
    label: "Log",
    icon: (active) => (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect
          x="3"
          y="3"
          width="14"
          height="14"
          rx="3"
          stroke="currentColor"
          strokeWidth={active ? "1.75" : "1.4"}
        />
        <path
          d="M7 10h6M7 13.5h4"
          stroke="currentColor"
          strokeWidth={active ? "1.75" : "1.4"}
          strokeLinecap="round"
        />
        <path
          d="M7 6.5h6"
          stroke={active ? "currentColor" : "currentColor"}
          strokeWidth={active ? "1.75" : "1.4"}
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: "analytics",
    label: "Insights",
    icon: (active) => (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path
          d="M3 15.5l4-5 3.5 3 3.5-5.5 3 3"
          stroke="currentColor"
          strokeWidth={active ? "1.75" : "1.4"}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M3 17h14"
          stroke="currentColor"
          strokeWidth={active ? "1.75" : "1.4"}
          strokeLinecap="round"
          opacity="0.4"
        />
      </svg>
    ),
  },
  {
    id: "settings",
    label: "Settings",
    icon: (active) => (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle
          cx="10"
          cy="10"
          r="2.5"
          stroke="currentColor"
          strokeWidth={active ? "1.75" : "1.4"}
        />
        <path
          d="M10 3v1.5M10 15.5V17M3 10h1.5M15.5 10H17M4.93 4.93l1.06 1.06M13.01 13.01l1.06 1.06M4.93 15.07l1.06-1.06M13.01 6.99l1.06-1.06"
          stroke="currentColor"
          strokeWidth={active ? "1.75" : "1.4"}
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

// ─── Month Switcher ─────────────────────────────────────────────────────────────

function MonthSwitcher({ month, onChange }) {
  const handlePrev = useCallback(
    () => onChange(prevMonth(month)),
    [month, onChange],
  );
  const handleNext = useCallback(
    () => onChange(nextMonth(month)),
    [month, onChange],
  );

  const isCurrent = isCurrentMonth(month);
  // Don't allow navigating past the current month
  const canGoNext = !isCurrent;

  return (
    <div className="flex items-center gap-1">
      {/* Prev */}
      <button
        onClick={handlePrev}
        aria-label="Previous month"
        className="
          w-7 h-7 flex items-center justify-center rounded-lg
          text-[#6a6a6a] hover:text-[#888] hover:bg-[#1a1a1a]
          transition-colors duration-150
        "
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M8.5 3L5 7l3.5 4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Month label */}
      <button
        onClick={() =>
          isCurrent || onChange(new Date().toISOString().slice(0, 7))
        }
        className={`
          px-2 py-1 rounded-lg text-[12px] font-medium transition-colors duration-150 tabular-nums
          ${
            isCurrent
              ? "text-[#7a7a7a] cursor-default"
              : "text-[#6bbf4e] hover:text-[#7fd460] hover:bg-[#6bbf4e]/10"
          }
        `}
        title={isCurrent ? "Current month" : "Jump to current month"}
      >
        {formatMonthLabel(month, "short")}
      </button>

      {/* Next */}
      <button
        onClick={handleNext}
        disabled={!canGoNext}
        aria-label="Next month"
        className="
          w-7 h-7 flex items-center justify-center rounded-lg
          text-[#6a6a6a] hover:text-[#888] hover:bg-[#1a1a1a]
          transition-colors duration-150
          disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[#6a6a6a]
        "
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M5.5 3L9 7l-3.5 4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}

// ─── Bottom Navigation ─────────────────────────────────────────────────────────

function BottomNav({ activeTab, onTabChange }) {
  return (
    <nav
      className="
        fixed bottom-0 left-0 right-0 z-40
        bg-[#0a0a0a]/95 backdrop-blur-md
        border-t border-[#141414]
        flex items-stretch
        safe-area-bottom
      "
      aria-label="Main navigation"
    >
      {NAV_ITEMS.map((item) => {
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            aria-label={item.label}
            aria-current={isActive ? "page" : undefined}
            className={`
              flex-1 flex flex-col items-center justify-center gap-1
              pt-3 pb-3
              transition-colors duration-150
              outline-none focus-visible:bg-[#141414]
              ${isActive ? "text-white" : "text-[#666] hover:text-[#666]"}
            `}
          >
            {item.icon(isActive)}
            <span
              className={`
                text-[10px] font-medium leading-none
                ${isActive ? "text-white" : "text-[#666]"}
              `}
            >
              {item.label}
            </span>

            {/* Active indicator dot */}
            {isActive && (
              <span className="absolute bottom-1 w-1 h-1 rounded-full bg-[#6bbf4e]" />
            )}
          </button>
        );
      })}
    </nav>
  );
}

// ─── Header ────────────────────────────────────────────────────────────────────

function AppHeader({ activeTab, month, onMonthChange }) {
  const showMonthSwitcher =
    activeTab === "dashboard" || activeTab === "analytics";

  return (
    <header
      className="
        sticky top-0 z-30
        bg-[#0a0a0a]/95 backdrop-blur-md
        border-b border-[#111]
        px-4
        flex items-center justify-between
        h-14
      "
    >
      {/* App wordmark */}
      <div className="flex items-center gap-2">
        <KudiIcon size={26} />
        <span
          className="text-[15px] font-bold text-white tracking-tight leading-none"
          style={{ fontFamily: "'Trebuchet MS', 'Segoe UI', sans-serif" }}
        >
          Kudi<span style={{ color: "#6bbf4e" }}>Log</span>
        </span>
      </div>

      {/* Month switcher (only on relevant tabs) */}
      {showMonthSwitcher && (
        <MonthSwitcher month={month} onChange={onMonthChange} />
      )}

      {/* Settings tab: show title */}
      {activeTab === "settings" && (
        <span className="text-[13px] font-medium text-[#6a6a6a]">Settings</span>
      )}
    </header>
  );
}

// ─── Root Layout ────────────────────────────────────────────────────────────────

/**
 * @param {{
 *   activeTab: "dashboard" | "analytics" | "settings",
 *   onTabChange: (tab: string) => void,
 *   month: string,
 *   onMonthChange: (month: string) => void,
 *   children: React.ReactNode,
 * }} props
 */
export default function AppLayout({
  activeTab,
  onTabChange,
  month,
  onMonthChange,
  children,
}) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <AppHeader
        activeTab={activeTab}
        month={month}
        onMonthChange={onMonthChange}
      />

      {/* Main content — padded for bottom nav */}
      <main
        className="
          max-w-lg mx-auto
          px-4 pt-4 pb-28
          min-h-[calc(100vh-3.5rem)]
        "
      >
        {children}
      </main>

      {/* Bottom nav */}
      <BottomNav activeTab={activeTab} onTabChange={onTabChange} />
    </div>
  );
}
