import { db } from "../db/db";

const typedDb = /** @type {any} */ (db);

/**
 * Finds duplicate expenses based on name, amount, and month.
 * @returns {Promise<import("../db/db").Expense[][]>} Array of duplicate groups
 */
export async function findDuplicateExpenses() {
  const allExpenses = await typedDb.expenses.toArray();
  const groups = new Map();

  for (const exp of allExpenses) {
    // Group by name (lowercase, trimmed), amount, and month
    const key = `${exp.name.toLowerCase().trim()}|${exp.amount}|${exp.month}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(exp);
  }

  // Filter only groups with more than one entry
  return Array.from(groups.values()).filter((group) => group.length > 1);
}

/**
 * Runs the deduplication once and sets a flag in settings.
 */
export async function runOnceDedupe() {
  try {
    const hasRun = await typedDb.settings.get("hasRunDedupe");
    if (hasRun && hasRun.value) {
      return { success: true, alreadyRun: true };
    }

    const duplicateGroups = await findDuplicateExpenses();
    let removedCount = 0;

    if (duplicateGroups.length > 0) {
      await typedDb.transaction("rw", typedDb.expenses, async () => {
        for (const group of duplicateGroups) {
          // Keep the first one (usually the one with the earliest createdAt, but order is not guaranteed)
          // To be safe, we sort by createdAt
          group.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
          
          const idsToDelete = group.slice(1).map((exp) => exp.id);
          await typedDb.expenses.bulkDelete(idsToDelete);
          removedCount += idsToDelete.length;
        }
      });
    }

    await typedDb.settings.put({ id: "hasRunDedupe", value: true });
    console.log(`[Dedupe] Removed ${removedCount} duplicate expenses.`);
    return { success: true, alreadyRun: false, removedCount };
  } catch (error) {
    console.error("[Dedupe] Error during deduplication:", error);
    return { success: false, error };
  }
}
