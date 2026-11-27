"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";

const ToastContext = createContext(null);

/* Toasts sit above both themes, so they use one fixed dark style that reads on light and dark pages. */
const TONES = {
  success: { icon: CircleCheck, color: "#4ade80" },
  error: { icon: CircleAlert, color: "#f87171" },
  info: { icon: Info, color: "#60a5fa" },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const counter = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (type, message) => {
      counter.current += 1;
      const id = counter.current;
      setToasts((list) => [...list.slice(-2), { id, type, message }]);
      setTimeout(() => dismiss(id), type === "error" ? 7000 : 4500);
    },
    [dismiss],
  );

  const api = useMemo(
    () => ({
      success: (message) => push("success", message),
      error: (message) => push("error", message),
      info: (message) => push("info", message),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="no-print pointer-events-none fixed inset-x-4 bottom-4 z-[70] flex flex-col items-end gap-2.5 sm:left-auto sm:w-96"
        aria-live="polite"
        role="status"
      >
        {toasts.map((toast) => {
          const tone = TONES[toast.type];
          const Icon = tone.icon;
          return (
            <div
              key={toast.id}
              className="fade-up pointer-events-auto flex w-full items-start gap-3 rounded-xl border border-white/10 bg-[#0f172a] px-4 py-3 text-white shadow-[0_16px_40px_-12px_rgb(0_0_0/0.5)]"
            >
              <Icon className="mt-0.5 size-5 shrink-0" style={{ color: tone.color }} strokeWidth={2} aria-hidden="true" />
              <p className="min-w-0 flex-1 text-sm font-medium leading-snug">{toast.message}</p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="-mr-1 rounded-md p-0.5 text-white/60 transition-colors hover:text-white"
                aria-label="Dismiss notification"
              >
                <X className="size-4" strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside <ToastProvider>");
  return context;
}
