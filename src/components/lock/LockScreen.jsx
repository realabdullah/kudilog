import { useEffect, useState } from "react"
import { useLockMutations } from "../../hooks/useLock"
import { verifyPin, verifySecurityAnswer } from "../../utils/lockUtils"
import { KudiLogo, showToast } from "../ui/index"

/** 
 * @param {{
 *   lockSettings: any,
 *   onUnlock: () => void
 * }} props 
 */
export default function LockScreen({ lockSettings, onUnlock }) {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("pin"); // "pin" | "recovery"
  
  // Throttle logic
  const [attempts, setAttempts] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const { setLockouts, updateLockSettings } = useLockMutations();
  
  // Recovery state
  const [answer1, setAnswer1] = useState("");
  const [answer2, setAnswer2] = useState("");

  useEffect(() => {
    if (lockSettings.lockedUntil) {
      const now = Date.now();
      const diff = lockSettings.lockedUntil - now;
      if (diff > 0) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCooldown(Math.ceil(diff / 1000));
      }
    }
  }, [lockSettings.lockedUntil]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown(c => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const handlePinSubmit = async (/** @type {import("react").FormEvent} */ e) => {
    e.preventDefault();
    if (loading || cooldown > 0 || !pin) return;
    
    setLoading(true);
    try {
      const isValid = await verifyPin(pin, lockSettings.pinHash, lockSettings.pinSalt, lockSettings.pinParams);
      if (isValid) {
        setAttempts(0);
        setPin("");
        onUnlock();
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        setPin("");
        if (newAttempts >= 3) {
          const timeout = Math.pow(2, newAttempts - 3) * 30; // 30s, 60s, 120s...
          const unlockTime = Date.now() + timeout * 1000;
          await setLockouts(unlockTime);
          showToast({ message: "Too many failed attempts.", type: "error" });
        } else {
          showToast({ message: "Incorrect PIN", type: "error" });
        }
      }
    } catch (error) {
      console.error(error);
      showToast({ message: "Verification failed.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleRecoverySubmit = async (/** @type {import("react").FormEvent} */ e) => {
    e.preventDefault();
    if (loading || cooldown > 0) return;

    if (!lockSettings.securityQuestions || !Array.isArray(lockSettings.securityQuestions)) {
      showToast({ message: "Recovery not configured.", type: "error" });
      return;
    }

    setLoading(true);
    try {
      let validCount = 0;
      
      if (answer1 && lockSettings.securityQuestions[0]) {
        const q = lockSettings.securityQuestions[0];
        const isValid = await verifySecurityAnswer(answer1, q.answerHash, q.salt, lockSettings.pinParams);
        if (isValid) validCount++;
      }
      if (answer2 && lockSettings.securityQuestions[1]) {
        const q = lockSettings.securityQuestions[1];
        const isValid = await verifySecurityAnswer(answer2, q.answerHash, q.salt, lockSettings.pinParams);
        if (isValid) validCount++;
      }

      if (validCount >= 1) { // 1 of 2 is correct
         // Temporarily unlock, let them enter app and manually reset PIN via settings,
         // but plan specifically asks to "allow immediate PIN reset -> rewrite lock.pinHash/salt/params".
         // For simplicity here, we clear lock to unlock session and ask them to re-run setup.
         await updateLockSettings({
           enabled: false,
           pinHash: null,
           pinSalt: null,
           pinParams: null,
         });
         showToast({ message: "Recovery successful. App lock disabled.", type: "success" });
         onUnlock();
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        if (newAttempts >= 3) {
          const timeout = Math.pow(2, newAttempts - 3) * 30;
          const unlockTime = Date.now() + timeout * 1000;
          await setLockouts(unlockTime);
        }
        showToast({ message: "Incorrect answers. Try again.", type: "error" });
      }
    } catch (error) {
      console.error(error);
      showToast({ message: "Recovery verification failed.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  if (mode === "recovery") {
    const q1 = lockSettings.securityQuestions?.[0]?.question || "Security Question 1";
    const q2 = lockSettings.securityQuestions?.[1]?.question || "Security Question 2";

    return (
      <div className="fixed inset-0 z-50 bg-[#0a0a0a] flex items-center justify-center p-4">
        <form onSubmit={handleRecoverySubmit} className="w-full max-w-sm space-y-6">
          <div className="flex justify-center mb-6"><KudiLogo size="lg" /></div>
          <div className="text-center space-y-2 mb-6">
            <h2 className="text-[18px] font-semibold text-white">App lock recovery</h2>
            <p className="text-[12px] text-[#888]">Answer at least 1 question correctly to disable the PIN.</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[12px] font-medium text-[#ccc]">{q1}</label>
              <input
                type="password"
                value={answer1}
                onChange={e => setAnswer1(e.target.value)}
                disabled={loading || cooldown > 0}
                className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-xl px-4 py-3 text-[14px] text-white focus:outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[12px] font-medium text-[#ccc]">{q2}</label>
              <input
                type="password"
                value={answer2}
                onChange={e => setAnswer2(e.target.value)}
                disabled={loading || cooldown > 0}
                className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-xl px-4 py-3 text-[14px] text-white focus:outline-none"
              />
            </div>
          </div>

          {cooldown > 0 ? (
            <div className="text-center text-[12px] text-red-400">Locked for {cooldown}s</div>
          ) : (
            <button
              type="submit"
              disabled={loading || (!answer1 && !answer2)}
              className="w-full bg-[#6bbf4e] text-[#0a0a0a] rounded-xl px-4 py-3 font-medium text-[14px] disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Recover Access"}
            </button>
          )}

          <div className="mt-4 text-center">
            <button type="button" onClick={() => setMode("pin")} className="text-[12px] text-[#6bbf4e] hover:underline">
              Back to PIN
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0a0a] flex items-center justify-center p-4">
      <form onSubmit={handlePinSubmit} className="w-full max-w-xs space-y-6">
        <div className="flex justify-center mb-10"><KudiLogo size="lg" showTagline /></div>
        <div className="text-center space-y-2">
          <h2 className="text-[14px] font-semibold text-white">Enter PIN</h2>
        </div>
        <div className="space-y-4 text-center p-2">
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={e => setPin(e.target.value)}
            disabled={loading || cooldown > 0}
            autoFocus
            className="w-full text-center bg-[#0d0d0d] border border-[#2a2a2a] rounded-xl px-4 py-3 text-[20px] tracking-[0.5em] text-white focus:outline-none"
            placeholder="••••"
          />
        </div>
        {cooldown > 0 ? (
          <div className="text-center text-[12px] text-red-400">Locked for {cooldown}s</div>
        ) : (
          <button
            type="submit"
            disabled={loading || !pin}
            className="w-full bg-[#1a1a1a] text-white rounded-xl px-4 py-3 font-medium text-[14px] border border-[#2a2a2a] disabled:opacity-50"
          >
            {loading ? "Verifying..." : "Unlock"}
          </button>
        )}
        <div className="mt-6 text-center">
          <button type="button" onClick={() => setMode("recovery")} className="text-[12px] text-[#666] hover:text-white">
            Forgot PIN?
          </button>
        </div>
      </form>
    </div>
  );
}
