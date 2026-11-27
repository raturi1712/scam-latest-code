"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

/** Accessible modal built on the native <dialog> element (focus trap and Escape for free). */
export function Modal({ open, onClose, title, children, footer }) {
  const ref = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className="m-auto w-[min(92vw,28rem)] rounded-2xl border border-line bg-surface p-0 text-fg shadow-pop backdrop:bg-[#020617]/70 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-center justify-between gap-4 px-6 pb-2 pt-5">
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="-mr-2 inline-flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          aria-label="Close dialog"
        >
          <X className="size-4" strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
      <div className="px-6 pb-5 text-sm leading-relaxed text-muted">{children}</div>
      {footer ? <div className="flex flex-wrap justify-end gap-3 border-t border-line bg-surface-2/50 px-6 py-4">{footer}</div> : null}
    </dialog>
  );
}
