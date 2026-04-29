import { formatMonthLabel } from "./formatters";

/** @param {string} content @param {string} filename @param {string} mimeType */
function downloadContent(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/** @param {string | number | null | undefined} value */
function csvCell(value) {
  const str = value == null ? "" : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** @param {{
 *   meta: { generatedAt: string, month: string, currency: string },
 *   summary: { total: number, count: number, average: number, highest: number },
 *   budget: { monthlyBudget: number | null, spent: number, remaining: number | null, pct: number | null },
 *   categories: Array<{ categoryId: string, total: number }>,
 *   trend6: Array<{ month: string, total: number }>,
 * }} snapshot */
export function exportAnalyticsSnapshotJSON(snapshot) {
  const payload = {
    meta: {
      appName: "kudilog",
      reportType: "analytics",
      schemaVersion: 1,
      generatedAt: snapshot.meta.generatedAt,
      month: snapshot.meta.month,
      currency: snapshot.meta.currency,
    },
    data: snapshot,
  };

  const stamp = new Date(snapshot.meta.generatedAt).toISOString().slice(0, 10);
  const filename = `kudilog-analytics-${snapshot.meta.month}-${stamp}.json`;
  downloadContent(
    JSON.stringify(payload, null, 2),
    filename,
    "application/json",
  );
}

/** @param {{
 *   meta: { generatedAt: string, month: string, currency: string },
 *   summary: { total: number, count: number, average: number, highest: number },
 *   budget: { monthlyBudget: number | null, spent: number, remaining: number | null, pct: number | null },
 *   categories: Array<{ categoryId: string, total: number }>,
 *   trend6: Array<{ month: string, total: number }>,
 * }} snapshot */
export function exportAnalyticsSnapshotCSV(snapshot) {
  const rows = [];

  rows.push(["Section", "Metric", "Value"]);
  rows.push(["Meta", "Generated At", snapshot.meta.generatedAt]);
  rows.push(["Meta", "Month", snapshot.meta.month]);
  rows.push(["Meta", "Month Label", formatMonthLabel(snapshot.meta.month)]);
  rows.push(["Meta", "Currency", snapshot.meta.currency]);

  rows.push(["Summary", "Total", snapshot.summary.total]);
  rows.push(["Summary", "Count", snapshot.summary.count]);
  rows.push(["Summary", "Average", snapshot.summary.average]);
  rows.push(["Summary", "Highest", snapshot.summary.highest]);

  rows.push(["Budget", "Budget", snapshot.budget.monthlyBudget]);
  rows.push(["Budget", "Spent", snapshot.budget.spent]);
  rows.push(["Budget", "Remaining", snapshot.budget.remaining]);
  rows.push(["Budget", "Budget Pct", snapshot.budget.pct]);

  rows.push([]);
  rows.push(["Categories", "Category", "Total"]);
  for (const row of snapshot.categories) {
    rows.push(["Categories", row.categoryId, row.total]);
  }

  rows.push([]);
  rows.push(["Trend", "Month", "Total"]);
  for (const row of snapshot.trend6) {
    rows.push(["Trend", row.month, row.total]);
  }

  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");

  const stamp = new Date(snapshot.meta.generatedAt).toISOString().slice(0, 10);
  const filename = `kudilog-analytics-${snapshot.meta.month}-${stamp}.csv`;
  downloadContent(csv, filename, "text/csv;charset=utf-8");
}

/** @param {{
 *   meta: { generatedAt: string, month: string, currency: string },
 *   summary: { total: number, count: number, average: number, highest: number },
 *   budget: { monthlyBudget: number | null, spent: number, remaining: number | null, pct: number | null },
 *   categories: Array<{ categoryId: string, total: number }>,
 *   trend6: Array<{ month: string, total: number }>,
 * }} snapshot */
export function buildAnalyticsLLMPrompt(snapshot) {
  const payload = {
    app: "kudilog",
    dataset: "monthly-analytics",
    generatedAt: snapshot.meta.generatedAt,
    month: snapshot.meta.month,
    currency: snapshot.meta.currency,
    summary: snapshot.summary,
    budget: snapshot.budget,
    categories: snapshot.categories,
    trend6: snapshot.trend6,
  };

  return [
    "Role: You are a friendly personal-finance coach writing for everyday people.",
    "Audience: Non-technical users who want clear money guidance.",
    "Goal: Turn the dataset into practical monthly insights that are easy to understand.",
    "",
    "Writing Rules:",
    "- Use plain, everyday English. Avoid technical jargon.",
    "- Keep sentences short and clear.",
    "- For each insight, add: 'What this means for you'.",
    "- For each recommendation, add: 'Do this next'.",
    "- Use only the provided data. If a value is missing, say 'insufficient data'.",
    "- Show numbers to support claims (amounts, percentages, and changes).",
    "- Do not use finance acronyms unless you explain them in simple words.",
    "",
    "Output format (use exactly these sections):",
    "## Executive Summary",
    "- 5 to 8 bullet points in plain language.",
    "",
    "## What Stands Out",
    "- Explain spending trend direction in simple words.",
    "- Highlight category concentration risk in simple words.",
    "- Call out 2 to 5 unusual changes and likely reasons.",
    "",
    "## 30-Day Action Plan",
    "- 5 prioritized actions with expected impact and effort (Low/Medium/High).",
    "- Each action must include a concrete weekly habit.",
    "",
    "## Forecast",
    "- Next-month spend range (low/base/high) with simple assumptions.",
    "- Explain confidence in plain language.",
    "",
    "## Chart Pack (Mermaid)",
    "Provide 3 Mermaid charts in separate code blocks:",
    "1) Line chart for 6-month trend.",
    "2) Pie chart for category share.",
    "3) Bar chart for budget vs spent vs remaining/overrun.",
    "",
    "## Quick Wins",
    "- List the top 3 easiest changes the user can start today.",
    "",
    "DATA:",
    JSON.stringify(payload, null, 2),
  ].join("\n");
}
