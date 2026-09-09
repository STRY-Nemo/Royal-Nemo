/**
 * Friday recurrence and timezone helpers. Pure functions using Intl only.
 */

export const FRIDAY = 5;

export interface CalendarDate {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
}

export function parseDate(iso: string): CalendarDate {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`Invalid ISO date: ${iso}`);
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

export function formatDate(d: CalendarDate): string {
  const mm = String(d.month).padStart(2, '0');
  const dd = String(d.day).padStart(2, '0');
  return `${d.year}-${mm}-${dd}`;
}

/** Adds whole days to a calendar date using UTC arithmetic (no timezone effects). */
export function addDays(iso: string, days: number): string {
  const d = parseDate(iso);
  const ms = Date.UTC(d.year, d.month - 1, d.day) + days * 86_400_000;
  const out = new Date(ms);
  return formatDate({ year: out.getUTCFullYear(), month: out.getUTCMonth() + 1, day: out.getUTCDate() });
}

/** Day of week (0=Sunday..6=Saturday) of a calendar date. */
export function weekday(iso: string): number {
  const d = parseDate(iso);
  return new Date(Date.UTC(d.year, d.month - 1, d.day)).getUTCDay();
}

/**
 * Next Friday strictly after `fromDate` when `inclusive` is false, or the
 * same day when `fromDate` is already a Friday and `inclusive` is true.
 */
export function nextFriday(fromDate: string, inclusive = false): string {
  const wd = weekday(fromDate);
  let delta = (FRIDAY - wd + 7) % 7;
  if (delta === 0 && !inclusive) delta = 7;
  return addDays(fromDate, delta);
}

/** Deterministic event id for a weekly series and date. */
export function eventIdFor(seriesId: string, date: string): string {
  return `${seriesId}:${date}`;
}

export function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

interface Parts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const partsCache = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = partsCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    partsCache.set(tz, f);
  }
  return f;
}

export function zonedParts(utcMs: number, tz: string): Parts {
  const parts = formatter(tz).formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
  const hour = get('hour');
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: hour === 24 ? 0 : hour,
    minute: get('minute'),
    second: get('second'),
  };
}

/** Offset of `tz` from UTC in milliseconds at the given instant. */
export function tzOffsetMs(utcMs: number, tz: string): number {
  const p = zonedParts(utcMs, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/**
 * Converts a wall-clock date/time in a named timezone to a UTC instant.
 * Handles daylight-saving transitions by re-checking the offset once.
 */
export function zonedWallTimeToUtc(date: string, time: string, tz: string): Date {
  const d = parseDate(date);
  const [hh, mm] = time.split(':').map(Number);
  const guess = Date.UTC(d.year, d.month - 1, d.day, hh, mm, 0);
  let utc = guess - tzOffsetMs(guess, tz);
  const check = tzOffsetMs(utc, tz);
  utc = guess - check;
  return new Date(utc);
}

export function formatInZone(
  instant: Date,
  tz: string,
  opts: Intl.DateTimeFormatOptions = {},
): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: tz,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...opts,
  }).format(instant);
}

/** Short zone label like "GMT+2" or "PDT" for an instant. */
export function zoneAbbreviation(instant: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(instant);
  return parts.find((p) => p.type === 'timeZoneName')?.value ?? tz;
}

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Today's calendar date as seen in the given timezone. */
export function todayInZone(tz: string, now: Date = new Date()): string {
  const p = zonedParts(now.getTime(), tz);
  return formatDate({ year: p.year, month: p.month, day: p.day });
}

/** Common IANA zones offered in settings; any valid IANA name is also accepted. */
export const COMMON_TIME_ZONES: string[] = [
  'UTC',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Istanbul',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Bangkok',
  'Asia/Shanghai',
  'Asia/Manila',
  'Asia/Tokyo',
  'Australia/Sydney',
];
