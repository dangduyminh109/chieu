'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Pencil } from 'lucide-react';
import { Button } from './button';

const DialogContext = createContext<(() => void) | null>(null);
export function useCloseDialog() {
  return useContext(DialogContext);
}

/** Robust, mobile-first modal dialog with fixed header, scrollable body, and pinned footer. */
export function Dialog({
  title,
  description,
  trigger,
  children,
  variant = 'default',
  openOnHash,
  triggerIcon,
  triggerClassName,
}: {
  title: string;
  description?: string;
  trigger: ReactNode;
  children: ReactNode;
  variant?: 'default' | 'outline' | 'ghost';
  openOnHash?: string;
  triggerIcon?: ReactNode;
  triggerClassName?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const id = useId();

  const close = useCallback(() => {
    setIsOpen(false);
    if (openOnHash && typeof window !== 'undefined' && window.location.hash === `#${openOnHash}`) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, [openOnHash]);

  const open = useCallback(() => setIsOpen(true), []);

  // Hash-based auto-open
  useEffect(() => {
    if (!openOnHash) return;
    const checkHash = () => {
      if (window.location.hash === `#${openOnHash}`) setIsOpen(true);
    };
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, [openOnHash]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, close]);

  // Prevent background scrolling while modal is active
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  return (
    <>
      <Button
        type="button"
        variant={variant}
        aria-label={typeof trigger === 'string' ? trigger : undefined}
        className={
          triggerClassName ??
          (variant === 'outline'
            ? 'max-sm:size-9 max-sm:min-h-9 max-sm:p-0 max-sm:justify-center'
            : undefined)
        }
        onClick={open}
      >
        <span aria-hidden>
          {triggerIcon ?? (variant === 'default' ? <Plus size={16} /> : <Pencil size={16} />)}
        </span>
        <span className={variant === 'outline' && !triggerClassName ? 'hidden sm:inline' : ''}>{trigger}</span>
      </Button>

      {mounted &&
        isOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
              onClick={close}
              aria-hidden
            />

            {/* Modal Dialog Window */}
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={`${id}-title`}
              aria-describedby={description ? `${id}-description` : undefined}
              className="relative z-10 flex max-h-[90dvh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-2xl transition-all"
            >
              {/* FIXED / PINNED HEADER */}
              <div className="flex flex-none items-start justify-between gap-4 border-b border-border/60 bg-card p-4 sm:px-6 sm:py-4">
                <div className="min-w-0 flex-1">
                  <h2 id={`${id}-title`} className="text-base sm:text-lg font-bold text-foreground">
                    {title}
                  </h2>
                  {description && (
                    <p
                      id={`${id}-description`}
                      className="mt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed"
                    >
                      {description}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Đóng hộp thoại"
                  className="ml-2 flex size-10 shrink-0 items-center justify-center rounded-full bg-muted/60 text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-95"
                >
                  <X size={20} aria-hidden />
                </button>
              </div>

              {/* DIALOG BODY */}
              <DialogContext.Provider value={close}>
                <div className="flex flex-1 flex-col min-h-0 overflow-hidden [&>*:not(form):not([data-slot='card'])]:overflow-y-auto [&>*:not(form):not([data-slot='card'])]:p-4 sm:[&>*:not(form):not([data-slot='card'])]:p-6">
                  {children}
                </div>
              </DialogContext.Provider>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
