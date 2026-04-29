import { getCategoryLabel } from "./formatters";

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   amount: number,
 *   category?: string,
 *   createdAt: string,
 * }} FilterableExpense
 */

/**
 * @typedef {{
 *   query: string,
 *   categories: string[],
 *   minAmount: string,
 *   maxAmount: string,
 *   startDate: string,
 *   endDate: string,
 * }} ExpenseFilters
 */

/** @param {FilterableExpense[]} expenses @param {"date" | "amount" | "name"} sortBy */
export function sortExpenses(expenses, sortBy) {
  const copy = [...expenses];
  switch (sortBy) {
    case "amount":
      return copy.sort((a, b) => b.amount - a.amount);
    case "name":
      return copy.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      );
    case "date":
    default:
      return copy.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }
}

/** @param {string} value */
function parseAmountInput(value) {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

/** @param {string} isoString */
function toDateOnly(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

/** @param {FilterableExpense} expense @param {ExpenseFilters} filters */
export function matchesExpenseFilters(expense, filters) {
  const query = filters.query.trim().toLowerCase();
  const selectedCategories = filters.categories ?? [];
  const minAmount = parseAmountInput(filters.minAmount);
  const maxAmount = parseAmountInput(filters.maxAmount);
  const expenseDate = toDateOnly(expense.createdAt);

  if (query) {
    const nameMatch = expense.name.toLowerCase().includes(query);
    const categoryMatch = getCategoryLabel(expense.category || "other")
      .toLowerCase()
      .includes(query);
    const amountMatch = String(expense.amount).includes(query);

    if (!nameMatch && !categoryMatch && !amountMatch) {
      return false;
    }
  }

  if (selectedCategories.length > 0) {
    const expenseCategory = expense.category || "other";
    if (!selectedCategories.includes(expenseCategory)) {
      return false;
    }
  }

  if (minAmount != null && expense.amount < minAmount) {
    return false;
  }

  if (maxAmount != null && expense.amount > maxAmount) {
    return false;
  }

  if (filters.startDate && expenseDate && expenseDate < filters.startDate) {
    return false;
  }

  if (filters.endDate && expenseDate && expenseDate > filters.endDate) {
    return false;
  }

  return true;
}

/** @param {FilterableExpense[] | undefined} expenses @param {ExpenseFilters} filters @param {"date" | "amount" | "name"} sortBy */
export function getFilteredExpenses(expenses, filters, sortBy) {
  if (!expenses) return [];
  return sortExpenses(expenses.filter((expense) => matchesExpenseFilters(expense, filters)), sortBy);
}

/** @param {ExpenseFilters} filters */
export function countActiveExpenseFilters(filters) {
  let count = 0;
  if (filters.query.trim()) count += 1;
  if (filters.categories.length > 0) count += 1;
  if (filters.minAmount.trim()) count += 1;
  if (filters.maxAmount.trim()) count += 1;
  if (filters.startDate) count += 1;
  if (filters.endDate) count += 1;
  return count;
}

/** @returns {ExpenseFilters} */
export function createEmptyExpenseFilters() {
  return {
    query: "",
    categories: [],
    minAmount: "",
    maxAmount: "",
    startDate: "",
    endDate: "",
  };
}