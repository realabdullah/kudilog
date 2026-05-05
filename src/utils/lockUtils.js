/**
 * Cryptography and normalisation utilities for local app lock PIN and recovery questions.
 * Uses Web Crypto API (SubtleCrypto) for hashing.
 */

const ENCODER = new TextEncoder();

/**
 * Normalises a security question answer before hashing.
 * - toLowerCase
 * - trim
 * - collapse internal whitespace
 * - strip punctuation/special characters
 * @param {string} answer
 * @returns {string}
 */
export function normalizeSecurityAnswer(answer) {
  if (!answer) return "";
  return answer
    .toLowerCase()
    .replace(/[^\w\s\d]/g, "") // strip punctuation
    .replace(/\s+/g, " ") // collapse whitespace
    .trim();
}

/**
 * Generates a random salt (base64).
 * @param {number} length Bytes length
 * @returns {string}
 */
export function generateSalt(length = 16) {
  const buf = new Uint8Array(length);
  crypto.getRandomValues(buf);
  // Base64 encode using btoa (with array spread)
  return btoa(String.fromCharCode(...buf));
}

/**
 * PBKDF2 parameters for PIN/Answer hashing
 */
export const DEFAULT_PIN_PARAMS = {
  iterations: 100000,
  hash: "SHA-256",
  length: 32,
};

/**
 * Hashes a plaintext input (PIN or normalized answer) with a salt using PBKDF2.
 * @param {string} plaintext
 * @param {string} salt (base64)
 * @param {object} params
 * @returns {Promise<string>} Base64 encoded hash
 */
export async function hashInput(plaintext, salt, params = DEFAULT_PIN_PARAMS) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    ENCODER.encode(plaintext),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );

  const saltBuf = Uint8Array.from(atob(salt), (c) => c.charCodeAt(0));

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBuf,
      iterations: params.iterations,
      hash: params.hash,
    },
    keyMaterial,
    params.length * 8,
  );

  return btoa(String.fromCharCode(...new Uint8Array(derivedBits)));
}

/**
 * Verifies a plaintext input against a stored hash and salt.
 * @param {string} plaintext
 * @param {string} storedHash (base64)
 * @param {string} salt (base64)
 * @param {object} params
 * @returns {Promise<boolean>}
 */
export async function verifyInput(
  plaintext,
  storedHash,
  salt,
  params = DEFAULT_PIN_PARAMS,
) {
  const hash = await hashInput(plaintext, salt, params);
  return safeCompare(hash, storedHash);
}

/**
 * Constant-time string comparison (timing attack mitigation).
 * Since we compare base64 hashes, we can compare their byte representations.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function safeCompare(a, b) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Helper strictly for PIN hashing.
 */
export const hashPin = hashInput;

/**
 * Helper strictly for PIN verification.
 */
export const verifyPin = verifyInput;

/**
 * Helper strictly for Security Answer hashing.
 */
export async function hashSecurityAnswer(
  answer,
  salt,
  params = DEFAULT_PIN_PARAMS,
) {
  return hashInput(normalizeSecurityAnswer(answer), salt, params);
}

/**
 * Helper strictly for Security Answer verification.
 */
export async function verifySecurityAnswer(
  answer,
  storedHash,
  salt,
  params = DEFAULT_PIN_PARAMS,
) {
  return verifyInput(normalizeSecurityAnswer(answer), storedHash, salt, params);
}

/**
 * Validates the structure of the lock settings to prevent malformed data from bricking the app.
 * @param {object} lockSettings
 * @returns {boolean} true if structurally valid
 */
export function validateLockConfig(lockSettings) {
  if (!lockSettings || !lockSettings.enabled) return true; // Disabled is valid
  // If enabled, must have these fields
  if (
    !lockSettings.pinHash ||
    !lockSettings.pinSalt ||
    !lockSettings.pinParams
  ) {
    return false;
  }
  return true;
}
