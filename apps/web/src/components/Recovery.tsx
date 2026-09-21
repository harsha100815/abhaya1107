'use client';
import { useEffect, useState } from 'react';
import { messageViewSchema } from '@abhaya/validation';
import { api } from '../lib/api';
export function Recovery({ mode }: { mode: 'reset' | 'verify' }) {
  const [token, setToken] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setToken(new URLSearchParams(location.hash.slice(1)).get('token') ?? '');
    history.replaceState(null, '', location.pathname);
  }, []);
  return (
    <main className="public-page">
      <a className="brand" href="/">
        abhaya<span className="brand-number">1107</span>
      </a>
      <section className="card">
        <h1>{mode === 'reset' ? 'A fresh start.' : 'Confirm your email.'}</h1>
        <p>
          {mode === 'reset'
            ? 'Choose a new password. All existing sessions will end.'
            : 'Verify this email address to complete account setup.'}
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy(true);
            try {
              const result = await api.call(
                'POST',
                mode === 'reset' ? '/auth/reset-password' : '/auth/verify',
                messageViewSchema,
                { token, ...(mode === 'reset' ? { password: f.get('password') } : {}) },
              );
              setMessage(result.message);
              setToken('');
            } catch (e) {
              setMessage(e instanceof Error ? e.message : 'The link could not be used.');
            } finally {
              setBusy(false);
            }
          }}
        >
          {mode === 'reset' && (
            <label className="field">
              New password
              <input
                name="password"
                type="password"
                minLength={12}
                maxLength={72}
                required
                autoComplete="new-password"
              />
            </label>
          )}
          <button className="primary" disabled={!token || busy}>
            {busy ? 'Working…' : mode === 'reset' ? 'Reset password' : 'Verify email'}
          </button>
        </form>
        <p role="status">{message || (!token ? 'Use the link in your email to continue.' : '')}</p>
        <a className="link" href="/">
          Return to ABHAYA
        </a>
      </section>
    </main>
  );
}
