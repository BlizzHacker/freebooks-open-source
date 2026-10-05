import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthInsiderCard } from './_components';
import { AuthInsider } from './AuthInsider';
import { setAuthLoginCookies } from '@/hooks/query/authentication/queries';
import './Login.scss';

export function Login() {
  const [mode, setMode] = useState<'loading' | 'password' | 'sso'>('loading');
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const complete = (data: any) => {
      if (
        !data.access_token ||
        !data.tenant_id ||
        !data.user_id ||
        !data.organization_id
      ) {
        throw new Error('The server returned an incomplete sign-in response.');
      }
      if (active) {
        setAuthLoginCookies(data);
        window.location.replace('/');
      }
    };
    fetch('/api/auth/meta', { credentials: 'same-origin' })
      .then(async (response) => {
        if (!response.ok)
          throw new Error('The server could not load sign-in settings.');
        const meta = await response.json();
        if (!active) return;
        if (!meta.sso_enabled) {
          setMode('password');
          return;
        }
        setMode('sso');
        const sso = await fetch('/api/auth/sso', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        });
        if (!sso.ok)
          throw new Error(
            'Protected sign-in could not complete. Check the identity provider or retry.',
          );
        complete(await sso.json());
      })
      .catch((failure) => {
        if (active) setError(failure.message || 'Sign-in could not load.');
      });
    return () => {
      active = false;
    };
  }, []);

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (!response.ok)
        throw new Error('Sign-in failed. Check your email and password.');
      const data = await response.json();
      if (!data.access_token || !data.organization_id)
        throw new Error('Incomplete sign-in response.');
      setAuthLoginCookies(data);
      setPassword('');
      window.location.replace('/');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Please retry.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthInsider>
      <AuthInsiderCard>
        <div className="freebooks-login">
          <span className="freebooks-login__eyebrow">
            Your books. Your server.
          </span>
          <h2>
            {mode === 'password' ? 'Welcome to FreeBooks' : 'Secure sign-in'}
          </h2>
          {mode === 'password' ? (
            <form onSubmit={signIn}>
              <label htmlFor="freebooks-login-email">Email address</label>
              <input
                id="freebooks-login-email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.currentTarget.value)}
              />
              <label htmlFor="freebooks-login-password">Password</label>
              <input
                id="freebooks-login-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.currentTarget.value)}
              />
              <button disabled={busy} type="submit">
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
              <Link to="/auth/send_reset_password">Forgot your password?</Link>
            </form>
          ) : (
            <p>
              {error
                ? 'Your protected session could not complete.'
                : 'Completing your protected session…'}
            </p>
          )}
          {error && (
            <p role="alert" className="freebooks-login__error">
              {error}
            </p>
          )}
          {error && mode !== 'password' && (
            <button type="button" onClick={() => window.location.reload()}>
              Retry sign-in
            </button>
          )}
          <p className="freebooks-login__help">
            For a new self-hosted installation, create your first account with
            the setup tool.
          </p>
        </div>
      </AuthInsiderCard>
    </AuthInsider>
  );
}
