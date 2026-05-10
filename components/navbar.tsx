'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export function Navbar() {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then((r) => setSignedIn(r.ok))
      .catch(() => setSignedIn(false));
  }, []);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setSignedIn(false);
    router.push('/');
    router.refresh();
  }

  return (
    <header className="sticky top-4 z-50 mx-auto w-[92%] max-w-5xl rounded-full border border-white/10 bg-background/80 px-5 py-3 shadow-lg shadow-black/20 backdrop-blur-md">
      <div className="flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3 text-sm font-semibold tracking-wide text-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
            <Image src="/logo.png" alt="SafeScan logo" width={26} height={26} className="rounded-full" />
          </span>
          <span className="text-base font-semibold">
            <span className="bg-gradient-to-r from-[#00e5b0] to-[#0070f3] bg-clip-text text-transparent">Safe</span>
            <span className="text-white/80">Scan</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm text-[#c5d2ea] sm:gap-2">
          <Link href="/scan" className="rounded-full px-3 py-2 hover:bg-white/10 hover:text-white sm:px-4">
            Scan
          </Link>

          {signedIn === true && (
            <>
              <Link href="/profile" aria-label="Profile" className="hidden rounded-full p-2 hover:bg-white/10 hover:text-white sm:inline-flex sm:items-center sm:justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                </svg>
              </Link>
              <button
                onClick={handleLogout}
                className="hidden rounded-full px-3 py-2 text-white/60 hover:bg-white/10 hover:text-white sm:inline-block sm:px-4"
              >
                Sign out
              </button>
            </>
          )}

          {signedIn === false && (
            <>
              <Link href="/login" className="hidden rounded-full px-3 py-2 hover:bg-white/10 hover:text-white sm:inline-block sm:px-4">
                Sign in
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-[#00e5b0] px-4 py-2 font-semibold text-[#06130f] hover:bg-[#1af0bf] sm:px-5"
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
