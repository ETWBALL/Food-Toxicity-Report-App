'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Navbar } from '@/components/navbar';

const PWD_RULES = [
  { test: (p: string) => p.length >= 10, label: '10+ characters' },
  { test: (p: string) => /[A-Z]/.test(p), label: 'uppercase letter' },
  { test: (p: string) => /[a-z]/.test(p), label: 'lowercase letter' },
  { test: (p: string) => /[0-9]/.test(p), label: 'digit' },
  { test: (p: string) => /[^A-Za-z0-9]/.test(p), label: 'special character' },
];

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdTouched, setPwdTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const pwdRuleResults = PWD_RULES.map((r) => ({ ...r, ok: r.test(password) }));
  const allRulesPass = pwdRuleResults.every((r) => r.ok);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIssues([]);
    setPwdTouched(true);

    if (!allRulesPass) return; // checklist already shows what's missing

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim() || undefined,
        email: email.trim(),
        password,
        confirmPassword,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(json?.error || 'Unable to sign up');
      if (Array.isArray(json?.issues)) {
        setIssues(json.issues.map((i: { message?: string }) => i.message ?? '').filter(Boolean));
      }
      return;
    }
    router.push('/profile');
    router.refresh();
  }

  return (
    <main className="pb-12">
      <Navbar />
      <section className="mx-auto mt-12 w-[92%] max-w-md rounded-3xl border border-white/10 bg-white/5 p-7 text-white shadow-lg shadow-black/20 backdrop-blur">
        <h1 className="text-2xl font-semibold">Create account</h1>
        <p className="mt-2 text-sm text-white/60">Personalized scans, reports, and chat.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4" autoComplete="on">
          <input
            type="text"
            name="name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (optional)"
            className="w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-[#00e5b0]"
          />
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
            name="new-password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setPwdTouched(true); }}
            placeholder="Password"
            required
            minLength={10}
            className="w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-[#00e5b0]"
          />
          {pwdTouched && (
            <ul className="grid grid-cols-2 gap-1 text-[11px]">
              {pwdRuleResults.map((r) => (
                <li key={r.label} className={r.ok ? 'text-[#00e5b0]' : 'text-[#ff8596]'}>
                  {r.ok ? '✓' : '✗'} {r.label}
                </li>
              ))}
            </ul>
          )}
          <input
            type="password"
            name="confirm-password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm password"
            required
            className="w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-[#00e5b0]"
          />
          {error ? <p className="text-sm text-[#ff8596]">{error}</p> : null}
          {issues.length > 0 ? (
            <ul className="list-disc pl-5 text-xs text-[#ff8596]">
              {issues.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#00e5b0] px-4 py-3 text-sm font-semibold text-[#06130f] hover:bg-[#1af0bf] disabled:opacity-70"
            onClick={() => setPwdTouched(true)}
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-5 text-sm text-white/60">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-[#00e5b0]">
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
