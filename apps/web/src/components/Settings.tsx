'use client';
import type { User } from '@abhaya/types';
import { userViewSchema, messageViewSchema } from '@abhaya/validation';
import { api } from '../lib/api';
import { fileBase64 } from './Reports';
import { Button, Field, Notice, useAction, ActionNotice } from './common';
export function Settings({ user, onLogout }: { user: User; onLogout: () => void }) {
  const action = useAction();
  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">ON YOUR TERMS</p>
          <h2>Your space. Your settings.</h2>
          <p>Choose what to share, and when.</p>
        </div>
      </div>
      <ActionNotice action={action} />
      <section className="card">
        <h3>Profile & preferences</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void action.run(async () => {
              await api.call('PATCH', '/profile', userViewSchema, {
                name: f.get('name'),
                phone: f.get('phone') || null,
                theme: f.get('theme'),
                pushEnabled: f.get('push') === 'on',
                securityEmails: f.get('security') === 'on',
              });
              action.setMessage('Preferences saved.');
            });
          }}
        >
          <div className="form-grid">
            <Field label="Your name">
              <input name="name" required defaultValue={user.name} />
            </Field>
            <Field label="Phone · optional">
              <input
                name="phone"
                type="tel"
                placeholder="+919876543210"
                defaultValue={user.phone ?? ''}
              />
            </Field>
            <Field label="Appearance">
              <select name="theme" defaultValue={user.theme}>
                <option value="system">Match system</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </Field>
          </div>
          <label className="check">
            <input type="checkbox" name="push" defaultChecked={user.pushEnabled} />
            Receive push alerts on registered mobile devices
          </label>
          <label className="check">
            <input type="checkbox" name="security" defaultChecked={user.securityEmails} />
            Receive account security alerts by email
          </label>
          <Button className="primary" busy={action.busy}>
            Save preferences
          </Button>
        </form>
        <hr />
        <div className="row wrap">
          {user.hasAvatar && (
            <a className="secondary" href="/api/profile/avatar" target="_blank" rel="noreferrer">
              View profile image
            </a>
          )}
          <label className="secondary upload-label">
            Upload profile image
            <input
              type="file"
              accept="image/jpeg,image/png"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file)
                  void action.run(async () => {
                    await api.call('PUT', '/profile/avatar', messageViewSchema, {
                      mimeType: file.type,
                      base64: await fileBase64(file),
                      privacyConsent: true,
                    });
                  });
              }}
            />
          </label>
          {user.hasAvatar && (
            <Button
              className="link"
              onClick={() =>
                void action.run(async () => {
                  await api.call('DELETE', '/profile/avatar', messageViewSchema);
                })
              }
            >
              Remove image
            </Button>
          )}
        </div>
        <p className="small">Images are stored privately; embedded metadata is removed.</p>
      </section>
      <section className="card">
        <h3>Account verification</h3>
        <p>
          {user.email} · {user.emailVerifiedAt ? 'Verified' : 'Not verified'}
        </p>
        {!user.emailVerifiedAt && (
          <Button
            className="secondary"
            busy={action.busy}
            onClick={() =>
              void action.run(async () => {
                action.setMessage(
                  (await api.call('POST', '/auth/verification', messageViewSchema, {})).message,
                );
              })
            }
          >
            Send verification email
          </Button>
        )}
        <p className="small">
          A profile phone number is not verified and is not used to prove contact identity.
        </p>
      </section>
      <section className="card">
        <h3>Location & privacy</h3>
        <p>
          Location is collected only for an active SOS or journey when you enable sharing. Browser
          tracking stops when this page closes. Old tracking points are automatically removed after
          the configured retention period (7 days by default).
        </p>
        <Notice>
          Trusted sharing links expire and stop working when sharing ends. Private incident
          locations stay with their report until you delete it.
        </Notice>
        <Button
          className="secondary"
          onClick={() => {
            if (confirm('Delete stored SOS and journey coordinates and stop all location sharing?'))
              void action.run(async () => {
                action.setMessage(
                  (await api.call('DELETE', '/location', messageViewSchema)).message,
                );
              });
          }}
        >
          Delete location history & stop sharing
        </Button>
      </section>
      <section className="card">
        <h3>Account management</h3>
        <Button
          className="secondary"
          onClick={() =>
            void action.run(async () => {
              await api.call('POST', '/auth/logout', messageViewSchema, {});
              onLogout();
            })
          }
        >
          Sign out
        </Button>
        <details className="delete-area">
          <summary>Delete my account</summary>
          <p>
            This permanently removes your profile, contacts, sessions, history and evidence. Alerts
            already sent cannot be recalled.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void action.run(async () => {
                await api.call('DELETE', '/profile', messageViewSchema, {
                  password: f.get('password'),
                  confirmation: f.get('confirmation'),
                });
                onLogout();
              });
            }}
          >
            <Field label="Your password">
              <input type="password" name="password" autoComplete="current-password" required />
            </Field>
            <Field label="Type DELETE to confirm">
              <input name="confirmation" pattern="DELETE" required />
            </Field>
            <Button className="danger" busy={action.busy}>
              Permanently delete account
            </Button>
          </form>
        </details>
      </section>
    </>
  );
}
