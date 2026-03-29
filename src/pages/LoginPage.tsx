'use client';

/**
 * LoginPage — página completa de login do getmi.ai.
 *
 * Composição dos componentes de LoginPage com o container animado.
 * Conecte `onSubmit` e `onGoogleSignIn` à sua camada de autenticação
 * (Firebase Auth, NextAuth, etc.).
 *
 * Exemplo de uso:
 * ```tsx
 * import { LoginPage } from '@/pages/LoginPage';
 *
 * export default function Page() {
 *   return (
 *     <LoginPage
 *       onSubmit={async ({ email, password }) => {
 *         await firebaseSignIn(email, password);
 *       }}
 *       onGoogleSignIn={async () => {
 *         await firebaseGoogleSignIn();
 *       }}
 *     />
 *   );
 * }
 * ```
 */

import { LoginContainer } from '@/components/LoginPage/LoginContainer';
import { LoginForm } from '@/components/LoginPage/LoginForm';
import type { LoginCredentials } from '@/components/LoginPage/LoginForm';

interface LoginPageProps {
  onSubmit: (credentials: LoginCredentials) => Promise<void>;
  onGoogleSignIn?: () => Promise<void>;
}

export function LoginPage({ onSubmit, onGoogleSignIn }: LoginPageProps) {
  return (
    <LoginContainer>
      <LoginForm
        onSubmit={onSubmit}
        onGoogleSignIn={onGoogleSignIn}
        logo={
          <a href="/" aria-label="getmi.ai — Página inicial">
            {/* Substitua pela tag <Image> do Next.js em produção */}
            <img
              src="/img/getmi-logo-rect6.png"
              alt="getmi.ai"
              width={140}
              height={34}
              style={{ display: 'block', height: 34, width: 'auto' }}
            />
          </a>
        }
      />
    </LoginContainer>
  );
}
