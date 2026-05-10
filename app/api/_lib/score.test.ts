import { describe, expect, it } from 'vitest';
import { computeScore, worstSeverity } from './score';

describe('computeScore', () => {
  const base = { allergyFlags: [], drugFlags: [], userProfileExists: true };

  it('100 → Safe when no flags', () => {
    expect(computeScore({ ...base, recallActive: false })).toEqual({
      score: 100,
      verdict: 'Safe',
      isPersonalized: true,
    });
  });

  it('Class I recall is hard-floor Unsafe even when score math would land in Safe band', () => {
    // -50 (any recall) -30 (Class I) = 20 → already Unsafe by score, but assert hard-floor wins
    const r = computeScore({ ...base, recallActive: true, recallSeverity: 'Class I' });
    expect(r.verdict).toBe('Unsafe');
    expect(r.score).toBe(20);
  });

  it('Class II recall + 1 allergen → -50-20-20 = 10 → Unsafe', () => {
    const r = computeScore({
      ...base,
      recallActive: true,
      recallSeverity: 'Class II',
      allergyFlags: ['peanuts'],
    });
    expect(r.score).toBe(10);
    expect(r.verdict).toBe('Unsafe');
  });

  it('one allergen only → 80 → Safe (boundary)', () => {
    const r = computeScore({ ...base, recallActive: false, allergyFlags: ['gluten'] });
    expect(r.score).toBe(80);
    expect(r.verdict).toBe('Safe');
  });

  it('two allergens → 60 → Caution', () => {
    const r = computeScore({ ...base, recallActive: false, allergyFlags: ['a', 'b'] });
    expect(r.score).toBe(60);
    expect(r.verdict).toBe('Caution');
  });

  it('extreme deductions clamp to 0', () => {
    const r = computeScore({
      ...base,
      recallActive: true,
      recallSeverity: 'Class I',
      allergyFlags: ['a', 'b', 'c'],
      drugFlags: ['x', 'y'],
    });
    expect(r.score).toBe(0);
  });

  it('isPersonalized=false when no user profile', () => {
    const r = computeScore({ ...base, recallActive: false, userProfileExists: false });
    expect(r.isPersonalized).toBe(false);
  });
});

describe('worstSeverity', () => {
  it('returns highest among Class I/II/III', () => {
    expect(worstSeverity(['Class III', 'Class I', 'Class II'])).toBe('Class I');
    expect(worstSeverity(['Class III', 'Class II'])).toBe('Class II');
    expect(worstSeverity([null, 'Class III'])).toBe('Class III');
  });

  it('returns null on empty/all-null input', () => {
    expect(worstSeverity([])).toBe(null);
    expect(worstSeverity([null, undefined])).toBe(null);
  });
});
