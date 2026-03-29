'use client';

import { useId } from 'react';
import { ValidationMessage } from './ValidationMessage';
import styles from './LoginPage.module.css';

interface EmailFieldProps {
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  disabled?: boolean;
}

export function EmailField({
  value,
  onChange,
  error,
  disabled = false,
}: EmailFieldProps) {
  const inputId = useId();
  const errorId = `${inputId}-error`;

  return (
    <div className={styles.formGroup}>
      <label className={styles.formLabel} htmlFor={inputId}>
        E-mail
      </label>
      <input
        id={inputId}
        type="email"
        className={`${styles.formControl} ${error ? styles.isInvalid : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="email"
        placeholder="seu@email.com"
        required
        disabled={disabled}
        aria-label="E-mail"
        aria-describedby={error ? errorId : undefined}
        aria-invalid={!!error}
        aria-errormessage={error ? errorId : undefined}
      />
      <ValidationMessage id={errorId} message={error ?? null} />
    </div>
  );
}
