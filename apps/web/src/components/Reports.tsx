'use client';
import { useState } from 'react';
import type { Incident, LocationPoint } from '@abhaya/types';
import { incidentViewSchema, messageViewSchema } from '@abhaya/validation';
import { api, uuid, readableTime } from '../lib/api';
import { Button, Field, Empty, useAction, ActionNotice, Badge } from './common';
export async function fileBase64(file: File): Promise<string> {
  if (file.size > 3 * 1024 * 1024) throw new Error('Choose an image smaller than 3 MB.');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('The image could not be read.'));
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.readAsDataURL(file);
  });
}
export function Reports({
  incidents,
  point,
}: {
  incidents: Incident[];
  point: LocationPoint | null;
}) {
  const action = useAction(),
    [show, setShow] = useState(false);
  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">YOUR PRIVATE RECORD</p>
          <h2>Make a note. Keep it safe.</h2>
          <p>Reports are private records. They are not police complaints.</p>
        </div>
        <Button className="primary" onClick={() => setShow((v) => !v)}>
          Create report
        </Button>
      </div>
      <ActionNotice action={action} />
      {show && (
        <section className="card">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget,
                f = new FormData(form);
              void action.run(async () => {
                const report = await api.call('POST', '/incidents', incidentViewSchema, {
                  clientRequestId: uuid(),
                  category: f.get('category'),
                  description: f.get('description'),
                  occurredAt: new Date(String(f.get('occurredAt'))).toISOString(),
                  ...(f.get('location') === 'on' && point ? { location: point } : {}),
                });
                const file = f.get('evidence');
                if (file instanceof File && file.size) {
                  try {
                    if (f.get('consent') !== 'on')
                      throw new Error('Confirm evidence privacy consent before uploading.');
                    await api.call('PUT', `/incidents/${report.id}/evidence`, messageViewSchema, {
                      mimeType: file.type,
                      base64: await fileBase64(file),
                      privacyConsent: true,
                    });
                  } catch (e) {
                    action.setMessage(
                      'Your report was saved, but the image upload failed. Open the report to retry.',
                    );
                    setShow(false);
                    throw e;
                  }
                }
                form.reset();
                setShow(false);
                action.setMessage('Private report saved.');
              });
            }}
          >
            <div className="form-grid">
              <Field label="Category">
                <select name="category">
                  {[
                    'HARASSMENT',
                    'SUSPICIOUS_ACTIVITY',
                    'ACCIDENT',
                    'UNSAFE_LOCATION',
                    'MEDICAL',
                    'OTHER',
                  ].map((c) => (
                    <option key={c} value={c}>
                      {c.replaceAll('_', ' ')}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="When did it happen?">
                <input
                  name="occurredAt"
                  type="datetime-local"
                  required
                  defaultValue={new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
                    .toISOString()
                    .slice(0, 16)}
                />
              </Field>
            </div>
            <Field label="What happened?">
              <textarea
                name="description"
                rows={4}
                minLength={10}
                maxLength={4000}
                required
                placeholder="Describe what you want to remember…"
              />
            </Field>
            <label className="check">
              <input type="checkbox" name="location" disabled={!point} />
              Attach my current location{!point ? ' (refresh location on the dashboard first)' : ''}
            </label>
            <Field label="Evidence image · optional">
              <input type="file" name="evidence" accept="image/jpeg,image/png" />
            </Field>
            <label className="check">
              <input type="checkbox" name="consent" />I understand this image will be uploaded
              privately and may contain sensitive personal information. Image metadata will be
              removed.
            </label>
            <Button className="primary" busy={action.busy}>
              Save private report
            </Button>
          </form>
        </section>
      )}
      {incidents.length ? (
        incidents.map((i) => (
          <section className="card" key={i.id}>
            <div className="row between">
              <Badge>{i.category.replaceAll('_', ' ')}</Badge>
              <span className="small">{readableTime(i.occurredAt)}</span>
            </div>
            <h3>{i.description.slice(0, 80)}</h3>
            <p className="preserve">{i.description}</p>
            {i.latitude !== null && (
              <p className="small">
                Location: {i.latitude.toFixed(5)}, {i.longitude?.toFixed(5)}
              </p>
            )}
            <div className="row wrap">
              {i.hasEvidence && (
                <a
                  className="secondary"
                  href={`/api/incidents/${i.id}/evidence`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View private image
                </a>
              )}
              <label className="secondary upload-label">
                {i.hasEvidence ? 'Replace image' : 'Attach image'}
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (
                      file &&
                      confirm(
                        'Upload this sensitive image to your private report? Embedded metadata will be removed.',
                      )
                    )
                      void action.run(async () => {
                        await api.call('PUT', `/incidents/${i.id}/evidence`, messageViewSchema, {
                          mimeType: file.type,
                          base64: await fileBase64(file),
                          privacyConsent: true,
                        });
                      });
                  }}
                />
              </label>
              <Button
                className="link danger-text"
                onClick={() => {
                  if (confirm('Permanently delete this private report and its evidence?'))
                    void action.run(async () => {
                      await api.call('DELETE', `/incidents/${i.id}`, messageViewSchema);
                    });
                }}
              >
                Delete report
              </Button>
            </div>
          </section>
        ))
      ) : (
        <Empty title="A quiet space for your records.">
          Your private reports will appear here.
        </Empty>
      )}
    </>
  );
}
