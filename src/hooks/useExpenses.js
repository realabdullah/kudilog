// ─── useExpenses Hook ──────────────────────────────────────────────────────────
//
// Centralised hook for all expense and settings interactions.
// Uses Dexie's useLiveQuery for reactive, real-time updates from IndexedDB.

import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useMemo } from "react";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db/db";
import { currentMonth, toMonthKey } from "../utils/formatters";

const typedDb = /** @type {any} */ (db);

/** @param {unknown} monthKey */
function isValidMonthKey(monthKey) {
  return typeof monthKey === "string" && /^\d{4}-\d{2}$/.test(monthKey);
}

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   amount: number,
 *   category: string,
 *   month: string,
 *   createdAt: string,
 *   updatedAt: string,
 *   recurringId?: string,
 * }} Expense
 */

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   amount: number,
 *   category: string,
 *   frequency: "monthly",
 *   startMonth: string,
 *   enabled: boolean,
 *   lastGeneratedMonth: string | null,
 *   createdAt: string,
 *   updatedAt: string,
 * }} RecurringTemplate
 */

/**
 * @typedef {{
 *   id: string,
 *   value: any,
 * }} SettingRow
 */

/**
 * @typedef {{
 *   currency?: string,
 *   monthlyBudget?: number | null,
 *   categoryBudgets?: Record<string, number>,
 *   theme?: string,
 *   hideMonetaryValues?: boolean,
 *   [key: string]: any,
 * }} AppSettings
 */

// ─── Expenses ──────────────────────────────────────────────────────────────────

/**
 * Fetch all expenses for a given month, sorted newest-first.
 *
 * @param {string} month - "YYYY-MM"
 * @returns {Expense[]|undefined}
 */
export function useMonthExpenses(month) {
  return useLiveQuery(() => {
    if (!isValidMonthKey(month)) return [];
    return typedDb.expenses
      .where("month")
      .equals(month)
      .reverse()
      .sortBy("createdAt");
  }, [month]);
}

/**
 * Fetch all expenses across all months, sorted by month desc then createdAt desc.
 *
 * @returns {Expense[]|undefined}
 */
export function useAllExpenses() {
  return useLiveQuery(() =>
    typedDb.expenses.orderBy("createdAt").reverse().toArray(),
  );
}

/**
 * Fetch all distinct months that have at least one expense.
 * Returns an array of "YYYY-MM" strings sorted descending.
 *
 * @returns {string[]|undefined}
 */
export function useAvailableMonths() {
  return useLiveQuery(async () => {
    const all = await typedDb.expenses.orderBy("month").uniqueKeys();
    // uniqueKeys returns ascending; we want newest first
    return [...all].reverse();
  });
}

/**
 * Fetch a single expense by ID.
 *
 * @param {string|null} id
 * @returns {Expense|undefined}
 */
export function useExpenseById(id) {
  return useLiveQuery(() => (id ? typedDb.expenses.get(id) : undefined), [id]);
}

// ─── Mutations ─────────────────────────────────────────────────────────────────

/**
 * Returns CRUD functions for expenses.
 * All functions are stable references (useCallback with empty deps where safe).
 */
export function useExpenseMutations() {
  /**
   * Add a new expense.
   *
   * @param {{ name: string, amount: number, category?: string, month?: string }} data
   * @returns {Promise<string>} The new expense's ID
   */
  const addExpense = useCallback(
    async (
      /** @type {{ name: string, amount: number, category?: string, month?: string }} */ data,
    ) => {
      const now = new Date().toISOString();
      const expense = {
        id: uuidv4(),
        name: data.name.trim(),
        amount: Number(data.amount),
        category: data.category ?? "",
        month: data.month ?? currentMonth(),
        createdAt: now,
        updatedAt: now,
      };
      await typedDb.expenses.add(expense);
      return expense.id;
    },
    [],
  );

  /**
   * Update an existing expense by ID.
   * Only the provided fields are updated; updatedAt is always refreshed.
   *
   * @param {string} id
   * @param {Partial<Expense>} changes
   * @returns {Promise<number>} Number of records updated (0 or 1)
   */
  const updateExpense = useCallback(
    async (
      /** @type {string} */ id,
      /** @type {Partial<Expense>} */ changes,
    ) => {
      const safeChanges = { ...changes, updatedAt: new Date().toISOString() };
      // Never allow id or createdAt to be mutated via this path
      delete safeChanges.id;
      delete safeChanges.createdAt;

      // If amount is being updated, ensure it's a number
      if (safeChanges.amount !== undefined) {
        safeChanges.amount = Number(safeChanges.amount);
      }

      // If name is being updated, trim whitespace
      if (safeChanges.name !== undefined) {
        safeChanges.name = safeChanges.name.trim();
      }

      return typedDb.expenses.update(id, safeChanges);
    },
    [],
  );

  /**
   * Delete an expense by ID.
   *
   * @param {string} id
   * @returns {Promise<void>}
   */
  const deleteExpense = useCallback(async (/** @type {string} */ id) => {
    await typedDb.expenses.delete(id);
  }, []);

  /**
   * Delete all expenses for a given month.
   *
   * @param {string} month - "YYYY-MM"
   * @returns {Promise<number>} Number of deleted records
   */
  const deleteMonthExpenses = useCallback(
    async (/** @type {string} */ month) => {
      if (!isValidMonthKey(month)) return 0;
      return typedDb.expenses.where("month").equals(month).delete();
    },
    [],
  );

  /**
   * Duplicate an expense (creating a new one with the same fields, timestamped now).
   *
   * @param {string} id
   * @returns {Promise<string|null>} New expense ID, or null if source not found
   */
  const duplicateExpense = useCallback(async (/** @type {string} */ id) => {
    const original = await typedDb.expenses.get(id);
    if (!original) return null;

    const now = new Date().toISOString();
    const duplicate = {
      ...original,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
    };
    await typedDb.expenses.add(duplicate);
    return duplicate.id;
  }, []);

  return {
    addExpense,
    updateExpense,
    deleteExpense,
    deleteMonthExpenses,
    duplicateExpense,
  };
}

// ─── Settings ──────────────────────────────────────────────────────────────────

/**
 * Reactive hook for a single setting value.
 * Returns undefined while loading, then the stored value (or `defaultValue`).
 *
 * @param {string} key
 * @param {*}      defaultValue
 * @returns {*}
 */
export function useSetting(key, defaultValue = null) {
  return useLiveQuery(async () => {
    const row = await typedDb.settings.get(key);
    return row !== undefined ? row.value : defaultValue;
  }, [key]);
}

/**
 * Reactive hook that returns all settings as a plain object.
 * e.g. { currency: "NGN", monthlyBudget: 50000, theme: "dark" }
 *
 * @returns {AppSettings|undefined}
 */
export function useAllSettings() {
  return useLiveQuery(async () => {
    const rows = /** @type {SettingRow[]} */ (await typedDb.settings.toArray());
    return Object.fromEntries(rows.map((r) => [r.id, r.value]));
  });
}

/**
 * Returns a stable function for updating a setting by key.
 *
 * @returns {(key: string, value: *) => Promise<void>}
 */
export function useSettingMutation() {
  return useCallback(async (key, value) => {
    await typedDb.settings.put({ id: key, value });
  }, []);
}

/**
 * Reactive hook for category budgets object.
 * Shape: { [categoryId: string]: number }
 *
 * @returns {Record<string, number>|undefined}
 */
export function useCategoryBudgets() {
  return useSetting("categoryBudgets", {});
}

/**
 * Returns stable mutation helpers for category budgets.
 */
export function useCategoryBudgetMutations() {
  const setCategoryBudget = useCallback(
    async (/** @type {string} */ categoryId, /** @type {number} */ amount) => {
      const parsed = Number(amount);
      if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error("Category budget must be a valid number.");
      }

      const existing = await typedDb.settings.get("categoryBudgets");
      const budgets =
        existing && existing.value && typeof existing.value === "object"
          ? { ...existing.value }
          : {};

      budgets[categoryId] = parsed;
      await typedDb.settings.put({ id: "categoryBudgets", value: budgets });
    },
    [],
  );

  const clearCategoryBudget = useCallback(
    async (/** @type {string} */ categoryId) => {
      const existing = await typedDb.settings.get("categoryBudgets");
      const budgets =
        existing && existing.value && typeof existing.value === "object"
          ? { ...existing.value }
          : {};

      if (budgets[categoryId] === undefined) return;
      delete budgets[categoryId];
      await typedDb.settings.put({ id: "categoryBudgets", value: budgets });
    },
    [],
  );

  return {
    setCategoryBudget,
    clearCategoryBudget,
  };
}

// ─── Analytics helpers (reactive) ─────────────────────────────────────────────

/**
 * Compute summary statistics for a given month.
 *
 * @param {string} month - "YYYY-MM"
 * @returns {{
 *   total: number,
 *   count: number,
 *   highest: Expense|null,
 *   average: number,
 *   byCategory: Record<string, number>,
 * }|undefined}
 */
export function useMonthStats(month) {
  return useLiveQuery(async () => {
    if (!isValidMonthKey(month)) {
      return {
        total: 0,
        count: 0,
        highest: null,
        average: 0,
        byCategory: /** @type {Record<string, number>} */ ({}),
      };
    }

    const expenses = /** @type {Expense[]} */ (
      await typedDb.expenses.where("month").equals(month).toArray()
    );

    if (expenses.length === 0) {
      return {
        total: 0,
        count: 0,
        highest: null,
        average: 0,
        byCategory: /** @type {Record<string, number>} */ ({}),
      };
    }

    let total = 0;
    let highest = expenses[0];
    const byCategory = /** @type {Record<string, number>} */ ({});

    for (const exp of expenses) {
      total += exp.amount;

      if (exp.amount > highest.amount) {
        highest = exp;
      }

      const cat = exp.category || "other";
      byCategory[cat] = (byCategory[cat] ?? 0) + exp.amount;
    }

    return {
      total,
      count: expenses.length,
      highest,
      average: total / expenses.length,
      byCategory,
    };
  }, [month]);
}

/**
 * Compute totals for the last N months (including the given month).
 * Returns an array of { month, total } sorted oldest-first, for charting.
 *
 * @param {string} currentMonthKey - "YYYY-MM"
 * @param {number} lookback         - Number of months to include (default 6)
 * @returns {{ month: string, total: number }[]|undefined}
 */
export function useMonthlyTrend(currentMonthKey, lookback = 6) {
  return useLiveQuery(async () => {
    if (!isValidMonthKey(currentMonthKey)) return [];

    // Build the list of month keys to query
    const months = [];
    const [baseYear, baseMonth] = currentMonthKey.split("-").map(Number);

    for (let i = lookback - 1; i >= 0; i--) {
      const d = new Date(baseYear, baseMonth - 1 - i, 1);
      months.push(toMonthKey(d));
    }

    // Fetch all expenses in the range in one query
    const expenses =
      months.length > 0
        ? /** @type {Expense[]} */ (
            await typedDb.expenses.where("month").anyOf(months).toArray()
          )
        : [];

    // Aggregate by month
    const totals = Object.fromEntries(months.map((m) => [m, 0]));
    for (const exp of expenses) {
      if (totals[exp.month] !== undefined) {
        totals[exp.month] += exp.amount;
      }
    }

    return months.map((m) => ({ month: m, total: totals[m] }));
  }, [currentMonthKey, lookback]);
}

/**
 * Compute top category trend over the last N months.
 *
 * @param {string} currentMonthKey
 * @param {number} lookback
 * @param {number} limit
 * @returns {{ months: string[], series: Array<{ categoryId: string, total: number, points: Array<{ month: string, total: number }> }> }|undefined}
 */
export function useCategoryTrend(currentMonthKey, lookback = 6, limit = 4) {
  return useLiveQuery(async () => {
    if (!isValidMonthKey(currentMonthKey)) {
      return { months: [], series: [] };
    }

    const months = /** @type {string[]} */ ([]);
    const [baseYear, baseMonth] = currentMonthKey.split("-").map(Number);

    for (let i = lookback - 1; i >= 0; i--) {
      const d = new Date(baseYear, baseMonth - 1 - i, 1);
      months.push(toMonthKey(d));
    }

    const expenses =
      months.length > 0
        ? /** @type {Expense[]} */ (
            await typedDb.expenses.where("month").anyOf(months).toArray()
          )
        : [];

    const totalsByCategory = /** @type {Record<string, number>} */ ({});
    const byMonthByCategory =
      /** @type {Record<string, Record<string, number>>} */ ({});

    for (const exp of expenses) {
      const categoryId = exp.category || "other";
      totalsByCategory[categoryId] =
        (totalsByCategory[categoryId] ?? 0) + exp.amount;

      if (!byMonthByCategory[categoryId]) {
        byMonthByCategory[categoryId] = Object.fromEntries(
          months.map((m) => [m, 0]),
        );
      }
      byMonthByCategory[categoryId][exp.month] =
        (byMonthByCategory[categoryId][exp.month] ?? 0) + exp.amount;
    }

    const topCategories = Object.entries(totalsByCategory)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit);

    const series = topCategories.map(([categoryId, total]) => ({
      categoryId,
      total,
      points: months.map((month) => ({
        month,
        total: byMonthByCategory[categoryId]?.[month] ?? 0,
      })),
    }));

    return { months, series };
  }, [currentMonthKey, lookback, limit]);
}

/**
 * Compute spend distribution by weekday for a given month.
 *
 * @param {string} month
 * @returns {Array<{ day: number, total: number, count: number }>|undefined}
 */
export function useWeekdaySpendDistribution(month) {
  return useLiveQuery(async () => {
    if (!isValidMonthKey(month)) {
      return Array.from({ length: 7 }, (_, day) => ({
        day,
        total: 0,
        count: 0,
      }));
    }

    const expenses = /** @type {Expense[]} */ (
      await typedDb.expenses.where("month").equals(month).toArray()
    );

    const days = Array.from({ length: 7 }, (_, day) => ({
      day,
      total: 0,
      count: 0,
    }));

    for (const exp of expenses) {
      const date = new Date(exp.createdAt);
      if (Number.isNaN(date.getTime())) continue;
      const dayIndex = date.getDay();
      days[dayIndex].total += exp.amount;
      days[dayIndex].count += 1;
    }

    return days;
  }, [month]);
}

/**
 * Compute global and category-level budget variance for the selected month.
 *
 * @param {string} month
 * @param {number|null|undefined} monthlyBudget
 * @param {Record<string, number>|null|undefined} categoryBudgets
 * @returns {{
 *   global: { budget: number, spent: number, variance: number, pct: number } | null,
 *   categories: Array<{ categoryId: string, budget: number, spent: number, variance: number, pct: number }>
 * }|undefined}
 */
export function useBudgetVariance(month, monthlyBudget, categoryBudgets) {
  return useLiveQuery(async () => {
    if (!isValidMonthKey(month)) {
      return {
        global: null,
        categories: [],
      };
    }

    const expenses = /** @type {Expense[]} */ (
      await typedDb.expenses.where("month").equals(month).toArray()
    );

    const spentByCategory = /** @type {Record<string, number>} */ ({});
    let totalSpent = 0;

    for (const exp of expenses) {
      totalSpent += exp.amount;
      const categoryId = exp.category || "other";
      spentByCategory[categoryId] =
        (spentByCategory[categoryId] ?? 0) + exp.amount;
    }

    const categoryRows = Object.entries(categoryBudgets || {})
      .filter(([, value]) => Number(value) > 0)
      .map(([categoryId, budget]) => {
        const numericBudget = Number(budget);
        const spent = spentByCategory[categoryId] ?? 0;
        const variance = numericBudget - spent;
        const pct = numericBudget > 0 ? (spent / numericBudget) * 100 : 0;
        return {
          categoryId,
          budget: numericBudget,
          spent,
          variance,
          pct,
        };
      })
      .sort((a, b) => b.pct - a.pct);

    const global =
      monthlyBudget && Number(monthlyBudget) > 0
        ? {
            budget: Number(monthlyBudget),
            spent: totalSpent,
            variance: Number(monthlyBudget) - totalSpent,
            pct: (totalSpent / Number(monthlyBudget)) * 100,
          }
        : null;

    return {
      global,
      categories: categoryRows,
    };
  }, [month, monthlyBudget, categoryBudgets]);
}

/** @param {string} targetMonthKey @param {number} lookback */
function buildMonthsAround(targetMonthKey, lookback = 6) {
  if (!isValidMonthKey(targetMonthKey) || lookback <= 0) return [];

  const months = [];
  const [baseYear, baseMonth] = targetMonthKey.split("-").map(Number);
  for (let i = lookback - 1; i >= 0; i--) {
    const d = new Date(baseYear, baseMonth - 1 - i, 1);
    months.push(toMonthKey(d));
  }
  return months;
}

/** @param {string} monthKey */
function getMonthDayStats(monthKey) {
  if (!isValidMonthKey(monthKey)) {
    return {
      daysInMonth: 30,
      elapsedDays: 0,
      remainingDays: 30,
    };
  }

  const [y, m] = monthKey.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const today = new Date();
  const current = currentMonth();
  let elapsedDays = 0;

  if (monthKey < current) {
    elapsedDays = daysInMonth;
  } else if (monthKey === current) {
    elapsedDays = today.getDate();
  }

  return {
    daysInMonth,
    elapsedDays,
    remainingDays: Math.max(daysInMonth - elapsedDays, 0),
  };
}

/**
 * Compute budget health and pace for a selected month.
 *
 * @param {string} month
 * @param {number|null|undefined} monthlyBudget
 * @returns {{
 *   spent: number,
 *   budget: number|null,
 *   remaining: number|null,
 *   pct: number|null,
 *   allowedDaily: number|null,
 *   actualDaily: number|null,
 *   expectedToDate: number|null,
 *   elapsedDays: number,
 *   daysInMonth: number,
 *   remainingDays: number,
 *   status: "none" | "on-track" | "watch" | "over"
 * }|undefined}
 */
export function useBudgetHealth(month, monthlyBudget) {
  return useLiveQuery(async () => {
    if (!isValidMonthKey(month)) {
      return {
        spent: 0,
        budget: null,
        remaining: null,
        pct: null,
        allowedDaily: null,
        actualDaily: null,
        expectedToDate: null,
        elapsedDays: 0,
        daysInMonth: 30,
        remainingDays: 30,
        status: "none",
      };
    }

    const expenses = /** @type {Expense[]} */ (
      await typedDb.expenses.where("month").equals(month).toArray()
    );

    const spent = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const monthStats = getMonthDayStats(month);

    if (!monthlyBudget || Number(monthlyBudget) <= 0) {
      return {
        spent,
        budget: null,
        remaining: null,
        pct: null,
        allowedDaily: null,
        actualDaily:
          monthStats.elapsedDays > 0 ? spent / monthStats.elapsedDays : null,
        expectedToDate: null,
        elapsedDays: monthStats.elapsedDays,
        daysInMonth: monthStats.daysInMonth,
        remainingDays: monthStats.remainingDays,
        status: "none",
      };
    }

    const budget = Number(monthlyBudget);
    const remaining = budget - spent;
    const pct = budget > 0 ? (spent / budget) * 100 : null;
    const allowedDaily = budget / monthStats.daysInMonth;
    const actualDaily =
      monthStats.elapsedDays > 0 ? spent / monthStats.elapsedDays : 0;
    const expectedToDate = allowedDaily * monthStats.elapsedDays;

    let status = /** @type {"none" | "on-track" | "watch" | "over"} */ (
      "on-track"
    );
    if (spent > budget) {
      status = "over";
    } else if (actualDaily > allowedDaily * 1.15) {
      status = "watch";
    }

    return {
      spent,
      budget,
      remaining,
      pct,
      allowedDaily,
      actualDaily,
      expectedToDate,
      elapsedDays: monthStats.elapsedDays,
      daysInMonth: monthStats.daysInMonth,
      remainingDays: monthStats.remainingDays,
      status,
    };
  }, [month, monthlyBudget]);
}

/**
 * Compute daily burn rate signal for the selected month.
 *
 * @param {string} month
 * @param {number|null|undefined} monthlyBudget
 * @returns {{
 *   actualDaily: number,
 *   allowedDaily: number|null,
 *   paceRatio: number|null,
 *   warning: "none" | "watch" | "critical",
 *   elapsedDays: number,
 *   remainingDays: number,
 * }|undefined}
 */
export function useDailyBurnRate(month, monthlyBudget) {
  const health = useBudgetHealth(month, monthlyBudget);

  return useMemo(() => {
    if (!health) return undefined;
    const allowedDaily = health.allowedDaily;
    const actualDaily = Number(health.actualDaily ?? 0);
    const paceRatio =
      allowedDaily && allowedDaily > 0 ? actualDaily / allowedDaily : null;

    let warning = /** @type {"none" | "watch" | "critical"} */ ("none");
    if (paceRatio !== null && paceRatio >= 1.25) {
      warning = "critical";
    } else if (paceRatio !== null && paceRatio >= 1.1) {
      warning = "watch";
    }

    return {
      actualDaily,
      allowedDaily,
      paceRatio,
      warning,
      elapsedDays: health.elapsedDays,
      remainingDays: health.remainingDays,
    };
  }, [health]);
}

/**
 * Estimate month-end spend using recent trend and recurring contribution.
 *
 * @param {string} month
 * @param {number|null|undefined} monthlyBudget
 * @param {number} lookback
 * @returns {{
 *   forecast: number,
 *   baseline: number,
 *   recurringContribution: number,
 *   confidence: "low" | "medium" | "high",
 *   deltaVsBudget: number | null,
 * }|undefined}
 */
export function useMonthForecast(month, monthlyBudget, lookback = 6) {
  return useLiveQuery(async () => {
    if (!isValidMonthKey(month)) {
      return {
        forecast: 0,
        baseline: 0,
        recurringContribution: 0,
        confidence: "low",
        deltaVsBudget: null,
      };
    }

    const months = buildMonthsAround(month, lookback + 1);
    const historyMonths = months.slice(0, -1);

    const expenses =
      historyMonths.length > 0
        ? /** @type {Expense[]} */ (
            await typedDb.expenses.where("month").anyOf(historyMonths).toArray()
          )
        : [];

    const totals = Object.fromEntries(historyMonths.map((m) => [m, 0]));
    for (const exp of expenses) {
      if (totals[exp.month] !== undefined) {
        totals[exp.month] += exp.amount;
      }
    }

    const series = historyMonths.map((m) => totals[m] ?? 0);
    const baseline =
      series.length > 0
        ? series.reduce((sum, v) => sum + v, 0) / series.length
        : 0;

    const recurring = /** @type {RecurringTemplate[]} */ (
      await typedDb.recurring.toArray()
    );
    const recurringContribution = recurring
      .filter((tpl) => tpl.enabled && tpl.startMonth <= month)
      .reduce((sum, tpl) => sum + Number(tpl.amount || 0), 0);

    const forecast =
      recurringContribution > 0
        ? baseline * 0.65 + recurringContribution * 0.35
        : baseline;

    const variance =
      series.length > 0
        ? series.reduce((sum, v) => sum + (v - baseline) ** 2, 0) /
          series.length
        : 0;
    const std = Math.sqrt(variance);
    const cv = baseline > 0 ? std / baseline : 1;

    let confidence = /** @type {"low" | "medium" | "high"} */ ("low");
    if (series.length >= 4 && cv < 0.25) {
      confidence = "high";
    } else if (series.length >= 3 && cv < 0.45) {
      confidence = "medium";
    }

    const deltaVsBudget =
      monthlyBudget && Number(monthlyBudget) > 0
        ? forecast - Number(monthlyBudget)
        : null;

    return {
      forecast,
      baseline,
      recurringContribution,
      confidence,
      deltaVsBudget,
    };
  }, [month, monthlyBudget, lookback]);
}

/**
 * Build an export-ready analytics snapshot for the selected month.
 *
 * @param {string} month
 * @param {string} currency
 * @param {number|null|undefined} monthlyBudget
 * @param {Record<string, number>|null|undefined} categoryBudgets
 * @returns {{
 *   meta: { generatedAt: string, month: string, currency: string },
 *   summary: { total: number, count: number, average: number, highest: number },
 *   budget: { monthlyBudget: number | null, spent: number, remaining: number | null, pct: number | null },
 *   categories: Array<{ categoryId: string, total: number }>,
 *   trend6: Array<{ month: string, total: number }>,
 * }|undefined}
 */
export function useAnalyticsExportSnapshot(
  month,
  currency,
  monthlyBudget,
  categoryBudgets,
) {
  return useLiveQuery(async () => {
    if (!isValidMonthKey(month)) {
      return {
        meta: {
          generatedAt: new Date().toISOString(),
          month: currentMonth(),
          currency,
        },
        summary: {
          total: 0,
          count: 0,
          average: 0,
          highest: 0,
        },
        budget: {
          monthlyBudget: null,
          spent: 0,
          remaining: null,
          pct: null,
        },
        categories: [],
        trend6: [],
        categoryBudgets: categoryBudgets || {},
      };
    }

    const trendMonths = buildMonthsAround(month, 6);
    const [monthExpenses, trendExpenses] = await Promise.all([
      /** @type {Promise<Expense[]>} */ (
        typedDb.expenses.where("month").equals(month).toArray()
      ),
      trendMonths.length > 0
        ? /** @type {Promise<Expense[]>} */ (
            typedDb.expenses.where("month").anyOf(trendMonths).toArray()
          )
        : Promise.resolve([]),
    ]);

    const total = monthExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const count = monthExpenses.length;
    const average = count > 0 ? total / count : 0;
    const highest =
      count > 0
        ? monthExpenses.reduce((max, exp) => Math.max(max, exp.amount), 0)
        : 0;

    const byCategory = /** @type {Record<string, number>} */ ({});
    for (const exp of monthExpenses) {
      const cat = exp.category || "other";
      byCategory[cat] = (byCategory[cat] ?? 0) + exp.amount;
    }

    const categories = Object.entries(byCategory)
      .map(([categoryId, amount]) => ({ categoryId, total: amount }))
      .sort((a, b) => b.total - a.total);

    const months = trendMonths;
    const trendMap = Object.fromEntries(months.map((m) => [m, 0]));
    for (const exp of trendExpenses) {
      if (trendMap[exp.month] !== undefined) {
        trendMap[exp.month] += exp.amount;
      }
    }

    const trend6 = months.map((m) => ({ month: m, total: trendMap[m] ?? 0 }));

    const budget =
      monthlyBudget && Number(monthlyBudget) > 0 ? Number(monthlyBudget) : null;

    const spent = total;
    const remaining = budget !== null ? budget - spent : null;
    const pct = budget !== null && budget > 0 ? (spent / budget) * 100 : null;

    return {
      meta: {
        generatedAt: new Date().toISOString(),
        month,
        currency,
      },
      summary: {
        total,
        count,
        average,
        highest,
      },
      budget: {
        monthlyBudget: budget,
        spent,
        remaining,
        pct,
      },
      categories,
      trend6,
      categoryBudgets: categoryBudgets || {},
    };
  }, [month, currency, monthlyBudget, categoryBudgets]);
}

/**
 * Detect unusual spending patterns for the selected month.
 *
 * @param {string} month
 * @param {number} lookback
 * @returns {{
 *   monthly: { kind: "spike" | "drop", current: number, baseline: number, changePct: number } | null,
 *   categories: Array<{ categoryId: string, current: number, baseline: number, changePct: number }>
 * }|undefined}
 */
export function useSpendingAnomalies(month, lookback = 6) {
  return useLiveQuery(async () => {
    if (!isValidMonthKey(month)) {
      return {
        monthly: null,
        categories: [],
      };
    }

    const months = [];
    const [baseYear, baseMonth] = month.split("-").map(Number);

    for (let i = lookback - 1; i >= 0; i--) {
      const d = new Date(baseYear, baseMonth - 1 - i, 1);
      months.push(toMonthKey(d));
    }

    const expenses =
      months.length > 0
        ? /** @type {Expense[]} */ (
            await typedDb.expenses.where("month").anyOf(months).toArray()
          )
        : [];

    const monthlyTotals = Object.fromEntries(months.map((m) => [m, 0]));
    const currentByCategory = /** @type {Record<string, number>} */ ({});
    const previousByCategoryMonth =
      /** @type {Record<string, Record<string, number>>} */ ({});

    for (const exp of expenses) {
      monthlyTotals[exp.month] = (monthlyTotals[exp.month] ?? 0) + exp.amount;
      const categoryId = exp.category || "other";

      if (exp.month === month) {
        currentByCategory[categoryId] =
          (currentByCategory[categoryId] ?? 0) + exp.amount;
      } else {
        if (!previousByCategoryMonth[categoryId]) {
          previousByCategoryMonth[categoryId] = {};
        }
        previousByCategoryMonth[categoryId][exp.month] =
          (previousByCategoryMonth[categoryId][exp.month] ?? 0) + exp.amount;
      }
    }

    const currentTotal = monthlyTotals[month] ?? 0;
    const previousTotals = months
      .filter((m) => m !== month)
      .map((m) => monthlyTotals[m] ?? 0)
      .filter((value) => value > 0);

    let monthly = null;
    if (previousTotals.length >= 2 && currentTotal > 0) {
      const baseline =
        previousTotals.reduce((sum, value) => sum + value, 0) /
        previousTotals.length;
      if (baseline > 0) {
        const changePct = ((currentTotal - baseline) / baseline) * 100;
        if (changePct >= 35) {
          monthly = {
            kind: /** @type {"spike"} */ ("spike"),
            current: currentTotal,
            baseline,
            changePct,
          };
        } else if (changePct <= -30) {
          monthly = {
            kind: /** @type {"drop"} */ ("drop"),
            current: currentTotal,
            baseline,
            changePct,
          };
        }
      }
    }

    const categories = Object.entries(currentByCategory)
      .map(([categoryId, current]) => {
        const history = Object.values(
          previousByCategoryMonth[categoryId] ?? {},
        ).filter((value) => value > 0);
        if (history.length < 2) return null;

        const baseline =
          history.reduce((sum, value) => sum + value, 0) / history.length;
        if (baseline <= 0) return null;
        const changePct = ((current - baseline) / baseline) * 100;
        if (changePct < 50) return null;

        return {
          categoryId,
          current,
          baseline,
          changePct,
        };
      })
      .filter((row) => row !== null)
      .sort((a, b) => b.changePct - a.changePct)
      .slice(0, 3);

    return {
      monthly,
      categories,
    };
  }, [month, lookback]);
}

/**
 * Detect potentially recurring expenses by finding names that appear
 * in at least `minMonths` different months.
 *
 * Returns an array of { name, months, amounts, avgAmount } sorted by frequency.
 *
 * @param {number} minMonths - Minimum months a name must appear in (default 2)
 * @returns {{ name: string, months: string[], amounts: number[], avgAmount: number }[]|undefined}
 */
export function useRecurringExpenses(minMonths = 2) {
  return useLiveQuery(async () => {
    const all = /** @type {Expense[]} */ (
      await typedDb.expenses.orderBy("month").toArray()
    );

    // Group by normalised name
    const nameMap =
      /** @type {Record<string, { name: string, months: string[], amounts: number[] }>} */ ({});
    for (const exp of all) {
      const key = exp.name.toLowerCase().trim();
      if (!nameMap[key]) {
        nameMap[key] = { name: exp.name, months: [], amounts: [] };
      }
      if (!nameMap[key].months.includes(exp.month)) {
        nameMap[key].months.push(exp.month);
      }
      nameMap[key].amounts.push(exp.amount);
    }

    return Object.values(nameMap)
      .filter((g) => g.months.length >= minMonths)
      .map((g) => ({
        name: g.name,
        months: g.months.sort(),
        amounts: g.amounts,
        avgAmount:
          g.amounts.reduce(
            (/** @type {number} */ s, /** @type {number} */ a) => s + a,
            0,
          ) / g.amounts.length,
      }))
      .sort((a, b) => b.months.length - a.months.length);
  });
}

/**
 * Fetch all recurring templates.
 *
 * @returns {RecurringTemplate[]|undefined}
 */
export function useRecurringTemplates() {
  return useLiveQuery(() =>
    typedDb.recurring.orderBy("createdAt").reverse().toArray(),
  );
}

/**
 * Returns stable mutation helpers for recurring templates.
 */
export function useRecurringTemplateMutations() {
  const createRecurringTemplate = useCallback(
    async (
      /** @type {{ name: string, amount: number, category?: string, startMonth?: string }} */ data,
    ) => {
      const now = new Date().toISOString();
      const template = {
        id: uuidv4(),
        name: data.name.trim(),
        amount: Number(data.amount),
        category: data.category ?? "",
        frequency: "monthly",
        startMonth: data.startMonth ?? currentMonth(),
        enabled: true,
        lastGeneratedMonth: null,
        createdAt: now,
        updatedAt: now,
      };

      await typedDb.recurring.add(template);
      return template.id;
    },
    [],
  );

  const updateRecurringTemplate = useCallback(
    async (
      /** @type {string} */ id,
      /** @type {Partial<RecurringTemplate>} */ changes,
    ) => {
      const safeChanges = { ...changes, updatedAt: new Date().toISOString() };
      delete safeChanges.id;
      delete safeChanges.createdAt;
      if (safeChanges.amount !== undefined) {
        safeChanges.amount = Number(safeChanges.amount);
      }
      if (safeChanges.name !== undefined) {
        safeChanges.name = safeChanges.name.trim();
      }
      return typedDb.recurring.update(id, safeChanges);
    },
    [],
  );

  const deleteRecurringTemplate = useCallback(
    async (/** @type {string} */ id) => {
      await typedDb.recurring.delete(id);
    },
    [],
  );

  const toggleRecurringTemplate = useCallback(
    async (/** @type {string} */ id, /** @type {boolean} */ enabled) => {
      return typedDb.recurring.update(id, {
        enabled,
        updatedAt: new Date().toISOString(),
      });
    },
    [],
  );

  return {
    createRecurringTemplate,
    updateRecurringTemplate,
    deleteRecurringTemplate,
    toggleRecurringTemplate,
  };
}
