'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';

type Allergy = { id: number; allergen: string; name: string | null; severity: string | null };
type Condition = { id: number; conditionName: string; name: string | null };
type Medication = { id: number; medication: string; name: string | null; dosage: string | null };

type Profile = {
  id: number;
  publicId: string;
  name: string | null;
  email: string;
  age: number | null;
  country: string | null;
};

const COMMON_ALLERGIES = ['Peanuts', 'Tree nuts', 'Milk', 'Eggs', 'Wheat / Gluten', 'Soy', 'Fish', 'Shellfish', 'Sesame'];
const COMMON_CONDITIONS = ['Diabetes (Type 2)', 'Hypertension', 'High cholesterol', 'Celiac disease', 'Lactose intolerance', 'Heart disease'];

export default function ProfilePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);

  // Form states
  const [allergyInput, setAllergyInput] = useState('');
  const [allergyAdding, setAllergyAdding] = useState(false);
  const [conditionInput, setConditionInput] = useState('');
  const [conditionAdding, setConditionAdding] = useState(false);
  const [medInput, setMedInput] = useState('');
  const [medAdding, setMedAdding] = useState(false);

  useEffect(() => {
    async function load() {
      // Fetch current user from session
      const meRes = await fetch('/api/auth/me', { credentials: 'include' });
      if (!meRes.ok) { setAuthError(true); setLoading(false); return; }
      const me = (await meRes.json()) as Profile;
      setProfile(me);

      const uid = me.publicId ?? me.id;
      const [al, co, med] = await Promise.all([
        fetch(`/api/users/${uid}/allergies`, { credentials: 'include' }).then((r) => r.json()),
        fetch(`/api/users/${uid}/conditions`, { credentials: 'include' }).then((r) => r.json()),
        fetch(`/api/users/${uid}/medications`, { credentials: 'include' }).then((r) => r.json()),
      ]);

      setAllergies(Array.isArray(al) ? al : (al.data ?? []));
      setConditions(Array.isArray(co) ? co : (co.data ?? []));
      setMedications(Array.isArray(med) ? med : (med.data ?? []));
      setLoading(false);
    }
    void load();
  }, []);

  if (authError) {
    return (
      <main className="min-h-screen pb-16">
        <Navbar />
        <div className="mx-auto mt-24 max-w-sm text-center text-white">
          <p className="text-lg font-semibold">Please sign in to view your profile.</p>
          <button
            onClick={() => router.push('/login')}
            className="mt-4 rounded-xl bg-[#00e5b0] px-6 py-3 text-sm font-semibold text-[#06130f]"
          >
            Sign in
          </button>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen pb-16">
        <Navbar />
        <div className="mx-auto mt-24 flex justify-center">
          <svg className="h-8 w-8 animate-spin text-[#00e5b0]" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="8" />
          </svg>
        </div>
      </main>
    );
  }

  const uid = profile?.publicId ?? profile?.id;

  async function addAllergy(name: string) {
    if (!name.trim() || allergyAdding) return;
    setAllergyAdding(true);
    const res = await fetch(`/api/users/${uid}/allergies`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allergen: name.trim(), name: name.trim() }),
    });
    if (res.ok) {
      const row = await res.json();
      setAllergies((p) => [row, ...p]);
    }
    setAllergyInput('');
    setAllergyAdding(false);
  }

  async function removeAllergy(id: number) {
    await fetch(`/api/users/${uid}/allergies/${id}`, { method: 'DELETE', credentials: 'include' });
    setAllergies((p) => p.filter((a) => a.id !== id));
  }

  async function addCondition(name: string) {
    if (!name.trim() || conditionAdding) return;
    setConditionAdding(true);
    const res = await fetch(`/api/users/${uid}/conditions`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conditionName: name.trim(), name: name.trim() }),
    });
    if (res.ok) {
      const row = await res.json();
      setConditions((p) => [row, ...p]);
    }
    setConditionInput('');
    setConditionAdding(false);
  }

  async function removeCondition(id: number) {
    await fetch(`/api/users/${uid}/conditions/${id}`, { method: 'DELETE', credentials: 'include' });
    setConditions((p) => p.filter((c) => c.id !== id));
  }

  async function addMedication(name: string) {
    if (!name.trim() || medAdding) return;
    setMedAdding(true);
    const res = await fetch(`/api/users/${uid}/medications`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ medicationName: name.trim(), name: name.trim() }),
    });
    if (res.ok) {
      const row = await res.json();
      setMedications((p) => [row, ...p]);
    }
    setMedInput('');
    setMedAdding(false);
  }

  async function removeMedication(id: number) {
    await fetch(`/api/users/${uid}/medications/${id}`, { method: 'DELETE', credentials: 'include' });
    setMedications((p) => p.filter((m) => m.id !== id));
  }

  return (
    <main className="relative min-h-screen overflow-hidden pb-16 text-white">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute -left-32 top-12 h-72 w-72 rounded-full bg-[#00e5b0]/12 blur-[120px]" />
      <div className="pointer-events-none absolute -right-40 top-24 h-80 w-80 rounded-full bg-[#0070f3]/12 blur-[140px]" />

      <Navbar />

      <div className="mx-auto mt-8 w-[92%] max-w-3xl space-y-6">

        {/* Header card */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-black/10">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#00e5b0]/20 text-2xl font-bold text-[#00e5b0]">
              {(profile?.name ?? profile?.email ?? '?')[0].toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold">{profile?.name ?? 'Your profile'}</h1>
              <p className="text-sm text-white/50">{profile?.email}</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-white/60">
            Add your allergies, conditions, and medications below so SafeScan can tailor every safety report to <strong className="text-white">you</strong>.
          </p>
          <button
            onClick={() => router.push('/scan')}
            className="mt-4 inline-flex rounded-xl bg-[#00e5b0] px-5 py-2.5 text-sm font-semibold text-[#06130f] hover:bg-[#1af0bf] transition"
          >
            Start scanning →
          </button>
        </div>

        {/* Allergies */}
        <Section title="Allergies & Intolerances" icon="⚠️" count={allergies.length}>
          <QuickPills options={COMMON_ALLERGIES} existing={allergies.map((a) => a.allergen)} onAdd={addAllergy} />
          <AddRow
            value={allergyInput}
            onChange={setAllergyInput}
            onAdd={() => addAllergy(allergyInput)}
            placeholder="e.g. Latex, Pollen…"
            loading={allergyAdding}
          />
          <TagList
            items={allergies.map((a) => ({ id: a.id, label: a.name ?? a.allergen }))}
            onRemove={removeAllergy}
            color="red"
          />
        </Section>

        {/* Conditions */}
        <Section title="Health Conditions" icon="🏥" count={conditions.length}>
          <QuickPills options={COMMON_CONDITIONS} existing={conditions.map((c) => c.conditionName)} onAdd={addCondition} />
          <AddRow
            value={conditionInput}
            onChange={setConditionInput}
            onAdd={() => addCondition(conditionInput)}
            placeholder="e.g. Asthma, GERD…"
            loading={conditionAdding}
          />
          <TagList
            items={conditions.map((c) => ({ id: c.id, label: c.name ?? c.conditionName }))}
            onRemove={removeCondition}
            color="blue"
          />
        </Section>

        {/* Medications */}
        <Section title="Current Medications" icon="💊" count={medications.length}>
          <AddRow
            value={medInput}
            onChange={setMedInput}
            onAdd={() => addMedication(medInput)}
            placeholder="e.g. Metformin, Lisinopril, Ibuprofen…"
            loading={medAdding}
          />
          <TagList
            items={medications.map((m) => ({ id: m.id, label: m.name ?? m.medication }))}
            onRemove={removeMedication}
            color="teal"
          />
          <p className="text-xs text-white/40 mt-1">
            SafeScan cross-references these against FDA drug interaction databases.
          </p>
        </Section>
      </div>
    </main>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({
  title, icon, count, children,
}: { title: string; icon: string; count: number; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-black/10 space-y-3">
      <div className="flex items-center gap-2">
        <span>{icon}</span>
        <h2 className="font-semibold">{title}</h2>
        {count > 0 && (
          <span className="ml-auto rounded-full bg-[#00e5b0]/20 px-2.5 py-0.5 text-xs font-semibold text-[#00e5b0]">
            {count}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function QuickPills({
  options, existing, onAdd,
}: { options: string[]; existing: string[]; onAdd: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = existing.some((e) => e?.toLowerCase() === opt.toLowerCase());
        return (
          <button
            key={opt}
            type="button"
            disabled={active}
            onClick={() => !active && onAdd(opt)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              active
                ? 'border border-[#00e5b0]/40 bg-[#00e5b0]/15 text-[#00e5b0] cursor-default'
                : 'border border-white/15 bg-white/5 text-white/70 hover:bg-white/10'
            }`}
          >
            {active ? '✓ ' : '+ '}{opt}
          </button>
        );
      })}
    </div>
  );
}

function AddRow({
  value, onChange, onAdd, placeholder, loading,
}: { value: string; onChange: (v: string) => void; onAdd: () => void; placeholder: string; loading: boolean }) {
  return (
    <div className="flex gap-2">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onAdd()}
        placeholder={placeholder}
        className="flex-1 rounded-xl border border-white/15 bg-black/30 px-4 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#00e5b0]"
      />
      <button
        type="button"
        onClick={onAdd}
        disabled={!value.trim() || loading}
        className="rounded-xl bg-[#00e5b0] px-4 py-2 text-sm font-semibold text-[#06130f] disabled:opacity-50 hover:bg-[#1af0bf] transition"
      >
        {loading ? '…' : '+ Add'}
      </button>
    </div>
  );
}

function TagList({
  items, onRemove, color,
}: { items: { id: number; label: string }[]; onRemove: (id: number) => void; color: 'red' | 'blue' | 'teal' }) {
  if (!items.length) return null;
  const cls = {
    red: 'border-[#ff8596]/30 bg-[#ff8596]/10 text-[#ff8596]',
    blue: 'border-[#6aadff]/30 bg-[#6aadff]/10 text-[#6aadff]',
    teal: 'border-[#00e5b0]/30 bg-[#00e5b0]/10 text-[#00e5b0]',
  }[color];

  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {items.map((item) => (
        <span
          key={item.id}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${cls}`}
        >
          {item.label}
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            className="hover:opacity-70 transition ml-0.5"
            aria-label={`Remove ${item.label}`}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
}
