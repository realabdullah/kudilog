import Dexie from "dexie";

// ─── Schema Version History ───────────────────────────────────────────────────
// v1: initial schema – expenses + settings tables
// v3: categories table + budgets table (month-specific)

export const SCHEMA_VERSION = 3;

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

db.version(3).stores({
  expenses: "id, month, category, createdAt, updatedAt, recurringId",
  settings: "id",
  recurring:
    "id, enabled, frequency, startMonth, lastGeneratedMonth, createdAt, updatedAt",
  categories: "id, label, emoji, createdAt",
  budgets: "id", // id = month (YYYY-MM)
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
    { id: "hideMonetaryValues", value: false },
    { id: "lock.enabled", value: false },
    { id: "lock.pinHash", value: null },
    { id: "lock.pinSalt", value: null },
    { id: "lock.pinParams", value: null },
    { id: "lock.securityQuestions", value: null },
    { id: "lock.sessionTimeoutMinutes", value: 5 },
    { id: "lock.lockedUntil", value: null },
  ];

  await typedDb.transaction(
    "rw",
    typedDb.settings,
    typedDb.categories,
    async () => {
      // 1. Settings
      for (const def of defaults) {
        const existing = await typedDb.settings.get(def.id);
        if (!existing) {
          await typedDb.settings.put(def);
        }
      }

      // 2. Default Categories
      const catCount = await typedDb.categories.count();
      if (catCount === 0) {
        const defaultCategories = [
          {
            id: "food",
            label: "Food & Dining",
            emoji: "🍽️",
            createdAt: new Date().toISOString(),
          },
          {
            id: "transport",
            label: "Transport",
            emoji: "🚗",
            createdAt: new Date().toISOString(),
          },
          {
            id: "entertainment",
            label: "Entertainment",
            emoji: "🎬",
            createdAt: new Date().toISOString(),
          },
          {
            id: "shopping",
            label: "Shopping",
            emoji: "🛍️",
            createdAt: new Date().toISOString(),
          },
          {
            id: "health",
            label: "Health",
            emoji: "💊",
            createdAt: new Date().toISOString(),
          },
          {
            id: "bills",
            label: "Bills & Utilities",
            emoji: "💡",
            createdAt: new Date().toISOString(),
          },
          {
            id: "education",
            label: "Education",
            emoji: "📚",
            createdAt: new Date().toISOString(),
          },
          {
            id: "personal",
            label: "Personal Care",
            emoji: "✨",
            createdAt: new Date().toISOString(),
          },
          {
            id: "travel",
            label: "Travel",
            emoji: "✈️",
            createdAt: new Date().toISOString(),
          },
          {
            id: "other",
            label: "Other",
            emoji: "📦",
            createdAt: new Date().toISOString(),
          },
        ];
        await typedDb.categories.bulkAdd(defaultCategories);
      }
    },
  );
}
