// ─── Fast Input Parser ─────────────────────────────────────────────────────────
//
// Supports formats:
//   "netflix 6500"
//   "uber eats 3400.50"
//   "rent 45,000"
//   "coffee 500 food"       → name: coffee, amount: 500, category hint: food
//   "6500 netflix"          → amount first is also supported
//
// Returns null if no valid amount can be extracted.

/**
 * @typedef {Object} ParsedExpense
 * @property {string} name
 * @property {number} amount
 * @property {string} categoryHint  - may be empty string
 */

/**
 * Known category keywords for auto-detection.
 * Maps keyword → category slug.
 */
const CATEGORY_KEYWORDS = {
  // Food & Dining
  food: "food",
  lunch: "food",
  dinner: "food",
  breakfast: "food",
  snack: "food",
  coffee: "food",
  cafe: "food",
  restaurant: "food",
  pizza: "food",
  burger: "food",
  suya: "food",
  shawarma: "food",
  eat: "food",
  eating: "food",
  groceries: "food",
  grocery: "food",
  market: "food",
  supermarket: "food",

  // Transport
  uber: "transport",
  bolt: "transport",
  taxi: "transport",
  bus: "transport",
  transport: "transport",
  fuel: "transport",
  petrol: "transport",
  gas: "transport",
  fare: "transport",
  ride: "transport",
  okada: "transport",
  keke: "transport",

  // Entertainment
  netflix: "entertainment",
  spotify: "entertainment",
  hulu: "entertainment",
  cinema: "entertainment",
  movie: "entertainment",
  games: "entertainment",
  gaming: "entertainment",
  showmax: "entertainment",
  youtube: "entertainment",
  dstv: "entertainment",
  gotv: "entertainment",

  // Shopping
  shop: "shopping",
  shopping: "shopping",
  clothes: "shopping",
  shoes: "shopping",
  fashion: "shopping",
  amazon: "shopping",
  jumia: "shopping",
  konga: "shopping",

  // Health
  health: "health",
  pharmacy: "health",
  drugs: "health",
  hospital: "health",
  clinic: "health",
  doctor: "health",
  gym: "health",
  medic: "health",

  // Bills & Utilities
  bills: "bills",
  electricity: "bills",
  nepa: "bills",
  ekedc: "bills",
  ikedc: "bills",
  water: "bills",
  internet: "bills",
  wifi: "bills",
  airtime: "bills",
  data: "bills",
  phone: "bills",
  rent: "bills",
  utility: "bills",

  // Education
  school: "education",
  tuition: "education",
  books: "education",
  course: "education",
  exam: "education",
  education: "education",

  // Personal Care
  haircut: "personal",
  salon: "personal",
  barber: "personal",
  spa: "personal",
  laundry: "personal",
  personal: "personal",

  // Travel
  flight: "travel",
  hotel: "travel",
  travel: "travel",
  trip: "travel",
  airbnb: "travel",
  vacation: "travel",
};

/**
 * Strip thousand-separator commas from a numeric string.
 * "45,000" → "45000"  |  "1,234.56" → "1234.56"
 */
function normaliseNumericString(str) {
  return str.replace(/,/g, "");
}

/**
 * Attempt to parse a string token as a positive number.
 * Returns the number or null.
 */
function tryParseAmount(token) {
  const cleaned = normaliseNumericString(token);
  // Must look like a number (digits, optional decimal point)
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = parseFloat(cleaned);
  return isFinite(n) && n > 0 ? n : null;
}

/**
 * Detect a category from a list of name tokens using keyword matching.
 * Returns the first matching category slug, or empty string.
 */
function detectCategory(tokens) {
  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (CATEGORY_KEYWORDS[lower]) return CATEGORY_KEYWORDS[lower];
  }
  return "";
}

/**
 * Parse a free-form expense string into structured data.
 *
 * Strategy:
 *  1. Tokenise by whitespace.
 *  2. Find the first token that looks like a valid amount.
 *  3. Everything else (joined) becomes the name.
 *  4. Attempt category detection from name tokens.
 *
 * @param {string} raw - Raw user input, e.g. "netflix 6500" or "45000 rent"
 * @returns {ParsedExpense|null}
 */
export function parseExpenseInput(raw) {
  if (!raw || typeof raw !== "string") return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  const tokens = trimmed.split(/\s+/);
  if (tokens.length === 0) return null;

  // Find the first token that parses as a valid amount
  let amountIndex = -1;
  let amount = null;

  for (let i = 0; i < tokens.length; i++) {
    const parsed = tryParseAmount(tokens[i]);
    if (parsed !== null) {
      amountIndex = i;
      amount = parsed;
      break;
    }
  }

  if (amountIndex === -1 || amount === null) return null;

  // Name = all tokens except the amount token
  const nameTokens = tokens.filter((_, i) => i !== amountIndex);

  if (nameTokens.length === 0) return null;

  const name = nameTokens
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (!name) return null;

  const categoryHint = detectCategory(nameTokens);

  return {
    name,
    amount,
    categoryHint,
  };
}

/**
 * Validate a manually entered amount string.
 * Returns the parsed number or null.
 *
 * @param {string} value
 * @returns {number|null}
 */
export function validateAmount(value) {
  if (!value) return null;
  return tryParseAmount(String(value).trim());
}

/**
 * Format a raw input preview for display while the user is typing.
 * Returns an object showing what has been understood so far.
 *
 * @param {string} raw
 * @returns {{ name: string, amount: number|null, valid: boolean }}
 */
export function previewInput(raw) {
  const parsed = parseExpenseInput(raw);
  if (!parsed) {
    return { name: raw?.trim() || "", amount: null, valid: false };
  }
  return { name: parsed.name, amount: parsed.amount, valid: true };
}
