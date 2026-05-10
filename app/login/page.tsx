'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Navbar } from '@/components/navbar';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password }),
    });
    const json = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(json?.error || 'Unable to sign in');
      return;
    }
    router.push('/profile');
    router.refresh();
  }

  return (
    <main className="pb-12">
      <Navbar />
      <section className="mx-auto mt-12 w-[92%] max-w-md rounded-3xl border border-white/10 bg-white/5 p-7 text-white shadow-lg shadow-black/20 backdrop-blur">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-white/60">Welcome back to SafeScan.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4" autoComplete="on">
          <input
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            className="w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-[#00e5b0]"
          />
          <input
            type="password"
            name="current-password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            className="w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-[#00e5b0]"
          />
          {error ? <p className="text-sm text-[#ff8596]">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#00e5b0] px-4 py-3 text-sm font-semibold text-[#06130f] hover:bg-[#1af0bf] disabled:opacity-70"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-5 text-sm text-white/60">
          Need an account?{' '}
          <Link href="/register" className="font-medium text-[#00e5b0]">
            Sign up
          </Link>
        </p>
      </section>
    </main>
  );
}
