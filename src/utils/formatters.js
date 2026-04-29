// ─── Formatting Utilities ──────────────────────────────────────────────────────

// ─── Currency ──────────────────────────────────────────────────────────────────

/**
 * Currency symbol map for common currencies.
 */
const CURRENCY_SYMBOLS = {
  NGN: "₦",
  USD: "$",
  EUR: "€",
  GBP: "£",
  GHS: "₵",
  KES: "KSh",
  ZAR: "R",
  INR: "₹",
  CAD: "C$",
  AUD: "A$",
};

/**
 * Get the symbol for a currency code.
 * Falls back to the code itself if not found.
 *
 * @param {string} currencyCode
 * @returns {string}
 */
export function getCurrencySymbol(currencyCode = "NGN") {
  return CURRENCY_SYMBOLS[currencyCode] ?? currencyCode;
}

/**
 * Format a number as a currency string.
 * Uses compact notation for large numbers when `compact` is true.
 *
 * @param {number}  amount
 * @param {string}  currencyCode
 * @param {boolean} compact       - Use short form: 1.2M, 45K, etc.
 * @returns {string}
 */
export function formatCurrency(amount, currencyCode = "NGN", compact = false) {
  if (amount == null || isNaN(amount)) return `${getCurrencySymbol(currencyCode)}0`;

  const symbol = getCurrencySymbol(currencyCode);
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";

  if (compact) {
    if (abs >= 1_000_000_000) {
      return `${sign}${symbol}${trimTrailingZeros((abs / 1_000_000_000).toFixed(2))}B`;
    }
    if (abs >= 1_000_000) {
      return `${sign}${symbol}${trimTrailingZeros((abs / 1_000_000).toFixed(2))}M`;
    }
    if (abs >= 100_000) {
      return `${sign}${symbol}${trimTrailingZeros((abs / 1_000).toFixed(1))}K`;
    }
  }

  // Standard formatting with thousand separators
  const formatted = abs.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  return `${sign}${symbol}${formatted}`;
}

/**
 * Remove unnecessary trailing decimal zeros.
 * "1.50" → "1.5"  |  "2.00" → "2"  |  "1.23" → "1.23"
 *
 * @param {string} str
 * @returns {string}
 */
function trimTrailingZeros(str) {
  return str.replace(/\.?0+$/, "");
}

// ─── Dates ─────────────────────────────────────────────────────────────────────

/**
 * Get the current month string in YYYY-MM format.
 *
 * @returns {string}
 */
export function currentMonth() {
  const now = new Date();
  return toMonthKey(now);
}

/**
 * Convert a Date object to a "YYYY-MM" string.
 *
 * @param {Date} date
 * @returns {string}
 */
export function toMonthKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Parse a "YYYY-MM" string into a Date set to the 1st of that month.
 *
 * @param {string} monthKey
 * @returns {Date}
 */
export function parseMonthKey(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

/**
 * Format a "YYYY-MM" string into a human-readable label.
 * "2024-01" → "January 2024"
 *
 * @param {string} monthKey
 * @param {"long"|"short"} style
 * @returns {string}
 */
export function formatMonthLabel(monthKey, style = "long") {
  const date = parseMonthKey(monthKey);
  return date.toLocaleDateString("en-US", { month: style, year: "numeric" });
}

/**
 * Format a "YYYY-MM" string into a short label.
 * "2024-01" → "Jan '24"
 *
 * @param {string} monthKey
 * @returns {string}
 */
export function formatMonthShort(monthKey) {
  const date = parseMonthKey(monthKey);
  const month = date.toLocaleDateString("en-US", { month: "short" });
  const year = String(date.getFullYear()).slice(2);
  return `${month} '${year}`;
}

/**
 * Get the previous month key.
 * "2024-01" → "2023-12"
 *
 * @param {string} monthKey
 * @returns {string}
 */
export function prevMonth(monthKey) {
  const date = parseMonthKey(monthKey);
  date.setMonth(date.getMonth() - 1);
  return toMonthKey(date);
}

/**
 * Get the next month key.
 * "2024-01" → "2024-02"
 *
 * @param {string} monthKey
 * @returns {string}
 */
export function nextMonth(monthKey) {
  const date = parseMonthKey(monthKey);
  date.setMonth(date.getMonth() + 1);
  return toMonthKey(date);
}

/**
 * Check whether a month key is the current calendar month.
 *
 * @param {string} monthKey
 * @returns {boolean}
 */
export function isCurrentMonth(monthKey) {
  return monthKey === currentMonth();
}

/**
 * Format an ISO 8601 timestamp for display.
 * Returns e.g. "Apr 29, 2024 · 14:32"
 *
 * @param {string} isoString
 * @returns {string}
 */
export function formatTimestamp(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  const datePart = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timePart = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${datePart} · ${timePart}`;
}

/**
 * Format an ISO 8601 timestamp as a relative time string.
 * "just now", "5 min ago", "2 hours ago", "yesterday", "Apr 3"
 *
 * @param {string} isoString
 * @returns {string}
 */
export function formatRelativeTime(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return "yesterday";
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Numbers & Percentages ─────────────────────────────────────────────────────

/**
 * Format a percentage change with a sign and one decimal place.
 * 15.3 → "+15.3%"  |  -8 → "-8.0%"  |  0 → "0%"
 *
 * @param {number} value
 * @returns {string}
 */
export function formatPercentChange(value) {
  if (value == null || isNaN(value)) return "—";
  if (value === 0) return "0%";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

/**
 * Compute the percentage change between two values.
 * Returns null if the previous value is 0 or null.
 *
 * @param {number} current
 * @param {number} previous
 * @returns {number|null}
 */
export function percentChange(current, previous) {
  if (!previous || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/**
 * Format a plain number with thousand separators.
 * 1234567 → "1,234,567"
 *
 * @param {number} value
 * @returns {string}
 */
export function formatNumber(value) {
  if (value == null || isNaN(value)) return "0";
  return value.toLocaleString("en-US");
}

/**
 * Clamp a value between min and max.
 *
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Format a percentage (0–100) for a progress bar, clamped to [0, 100].
 *
 * @param {number} value
 * @returns {string}  e.g. "72.5%"
 */
export function formatBarPercent(value) {
  return `${clamp(value ?? 0, 0, 100).toFixed(1)}%`;
}

// ─── Category Meta ─────────────────────────────────────────────────────────────

export const CATEGORIES = [
  { id: "food",          label: "Food & Dining",      emoji: "🍽️" },
  { id: "transport",     label: "Transport",           emoji: "🚗" },
  { id: "entertainment", label: "Entertainment",       emoji: "🎬" },
  { id: "shopping",      label: "Shopping",            emoji: "🛍️" },
  { id: "health",        label: "Health",              emoji: "💊" },
  { id: "bills",         label: "Bills & Utilities",   emoji: "💡" },
  { id: "education",     label: "Education",           emoji: "📚" },
  { id: "personal",      label: "Personal Care",       emoji: "✨" },
  { id: "travel",        label: "Travel",              emoji: "✈️" },
  { id: "other",         label: "Other",               emoji: "📦" },
];

/** Map from category id → category meta */
export const CATEGORY_MAP = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c])
);

/**
 * Get a category's display label.
 *
 * @param {string} categoryId
 * @returns {string}
 */
export function getCategoryLabel(categoryId) {
  return CATEGORY_MAP[categoryId]?.label ?? "Uncategorised";
}

/**
 * Get a category's emoji.
 *
 * @param {string} categoryId
 * @returns {string}
 */
export function getCategoryEmoji(categoryId) {
  return CATEGORY_MAP[categoryId]?.emoji ?? "📦";
}
