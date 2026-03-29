'use client';

import type { ButtonHTMLAttributes } from 'react';
import styles from './LoginPage.module.css';

interface SubmitButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  children: React.ReactNode;
}

export function SubmitButton({
  loading = false,
  disabled,
  children,
  ...rest
}: SubmitButtonProps) {
  return (
    <button
      type="submit"
      className={styles.btnSubmit}
      disabled={disabled || loading}
      aria-busy={loading}
      {...rest}
    >
      {loading && (
        <span
          className={styles.spinner}
          aria-hidden="true"
          role="presentation"
        />
      )}
      <span className={styles.btnLabel}>{children}</span>
    </button>
  );
}
