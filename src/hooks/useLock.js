import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";

const typedDb = /** @type {any} */ (db);

export function useLockSettings() {
  const settings = useLiveQuery(async () => {
    const keys = [
      "lock.enabled",
      "lock.pinHash",
      "lock.pinSalt",
      "lock.pinParams",
      "lock.securityQuestions",
      "lock.sessionTimeoutMinutes",
      "lock.lockedUntil",
    ];

    // Fetch all keys in a batch
    const results = await typedDb.settings.bulkGet(keys);

    return {
      enabled: results[0]?.value ?? false,
      pinHash: results[1]?.value ?? null,
      pinSalt: results[2]?.value ?? null,
      pinParams: results[3]?.value ?? null,
      securityQuestions: results[4]?.value ?? null,
      sessionTimeoutMinutes: results[5]?.value ?? 5,
      lockedUntil: results[6]?.value ?? null,
    };
  });

  return settings;
}

export function useLockMutations() {
  const setLockouts = async (lockedUntil) => {
    return typedDb.settings.put({ id: "lock.lockedUntil", value: lockedUntil });
  };

  const updateLockSettings = async (settingsObject) => {
    return typedDb.transaction("rw", typedDb.settings, async () => {
      for (const [key, value] of Object.entries(settingsObject)) {
        await typedDb.settings.put({ id: `lock.${key}`, value });
      }
    });
  };

  const disableLock = async () => {
    return typedDb.transaction("rw", typedDb.settings, async () => {
      await typedDb.settings.put({ id: "lock.enabled", value: false });
      // Keep other parameters so they can be re-enabled without full setup if needed,
      // or optionally clear them. The plan says "rewriting pinHash" on reset,
      // but doesn't explicitly say whether to clear them on disable.
      // Clearing them is safer.
      await typedDb.settings.put({ id: "lock.pinHash", value: null });
      await typedDb.settings.put({ id: "lock.pinSalt", value: null });
      await typedDb.settings.put({ id: "lock.pinParams", value: null });
      await typedDb.settings.put({ id: "lock.securityQuestions", value: null });
    });
  };

  return {
    setLockouts,
    updateLockSettings,
    disableLock,
  };
}
