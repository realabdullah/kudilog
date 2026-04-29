import Dexie from "dexie";

// ─── Schema Version History ───────────────────────────────────────────────────
// v1: initial schema – expenses + settings tables

export const SCHEMA_VERSION = 1;

export const db = new Dexie("kudilog");

db.version(1).stores({
  // Primary key: id (uuid string)
  // Indexed fields: month, category, createdAt
  expenses: "id, month, category, createdAt, updatedAt",

  // Key-value store for app settings (id = setting key)
  settings: "id",
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
    { id: "monthlyBudget", value: null },   // null = no limit set
    { id: "theme", value: "dark" },
  ];

  await db.transaction("rw", db.settings, async () => {
    for (const def of defaults) {
      const existing = await db.settings.get(def.id);
      if (!existing) {
        await db.settings.put(def);
      }
    }
  });
}
