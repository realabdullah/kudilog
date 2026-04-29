import Dexie from "dexie";

// ─── Schema Version History ───────────────────────────────────────────────────
// v1: initial schema – expenses + settings tables
// v2: recurring templates table + recurringId expense index

export const SCHEMA_VERSION = 2;

export const db = new Dexie("kudilog");
const typedDb = /** @type {any} */ (db);

db.version(1).stores({
  // Primary key: id (uuid string)
  // Indexed fields: month, category, createdAt
  expenses: "id, month, category, createdAt, updatedAt",

  // Key-value store for app settings (id = setting key)
  settings: "id",
});

db.version(2).stores({
  expenses: "id, month, category, createdAt, updatedAt, recurringId",
  settings: "id",
  recurring:
    "id, enabled, frequency, startMonth, lastGeneratedMonth, createdAt, updatedAt",
});

// ─── Typed helpers ─────────────────────────────────────────────────────────────

/**
 * @typedef {Object} Expense
 * @property {string}  id          - UUID v4
 * @property {string}  name        - Human-readable label
 * @property {number}  amount      - Amount in smallest currency unit (e.g. kobo / cents)
 *                                   We store as a plain float for simplicity
 * @property {string}  category    - Category slug (or empty string)
 * @property {string}  month       - "YYYY-MM" – auto-assigned at creation
 * @property {string}  createdAt   - ISO 8601
 * @property {string}  updatedAt   - ISO 8601
 * @property {string=} recurringId - Source recurring template ID, if generated automatically
 */

/**
 * @typedef {Object} RecurringTemplate
 * @property {string}  id
 * @property {string}  name
 * @property {number}  amount
 * @property {string}  category
 * @property {"monthly"} frequency
 * @property {string}  startMonth
 * @property {boolean} enabled
 * @property {string|null} lastGeneratedMonth
 * @property {string}  createdAt
 * @property {string}  updatedAt
 */

/**
 * @typedef {Object} Setting
 * @property {string} id    - Setting key
 * @property {*}      value - Setting value (any JSON-serialisable type)
 */

// ─── Seed helpers ──────────────────────────────────────────────────────────────

/** Ensure default settings exist without overwriting user values */
export async function seedDefaultSettings() {
  const defaults = [
    { id: "currency", value: "NGN" },
    { id: "monthlyBudget", value: null }, // null = no limit set
    { id: "categoryBudgets", value: {} }, // { [categoryId]: number }
    { id: "theme", value: "dark" },
  ];

  await typedDb.transaction("rw", typedDb.settings, async () => {
    for (const def of defaults) {
      const existing = await typedDb.settings.get(def.id);
      if (!existing) {
        await typedDb.settings.put(def);
      }
    }
  });
}
