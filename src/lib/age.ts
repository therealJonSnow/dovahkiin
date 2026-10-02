/**
 * Date-of-birth and corrected-age maths. All dates are ISO "YYYY-MM-DD"
 * calendar dates, handled in UTC so time zones and DST never shift a day.
 */

export const DAYS_PER_MONTH = 30.4375; // 365.25 / 12
const MS_PER_DAY = 86_400_000;
/** Due date must be more than this many days after DOB to use corrected age. */
export const CORRECTION_THRESHOLD_DAYS = 14;
export const TREE_MONTHS = 24;

export interface CalendarDate {
  y: number;
  m: number; // 1–12
  d: number;
}

export function parseISODate(s: string | undefined | null): CalendarDate | null {
  if (!s) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return { y, m, d };
}

export function toISODate({ y, m, d }: CalendarDate): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Today's date in the user's local time zone, as ISO. */
export function todayISO(now: Date = new Date()): string {
  return toISODate({ y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() });
}

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(y: number, m: number): number {
  return [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]!;
}

function utc(c: CalendarDate): number {
  return Date.UTC(c.y, c.m - 1, c.d);
}

export function daysBetween(from: CalendarDate, to: CalendarDate): number {
  return Math.round((utc(to) - utc(from)) / MS_PER_DAY);
}

export function addDays(c: CalendarDate, days: number): CalendarDate {
  const dt = new Date(utc(c) + days * MS_PER_DAY);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

/** Adds calendar months, clamping to the end of shorter months (31 Jan + 1m = 28/29 Feb). */
export function addMonths(c: CalendarDate, months: number): CalendarDate {
  const total = c.y * 12 + (c.m - 1) + months;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return { y, m, d: Math.min(c.d, daysInMonth(y, m)) };
}

/** Whole calendar months and leftover days from `from` to `to` (to >= from). */
export function monthsAndDays(from: CalendarDate, to: CalendarDate): { months: number; days: number } {
  if (utc(to) < utc(from)) return { months: 0, days: 0 };
  let months = (to.y - from.y) * 12 + (to.m - from.m);
  if (utc(addMonths(from, months)) > utc(to)) months -= 1;
  const days = daysBetween(addMonths(from, months), to);
  return { months, days };
}

export interface BabyDates {
  dob: string;
  dueDate?: string;
}

export interface Age {
  /** Age used for the tree, in fractional weeks (corrected when applicable), clamped to >= 0. */
  ageWeeks: number;
  /** Age in whole days that `ageWeeks` is based on (may be negative before the due date). */
  effectiveDays: number;
  chronologicalDays: number;
  corrected: boolean;
  /** Weeks between DOB and due date when corrected, else 0. */
  correctionWeeks: number;
  /** The date the effective age counts from (DOB or due date). */
  from: CalendarDate;
  /** True when the baby is past the end of the tree (24 months). */
  beyondTree: boolean;
}

export function shouldCorrect(dob: CalendarDate, due: CalendarDate | null): boolean {
  return !!due && daysBetween(dob, due) > CORRECTION_THRESHOLD_DAYS;
}

/**
 * Computes the baby's age on `today`. If the due date is more than two weeks
 * after the DOB, corrected age (counted from the due date) is used until the
 * baby's actual age reaches 24 months.
 */
export function getAge(baby: BabyDates, today: string): Age | null {
  const dob = parseISODate(baby.dob);
  const now = parseISODate(today);
  if (!dob || !now) return null;
  const due = parseISODate(baby.dueDate);
  const chronologicalDays = daysBetween(dob, now);
  const beforeTwo = utc(now) < utc(addMonths(dob, TREE_MONTHS));
  const corrected = shouldCorrect(dob, due) && beforeTwo;
  const from = corrected ? due! : dob;
  const effectiveDays = daysBetween(from, now);
  const ageWeeks = Math.max(0, effectiveDays / 7);
  return {
    ageWeeks,
    effectiveDays,
    chronologicalDays,
    corrected,
    correctionWeeks: corrected ? daysBetween(dob, due!) / 7 : 0,
    from,
    beyondTree: !beforeTwo,
  };
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "7 months 2 weeks", "3 weeks", "5 days", "Newborn". */
export function formatAgeSpan(from: CalendarDate, to: CalendarDate): string {
  const totalDays = daysBetween(from, to);
  if (totalDays <= 0) return 'Newborn';
  const { months, days } = monthsAndDays(from, to);
  const weeks = Math.floor(days / 7);
  if (months === 0) {
    if (weeks === 0) return plural(days, 'day');
    return plural(weeks, 'week');
  }
  if (months >= 24) return plural(Math.floor(months / 12), 'year');
  return weeks > 0 ? `${plural(months, 'month')} ${plural(weeks, 'week')}` : plural(months, 'month');
}

/** Formats a fractional age in weeks (used by Explore mode and the window bar). */
export function formatWeeks(weeks: number): string {
  const w = Math.max(0, weeks);
  if (w < 1) return 'Newborn';
  if (w < 13) return plural(Math.floor(w), 'week');
  const months = Math.floor((w * 7) / DAYS_PER_MONTH);
  if (months >= 24) return '2 years';
  return plural(months, 'month');
}

export function weeksToMonths(weeks: number): number {
  return (weeks * 7) / DAYS_PER_MONTH;
}

/** Short window label: "0–8 weeks", "3–6 months", "8–18 months". */
export function formatWindow(minWeeks: number, maxWeeks: number): string {
  if (maxWeeks <= 12) return `${Math.round(minWeeks)}–${Math.round(maxWeeks)} weeks`;
  const lo = Math.round(weeksToMonths(minWeeks));
  const hi = Math.max(lo, Math.round(weeksToMonths(maxWeeks)));
  return lo === hi ? `around ${lo} months` : `${lo}–${hi} months`;
}

/** Long window sentence: "Usually between 3 and 6 months". */
export function formatWindowSentence(minWeeks: number, maxWeeks: number): string {
  if (maxWeeks <= 12) return `Usually between ${Math.round(minWeeks)} and ${Math.round(maxWeeks)} weeks`;
  const lo = Math.round(weeksToMonths(minWeeks));
  const hi = Math.max(lo, Math.round(weeksToMonths(maxWeeks)));
  if (lo === hi) return `Usually around ${lo} months`;
  return `Usually between ${lo} and ${hi} months`;
}
