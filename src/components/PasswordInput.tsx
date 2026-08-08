'use client';

import { useState } from 'react';
import { EyeIcon, EyeOffIcon } from './icons';

/**
 * A password field with a show/hide toggle.
 *
 * Renders the input only — every screen keeps its own label and hint markup, so
 * this drops into the sign-in card and the profile form without either having to
 * adopt the other's layout.
 *
 * Revealed state is per-field and never persisted: it resets on unmount, so a
 * password is not left visible on a screen someone walks back to.
 */
export default function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
  autoComplete,
  required,
  autoFocus,
  minLength,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  autoFocus?: boolean;
  minLength?: number;
}) {
  const [shown, setShown] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        // Padded on the right so a long password never runs under the button.
        className="pr-10"
        type={shown ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        autoFocus={autoFocus}
        minLength={minLength}
      />
      <button
        // type="button" matters: inside a form, the default would submit it.
        type="button"
        onClick={() => setShown((v) => !v)}
        aria-label={shown ? 'Hide password' : 'Show password'}
        aria-pressed={shown}
        title={shown ? 'Hide password' : 'Show password'}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-[9px] text-muted transition-colors hover:text-ink"
      >
        {shown ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}