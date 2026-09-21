'use client';
import { useState } from 'react';
import { Plus, Phone, Mail, Star, Pencil, Trash2 } from 'lucide-react';
import type { Contact } from '@abhaya/types';
import { contactSchema, contactViewSchema, messageViewSchema } from '@abhaya/validation';
import { api } from '../lib/api';
import { Button, Field, Badge, Empty, useAction, ActionNotice } from './common';
export function Contacts({ contacts }: { contacts: Contact[] }) {
  const [editing, setEditing] = useState<Contact | null | undefined>(undefined),
    action = useAction();
  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">YOUR INNER CIRCLE</p>
          <h2>Good people. Close by.</h2>
          <p>People you trust, ready when you need them.</p>
        </div>
        <Button className="primary" onClick={() => setEditing(null)}>
          <Plus size={18} />
          Add contact
        </Button>
      </div>
      {editing !== undefined && (
        <section className="card">
          <h3>{editing ? 'Edit contact' : 'Bring someone into your circle'}</h3>
          <form
            key={editing?.id ?? 'new'}
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void action.run(async () => {
                const input = contactSchema.parse({
                  name: f.get('name'),
                  phone: f.get('phone'),
                  ...(f.get('email') ? { email: f.get('email') } : {}),
                  isPrimary: f.get('primary') === 'on',
                  receivesAlerts: f.get('alerts') === 'on',
                  consentConfirmed: f.get('consent') === 'on',
                });
                await api.call(
                  editing ? 'PATCH' : 'POST',
                  editing ? `/contacts/${editing.id}` : '/contacts',
                  contactViewSchema,
                  input,
                );
                setEditing(undefined);
              });
            }}
          >
            <div className="form-grid">
              <Field label="Name">
                <input name="name" required defaultValue={editing?.name} />
              </Field>
              <Field label="Phone (international format)">
                <input
                  name="phone"
                  type="tel"
                  placeholder="+919876543210"
                  required
                  defaultValue={editing?.phone}
                />
              </Field>
              <Field label="Email (optional)">
                <input name="email" type="email" defaultValue={editing?.email ?? ''} />
              </Field>
            </div>
            <label className="check">
              <input name="primary" type="checkbox" defaultChecked={editing?.isPrimary} />
              Primary contact
            </label>
            <label className="check">
              <input
                name="alerts"
                type="checkbox"
                defaultChecked={editing?.receivesAlerts ?? true}
              />
              Receive my safety alerts
            </label>
            <label className="check">
              <input name="consent" type="checkbox" required />
              This person agreed to receive my safety alerts
            </label>
            <div className="row">
              <Button className="primary" busy={action.busy}>
                Save contact
              </Button>
              <button className="secondary" type="button" onClick={() => setEditing(undefined)}>
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}
      <ActionNotice action={action} />
      <div className="contact-grid">
        {contacts.map((c, i) => (
          <section className="card contact-card" key={c.id}>
            <div className="row between">
              <div className={`avatar tone-${i % 3}`}>{c.name.slice(0, 1).toUpperCase()}</div>
              {c.isPrimary && (
                <Badge>
                  <Star size={12} />
                  Primary
                </Badge>
              )}
            </div>
            <h3>{c.name}</h3>
            <p>
              <Phone size={15} />
              {c.phone}
            </p>
            {c.email && (
              <p>
                <Mail size={15} />
                {c.email}
              </p>
            )}
            <div className="row between">
              <span className="small">{c.receivesAlerts ? 'Alerts enabled' : 'Alerts paused'}</span>
              <div className="row">
                <button
                  className="icon-btn"
                  aria-label={`Edit ${c.name}`}
                  onClick={() => setEditing(c)}
                >
                  <Pencil size={17} />
                </button>
                <button
                  className="icon-btn"
                  aria-label={`Remove ${c.name}`}
                  onClick={() => {
                    if (confirm(`Remove ${c.name} from your emergency contacts?`))
                      void action.run(async () => {
                        await api.call('DELETE', `/contacts/${c.id}`, messageViewSchema);
                      });
                  }}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </div>
          </section>
        ))}
      </div>
      {!contacts.length && (
        <Empty title="Your circle starts with one person.">
          Add a friend or family member who has agreed to receive your alerts.
        </Empty>
      )}
    </>
  );
}
