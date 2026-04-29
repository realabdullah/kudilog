import { v4 as uuidv4 } from "uuid";
import { db } from "../db/db";
import { currentMonth, parseMonthKey, toMonthKey } from "./formatters";

const typedDb = /** @type {any} */ (db);

function compareMonthKeys(a, b) {
  return a.localeCompare(b);
}

function nextMonthKey(monthKey) {
  const date = parseMonthKey(monthKey);
  date.setMonth(date.getMonth() + 1);
  return toMonthKey(date);
}

function listMonthKeys(startMonth, endMonth) {
  if (compareMonthKeys(startMonth, endMonth) > 0) return [];

  const months = [];
  let cursor = startMonth;

  while (compareMonthKeys(cursor, endMonth) <= 0) {
    months.push(cursor);
    cursor = nextMonthKey(cursor);
  }

  return months;
}

function buildRecurringExpense(template, monthKey) {
  const createdAt = new Date(`${monthKey}-01T09:00:00.000Z`).toISOString();
  return {
    id: uuidv4(),
    name: template.name,
    amount: Number(template.amount),
    category: template.category ?? "",
    month: monthKey,
    createdAt,
    updatedAt: createdAt,
    recurringId: template.id,
  };
}

/**
 * Generate due recurring expenses up to a target month.
 * Idempotent by recurringId + month.
 *
 * @param {string} targetMonth
 * @returns {Promise<{ created: number, synced: number }>}
 */
export async function syncRecurringExpensesToMonth(
  targetMonth = currentMonth(),
) {
  const templates = /** @type {import("../db/db").RecurringTemplate[]} */ (
    await typedDb.recurring.toArray()
  );

  const enabledTemplates = templates.filter((template) => template.enabled);
  if (enabledTemplates.length === 0) {
    return { created: 0, synced: 0 };
  }

  const earliestMonth = enabledTemplates.reduce((min, template) => {
    if (!min) return template.startMonth;
    return compareMonthKeys(template.startMonth, min) < 0
      ? template.startMonth
      : min;
  }, "");

  const monthsToInspect = listMonthKeys(earliestMonth, targetMonth);
  const existingExpenses = /** @type {import("../db/db").Expense[]} */ (
    await typedDb.expenses.where("month").anyOf(monthsToInspect).toArray()
  );
  const existingKeys = new Set(
    existingExpenses
      .filter(
        (expense) =>
          typeof expense.recurringId === "string" && expense.recurringId,
      )
      .map((expense) => `${expense.recurringId}:${expense.month}`),
  );

  const expensesToCreate = [];
  const templatesToUpdate = [];

  for (const template of enabledTemplates) {
    const startMonth = template.lastGeneratedMonth
      ? nextMonthKey(template.lastGeneratedMonth)
      : template.startMonth;

    if (compareMonthKeys(startMonth, targetMonth) > 0) {
      continue;
    }

    const dueMonths = listMonthKeys(startMonth, targetMonth);
    let latestGenerated = template.lastGeneratedMonth;

    for (const monthKey of dueMonths) {
      const dedupeKey = `${template.id}:${monthKey}`;
      if (!existingKeys.has(dedupeKey)) {
        expensesToCreate.push(buildRecurringExpense(template, monthKey));
        existingKeys.add(dedupeKey);
      }
      latestGenerated = monthKey;
    }

    if (latestGenerated && latestGenerated !== template.lastGeneratedMonth) {
      templatesToUpdate.push({
        ...template,
        lastGeneratedMonth: latestGenerated,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  await typedDb.transaction(
    "rw",
    typedDb.expenses,
    typedDb.recurring,
    async () => {
      if (expensesToCreate.length > 0) {
        await typedDb.expenses.bulkPut(expensesToCreate);
      }
      if (templatesToUpdate.length > 0) {
        await typedDb.recurring.bulkPut(templatesToUpdate);
      }
    },
  );

  return {
    created: expensesToCreate.length,
    synced: templatesToUpdate.length,
  };
}
