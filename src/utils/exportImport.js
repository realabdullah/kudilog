// ─── Export / Import Utilities ─────────────────────────────────────────────────
//
// Export: serialise all IndexedDB data to a structured JSON file
// Import: validate and restore / merge data from a JSON file
//
// The exported format is intentionally backend-ready:
// {
//   "meta": {
//     "appName": "kudilog",
//     "schemaVersion": 2,
//     "exportedAt": "<ISO 8601>",
//     "recordCount": { "expenses": 42, "settings": 3, "recurring": 2 }
//   },
//   "data": {
//     "expenses": [ ...Expense ],
//     "settings": [ ...Setting ],
//     "recurring": [ ...RecurringTemplate ]
//   }
// }

import { db, SCHEMA_VERSION } from "../db/db";
const typedDb = /** @type {any} */ (db);

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   amount: number,
 *   category?: string,
 *   month: string,
 *   createdAt: string,
 *   updatedAt: string,
 *   recurringId?: string,
 * }} ExportExpense
 */

/** @typedef {{ id: string, value: any }} ExportSetting */
/** @typedef {{ id: string, name: string, amount: number, category: string, frequency: "monthly", startMonth: string, enabled: boolean, lastGeneratedMonth: string | null, createdAt: string, updatedAt: string }} ExportRecurring */
/** @typedef {{ meta: { appName: string, schemaVersion: number, exportedAt: string, recordCount: { expenses: number, settings: number, recurring: number } }, data: { expenses: ExportExpense[], settings: ExportSetting[], recurring: ExportRecurring[] } }} ExportPayload */
/** @typedef {{ format: string, meta: Object | null, expenseCount: number, settingCount: number, valid: boolean, error: string | null, skippedCount: number, sampleRows: Array<{ name: string, amount: number, category?: string, month?: string, createdAt?: string }>, warnings: string[] }} ImportPreviewResult */

/** @param {unknown} error */
function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

const APP_NAME = "kudilog";
const CSV_HEADERS = ["Name", "Amount", "Category", "Month", "Created At", "ID"];

function buildFileStamp() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** @param {string} isoString */
function toISODate(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function createExpenseId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `exp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** @param {unknown} header */
function normalizeHeader(header) {
  return String(header || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** @param {unknown} value */
function escapeCSVField(value) {
  const str = value == null ? "" : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** @param {string} line */
function parseCSVLine(line) {
  const cells = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

/** @param {string[]} headers */
function detectCSVColumns(headers) {
  const normalized = headers.map(normalizeHeader);
  /** @param {string[]} aliases */
  const pick = (aliases) =>
    normalized.findIndex((/** @type {string} */ h) => aliases.includes(h));

  return {
    name: pick(["name", "expensename", "title", "item"]),
    amount: pick(["amount", "value", "price", "cost"]),
    category: pick(["category", "cat"]),
    month: pick(["month", "period"]),
    createdAt: pick(["createdat", "created", "date", "timestamp"]),
    id: pick(["id", "expenseid"]),
  };
}

/** @param {string[]} cells @param {number} index */
function readCell(cells, index) {
  if (index < 0 || index >= cells.length) return "";
  return String(cells[index] || "").trim();
}

/** @param {unknown} raw */
function normalizeMonth(raw) {
  const value = String(raw || "").trim();
  if (!value) return currentMonthKey();

  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    return value;
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
  }

  return currentMonthKey();
}

/** @param {unknown} raw */
function normalizeAmount(raw) {
  const cleaned = String(raw || "")
    .trim()
    .replace(/,/g, "")
    .replace(/[^0-9.-]/g, "");
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : null;
}

/** @param {unknown} raw */
function normalizeCreatedAt(raw) {
  const value = String(raw || "").trim();
  if (!value) return new Date().toISOString();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

/** @param {unknown} raw */
function normalizeCategory(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase();
}

/** @param {ExportExpense} expense */
function buildCSVRow(expense) {
  return [
    expense.name ?? "",
    expense.amount ?? "",
    expense.category ?? "",
    expense.month ?? "",
    toISODate(expense.createdAt),
    expense.id ?? "",
  ];
}

/** @param {string} text */
async function parseCSVExpenses(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const nonEmptyLines = lines.filter(
    (/** @type {string} */ line) => line.trim().length > 0,
  );
  if (nonEmptyLines.length === 0) {
    throw new Error("Invalid file format.");
  }

  const headers = parseCSVLine(nonEmptyLines[0]);
  const columns = detectCSVColumns(headers);

  if (columns.name < 0 || columns.amount < 0) {
    throw new Error(
      "Invalid file format: CSV must include Name and Amount columns.",
    );
  }

  const expenses = [];
  const sampleRows = [];
  const rowErrors = [];

  for (let i = 1; i < nonEmptyLines.length; i++) {
    const rowNumber = i + 1;
    const cells = parseCSVLine(nonEmptyLines[i]);

    const name = readCell(cells, columns.name);
    const rawAmount = readCell(cells, columns.amount);

    if (!name) {
      rowErrors.push({ row: rowNumber, reason: "Name is required" });
      continue;
    }

    const amount = normalizeAmount(rawAmount);
    if (amount == null) {
      rowErrors.push({ row: rowNumber, reason: "Amount must be a number" });
      continue;
    }

    const createdAt = normalizeCreatedAt(readCell(cells, columns.createdAt));
    const normalized = {
      id: readCell(cells, columns.id) || createExpenseId(),
      name,
      amount,
      category: normalizeCategory(readCell(cells, columns.category)),
      month: normalizeMonth(readCell(cells, columns.month)),
      createdAt,
      updatedAt: createdAt,
    };

    expenses.push(normalized);

    if (sampleRows.length < 5) {
      sampleRows.push({
        name: normalized.name,
        amount: normalized.amount,
        category: normalized.category,
        month: normalized.month,
        createdAt: toISODate(normalized.createdAt),
      });
    }

    if (i % 400 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  return {
    meta: {
      appName: APP_NAME,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: null,
      source: "csv",
    },
    expenses,
    settings: [],
    sampleRows,
    rowErrors,
    totalRows: Math.max(nonEmptyLines.length - 1, 0),
  };
}

/** @param {File | null | undefined} file @param {string} text */
function detectImportFormat(file, text) {
  const lowerName = String(file?.name || "").toLowerCase();
  const mime = String(file?.type || "").toLowerCase();

  if (lowerName.endsWith(".json") || mime.includes("application/json")) {
    return "json";
  }

  if (lowerName.endsWith(".csv") || mime.includes("text/csv")) {
    return "csv";
  }

  const content = String(text || "").trim();
  if (content.startsWith("{") || content.startsWith("[")) return "json";
  if (content.includes(",") && content.includes("\n")) return "csv";

  return "unknown";
}

// ─── Export ────────────────────────────────────────────────────────────────────

/**
 * Collect all data from IndexedDB and return a serialisable export object.
 *
 * @returns {Promise<ExportPayload>} The full export payload
 */
export async function buildExportPayload() {
  const [expenses, settings, recurring] = await Promise.all([
    typedDb.expenses.orderBy("createdAt").toArray(),
    typedDb.settings.toArray(),
    typedDb.recurring ? typedDb.recurring.orderBy("createdAt").toArray() : [],
  ]);

  return {
    meta: {
      appName: APP_NAME,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      recordCount: {
        expenses: expenses.length,
        settings: settings.length,
        recurring: recurring.length,
      },
    },
    data: {
      expenses,
      settings,
      recurring,
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

  const stamp = buildFileStamp();
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

/**
 * Trigger a CSV file download in the browser containing expenses only.
 *
 * @returns {Promise<{ count: number }>} Number of exported expenses
 */
export async function exportToCSV() {
  const payload = await buildExportPayload();
  const rows = [CSV_HEADERS, ...payload.data.expenses.map(buildCSVRow)];
  const csv = rows.map((row) => row.map(escapeCSVField).join(",")).join("\r\n");
  const withBom = `\uFEFF${csv}`;
  const blob = new Blob([withBom], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const stamp = buildFileStamp();
  const filename = `kudilog-export-${stamp}.csv`;

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  setTimeout(() => URL.revokeObjectURL(url), 10_000);

  return { count: payload.meta.recordCount.expenses };
}

// ─── Validation ────────────────────────────────────────────────────────────────

/**
 * Validate the top-level shape of an import payload.
 * Throws a descriptive Error if anything is wrong.
 *
 * @param {unknown} payload
 * @returns {{ expenses: ExportExpense[], settings: ExportSetting[], recurring: ExportRecurring[], meta: Object }}
 */
function validatePayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid file: expected a JSON object.");
  }

  const filePayload = /** @type {any} */ (payload);

  if (!filePayload.meta || typeof filePayload.meta !== "object") {
    throw new Error("Invalid format: missing `meta` field.");
  }

  if (filePayload.meta.appName !== APP_NAME) {
    throw new Error(
      `Unrecognised app: "${filePayload.meta.appName}". This file was not exported from KudiLog.`,
    );
  }

  const fileVersion = filePayload.meta.schemaVersion;
  if (typeof fileVersion !== "number") {
    throw new Error("Invalid format: `meta.schemaVersion` must be a number.");
  }

  if (fileVersion > SCHEMA_VERSION) {
    throw new Error(
      `This file was exported from a newer version of KudiLog (schema v${fileVersion}). ` +
        `Please update the app to import it.`,
    );
  }

  if (!filePayload.data || typeof filePayload.data !== "object") {
    throw new Error("Invalid format: missing `data` field.");
  }

  if (!Array.isArray(filePayload.data.expenses)) {
    throw new Error("Invalid format: `data.expenses` must be an array.");
  }

  // Validate individual expense records (light-touch)
  const invalidIndexes = [];
  for (let i = 0; i < filePayload.data.expenses.length; i++) {
    const e = filePayload.data.expenses[i];
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
        (invalidIndexes.length > 5 ? "…" : ""),
    );
  }

  return {
    meta: filePayload.meta,
    expenses: filePayload.data.expenses,
    settings: Array.isArray(filePayload.data.settings)
      ? filePayload.data.settings
      : [],
    recurring: Array.isArray(filePayload.data.recurring)
      ? filePayload.data.recurring
      : [],
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
        resolve(JSON.parse(String(e.target?.result || "")));
      } catch {
        reject(new Error("Could not parse file: make sure it is valid JSON."));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read the file."));
    reader.readAsText(file);
  });
}

/** @param {File} file */
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(String(e.target?.result || ""));
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
  const { meta, expenses, settings, recurring } = validatePayload(raw);

  await typedDb.transaction(
    "rw",
    typedDb.expenses,
    typedDb.settings,
    typedDb.recurring,
    async () => {
      if (mode === "replace") {
        await typedDb.expenses.clear();
        await typedDb.settings.clear();
        await typedDb.recurring.clear();
      }

      // bulkPut uses the primary key (id) so duplicate IDs are overwritten
      if (expenses.length > 0) {
        await typedDb.expenses.bulkPut(expenses);
      }

      if (settings.length > 0) {
        await typedDb.settings.bulkPut(settings);
      }

      if (recurring.length > 0) {
        await typedDb.recurring.bulkPut(recurring);
      }
    },
  );

  return { imported: expenses.length, mode, meta };
}

/**
 * Import a JSON or CSV file into IndexedDB.
 *
 * @param {File} file
 * @param {ImportMode} mode
 * @returns {Promise<{ imported: number, skipped: number, mode: ImportMode, meta: Object, format: "json"|"csv" }>}
 */
export async function importData(file, mode = "merge") {
  if (!(file instanceof File)) {
    throw new Error("Expected a File object.");
  }

  const text = await readFileAsText(file);
  const format = detectImportFormat(file, text);

  if (format === "json") {
    const result = await importFromJSON(file, mode);
    return { ...result, skipped: 0, format: "json" };
  }

  if (format === "csv") {
    const parsed = await parseCSVExpenses(text);

    await typedDb.transaction(
      "rw",
      typedDb.expenses,
      typedDb.settings,
      async () => {
        if (mode === "replace") {
          await typedDb.expenses.clear();
        }

        if (parsed.expenses.length > 0) {
          await typedDb.expenses.bulkPut(parsed.expenses);
        }
      },
    );

    return {
      imported: parsed.expenses.length,
      skipped: parsed.rowErrors.length,
      mode,
      meta: parsed.meta,
      format: "csv",
    };
  }

  throw new Error("Invalid file format.");
}

/**
 * Preview what an import would do WITHOUT writing to the database.
 * Useful for showing a confirmation dialog before committing.
 *
 * @param {File} file
 * @returns {Promise<ImportPreviewResult>}
 */
export async function previewImport(file) {
  try {
    if (!(file instanceof File)) {
      throw new Error("Expected a File object.");
    }

    const text = await readFileAsText(file);
    const format = detectImportFormat(file, text);

    if (format === "json") {
      const raw = JSON.parse(text);
      const { meta, expenses, settings } = validatePayload(raw);
      return {
        format: "json",
        meta,
        expenseCount: expenses.length,
        settingCount: settings.length,
        valid: true,
        error: null,
        skippedCount: 0,
        sampleRows: [],
        warnings: [],
      };
    }

    if (format === "csv") {
      const parsed = await parseCSVExpenses(text);
      const warnings = [];
      if (parsed.rowErrors.length > 0) {
        warnings.push("Some rows were skipped.");
        if (
          parsed.rowErrors.some(
            (row) => row.reason === "Amount must be a number",
          )
        ) {
          warnings.push("Amount must be a number.");
        }
      }

      return {
        format: "csv",
        meta: parsed.meta,
        expenseCount: parsed.expenses.length,
        settingCount: 0,
        valid: true,
        error: null,
        skippedCount: parsed.rowErrors.length,
        sampleRows: parsed.sampleRows,
        warnings,
      };
    }

    throw new Error("Invalid file format.");
  } catch (err) {
    const message =
      err instanceof SyntaxError
        ? "Could not parse file: make sure it is valid JSON or CSV."
        : getErrorMessage(err);

    return {
      format: "unknown",
      meta: null,
      expenseCount: 0,
      settingCount: 0,
      valid: false,
      error: message,
      skippedCount: 0,
      sampleRows: [],
      warnings: [],
    };
  }
}
