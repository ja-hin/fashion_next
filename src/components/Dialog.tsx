'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

/**
 * Replaces the browser's native alert/confirm/prompt with in-app modals.
 *
 * Exposed as promise-returning functions so calling code reads the same way the
 * native ones did: `if (await confirm('Delete?')) ...`
 */

interface DialogOptions {
  title?: string;
  okLabel?: string;
  danger?: boolean;
  inputError?: string;
}

interface DialogApi {
  alert: (message: string, title?: string) => Promise<void>;
  confirm: (message: string, opts?: DialogOptions) => Promise<boolean>;
  prompt: (message: string, defaultValue?: string, opts?: DialogOptions) => Promise<string | null>;
}

const DialogContext = createContext<DialogApi | null>(null);

export function useDialog(): DialogApi {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used inside <DialogProvider>');
  return ctx;
}

interface DialogState {
  open: boolean;
  title: string;
  message: string;
  showCancel: boolean;
  showInput: boolean;
  inputValue: string;
  inputError: string;
  okLabel: string;
  danger: boolean;
}

const CLOSED: DialogState = {
  open: false,
  title: '',
  message: '',
  showCancel: false,
  showInput: false,
  inputValue: '',
  inputError: '',
  okLabel: 'OK',
  danger: false,
};

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DialogState>(CLOSED);
  const resolver = useRef<((v: string | boolean | null) => void) | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const okRef = useRef<HTMLButtonElement>(null);

  const open = useCallback((next: Omit<DialogState, 'open'>) => {
    return new Promise<string | boolean | null>((resolve) => {
      resolver.current = resolve;
      setState({ ...next, open: true });
    });
  }, []);

  const settle = useCallback((value: string | boolean | null) => {
    const r = resolver.current;
    resolver.current = null;
    setState(CLOSED);
    r?.(value);
  }, []);

  const onOk = useCallback(() => {
    settle(state.showInput ? state.inputValue : true);
  }, [settle, state.showInput, state.inputValue]);

  const onCancel = useCallback(() => settle(null), [settle]);

  // Focus the right control once the modal is up.
  useEffect(() => {
    if (!state.open) return;
    const t = setTimeout(() => {
      if (state.showInput) {
        inputRef.current?.focus();
        inputRef.current?.select();
      } else {
        okRef.current?.focus();
      }
    }, 30);
    return () => clearTimeout(t);
  }, [state.open, state.showInput]);

  // Enter confirms, Escape cancels.
  useEffect(() => {
    if (!state.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onOk();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [state.open, onOk, onCancel]);

  const api: DialogApi = {
    alert: (message, title = 'Notice') =>
      open({ ...CLOSED, title, message, okLabel: 'OK' }).then(() => undefined),

    confirm: (message, opts = {}) =>
      open({
        ...CLOSED,
        title: opts.title ?? 'Please confirm',
        message,
        showCancel: true,
        okLabel: opts.okLabel ?? 'Delete',
        danger: opts.danger ?? true,
      }).then((v) => v === true),

    prompt: (message, defaultValue = '', opts = {}) =>
      open({
        ...CLOSED,
        title: opts.title ?? 'Rename',
        message,
        showCancel: true,
        showInput: true,
        inputValue: defaultValue,
        inputError: opts.inputError ?? '',
        okLabel: opts.okLabel ?? 'Save',
      }).then((v) => (v === null ? null : String(v).trim())),
  };

  return (
    <DialogContext.Provider value={api}>
      {children}
      {state.open && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-[30px]"
          onClick={onCancel}
        >
          <div
            className="w-full max-w-[420px] rounded-2xl bg-surface p-6 shadow-pop"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={state.title}
          >
            <div className="mb-[18px] flex items-center gap-3">
              <h3 className="text-[18px] font-bold">{state.title}</h3>
              <button
                onClick={onCancel}
                aria-label="Close"
                className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-surface2 text-base"
              >
                ×
              </button>
            </div>

            {/* whitespace-pre-line keeps the multi-line cost breakdowns readable */}
            <div className="mb-4 whitespace-pre-line text-[13.5px] leading-[1.5] text-ink">
              {state.message}
            </div>

            {state.showInput && (
              <div>
                <input
                  ref={inputRef}
                  type="text"
                  value={state.inputValue}
                  onChange={(e) => setState((s) => ({ ...s, inputValue: e.target.value }))}
                  className={state.inputError ? 'border-brand shadow-[0_0_0_3px_var(--red-soft)]' : ''}
                />
                {state.inputError && (
                  <div className="mt-[10px] rounded-[9px] bg-brand-soft px-3 py-[9px] text-[12.5px] font-semibold leading-[1.4] text-brand">
                    {state.inputError}
                  </div>
                )}
              </div>
            )}

            <div className="mt-[18px] flex justify-end gap-[10px]">
              {state.showCancel && (
                <button
                  onClick={onCancel}
                  className="text-[13px] font-bold text-muted hover:text-ink"
                >
                  Cancel
                </button>
              )}
              <button
                ref={okRef}
                onClick={onOk}
                className={`inline-flex items-center gap-2 rounded-[10px] px-[22px] py-[11px] text-[13.5px] font-bold text-white ${
                  state.danger
                    ? 'bg-brand shadow-[0_6px_16px_rgba(225,29,42,.28)]'
                    : 'bg-accent shadow-[0_6px_16px_rgba(109,59,209,.32)]'
                }`}
              >
                {state.okLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}