import { useState } from "react";
import { useLockSettings, useLockMutations } from "../../hooks/useLock";
import { showToast, Modal } from "../ui/index";
import { hashPin, generateSalt, hashSecurityAnswer, DEFAULT_PIN_PARAMS } from "../../utils/lockUtils";

export function LockSettingsEditor() {
  const lockSettings = useLockSettings();
  const { updateLockSettings, disableLock } = useLockMutations();
  
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [disableConfirmOpen, setDisableConfirmOpen] = useState(false);

  if (!lockSettings) return null;

  return (
    <div className="space-y-4">
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[13px] font-medium text-[#ddd]">App Lock</div>
            <div className="text-[11px] text-[#666] mt-0.5">
              Secure the app with a PIN and recover via security questions
            </div>
          </div>
          <button
            onClick={() => {
              if (lockSettings.enabled) {
                setDisableConfirmOpen(true);
              } else {
                setSetupModalOpen(true);
              }
            }}
            className={`
              relative w-9 h-5 rounded-full transition-colors duration-200
              focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6bbf4e]
              ${lockSettings.enabled ? "bg-[#6bbf4e]" : "bg-[#2a2a2a]"}
            `}
            role="switch"
            aria-checked={lockSettings.enabled}
          >
            <span
              className={`
                absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm
                transition-transform duration-200
                ${lockSettings.enabled ? "translate-x-4" : "translate-x-0"}
              `}
            />
          </button>
        </div>

        {lockSettings.enabled && (
          <div className="mt-4 pt-4 border-t border-[#1a1a1a] space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-[12px] text-[#aaa]">Change PIN</div>
              <button
                onClick={() => setResetModalOpen(true)}
                className="h-8 px-3 rounded-lg text-[12px] font-medium bg-[#1a1a1a] border border-[#222] text-[#ccc] hover:text-white hover:border-[#333] transition-colors"
              >
                Reset PIN
              </button>
            </div>
          </div>
        )}
      </div>

      <LockSetupModal
        open={setupModalOpen}
        onClose={() => setSetupModalOpen(false)}
        onComplete={async (config) => {
          await updateLockSettings(config);
          showToast({ message: "App lock enabled", type: "success" });
          setSetupModalOpen(false);
        }}
      />

      <LockResetModal
        open={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        currentConfig={lockSettings}
        onComplete={async (config) => {
          await updateLockSettings(config);
          showToast({ message: "PIN reset successful", type: "success" });
          setResetModalOpen(false);
        }}
      />

      <LockDisableModal
        open={disableConfirmOpen}
        onClose={() => setDisableConfirmOpen(false)}
        currentConfig={lockSettings}
        onComplete={async () => {
          await disableLock();
          showToast({ message: "App lock disabled", type: "success" });
          setDisableConfirmOpen(false);
        }}
      />
    </div>
  );
}

/** @param {{ open: boolean, onClose: () => void, onComplete: (config: any) => Promise<void> }} props */
function LockSetupModal({ open, onClose, onComplete }) {
  const [step, setStep] = useState(1);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [q1, setQ1] = useState("");
  const [a1, setA1] = useState("");
  const [q2, setQ2] = useState("");
  const [a2, setA2] = useState("");
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setStep(1);
    setPin("");
    setConfirmPin("");
    setQ1("");
    setA1("");
    setQ2("");
    setA2("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleNext = () => {
    if (step === 1) {
      if (pin.length < 4) return showToast({ message: "PIN must be at least 4 digits", type: "warning" });
      if (pin !== confirmPin) return showToast({ message: "PINs do not match", type: "error" });
      setStep(2);
    } else {
      if (!q1.trim() || !a1.trim() || !q2.trim() || !a2.trim()) {
        return showToast({ message: "Please fill out all questions and answers", type: "warning" });
      }
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const pinSalt = generateSalt();
      const pinHash = await hashPin(pin, pinSalt, DEFAULT_PIN_PARAMS);
      
      const q1Salt = generateSalt();
      const a1Hash = await hashSecurityAnswer(a1, q1Salt, DEFAULT_PIN_PARAMS);
      
      const q2Salt = generateSalt();
      const a2Hash = await hashSecurityAnswer(a2, q2Salt, DEFAULT_PIN_PARAMS);

      await onComplete({
        enabled: true,
        pinHash,
        pinSalt,
        pinParams: DEFAULT_PIN_PARAMS,
        securityQuestions: [
          { question: q1.trim(), answerHash: a1Hash, salt: q1Salt },
          { question: q2.trim(), answerHash: a2Hash, salt: q2Salt }
        ]
      });
      resetForm();
    } catch (error) {
      console.error(error);
      showToast({ message: "Failed to setup app lock", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Setup App Lock" size="sm">
      <div className="space-y-4">
        {step === 1 ? (
          <>
            <p className="text-[12px] text-[#7a7a7a]">Enter a new PIN to lock the app.</p>
            <div className="space-y-3">
              <input
                type="password"
                inputMode="numeric"
                placeholder="New PIN (min 4 digits)"
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, ""))}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-[14px] text-white tracking-[0.2em] focus:outline-none focus:border-[#6bbf4e]"
              />
              <input
                type="password"
                inputMode="numeric"
                placeholder="Confirm PIN"
                value={confirmPin}
                onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-[14px] text-white tracking-[0.2em] focus:outline-none focus:border-[#6bbf4e]"
              />
            </div>
          </>
        ) : (
          <>
            <p className="text-[12px] text-[#7a7a7a]">Set up security questions to recover access if you forget your PIN.</p>
            <div className="space-y-3 pb-2 max-h-80 overflow-y-auto pr-1">
              <div className="space-y-1">
                <input
                  type="text"
                  placeholder="Security Question 1 (e.g. Dream job?)"
                  value={q1}
                  onChange={e => setQ1(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-[#6bbf4e]"
                />
                <input
                  type="password"
                  placeholder="Answer 1"
                  value={a1}
                  onChange={e => setA1(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-[#6bbf4e]"
                />
              </div>
              <div className="border-b border-[#222]"></div>
              <div className="space-y-1">
                <input
                  type="text"
                  placeholder="Security Question 2 (e.g. Favorite movie?)"
                  value={q2}
                  onChange={e => setQ2(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-[#6bbf4e]"
                />
                <input
                  type="password"
                  placeholder="Answer 2"
                  value={a2}
                  onChange={e => setA2(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-[#6bbf4e]"
                />
              </div>
            </div>
          </>
        )}

        <div className="flex gap-2 justify-end pt-2">
          {step === 2 && (
            <button onClick={() => setStep(1)} className="h-9 px-4 rounded-xl text-[12px] font-medium bg-[#1a1a1a] text-[#ccc]">Back</button>
          )}
          <button onClick={handleClose} className="h-9 px-4 rounded-xl text-[12px] font-medium bg-[#1a1a1a] text-[#ccc]">Cancel</button>
          <button onClick={handleNext} disabled={saving} className="h-9 px-4 rounded-xl text-[12px] font-medium bg-[#6bbf4e] text-[#081105]">
            {step === 1 ? "Next" : (saving ? "Saving..." : "Enable Lock")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** @param {{ open: boolean, onClose: () => void, currentConfig: any, onComplete: (config: any) => Promise<void> }} props */
function LockResetModal({ open, onClose, currentConfig, onComplete }) {
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmNew, setConfirmNew] = useState("");
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setCurrentPin("");
    setNewPin("");
    setConfirmNew("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (newPin.length < 4) return showToast({ message: "PIN must be at least 4 digits", type: "warning" });
    if (newPin !== confirmNew) return showToast({ message: "New PINs do not match", type: "error" });

    setSaving(true);
    try {
      const isValid = await hashPin(currentPin, currentConfig.pinSalt, currentConfig.pinParams) === currentConfig.pinHash;
      if (!isValid) {
        showToast({ message: "Current PIN is incorrect", type: "error" });
        setSaving(false);
        return;
      }

      const pinSalt = generateSalt();
      const pinHash = await hashPin(newPin, pinSalt, DEFAULT_PIN_PARAMS);
      
      await onComplete({
        ...currentConfig,
        pinHash,
        pinSalt,
        pinParams: DEFAULT_PIN_PARAMS,
      });
      resetForm();
    } catch (error) {
      console.error(error);
      showToast({ message: "Verification failed", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Reset PIN" size="sm">
      <div className="space-y-4">
        <p className="text-[12px] text-[#7a7a7a]">Enter your current PIN to set a new one.</p>
        <div className="space-y-3">
          <input
            type="password"
            inputMode="numeric"
            placeholder="Current PIN"
            value={currentPin}
            onChange={e => setCurrentPin(e.target.value.replace(/\D/g, ""))}
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-[14px] text-white tracking-[0.2em] focus:outline-none focus:border-[#6bbf4e]"
          />
          <div className="border-t border-[#1a1a1a] my-2" />
          <input
            type="password"
            inputMode="numeric"
            placeholder="New PIN"
            value={newPin}
            onChange={e => setNewPin(e.target.value.replace(/\D/g, ""))}
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-[14px] text-white tracking-[0.2em] focus:outline-none focus:border-[#6bbf4e]"
          />
          <input
            type="password"
            inputMode="numeric"
            placeholder="Confirm New PIN"
            value={confirmNew}
            onChange={e => setConfirmNew(e.target.value.replace(/\D/g, ""))}
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-[14px] text-white tracking-[0.2em] focus:outline-none focus:border-[#6bbf4e]"
          />
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <button onClick={handleClose} className="h-9 px-4 rounded-xl text-[12px] font-medium bg-[#1a1a1a] text-[#ccc]">Cancel</button>
          <button onClick={handleSubmit} disabled={saving || !currentPin || !newPin || !confirmNew} className="h-9 px-4 rounded-xl text-[12px] font-medium bg-[#6bbf4e] text-[#081105]">
            {saving ? "Saving..." : "Change PIN"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** @param {{ open: boolean, onClose: () => void, currentConfig: any, onComplete: () => Promise<void> }} props */
function LockDisableModal({ open, onClose, currentConfig, onComplete }) {
  const [pin, setPin] = useState("");
  const [verifying, setVerifying] = useState(false);

  const resetForm = () => setPin("");

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    setVerifying(true);
    try {
      const isValid = await hashPin(pin, currentConfig.pinSalt, currentConfig.pinParams) === currentConfig.pinHash;
      if (!isValid) {
        showToast({ message: "Incorrect PIN", type: "error" });
        setVerifying(false);
        return;
      }
      await onComplete();
      resetForm();
    } catch (error) {
      console.error(error);
      showToast({ message: "Verification failed", type: "error" });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Disable App Lock" size="sm">
      <div className="space-y-4">
        <p className="text-[12px] text-[#7a7a7a]">Enter your PIN to disable the app lock.</p>
        <input
          type="password"
          inputMode="numeric"
          placeholder="PIN"
          value={pin}
          onChange={e => setPin(e.target.value.replace(/\D/g, ""))}
          className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-[14px] text-white tracking-[0.2em] focus:outline-none focus:border-[#d9534f]"
        />
        <div className="flex gap-2 justify-end pt-2">
          <button onClick={handleClose} className="h-9 px-4 rounded-xl text-[12px] font-medium bg-[#1a1a1a] text-[#ccc]">Cancel</button>
          <button onClick={handleSubmit} disabled={verifying || !pin} className="h-9 px-4 rounded-xl text-[12px] font-medium bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors">
            {verifying ? "Verifying..." : "Disable"}
          </button>
        </div>
      </div>
    </Modal>
  );
}