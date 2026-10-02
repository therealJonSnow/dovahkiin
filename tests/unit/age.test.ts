import { describe, expect, it } from 'vitest';
import {
  addMonths,
  formatAgeSpan,
  formatWindow,
  formatWindowSentence,
  getAge,
  monthsAndDays,
  parseISODate,
  shouldCorrect,
} from '../../src/lib/age';

const d = (s: string) => parseISODate(s)!;

describe('parseISODate', () => {
  it('accepts valid dates, including 29 Feb in leap years', () => {
    expect(parseISODate('2024-02-29')).toEqual({ y: 2024, m: 2, d: 29 });
  });
  it('rejects impossible dates', () => {
    expect(parseISODate('2025-02-29')).toBeNull();
    expect(parseISODate('2025-13-01')).toBeNull();
    expect(parseISODate('2025-1-1')).toBeNull();
    expect(parseISODate('')).toBeNull();
  });
});

describe('addMonths / monthsAndDays', () => {
  it('clamps to the end of shorter months', () => {
    expect(addMonths(d('2025-01-31'), 1)).toEqual(d('2025-02-28'));
    expect(addMonths(d('2024-01-31'), 1)).toEqual(d('2024-02-29'));
    expect(addMonths(d('2024-02-29'), 12)).toEqual(d('2025-02-28'));
  });
  it('counts whole months across year boundaries', () => {
    expect(monthsAndDays(d('2025-11-15'), d('2026-02-14'))).toEqual({ months: 2, days: 30 });
    expect(monthsAndDays(d('2025-11-15'), d('2026-02-15'))).toEqual({ months: 3, days: 0 });
  });
  it('handles a month-end birthday', () => {
    // Born 31 Jan: one month old on 28 Feb (non-leap).
    expect(monthsAndDays(d('2025-01-31'), d('2025-02-28'))).toEqual({ months: 1, days: 0 });
    expect(monthsAndDays(d('2025-01-31'), d('2025-02-27'))).toEqual({ months: 0, days: 27 });
  });
});

describe('formatAgeSpan', () => {
  it('formats days, weeks, months and weeks', () => {
    expect(formatAgeSpan(d('2026-01-01'), d('2026-01-01'))).toBe('Newborn');
    expect(formatAgeSpan(d('2026-01-01'), d('2026-01-06'))).toBe('5 days');
    expect(formatAgeSpan(d('2026-01-01'), d('2026-01-08'))).toBe('1 week');
    expect(formatAgeSpan(d('2026-01-01'), d('2026-01-22'))).toBe('3 weeks');
    expect(formatAgeSpan(d('2026-01-01'), d('2026-02-01'))).toBe('1 month');
    expect(formatAgeSpan(d('2026-02-15'), d('2026-10-02'))).toBe('7 months 2 weeks');
  });
});

describe('getAge', () => {
  it('uses chronological age when there is no due date', () => {
    const a = getAge({ dob: '2026-01-01' }, '2026-01-15')!;
    expect(a.corrected).toBe(false);
    expect(a.ageWeeks).toBe(2);
  });

  it('ignores a due date within two weeks of birth', () => {
    expect(shouldCorrect(d('2026-01-01'), d('2026-01-15'))).toBe(false);
    const a = getAge({ dob: '2026-01-01', dueDate: '2026-01-15' }, '2026-03-01')!;
    expect(a.corrected).toBe(false);
  });

  it('uses corrected age for babies born more than two weeks early', () => {
    const a = getAge({ dob: '2026-01-01', dueDate: '2026-02-12' }, '2026-04-02')!;
    expect(a.corrected).toBe(true);
    expect(a.correctionWeeks).toBe(6);
    expect(a.ageWeeks).toBeCloseTo(7, 5); // 49 days since due date
    expect(a.chronologicalDays).toBe(91);
  });

  it('clamps to zero before the due date', () => {
    const a = getAge({ dob: '2026-01-01', dueDate: '2026-03-01' }, '2026-01-20')!;
    expect(a.ageWeeks).toBe(0);
    expect(a.effectiveDays).toBeLessThan(0);
  });

  it('stops correcting at 24 months actual age', () => {
    const before = getAge({ dob: '2024-03-01', dueDate: '2024-04-12' }, '2026-02-28')!;
    expect(before.corrected).toBe(true);
    const after = getAge({ dob: '2024-03-01', dueDate: '2024-04-12' }, '2026-03-01')!;
    expect(after.corrected).toBe(false);
    expect(after.beyondTree).toBe(true);
  });

  it('handles a leap-day birthday', () => {
    const a = getAge({ dob: '2024-02-29' }, '2025-02-28')!;
    expect(a.chronologicalDays).toBe(365);
    expect(a.beyondTree).toBe(false);
  });

  it('returns null for invalid input', () => {
    expect(getAge({ dob: 'nope' }, '2026-01-01')).toBeNull();
  });
});

describe('window labels', () => {
  it('uses weeks for early windows and months later', () => {
    expect(formatWindow(0, 8)).toBe('0–8 weeks');
    expect(formatWindow(13, 26)).toBe('3–6 months');
    expect(formatWindowSentence(13, 26)).toBe('Usually between 3 and 6 months');
    expect(formatWindowSentence(4, 12)).toBe('Usually between 4 and 12 weeks');
  });
});
