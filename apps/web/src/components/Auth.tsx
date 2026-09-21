'use client';
import { useState } from 'react';
import { z } from 'zod';
import { ShieldCheck, ArrowUpRight, HeartHandshake, Navigation } from 'lucide-react';
import {
  userViewSchema,
  messageViewSchema,
  registerSchema,
  loginSchema,
  emailSchema,
} from '@abhaya/validation';
import { api } from '../lib/api';
import { Button, Field, ActionNotice, useAction } from './common';
export function Auth({ onSuccess }: { onSuccess: () => void }) {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('register');
  const action = useAction();
  return (
    <main className="auth-shell">
      <section className="auth-story">
        <a className="brand" href="/">
          <ShieldCheck size={32} />
          <span>
            abhaya<span className="brand-number">1107</span>
          </span>
        </a>
        <div>
          <p className="eyebrow">A LITTLE REASSURANCE. EVERY DAY.</p>
          <h1>
            Your world.
            <br />A little safer.
          </h1>
          <p className="story-copy">
            For the late ride home. The new route.
            <br />
            And the people who want to know you made it.
          </p>
          <div className="orbit-art" aria-hidden="true">
            <div className="orbit-ring one" />
            <div className="orbit-ring two" />
            <div className="orbit-core">
              <ShieldCheck size={70} strokeWidth={1.2} />
            </div>
            <span className="orbit-dot a">
              <HeartHandshake size={24} />
            </span>
            <span className="orbit-dot b">
              <Navigation size={23} />
            </span>
            <div className="orbit-note">
              <span className="status-dot" /> Your people. Within reach.
            </div>
          </div>
        </div>
        <p className="small">PRIVATE BY DESIGN · BUILT AROUND YOU</p>
      </section>
      <section className="auth-form">
        <div className="form-wrap">
          <p className="eyebrow">WELCOME TO YOUR SAFETY CIRCLE</p>
          <h2>
            {mode === 'register'
              ? 'Start with peace of mind.'
              : mode === 'login'
                ? 'Good to have you back.'
                : 'Let’s get you back in.'}
          </h2>
          <p>
            {mode === 'register'
              ? 'Create your account. Bring your trusted people closer.'
              : mode === 'login'
                ? 'Sign in to your personal safety space.'
                : 'We’ll email a link if your account exists and delivery is configured.'}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              void action.run(async () => {
                if (mode === 'forgot') {
                  const result = await api.call(
                    'POST',
                    '/auth/forgot-password',
                    messageViewSchema,
                    { email: emailSchema.parse(data.get('email')) },
                  );
                  action.setMessage(result.message);
                  return;
                }
                const input =
                  mode === 'register'
                    ? registerSchema.parse({
                        name: data.get('name'),
                        email: data.get('email'),
                        password: data.get('password'),
                      })
                    : loginSchema.parse({
                        email: data.get('email'),
                        password: data.get('password'),
                      });
                await api.call('POST', `/auth/${mode}`, z.object({ user: userViewSchema }), input);
                onSuccess();
              });
            }}
          >
            {mode === 'register' && (
              <Field label="Your name">
                <input
                  name="name"
                  autoComplete="name"
                  placeholder="How should we call you?"
                  required
                  minLength={2}
                />
              </Field>
            )}
            <Field label="Email address">
              <input
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
              />
            </Field>
            {mode !== 'forgot' && (
              <Field label="Password">
                <input
                  name="password"
                  type="password"
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  placeholder={mode === 'register' ? 'At least 12 characters' : 'Your password'}
                  minLength={mode === 'register' ? 12 : 1}
                  required
                />
              </Field>
            )}
            <ActionNotice action={action} />
            <Button busy={action.busy} className="primary full" type="submit">
              {mode === 'register'
                ? 'Create my account'
                : mode === 'login'
                  ? 'Sign in'
                  : 'Send reset link'}
              <ArrowUpRight size={18} />
            </Button>
          </form>
          <div className="auth-switch">
            {mode === 'register' ? 'Already have an account?' : 'New to ABHAYA?'}{' '}
            <button
              className="link"
              onClick={() => setMode(mode === 'register' ? 'login' : 'register')}
            >
              {mode === 'register' ? 'Sign in' : 'Create an account'}
            </button>
          </div>
          {mode === 'login' && (
            <button className="link full" onClick={() => setMode('forgot')}>
              Forgot your password?
            </button>
          )}
          <p className="privacy-note">
            <ShieldCheck size={17} /> Your location is shared only when you choose.
            <br />
            ABHAYA does not automatically contact emergency services.
          </p>
        </div>
      </section>
    </main>
  );
}
