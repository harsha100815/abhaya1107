'use client';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Check, LoaderCircle, X } from 'lucide-react';
export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return (
    <div className={`notice ${error ? 'error' : ''}`} role={error ? 'alert' : 'status'}>
      {error ? <AlertCircle size={18} /> : <Check size={18} />}
      <span>{children}</span>
    </div>
  );
}
export function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-orbit">✧</span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function Button({
  children,
  busy = false,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }) {
  return (
    <button {...props} disabled={props.disabled || busy}>
      {busy && <LoaderCircle size={16} className="spin" />}
      {children}
    </button>
  );
}
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Badge({ children, alert = false }: { children: ReactNode; alert?: boolean }) {
  return <span className={`badge ${alert ? 'badge-alert' : ''}`}>{children}</span>;
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop">
      <section role="dialog" aria-modal="true" aria-label={title} className="modal">
        <div className="row between">
          <h2>{title}</h2>
          <button className="icon-btn" aria-label="Close dialog" onClick={onClose}>
            <X />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
export function useAction() {
  const client = useQueryClient();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await fn();
      await client.invalidateQueries({ queryKey: ['dashboard'] });
      await client.invalidateQueries({ queryKey: ['history'] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, message, setMessage, run };
}
export function ActionNotice({ action }: { action: ReturnType<typeof useAction> }) {
  return (
    <>
      {action.error && <Notice error>{action.error}</Notice>}
      {action.message && <Notice>{action.message}</Notice>}
    </>
  );
}
