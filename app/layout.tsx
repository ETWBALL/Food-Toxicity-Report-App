import './globals.css';

import { DM_Sans, Syne } from 'next/font/google';
import { Toaster } from 'sonner';

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-body', display: 'swap' });
const syne = Syne({ subsets: ['latin'], variable: '--font-heading', display: 'swap' });

let title = 'SafeScan';
let description = 'AI-powered product safety for food, medication, and supplements.';

export const metadata = {
  title,
  description,
  icons: {
    icon: '/icon.png',
    shortcut: '/icon.png',
    apple: '/apple-icon.png',
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
  },
  metadataBase: new URL('https://nextjs-postgres-auth.vercel.app'),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${dmSans.variable} ${syne.variable} min-h-screen bg-[#0a0e1a] text-[#eef3ff]`}
      >
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#111827',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#eef3ff',
            },
          }}
        />
      </body>
    </html>
  );
}
