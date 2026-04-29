// ─── useExpenses Hook ──────────────────────────────────────────────────────────
//
// Centralised hook for all expense and settings interactions.
// Uses Dexie's useLiveQuery for reactive, real-time updates from IndexedDB.

import { useLiveQuery } from "dexie-react-hooks";
import { useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db/db";
import { currentMonth, toMonthKey } from "../utils/formatters";

// ─── Expenses ──────────────────────────────────────────────────────────────────

/**
 * Fetch all expenses for a given month, sorted newest-first.
 *
 * @param {string} month - "YYYY-MM"
 * @returns {Expense[]|undefined}
 */
export function useMonthExpenses(month) {
  return useLiveQuery(
    () =>
      db.expenses
        .where("month")
        .equals(month)
        .reverse()
        .sortBy("createdAt"),
    [month]
  );
}

/**
 * Fetch all expenses across all months, sorted by month desc then createdAt desc.
 *
 * @returns {Expense[]|undefined}
 */
export function useAllExpenses() {
  return useLiveQuery(() =>
    db.expenses.orderBy("createdAt").reverse().toArray()
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
    const all = await db.expenses.orderBy("month").uniqueKeys();
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
  return useLiveQuery(() => (id ? db.expenses.get(id) : undefined), [id]);
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
  const addExpense = useCallback(async (data) => {
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
    await db.expenses.add(expense);
    return expense.id;
  }, []);

  /**
   * Update an existing expense by ID.
   * Only the provided fields are updated; updatedAt is always refreshed.
   *
   * @param {string} id
   * @param {Partial<Expense>} changes
   * @returns {Promise<number>} Number of records updated (0 or 1)
   */
  const updateExpense = useCallback(async (id, changes) => {
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

    return db.expenses.update(id, safeChanges);
  }, []);

  /**
   * Delete an expense by ID.
   *
   * @param {string} id
   * @returns {Promise<void>}
   */
  const deleteExpense = useCallback(async (id) => {
    await db.expenses.delete(id);
  }, []);

  /**
   * Delete all expenses for a given month.
   *
   * @param {string} month - "YYYY-MM"
   * @returns {Promise<number>} Number of deleted records
   */
  const deleteMonthExpenses = useCallback(async (month) => {
    return db.expenses.where("month").equals(month).delete();
  }, []);

  /**
   * Duplicate an expense (creating a new one with the same fields, timestamped now).
   *
   * @param {string} id
   * @returns {Promise<string|null>} New expense ID, or null if source not found
   */
  const duplicateExpense = useCallback(async (id) => {
    const original = await db.expenses.get(id);
    if (!original) return null;

    const now = new Date().toISOString();
    const duplicate = {
      ...original,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
    };
    await db.expenses.add(duplicate);
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
    const row = await db.settings.get(key);
    return row !== undefined ? row.value : defaultValue;
  }, [key]);
}

/**
 * Reactive hook that returns all settings as a plain object.
 * e.g. { currency: "NGN", monthlyBudget: 50000, theme: "dark" }
 *
 * @returns {Object|undefined}
 */
export function useAllSettings() {
  return useLiveQuery(async () => {
    const rows = await db.settings.toArray();
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
    await db.settings.put({ id: key, value });
  }, []);
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
    const expenses = await db.expenses
      .where("month")
      .equals(month)
      .toArray();

    if (expenses.length === 0) {
      return {
        total: 0,
        count: 0,
        highest: null,
        average: 0,
        byCategory: {},
      };
    }

    let total = 0;
    let highest = expenses[0];
    const byCategory = {};

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
    // Build the list of month keys to query
    const months = [];
    const [baseYear, baseMonth] = currentMonthKey.split("-").map(Number);

    for (let i = lookback - 1; i >= 0; i--) {
      const d = new Date(baseYear, baseMonth - 1 - i, 1);
      months.push(toMonthKey(d));
    }

    // Fetch all expenses in the range in one query
    const expenses = await db.expenses
      .where("month")
      .anyOf(months)
      .toArray();

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
    const all = await db.expenses.orderBy("month").toArray();

    // Group by normalised name
    const nameMap = {};
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
        avgAmount: g.amounts.reduce((s, a) => s + a, 0) / g.amounts.length,
      }))
      .sort((a, b) => b.months.length - a.months.length);
  });
}
