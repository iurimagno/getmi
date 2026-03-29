'use client';

import { useId, useState } from 'react';
import { ValidationMessage } from './ValidationMessage';
import styles from './LoginPage.module.css';

interface PasswordFieldProps {
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  disabled?: boolean;
  autoComplete?: 'current-password' | 'new-password';
  label?: string;
}

export function PasswordField({
  value,
  onChange,
  error,
  disabled = false,
  autoComplete = 'current-password',
  label = 'Senha',
}: PasswordFieldProps) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const [visible, setVisible] = useState(false);

  return (
    <div className={styles.formGroup}>
      <label className={styles.formLabel} htmlFor={inputId}>
        {label}
      </label>
      <div className={styles.inputWrap}>
        <input
          id={inputId}
          type={visible ? 'text' : 'password'}
          className={`${styles.formControl} ${error ? styles.isInvalid : ''}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder="••••••••"
          required
          disabled={disabled}
          aria-label={label}
          aria-describedby={error ? errorId : undefined}
          aria-invalid={!!error}
          aria-errormessage={error ? errorId : undefined}
        />
        <button
          type="button"
          className={styles.toggleVisibility}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar senha' : 'Exibir senha'}
          tabIndex={0}
        >
          {visible ? (
            <EyeOffIcon aria-hidden="true" />
          ) : (
            <EyeIcon aria-hidden="true" />
          )}
        </button>
      </div>
      <ValidationMessage id={errorId} message={error ?? null} />
    </div>
  );
}

function EyeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      {...props}
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      {...props}
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
