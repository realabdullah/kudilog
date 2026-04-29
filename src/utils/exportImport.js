// ─── Export / Import Utilities ─────────────────────────────────────────────────
//
// Export: serialise all IndexedDB data to a structured JSON file
// Import: validate and restore / merge data from a JSON file
//
// The exported format is intentionally backend-ready:
// {
//   "meta": {
//     "appName": "kudilog",
//     "schemaVersion": 1,
//     "exportedAt": "<ISO 8601>",
//     "recordCount": { "expenses": 42, "settings": 3 }
//   },
//   "data": {
//     "expenses": [ ...Expense ],
//     "settings": [ ...Setting ]
//   }
// }

import { db, SCHEMA_VERSION } from "../db/db";

// ─── Export ────────────────────────────────────────────────────────────────────

/**
 * Collect all data from IndexedDB and return a serialisable export object.
 *
 * @returns {Promise<Object>} The full export payload
 */
export async function buildExportPayload() {
  const [expenses, settings] = await Promise.all([
    db.expenses.orderBy("createdAt").toArray(),
    db.settings.toArray(),
  ]);

  return {
    meta: {
      appName: "kudilog",
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      recordCount: {
        expenses: expenses.length,
        settings: settings.length,
      },
    },
    data: {
      expenses,
      settings,
    },
  };
}

/**
 * Trigger a JSON file download in the browser containing all app data.
 *
 * @returns {Promise<{ count: number }>} Number of exported expenses
 */
export async function exportToJSON() {
  const payload = await buildExportPayload();
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const now = new Date();
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const filename = `kudilog-export-${stamp}.json`;

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  // Release the object URL after a short delay
  setTimeout(() => URL.revokeObjectURL(url), 10_000);

  return { count: payload.meta.recordCount.expenses };
}

// ─── Validation ────────────────────────────────────────────────────────────────

/**
 * Validate the top-level shape of an import payload.
 * Throws a descriptive Error if anything is wrong.
 *
 * @param {unknown} payload
 * @returns {{ expenses: Expense[], settings: Setting[], meta: Object }}
 */
function validatePayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid file: expected a JSON object.");
  }

  if (!payload.meta || typeof payload.meta !== "object") {
    throw new Error("Invalid format: missing `meta` field.");
  }

  if (payload.meta.appName !== "kudilog") {
    throw new Error(
      `Unrecognised app: "${payload.meta.appName}". This file was not exported from KudiLog.`
    );
  }

  const fileVersion = payload.meta.schemaVersion;
  if (typeof fileVersion !== "number") {
    throw new Error("Invalid format: `meta.schemaVersion` must be a number.");
  }

  if (fileVersion > SCHEMA_VERSION) {
    throw new Error(
      `This file was exported from a newer version of KudiLog (schema v${fileVersion}). ` +
        `Please update the app to import it.`
    );
  }

  if (!payload.data || typeof payload.data !== "object") {
    throw new Error("Invalid format: missing `data` field.");
  }

  if (!Array.isArray(payload.data.expenses)) {
    throw new Error("Invalid format: `data.expenses` must be an array.");
  }

  // Validate individual expense records (light-touch)
  const invalidIndexes = [];
  for (let i = 0; i < payload.data.expenses.length; i++) {
    const e = payload.data.expenses[i];
    if (
      !e ||
      typeof e !== "object" ||
      typeof e.id !== "string" ||
      typeof e.name !== "string" ||
      typeof e.amount !== "number" ||
      typeof e.month !== "string"
    ) {
      invalidIndexes.push(i);
    }
  }

  if (invalidIndexes.length > 0) {
    throw new Error(
      `${invalidIndexes.length} expense record(s) have missing required fields ` +
        `(id, name, amount, month). Indexes: ${invalidIndexes.slice(0, 5).join(", ")}` +
        (invalidIndexes.length > 5 ? "…" : "")
    );
  }

  return {
    meta: payload.meta,
    expenses: payload.data.expenses,
    settings: Array.isArray(payload.data.settings) ? payload.data.settings : [],
  };
}

// ─── Import ────────────────────────────────────────────────────────────────────

/**
 * Import mode:
 * - "replace" – wipe all existing expenses and settings, then insert the imported data
 * - "merge"   – insert/update imported records without deleting existing ones
 *
 * @typedef {"replace"|"merge"} ImportMode
 */

/**
 * Read a File object and parse it as JSON.
 *
 * @param {File} file
 * @returns {Promise<unknown>}
 */
function readFileAsJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        resolve(JSON.parse(e.target.result));
      } catch {
        reject(new Error("Could not parse file: make sure it is valid JSON."));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read the file."));
    reader.readAsText(file);
  });
}

/**
 * Import a JSON backup file into IndexedDB.
 *
 * @param {File}       file
 * @param {ImportMode} mode  - "replace" or "merge" (default: "merge")
 * @returns {Promise<{ imported: number, mode: ImportMode, meta: Object }>}
 */
export async function importFromJSON(file, mode = "merge") {
  if (!(file instanceof File)) {
    throw new Error("Expected a File object.");
  }

  if (!file.name.endsWith(".json") && file.type !== "application/json") {
    throw new Error("Please select a .json file.");
  }

  const raw = await readFileAsJSON(file);
  const { meta, expenses, settings } = validatePayload(raw);

  await db.transaction("rw", db.expenses, db.settings, async () => {
    if (mode === "replace") {
      await db.expenses.clear();
      await db.settings.clear();
    }

    // bulkPut uses the primary key (id) so duplicate IDs are overwritten
    if (expenses.length > 0) {
      await db.expenses.bulkPut(expenses);
    }

    if (settings.length > 0) {
      await db.settings.bulkPut(settings);
    }
  });

  return { imported: expenses.length, mode, meta };
}

/**
 * Preview what an import would do WITHOUT writing to the database.
 * Useful for showing a confirmation dialog before committing.
 *
 * @param {File} file
 * @returns {Promise<{ meta: Object, expenseCount: number, settingCount: number, valid: boolean, error: string|null }>}
 */
export async function previewImport(file) {
  try {
    const raw = await readFileAsJSON(file);
    const { meta, expenses, settings } = validatePayload(raw);
    return {
      meta,
      expenseCount: expenses.length,
      settingCount: settings.length,
      valid: true,
      error: null,
    };
  } catch (err) {
    return {
      meta: null,
      expenseCount: 0,
      settingCount: 0,
      valid: false,
      error: err.message,
    };
  }
}
