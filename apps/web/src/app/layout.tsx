import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'ABHAYA 1107 · Your space to feel safe',
  description: 'Personal safety, trusted contacts and mindful journeys.',
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
