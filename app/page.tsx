import Link from 'next/link';
import { Navbar } from '@/components/navbar';

export default function Page() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute -left-32 top-12 h-72 w-72 rounded-full bg-[#00e5b0]/20 blur-[120px]" />
      <div className="pointer-events-none absolute -right-40 top-24 h-80 w-80 rounded-full bg-[#0070f3]/20 blur-[140px]" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-[#00e5b0]/10 blur-[160px]" />

      <Navbar />

      <section className="mx-auto mt-20 w-[92%] max-w-4xl pb-24 text-center">
        <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#9ed5c6]">
          IBM x UNSA Hackathon 2026
        </p>
        <h1 className="mt-6 text-5xl font-extrabold leading-tight text-white sm:text-7xl">
          Know what&apos;s{' '}
          <span className="bg-gradient-to-r from-[#00e5b0] to-[#0070f3] bg-clip-text text-transparent">
            in your product
          </span>
          .
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-[#b4c2db]">
          Scan any barcode and get an instant AI-powered safety report — allergens, FDA recalls,
          adverse events, drug interactions, and a personalized risk score.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/scan"
            className="rounded-2xl bg-[#00e5b0] px-8 py-4 text-base font-bold text-[#06130f] shadow-lg shadow-[#00e5b0]/30 hover:bg-[#1af0bf] transition"
          >
            Start a scan →
          </Link>
          <Link
            href="/register"
            className="rounded-2xl border border-white/15 bg-white/5 px-8 py-4 text-base font-semibold text-white hover:bg-white/10 transition"
          >
            Create free account
          </Link>
        </div>

        {/* Feature grid */}
        <div className="mt-20 grid gap-4 sm:grid-cols-3">
          {[
            { icon: '📷', title: 'Instant Barcode Scan', desc: 'Point your camera or enter manually. Works on food, supplements, and medications.' },
            { icon: '🧬', title: 'Personalized to You', desc: 'Set your allergies, conditions, and medications. Reports adapt to your profile.' },
            { icon: '💬', title: 'AI Chat Follow-Up', desc: 'Ask the AI anything about the report — ingredients, risks, alternatives.' },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-white/10 bg-white/5 p-6 text-left">
              <div className="text-3xl">{f.icon}</div>
              <h3 className="mt-3 text-base font-semibold text-white">{f.title}</h3>
              <p className="mt-1 text-sm text-white/60">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
