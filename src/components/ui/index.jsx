// ─── Shared UI Primitives ──────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react"

// ─── Modal ─────────────────────────────────────────────────────────────────────

/**
 * Accessible modal dialog with focus trap and Escape key support.
 *
 * @param {{ open: boolean, onClose: () => void, title?: string, children: React.ReactNode, size?: "sm"|"md"|"lg" }} props
 */
export function Modal({ open, onClose, title, children, size = "md" }) {
  const overlayRef = useRef(null);
  const dialogRef = useRef(null);

  // Lock body scroll while open
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  // Escape key closes modal
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Focus first focusable element when opened
  useEffect(() => {
    if (open && dialogRef.current) {
      const focusable = dialogRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length > 0) {
        setTimeout(() => focusable[0].focus(), 50);
      }
    }
  }, [open]);

  if (!open) return null;

  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      aria-modal="true"
      role="dialog"
      aria-label={title}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        className={`
          relative w-full ${sizeClasses[size]}
          bg-[#111111] border border-[#1f1f1f]
          rounded-t-2xl sm:rounded-2xl
          shadow-2xl shadow-black/60
          animate-slide-up sm:animate-scale-in
          overflow-hidden
        `}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#1f1f1f]">
            <h2 className="text-[15px] font-semibold text-white tracking-tight">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-[#666] hover:text-white hover:bg-[#1f1f1f] transition-colors"
              aria-label="Close"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M1 1l12 12M13 1L1 13"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        )}

        {/* Body */}
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Badge ─────────────────────────────────────────────────────────────────────

/**
 * Small label badge for categories, status, etc.
 *
 * @param {{ children: React.ReactNode, variant?: "default"|"muted"|"accent"|"success"|"warning"|"danger", size?: "xs"|"sm" }} props
 */
export function Badge({ children, variant = "default", size = "sm" }) {
  const variantClasses = {
    default: "bg-[#1f1f1f] text-[#a0a0a0] border border-[#2a2a2a]",
    muted: "bg-transparent text-[#7a7a7a] border border-[#222]",
    accent: "bg-[#6bbf4e]/10 text-[#6bbf4e] border border-[#6bbf4e]/20",
    success: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    warning: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    danger: "bg-red-500/10 text-red-400 border border-red-500/20",
  };

  const sizeClasses = {
    xs: "text-[10px] px-1.5 py-0.5 rounded",
    sm: "text-[11px] px-2 py-0.5 rounded-md",
  };

  return (
    <span
      className={`inline-flex items-center font-medium whitespace-nowrap ${variantClasses[variant]} ${sizeClasses[size]}`}
    >
      {children}
    </span>
  );
}

// ─── EmptyState ────────────────────────────────────────────────────────────────

/**
 * Full-area empty state placeholder with icon, title, and optional CTA.
 *
 * @param {{ icon?: string, title: string, description?: string, action?: React.ReactNode }} props
 */
export function EmptyState({ icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center select-none">
      {icon && <div className="text-4xl mb-4 opacity-40">{icon}</div>}
      <p className="text-[14px] font-medium text-[#7a7a7a] mb-1">{title}</p>
      {description && (
        <p className="text-[12px] text-[#666] max-w-xs leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ─── Toast ─────────────────────────────────────────────────────────────────────

/** Internal toast item shape */
let _toastListeners = [];
let _toastQueue = [];

function notifyListeners() {
  _toastListeners.forEach((fn) => fn([..._toastQueue]));
}

/**
 * Imperatively show a toast notification from anywhere.
 *
 * @param {{ message: string, type?: "success"|"error"|"info"|"warning", duration?: number }} options
 */
export function showToast({ message, type = "info", duration = 3000 }) {
  const id = Math.random().toString(36).slice(2);
  _toastQueue = [..._toastQueue, { id, message, type }];
  notifyListeners();

  setTimeout(() => {
    _toastQueue = _toastQueue.filter((t) => t.id !== id);
    notifyListeners();
  }, duration);
}

/**
 * Renders the global toast container. Mount once at the app root.
 */
export function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    _toastListeners.push(setToasts);
    return () => {
      _toastListeners = _toastListeners.filter((fn) => fn !== setToasts);
    };
  }, []);

  if (toasts.length === 0) return null;

  const typeClasses = {
    success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    error: "border-red-500/30 bg-red-500/10 text-red-300",
    warning: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    info: "border-[#2a2a2a] bg-[#111] text-[#ccc]",
  };

  const typeIcons = {
    success: (
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        className="shrink-0"
      >
        <path
          d="M2 7l3.5 3.5L12 3.5"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    error: (
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        className="shrink-0"
      >
        <path
          d="M1 1l12 12M13 1L1 13"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
    ),
    warning: (
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        className="shrink-0"
      >
        <path
          d="M7 2v5M7 10v1"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
    ),
    info: (
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        className="shrink-0"
      >
        <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M7 6.5V10M7 4.5v.5"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
    ),
  };

  return (
    <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-100 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
          flex items-center gap-2.5
          px-3.5 py-2.5
          rounded-xl border
          text-[13px] font-medium
          shadow-xl shadow-black/40
          backdrop-blur-md
          pointer-events-auto
          animate-slide-up
          max-w-70
          ${typeClasses[toast.type] ?? typeClasses.info}
        `}
        >
          {typeIcons[toast.type]}
          <span className="leading-tight">{toast.message}</span>
        </div>
      ))}
    </div>
  );
}

// ─── ConfirmDialog ─────────────────────────────────────────────────────────────

/**
 * A specialised modal for confirmation prompts (delete, replace, etc.).
 *
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   onConfirm: () => void,
 *   title: string,
 *   description?: string,
 *   confirmLabel?: string,
 *   confirmVariant?: "danger"|"primary",
 *   loading?: boolean,
 * }} props
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  confirmVariant = "danger",
  loading = false,
}) {
  const confirmClasses = {
    danger:
      "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20",
    primary:
      "bg-[#6bbf4e]/10 text-[#6bbf4e] border border-[#6bbf4e]/20 hover:bg-[#6bbf4e]/20",
  };

  return (
    <Modal open={open} onClose={onClose} size="sm">
      <div className="text-center">
        <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 5v4M8 11v1"
              stroke="#f87171"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
            <path
              d="M6.5 2h3L14 14H2L6.5 2z"
              stroke="#f87171"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h3 className="text-[15px] font-semibold text-white mb-2">{title}</h3>
        {description && (
          <p className="text-[13px] text-[#666] leading-relaxed mb-6">
            {description}
          </p>
        )}
        <div className="flex gap-2 mt-6">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 h-9 rounded-xl text-[13px] font-medium text-[#666] bg-[#1a1a1a] border border-[#222] hover:text-white hover:border-[#333] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 h-9 rounded-xl text-[13px] font-medium transition-colors disabled:opacity-50 ${confirmClasses[confirmVariant]}`}
          >
            {loading ? "…" : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

/**
 * Animated loading skeleton block.
 *
 * @param {{ className?: string }} props
 */
export function Skeleton({ className = "" }) {
  return <div className={`bg-[#1a1a1a] rounded animate-pulse ${className}`} />;
}

// ─── Spinner ───────────────────────────────────────────────────────────────────

/**
 * Small inline loading spinner.
 *
 * @param {{ size?: number, className?: string }} props
 */
export function Spinner({ size = 16, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      className={`animate-spin ${className}`}
    >
      <circle
        cx="8"
        cy="8"
        r="6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeOpacity="0.2"
      />
      <path
        d="M14 8a6 6 0 00-6-6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── Button ────────────────────────────────────────────────────────────────────

/**
 * Styled button with multiple variants.
 *
 * @param {{
 *   variant?: "primary"|"ghost"|"danger"|"outline",
 *   size?: "sm"|"md"|"lg",
 *   loading?: boolean,
 *   className?: string,
 *   children: React.ReactNode,
 *   [key: string]: any,
 * }} props
 */
export function Button({
  variant = "outline",
  size = "md",
  loading = false,
  className = "",
  children,
  ...rest
}) {
  const variantClasses = {
    primary: "bg-white text-black hover:bg-[#e0e0e0] font-semibold",
    ghost: "bg-transparent text-[#888] hover:text-white hover:bg-[#1a1a1a]",
    danger:
      "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20",
    outline:
      "bg-[#1a1a1a] text-[#ccc] border border-[#222] hover:border-[#333] hover:text-white",
  };

  const sizeClasses = {
    sm: "h-8 px-3 text-[12px] rounded-lg",
    md: "h-9 px-4 text-[13px] rounded-xl",
    lg: "h-11 px-5 text-[14px] rounded-xl",
  };

  return (
    <button
      disabled={loading || rest.disabled}
      className={`
        inline-flex items-center justify-center gap-2
        font-medium transition-colors
        disabled:opacity-40 disabled:cursor-not-allowed
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
      {...rest}
    >
      {loading ? <Spinner size={14} /> : null}
      {children}
    </button>
  );
}

// ─── Select ────────────────────────────────────────────────────────────────────

/**
 * Custom dropdown select component.
 *
 * @param {{
 *   value: string,
 *   onChange: (value: string) => void,
 *   options: Array<{ value: string, label: string, icon?: React.ReactNode, sub?: string }>,
 *   placeholder?: string,
 *   className?: string,
 *   label?: string,
 * }} props
 */
export function Select({ value, onChange, options, placeholder = "Select...", className = "", label }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const selectedOption = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const handler = (/** @type {MouseEvent} */ e) => {
      if (containerRef.current && !containerRef.current.contains(/** @type {Node} */ (e.target))) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-[11px] font-semibold text-[#6a6a6a] uppercase tracking-widest mb-1.5 px-1">
          {label}
        </label>
      )}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`
          w-full flex items-center justify-between gap-3 px-3.5 h-11
          bg-[#0d0d0d] light:bg-white border border-[#1a1a1a] light:border-[#ddd] rounded-xl
          hover:border-[#2a2a2a] light:hover:border-[#ccc] transition-all duration-200
          text-left
          ${open ? "ring-2 ring-[#6bbf4e]/20 border-[#6bbf4e]/40" : ""}
        `}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {selectedOption?.icon && (
            <span className="shrink-0">{selectedOption.icon}</span>
          )}
          <span className={`text-[13px] font-medium truncate flex-1 ${selectedOption ? "text-[#ddd]" : "text-[#555]"}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className={`shrink-0 text-[#444] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path d="M2.5 4.5l3.5 3.5 3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-[#111] light:bg-white border border-[#1f1f1f] light:border-[#ddd] rounded-xl shadow-2xl shadow-black/60 py-1.5 max-h-64 overflow-y-auto animate-scale-in origin-top">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`
                w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition-colors
                ${opt.value === value 
                  ? "bg-[#6bbf4e]/10" 
                  : "hover:bg-[#151515] hover:text-white transition-colors"
                }
              `}
            >
              {opt.icon && <span className="shrink-0 text-[16px]">{opt.icon}</span>}
              <span className={`text-[13px] font-medium flex-1 truncate ${opt.value === value ? "text-[#6bbf4e]" : "text-[#bcbcbc]"}`}>
                {opt.label}
              </span>
              {opt.value === value && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-[#6bbf4e] shrink-0">
                  <path d="M2 6l2.5 2.5L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── KudiIcon ─────────────────────────────────────────────────────────────────
/**
 * KudiLog book icon (standalone, no wordmark).
 * @param {{ size?: number, className?: string }} props
 */
export function KudiIcon({ size = 28, className = "" }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 140 150"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      {/* Book body */}
      <rect
        x="5"
        y="10"
        width="130"
        height="130"
        rx="12"
        ry="12"
        fill="#1a3a2a"
      />
      {/* Book spine */}
      <rect x="5" y="10" width="16" height="130" rx="7" ry="7" fill="#15301f" />
      {/* Bookmark */}
      <polygon points="72,10 96,10 96,55 84,46 72,55" fill="#6bbf4e" />
      {/* White K stem */}
      <rect x="28" y="44" width="16" height="62" rx="2" fill="white" />
      {/* Green K diagonal arms */}
      <polygon points="44,75 82,44 96,44 60,75" fill="#6bbf4e" />
      <polygon points="44,75 82,106 96,106 60,75" fill="#6bbf4e" />
      {/* Book lines */}
      <rect
        x="24"
        y="118"
        width="58"
        height="6"
        rx="3"
        fill="#3a6640"
        opacity="0.8"
      />
      <rect
        x="24"
        y="130"
        width="44"
        height="6"
        rx="3"
        fill="#3a6640"
        opacity="0.6"
      />
    </svg>
  );
}

// ─── KudiLogo ─────────────────────────────────────────────────────────────────
/**
 * KudiLog full horizontal logo (icon + wordmark + optional tagline).
 * @param {{ size?: "sm"|"md"|"lg", showTagline?: boolean, darkText?: boolean, className?: string }} props
 */
export function KudiLogo({
  size = "md",
  showTagline = false,
  darkText = false,
  className = "",
}) {
  const iconSize = size === "sm" ? 22 : size === "lg" ? 48 : 32;
  const textSize =
    size === "sm"
      ? "text-[15px]"
      : size === "lg"
        ? "text-[32px]"
        : "text-[20px]";
  const taglineSize =
    size === "sm" ? "text-[8px]" : size === "lg" ? "text-[12px]" : "text-[9px]";
  const wordmarkColor = darkText ? "text-[#1a3a2a]" : "text-white";

  return (
    <div className={`flex flex-col items-start gap-0.5 ${className}`}>
      <div className="flex items-center gap-2">
        <KudiIcon size={iconSize} />
        <span
          className={`font-bold tracking-tight leading-none ${textSize} ${wordmarkColor}`}
          style={{ fontFamily: "'Trebuchet MS', 'Segoe UI', sans-serif" }}
        >
          Kudi<span style={{ color: "#6bbf4e" }}>Log</span>
        </span>
      </div>
      {showTagline && (
        <span
          className={`${taglineSize} font-semibold tracking-[0.18em] uppercase pl-0.5`}
          style={{ color: "#6bbf4e", paddingLeft: iconSize + 8 }}
        >
          Track. Understand. Grow.
        </span>
      )}
    </div>
  );
}
