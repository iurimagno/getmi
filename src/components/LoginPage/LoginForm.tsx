'use client';

import { useState, useId } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion/client';
import { EmailField } from './EmailField';
import { PasswordField } from './PasswordField';
import { SubmitButton } from './SubmitButton';
import { ValidationMessage } from './ValidationMessage';
import styles from './LoginPage.module.css';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginFormProps {
  /** Chamado no submit com as credenciais válidas. */
  onSubmit: (credentials: LoginCredentials) => Promise<void>;
  /** Chamado ao clicar em "Entrar com Google". */
  onGoogleSignIn?: () => Promise<void>;
  /** Logo exibido no topo do formulário. */
  logo?: React.ReactNode;
}

type FormStatus = 'idle' | 'loading' | 'success' | 'error';

export function LoginForm({ onSubmit, onGoogleSignIn, logo }: LoginFormProps) {
  const formId = useId();
  const globalErrorId = `${formId}-global-error`;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [status, setStatus] = useState<FormStatus>('idle');

  const shouldReduce = useReducedMotion();

  function validate(): boolean {
    let valid = true;
    if (!email) {
      setEmailError('Informe seu e-mail.');
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('E-mail inválido.');
      valid = false;
    } else {
      setEmailError(null);
    }

    if (!password) {
      setPasswordError('Informe sua senha.');
      valid = false;
    } else if (password.length < 6) {
      setPasswordError('A senha deve ter pelo menos 6 caracteres.');
      valid = false;
    } else {
      setPasswordError(null);
    }

    return valid;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setGlobalError(null);

    if (!validate()) return;

    setStatus('loading');
    try {
      await onSubmit({ email, password });
      setStatus('success');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Algo deu errado. Tente novamente.';
      setGlobalError(message);
      setStatus('error');
    }
  }

  async function handleGoogleSignIn() {
    if (!onGoogleSignIn) return;
    setGlobalError(null);
    setStatus('loading');
    try {
      await onGoogleSignIn();
      setStatus('success');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Não foi possível entrar com Google.';
      setGlobalError(message);
      setStatus('error');
    }
  }

  const isLoading = status === 'loading';
  const isSuccess = status === 'success';

  const successVariants = {
    hidden: shouldReduce ? { opacity: 0 } : { opacity: 0, scale: 0.95 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.25, ease: [0, 0, 0.2, 1] },
    },
  };

  return (
    <div className={styles.formWrapper}>
      {logo && (
        <div className={styles.logoWrapper} aria-hidden="true">
          {logo}
        </div>
      )}

      <AnimatePresence mode="wait">
        {isSuccess ? (
          <motion.div
            key="success"
            className={styles.successFeedback}
            variants={successVariants}
            initial="hidden"
            animate="visible"
            role="status"
            aria-live="polite"
          >
            <SuccessIcon className={styles.successIcon} aria-hidden="true" />
            <p className={styles.successText}>Login realizado! Redirecionando…</p>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            id={formId}
            className={styles.form}
            onSubmit={handleSubmit}
            noValidate
            aria-label="Formulário de login"
            initial={false}
          >
            {/* Erro global */}
            <AnimatePresence>
              {globalError && (
                <motion.div
                  id={globalErrorId}
                  role="alert"
                  aria-live="assertive"
                  className={styles.alertError}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  {globalError}
                </motion.div>
              )}
            </AnimatePresence>

            <EmailField
              value={email}
              onChange={setEmail}
              error={emailError}
              disabled={isLoading}
            />

            <PasswordField
              value={password}
              onChange={setPassword}
              error={passwordError}
              disabled={isLoading}
            />

            <SubmitButton loading={isLoading} disabled={isLoading}>
              Entrar
            </SubmitButton>

            {onGoogleSignIn && (
              <>
                <div className={styles.divider} aria-hidden="true">
                  <span>ou</span>
                </div>
                <button
                  type="button"
                  className={styles.btnGoogle}
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  aria-label="Entrar com conta Google"
                >
                  <GoogleIcon aria-hidden="true" />
                  Entrar com Google
                </button>
              </>
            )}
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Ícones inline ──────────────────────────────────────────────────────── */

function SuccessIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width="48"
      height="48"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      focusable="false"
      {...props}
    >
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}
